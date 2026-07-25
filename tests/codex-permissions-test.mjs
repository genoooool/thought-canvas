import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CodexAppServerClient } from '../codex-app-server.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fake = path.join(root, 'tests', 'fake-codex.sh');

async function createClient(mode, readOnlyProfile = 'allowed', permissionsField = 'supported') {
  const dir = await mkdtemp(path.join(os.tmpdir(), `thought-canvas-codex-permissions-${mode}-`));
  const stateFile = path.join(dir, 'state.json');
  await writeFile(stateFile, `${JSON.stringify({
    loggedIn: true,
    account: { type: 'chatgpt', email: 'permissions@example.com', planType: 'plus' },
    requests: []
  }, null, 2)}\n`, { mode: 0o600 });
  const client = new CodexAppServerClient({
    command: fake,
    cwd: root,
    version: '1.2.6',
    env: {
      ...process.env,
      FAKE_CODEX_STATE_FILE: stateFile,
      FAKE_CODEX_PROTOCOL_MODE: mode,
      FAKE_CODEX_READ_ONLY_PROFILE: readOnlyProfile,
      FAKE_CODEX_PERMISSIONS_FIELD: permissionsField,
      FAKE_CODEX_TURN_DELAY: '5'
    }
  });
  return { client, dir, stateFile };
}

async function readState(stateFile) {
  return JSON.parse(await readFile(stateFile, 'utf8'));
}

async function withClient(mode, callback, readOnlyProfile = 'allowed', permissionsField = 'supported') {
  const fixture = await createClient(mode, readOnlyProfile, permissionsField);
  try {
    await callback(fixture);
  } finally {
    await fixture.client.close().catch(() => {});
    await rm(fixture.dir, { recursive: true, force: true });
  }
}

await withClient('modern', async ({ client, stateFile }) => {
  const deltas = [];
  const result = await client.generate({
    model: 'gpt-5.6-codex',
    effort: 'high',
    prompt: 'Verify named permission-profile generation.',
    onDelta: value => deltas.push(value)
  });
  assert.match(result.text, /Codex App Server reply/);
  assert.equal(result.permissionMode, 'permissionProfile');
  assert.ok(deltas.length > 0);

  const state = await readState(stateFile);
  assert.equal(state.initializeCapabilities.experimentalApi, true);
  assert.ok(state.requests.some(item => item.method === 'permissionProfile/list'));
  assert.equal(state.lastThread.permissions, ':read-only');
  assert.equal(state.lastThread.sandbox, null);
  assert.equal(state.lastThread.ephemeral, true);
  assert.equal(state.lastTurn.permissions, null);
  assert.equal(state.lastTurn.sandboxPolicy, null);
  assert.equal(state.requests.some(item => item?.params?.sandboxPolicy?.access), false);
});

await withClient('legacy', async ({ client, stateFile }) => {
  for (const prompt of ['Verify safe legacy fallback one.', 'Verify safe legacy fallback two.']) {
    const result = await client.generate({ model: 'gpt-5.5-codex-mini', effort: 'medium', prompt });
    assert.match(result.text, /Codex App Server reply/);
  }

  const state = await readState(stateFile);
  const profileRequests = state.requests.filter(item => item.method === 'permissionProfile/list');
  assert.equal(profileRequests.length, 0, 'legacy initialization should disable experimental permission-profile calls');
  assert.equal(state.lastThread.permissions, null);
  assert.equal(state.lastThread.sandbox, 'read-only');
  assert.equal(state.lastTurn.permissions, null);
  assert.equal(state.lastTurn.sandboxPolicy, null);
  assert.equal(state.requests.some(item => item?.params?.sandboxPolicy?.access), false);
});


await withClient('modern', async ({ client, stateFile }) => {
  const result = await client.generate({
    model: 'gpt-5.6-codex',
    effort: 'medium',
    prompt: 'Verify transition-era permissions-field fallback.'
  });
  assert.match(result.text, /Codex App Server reply/);
  assert.equal(result.permissionMode, 'legacySandbox');
  const state = await readState(stateFile);
  assert.ok(state.requests.some(item => item.method === 'permissionProfile/list'));
  assert.ok(state.requests.some(item => item.method === 'thread/start' && item?.params?.permissions === ':read-only'));
  assert.equal(state.lastThread.permissions, null);
  assert.equal(state.lastThread.sandbox, 'read-only');
  assert.equal(state.lastTurn.sandboxPolicy, null);
  assert.equal(state.requests.some(item => item?.params?.sandboxPolicy?.access), false);
}, 'allowed', 'unsupported');

await withClient('modern', async ({ client, stateFile }) => {
  await assert.rejects(
    client.generate({ model: 'gpt-5.6-codex', prompt: 'This must fail closed.' }),
    /不允许使用内置只读权限配置/
  );
  const state = await readState(stateFile);
  assert.ok(state.requests.some(item => item.method === 'permissionProfile/list'));
  assert.equal(state.lastThread, null, 'a denied profile must prevent thread creation');
  assert.equal(state.lastTurn, null, 'a denied profile must prevent turn creation');
}, 'denied');


await withClient('modern', async ({ client, stateFile }) => {
  await assert.rejects(
    client.generate({ model: 'gpt-5.6-codex', prompt: 'A missing profile must fail closed.' }),
    /没有提供内置只读权限配置/
  );
  const state = await readState(stateFile);
  assert.ok(state.requests.some(item => item.method === 'permissionProfile/list'));
  assert.equal(state.lastThread, null, 'a missing profile must prevent thread creation');
  assert.equal(state.lastTurn, null, 'a missing profile must prevent turn creation');
}, 'missing');

console.log('PASS: Codex named :read-only permission profile, deprecated readOnly.access removal, safe old/transition fallback and denied/missing-profile fail-closed behavior.');
