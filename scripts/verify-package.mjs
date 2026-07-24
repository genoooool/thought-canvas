#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.argv[2] || process.cwd());
const errors = [];
const files = [];
const required = [
  'package.json', 'server.mjs', 'app.js', 'selection-utils.js', 'text-encoding.js', 'i18n.js', 'thinking-core.js', 'providers.js',
  'provider-capabilities.js', 'codex-app-server.mjs',
  'index.html', 'styles.css', 'README.md', 'START_HERE.md', 'CHANGELOG.md',
  'data/projects/.gitkeep', 'data/backups/.gitkeep', 'docs/GATES.md', 'docs/TEST_REPORT.md', 'docs/ARCHITECTURE.md',
  'tests/selection-utils-test.mjs', 'tests/text-encoding-test.mjs', 'tests/i18n-test.mjs', 'tests/provider-capabilities-test.mjs',
  'tests/local-api-test.mjs', 'tests/browser_e2e.py', 'tests/codex-permissions-test.mjs', 'tests/codex-bridge-test.mjs',
  'tests/fake-codex-app-server.mjs'
];
const forbiddenParts = new Set(['.git', 'node_modules', '__pycache__', '.pytest_cache', 'playwright-report', 'test-results']);
const forbiddenExact = new Set([
  '.env.local', 'data/settings.local.json', 'data/runtime.local.json',
  '.DS_Store', 'npm-debug.log', 'yarn-error.log'
]);
const binaryExtensions = new Set(['.zip', '.gz', '.tgz', '.7z', '.rar', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm']);
const textExtensions = new Set(['', '.js', '.mjs', '.cjs', '.json', '.md', '.html', '.css', '.py', '.sh', '.txt', '.yml', '.yaml', '.toml', '.example']);
const forbiddenTemporaryName = /(?:\.log$|\.pyc$|\.bak$|\.orig$|\.tmp$|~$|\.before(?:[-.]|$))/i;

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = relative(full);
    const parts = rel.split('/');
    if (parts.some(part => forbiddenParts.has(part))) {
      errors.push(`forbidden path: ${rel}`);
      continue;
    }
    if (entry.isSymbolicLink()) {
      errors.push(`symbolic link is not allowed: ${rel}`);
      continue;
    }
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile()) files.push(full);
  }
}

await walk(root);
const relFiles = new Set(files.map(relative));
for (const item of required) if (!relFiles.has(item)) errors.push(`missing required file: ${item}`);

for (const file of files) {
  const rel = relative(file);
  const base = path.basename(rel);
  const ext = path.extname(base).toLowerCase();
  if (forbiddenExact.has(rel) || forbiddenExact.has(base)) errors.push(`runtime/private file present: ${rel}`);
  if (forbiddenTemporaryName.test(base)) errors.push(`temporary/log/cache file present: ${rel}`);
  if ((rel.startsWith('data/projects/') || rel.startsWith('data/backups/')) && base !== '.gitkeep') {
    errors.push(`generated user data present: ${rel}`);
  }
  if (/screenshot|screen-shot|trace\.zip$/i.test(rel) || binaryExtensions.has(ext)) {
    errors.push(`generated/binary artifact present: ${rel}`);
  }

  const info = await stat(file);
  if (info.size > 2_000_000 || !textExtensions.has(ext)) continue;
  let text;
  try { text = await readFile(file, 'utf8'); } catch { continue; }
  const findings = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
    [/\bsk-[A-Za-z0-9_-]{20,}\b/, 'provider secret'],
    [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/, 'GitHub token'],
    [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
    [/\bBearer\s+[A-Za-z0-9._~+\/-]{32,}={0,2}\b/i, 'bearer token']
  ];
  for (const [pattern, label] of findings) if (pattern.test(text)) errors.push(`${label} pattern in ${rel}`);
  if (rel !== '.env.example') {
    const envSecret = text.match(/^\s*(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|DEEPSEEK_API_KEY|API_KEY|ACCESS_TOKEN|CLIENT_SECRET)\s*=\s*([^\s#]{12,})/mi);
    if (envSecret && !/^(?:your|replace|example|test|dummy|<)/i.test(envSecret[1])) errors.push(`environment secret in ${rel}`);
  }
}

if (errors.length) {
  console.error(`FAIL package scan: ${errors.length} issue(s)`);
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`PASS package scan: ${files.length} files, no runtime data, caches, screenshots, archives, symlinks, or recognizable secrets.`);
