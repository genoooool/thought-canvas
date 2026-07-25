import http from 'node:http';
import { readFile, writeFile, stat, mkdir, readdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { CodexAppServerClient } from './codex-app-server.mjs';
import { mergeReasoningIntoPayload, normalizeDiscoveredModels, normalizeReasoningEffort } from './provider-capabilities.js';
import { repairUtf8Mojibake, repairUtf8MojibakeDeep } from './text-encoding.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8787);
const listenHost = process.env.HOST || '127.0.0.1';
const APP_VERSION = '1.2.6';
const SESSION_HEADER = 'x-thought-canvas-session';
const REQUEST_ENCODING_REPAIR = Symbol('requestEncodingRepair');
const runtimeSessionToken = randomBytes(32).toString('base64url');
const codexBin = process.env.CODEX_BIN || 'codex';
const codexLoginSessions = new Map();
const codexClient = new CodexAppServerClient({ command: codexBin, cwd: root, env: process.env, version: APP_VERSION });
const configRoot = process.env.THOUGHT_CANVAS_CONFIG_DIR ? path.resolve(process.env.THOUGHT_CANVAS_CONFIG_DIR) : root;
const envPath = path.join(configRoot, '.env.local');
const dataDir = path.join(configRoot, 'data');
const appConfigPath = path.join(dataDir, 'settings.local.json');
const projectsDir = path.join(dataDir, 'projects');
const backupsDir = path.join(dataDir, 'backups');
const runtimePath = path.join(dataDir, 'runtime.local.json');
let localSecrets = await loadLocalSecrets();
let localAppConfig = await loadLocalAppConfig();
await Promise.all([mkdir(projectsDir, { recursive: true }), mkdir(backupsDir, { recursive: true })]);
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  try {
    if (!isLoopbackHostHeader(req.headers.host)) return json(res, 403, { error: 'Thought Canvas 只接受本机回环地址访问。' });
    if (isMutationMethod(req.method) && req.headers.origin && !isAllowedOrigin(req.headers.origin, req.headers.host)) {
      return json(res, 403, { error: '已拒绝来自其他来源的本地写操作。' });
    }
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': `content-type,${SESSION_HEADER}` });
      return res.end();
    }
    if (pathname.startsWith('/api/') && isMutationMethod(req.method) && !hasValidSessionToken(req)) {
      return json(res, 401, { error: '本地运行会话已失效，请刷新页面后重试。', code: 'SESSION_REQUIRED' }, { 'Cache-Control': 'no-store' });
    }
    if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true, version: APP_VERSION, host: listenHost });
    if (req.method === 'GET' && pathname === '/api/workspace') return handleWorkspace(res);
    if (req.method === 'POST' && pathname === '/api/active-project') return handleSetActiveProject(req, res);
    const projectBackupsMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9._:-]{1,120})\/backups$/);
    if (projectBackupsMatch && req.method === 'GET') return handleListProjectBackups(projectBackupsMatch[1], res);
    const projectRestoreMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9._:-]{1,120})\/restore$/);
    if (projectRestoreMatch && req.method === 'POST') return handleRestoreProjectBackup(projectRestoreMatch[1], req, res);
    const messageDecomposeMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9._:-]{1,120})\/nodes\/([a-zA-Z0-9._:-]{1,120})\/messages\/([a-zA-Z0-9._:-]{1,120})\/decompose$/);
    if (messageDecomposeMatch && req.method === 'POST') return handleBoundDecompose(messageDecomposeMatch[1], messageDecomposeMatch[2], messageDecomposeMatch[3], req, res);
    const nodeOrganizeMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9._:-]{1,120})\/nodes\/([a-zA-Z0-9._:-]{1,120})\/organize$/);
    if (nodeOrganizeMatch && req.method === 'POST') return handleBoundOrganize(nodeOrganizeMatch[1], nodeOrganizeMatch[2], req, res);
    const nodeCompactMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9._:-]{1,120})\/nodes\/([a-zA-Z0-9._:-]{1,120})\/compact$/);
    if (nodeCompactMatch && req.method === 'POST') return handleBoundCompact(nodeCompactMatch[1], nodeCompactMatch[2], req, res);
    const projectMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9._:-]{1,120})$/);
    if (projectMatch && req.method === 'GET') return handleGetProject(projectMatch[1], res);
    if (projectMatch && req.method === 'POST') return handleSaveProject(projectMatch[1], req, res);
    if (projectMatch && req.method === 'DELETE') return handleDeleteProject(projectMatch[1], res);
    if (req.method === 'GET' && pathname === '/api/local-config') return handleGetLocalConfig(res);
    if (req.method === 'POST' && pathname === '/api/local-config') return handleSaveLocalConfig(req, res);
    if (req.method === 'POST' && pathname === '/api/provider-secret') return handleProviderSecret(req, res);
    if (req.method === 'GET' && pathname === '/api/oauth/codex/status') return handleCodexStatus(res);
    if (req.method === 'GET' && pathname === '/api/oauth/codex/session') return handleCodexSession(url, res);
    if (req.method === 'POST' && pathname === '/api/oauth/codex/start') return handleCodexStart(req, res);
    if (req.method === 'POST' && pathname === '/api/oauth/codex/cancel') return handleCodexCancel(req, res);
    if (req.method === 'POST' && pathname === '/api/oauth/codex/logout') return handleCodexLogout(req, res);
    if (req.method === 'POST' && pathname === '/api/generate-stream') return handleGenerateStream(req, res);
    if (req.method === 'POST' && pathname === '/api/analyze-stream') return handleAnalyzeStream(req, res);
    if (req.method === 'POST' && pathname === '/api/generate') return handleGenerate(req, res);
    if (req.method === 'POST' && pathname === '/api/analyze') return handleAnalyze(req, res);
    if (req.method === 'POST' && pathname === '/api/decompose') return handleDecompose(req, res);
    if (req.method === 'POST' && pathname === '/api/organize') return handleOrganize(req, res);
    if (req.method === 'POST' && pathname === '/api/compact') return handleCompact(req, res);
    if (req.method === 'POST' && pathname === '/api/synthesize') return handleSynthesize(req, res);
    if (req.method === 'POST' && pathname === '/api/providers/connect') return handleConnectProvider(req, res);
    if (req.method === 'POST' && pathname === '/api/test-provider') return handleTestProvider(req, res);
    if (req.method === 'POST' && pathname === '/api/list-models') return handleListModels(req, res);
    if (pathname.startsWith('/api/')) return json(res, 405, { error: `Method not allowed: ${req.method} ${pathname}` });
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    return serveStatic(pathname, res);
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : 'Unknown server error' });
  }
});

server.listen(port, listenHost, () => console.log(`Thought Canvas v12.6: http://${listenHost}:${port}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await codexClient.close().catch(() => {});
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1600).unref?.();
  });
}

function isMutationMethod(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase());
}

function hasValidSessionToken(req) {
  const provided = String(req.headers[SESSION_HEADER] || '');
  if (!provided) return false;
  const expected = Buffer.from(runtimeSessionToken);
  const actual = Buffer.from(provided);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hostParts(value) {
  try {
    const url = new URL(`http://${String(value || '')}`);
    return { hostname: url.hostname.toLowerCase(), port: url.port || '80' };
  } catch {
    return { hostname: '', port: '' };
  }
}

function isLoopbackHostname(hostname) {
  const value = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
  return value === 'localhost' || value === '::1' || value === '0:0:0:0:0:0:0:1' || /^127(?:\.\d{1,3}){3}$/.test(value);
}

function isLoopbackHostHeader(hostHeader) {
  return isLoopbackHostname(hostParts(hostHeader).hostname);
}

function isAllowedOrigin(origin, hostHeader) {
  try {
    const source = new URL(String(origin || ''));
    const target = hostParts(hostHeader);
    const sourcePort = source.port || (source.protocol === 'https:' ? '443' : '80');
    return ['http:', 'https:'].includes(source.protocol)
      && isLoopbackHostname(source.hostname)
      && source.hostname.toLowerCase() === target.hostname
      && sourcePort === target.port;
  } catch {
    return false;
  }
}

function projectFilePath(projectId) {
  if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(String(projectId || ''))) throw new Error('项目 ID 无效');
  return path.join(projectsDir, `${projectId}.json`);
}

async function readJsonFileWithRepair(filePath, fallback = null) {
  try {
    const original = JSON.parse(await readFile(filePath, 'utf8'));
    const repaired = repairUtf8MojibakeDeep(original);
    return { value: repaired.value, repairs: repaired.repairs, original };
  } catch {
    return { value: fallback, repairs: 0, original: fallback };
  }
}

async function readJsonFile(filePath, fallback = null) {
  return (await readJsonFileWithRepair(filePath, fallback)).value;
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(temp, filePath);
}

function containsSecretField(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:api[_-]?key|authorization|cookie|password|access[_-]?token|refresh[_-]?token|session[_-]?token|client[_-]?secret|secret)$/i.test(key) && String(child || '').trim()) return true;
    if (containsSecretField(child, seen)) return true;
  }
  return false;
}

function projectIndexEntry(project) {
  const nodes = Array.isArray(project?.nodes) ? project.nodes : [];
  const rootNode = nodes.find(node => node?.id === 'root') || nodes[0] || {};
  return {
    id: String(project?.projectId || ''),
    title: String(project?.projectTitle || rootNode.title || '未命名项目'),
    goal: String(project?.goal?.text || ''),
    summary: String(rootNode.summary || rootNode.question || ''),
    nodeCount: nodes.length || 1,
    createdAt: project?.projectCreatedAt || project?.createdAt || '',
    updatedAt: project?.projectUpdatedAt || project?.updatedAt || ''
  };
}

async function handleWorkspace(res) {
  await mkdir(projectsDir, { recursive: true });
  const names = (await readdir(projectsDir)).filter(name => name.endsWith('.json'));
  const projects = [];
  for (const name of names) {
    const project = await readJsonFile(path.join(projectsDir, name));
    if (project?.projectId) projects.push(projectIndexEntry(project));
  }
  projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const runtime = await readJsonFile(runtimePath, {});
  const activeProjectId = projects.some(item => item.id === runtime?.activeProjectId) ? runtime.activeProjectId : '';
  json(res, 200, { projects, activeProjectId, storage: { projectsDir: 'data/projects', backupsDir: 'data/backups', runtimeFile: 'data/runtime.local.json' } });
}

async function handleSetActiveProject(req, res) {
  const body = await readJson(req);
  const projectId = String(body.projectId || '');
  if (projectId && !/^[a-zA-Z0-9._:-]{1,120}$/.test(projectId)) return json(res, 400, { error: '项目 ID 无效' });
  await writeJsonAtomic(runtimePath, { activeProjectId: projectId, updatedAt: new Date().toISOString() });
  json(res, 200, { ok: true, activeProjectId: projectId });
}

async function handleGetProject(projectId, res) {
  const loaded = await readJsonFileWithRepair(projectFilePath(projectId));
  if (!loaded.value) return json(res, 404, { error: '项目不存在' });
  let project = loaded.value;
  let encodingRepair = null;
  if (loaded.repairs > 0) {
    const repairedAt = new Date().toISOString();
    const stamp = repairedAt.replace(/[:.]/g, '-');
    const original = loaded.original && typeof loaded.original === 'object' ? loaded.original : project;
    await writeJsonAtomic(path.join(backupsDir, `${projectId}.encoding-before-${stamp}.json`), original);
    project = {
      ...project,
      version: APP_VERSION,
      projectId,
      textEncodingRepairVersion: 1,
      textEncodingRepairedAt: repairedAt,
      textEncodingRepairCount: Number(project.textEncodingRepairCount || 0) + loaded.repairs
    };
    await writeJsonAtomic(projectFilePath(projectId), project);
    await pruneProjectBackups(projectId, 20);
    encodingRepair = { repairs: loaded.repairs, repairedAt, backupCreated: true };
  }
  json(res, 200, { project, encodingRepair });
}

async function handleSaveProject(projectId, req, res) {
  const body = await readJson(req);
  const requestRepairCount = Number(body?.[REQUEST_ENCODING_REPAIR] || 0);
  const project = body?.project && typeof body.project === 'object' && !Array.isArray(body.project) ? body.project : body;
  const createBackup = body?.createBackup !== false;
  const repaired = repairUtf8MojibakeDeep({ ...project, version: APP_VERSION, projectId });
  const totalRepairCount = requestRepairCount + repaired.repairs;
  const normalized = totalRepairCount > 0
    ? {
        ...repaired.value,
        textEncodingRepairVersion: 1,
        textEncodingRepairedAt: new Date().toISOString(),
        textEncodingRepairCount: Number(repaired.value.textEncodingRepairCount || 0) + totalRepairCount
      }
    : repaired.value;
  if (!Array.isArray(normalized.nodes)) return json(res, 400, { error: '项目文件缺少节点数据，未执行保存。' });
  if (containsSecretField(normalized)) return json(res, 400, { error: '项目数据中检测到疑似密钥字段，已拒绝写入。' });
  const filePath = projectFilePath(projectId);
  const previous = await readJsonFile(filePath);
  if (previous && createBackup) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await writeJsonAtomic(path.join(backupsDir, `${projectId}.${stamp}.json`), previous);
    await pruneProjectBackups(projectId, 20);
  }
  try {
    await writeJsonAtomic(filePath, normalized);
  } catch (error) {
    return json(res, 500, { error: '本地项目文件写入失败，请检查 data 目录权限。', detail: error?.code || '' });
  }
  json(res, 200, {
    ok: true,
    project: projectIndexEntry(normalized),
    storageFile: `data/projects/${projectId}.json`,
    encodingRepair: totalRepairCount > 0 ? { repairs: totalRepairCount, repairedAt: normalized.textEncodingRepairedAt || '' } : null
  });
}

async function handleDeleteProject(projectId, res) {
  await unlink(projectFilePath(projectId)).catch(error => { if (error?.code !== 'ENOENT') throw error; });
  const backupNames = await readdir(backupsDir).catch(() => []);
  await Promise.all(backupNames
    .filter(name => name.startsWith(`${projectId}.`) && name.endsWith('.json'))
    .map(name => unlink(path.join(backupsDir, name)).catch(() => {})));
  const runtime = await readJsonFile(runtimePath, {});
  if (runtime?.activeProjectId === projectId) await writeJsonAtomic(runtimePath, { activeProjectId: '', updatedAt: new Date().toISOString() });
  json(res, 200, { ok: true, projectId });
}

function validateBackupName(projectId, value) {
  const name = String(value || '');
  if (path.basename(name) !== name || !name.startsWith(`${projectId}.`) || !name.endsWith('.json') || !/^[a-zA-Z0-9._:-]+$/.test(name)) {
    throw Object.assign(new Error('备份标识无效。'), { statusCode: 400 });
  }
  return name;
}

async function projectBackupEntries(projectId) {
  await mkdir(backupsDir, { recursive: true });
  const names = (await readdir(backupsDir))
    .filter(name => name.startsWith(`${projectId}.`) && name.endsWith('.json'))
    .sort()
    .reverse();
  const entries = [];
  for (const name of names) {
    const filePath = path.join(backupsDir, name);
    const [info, project] = await Promise.all([stat(filePath).catch(() => null), readJsonFile(filePath)]);
    if (!info?.isFile() || !project) continue;
    entries.push({
      id: name,
      createdAt: info.mtime.toISOString(),
      size: info.size,
      project: projectIndexEntry(project),
      projectUpdatedAt: project.projectUpdatedAt || project.updatedAt || ''
    });
  }
  return entries;
}

async function handleListProjectBackups(projectId, res) {
  const current = await readJsonFile(projectFilePath(projectId));
  if (!current) return json(res, 404, { error: '项目不存在' });
  const backups = await projectBackupEntries(projectId);
  json(res, 200, { projectId, backups });
}

async function handleRestoreProjectBackup(projectId, req, res) {
  try {
    const body = await readJson(req);
    const backupId = validateBackupName(projectId, body.backupId);
    const loadedBackup = await readJsonFileWithRepair(path.join(backupsDir, backupId));
    const backup = loadedBackup.value;
    if (!backup) return json(res, 404, { error: '备份不存在或已被清理。' });
    if (!Array.isArray(backup.nodes)) return json(res, 400, { error: '备份缺少节点数据，无法恢复。' });
    if (containsSecretField(backup)) return json(res, 400, { error: '备份中检测到疑似密钥字段，已拒绝恢复。' });
    const current = await readJsonFile(projectFilePath(projectId));
    if (current) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await writeJsonAtomic(path.join(backupsDir, `${projectId}.${stamp}.json`), current);
    }
    const restoredAt = new Date().toISOString();
    const restoredBase = {
      ...backup,
      version: APP_VERSION,
      projectId,
      projectUpdatedAt: restoredAt,
      restoredFromBackup: backupId,
      restoredAt
    };
    const restored = loadedBackup.repairs > 0
      ? {
          ...restoredBase,
          textEncodingRepairVersion: 1,
          textEncodingRepairedAt: restoredAt,
          textEncodingRepairCount: Number(restoredBase.textEncodingRepairCount || 0) + loadedBackup.repairs
        }
      : restoredBase;
    await writeJsonAtomic(projectFilePath(projectId), restored);
    await pruneProjectBackups(projectId, 20);
    json(res, 200, {
      ok: true,
      project: restored,
      index: projectIndexEntry(restored),
      restoredFrom: backupId,
      encodingRepair: loadedBackup.repairs > 0 ? { repairs: loadedBackup.repairs, repairedAt: restoredAt } : null
    });
  } catch (error) {
    json(res, error?.statusCode || 500, { error: error?.message || '恢复备份失败。' });
  }
}


async function pruneProjectBackups(projectId, keep = 20) {
  const names = (await readdir(backupsDir)).filter(name => name.startsWith(`${projectId}.`) && name.endsWith('.json')).sort().reverse();
  await Promise.all(names.slice(keep).map(name => unlink(path.join(backupsDir, name)).catch(() => {})));
}

async function requireProjectNode(projectId, nodeId) {
  const project = await readJsonFile(projectFilePath(projectId));
  if (!project) return { error: '项目不存在或尚未保存。' };
  const node = (project.nodes || []).find(item => item?.id === nodeId);
  if (!node) return { error: '当前节点不存在，可能已被删除。' };
  return { project, node };
}

async function handleBoundDecompose(projectId, nodeId, messageId, req, res) {
  const found = await requireProjectNode(projectId, nodeId);
  if (found.error) return json(res, 404, { error: found.error });
  const message = (found.node.messages || []).find(item => item?.id === messageId && item?.role === 'assistant');
  if (!message) return json(res, 404, { error: '这条回答已被删除，无法拆解。' });
  const body = await readJson(req);
  const selectedText = String(body.selectedText || '').trim();
  const scope = body.scope === 'selection' ? 'selection' : 'message';
  if (scope === 'selection' && !selectedText) return json(res, 400, { error: '尚未选择文字。' });
  const fullText = String(message.content || '');
  if (scope === 'selection') {
    const requestedStart = Number(body.selectionStart);
    const requestedEnd = Number(body.selectionEnd);
    const exactRange = Number.isFinite(requestedStart) && Number.isFinite(requestedEnd) && requestedStart >= 0 && requestedEnd > requestedStart && fullText.slice(requestedStart, requestedEnd) === selectedText;
    const includedStart = exactRange ? requestedStart : fullText.indexOf(selectedText);
    if (!exactRange && includedStart < 0 && body.allowUnlocatedSelection !== true) {
      return json(res, 400, { error: '所选文字已无法在原回答中定位，请重新选择。' });
    }
    if (exactRange || includedStart >= 0) {
      body.selectionStart = exactRange ? requestedStart : includedStart;
      body.selectionEnd = exactRange ? requestedEnd : includedStart + selectedText.length;
      body.selectionLocated = true;
    } else {
      body.selectionStart = -1;
      body.selectionEnd = -1;
      body.selectionLocated = false;
    }
  }
  body.text = scope === 'selection' ? selectedText : fullText;
  body.answer = body.text;
  body.scope = scope;
  return handleDecomposeBody(body, res, {
    projectId,
    nodeId,
    messageId,
    selectionStart: Number.isFinite(Number(body.selectionStart)) ? Number(body.selectionStart) : -1,
    selectionEnd: Number.isFinite(Number(body.selectionEnd)) ? Number(body.selectionEnd) : -1,
    selectionLocated: body.selectionLocated !== false
  });
}

async function handleBoundOrganize(projectId, nodeId, req, res) {
  const found = await requireProjectNode(projectId, nodeId);
  if (found.error) return json(res, 404, { error: found.error });
  const body = await readJson(req);
  const messages = (found.node.messages || []).filter(item => body.includeArchivedMessages || !item.archived);
  if (!messages.length) return json(res, 400, { error: '当前节点没有可整理的对话。' });
  body.transcript = messages.map(item => `${item.role === 'user' ? '用户' : 'AI'}：${String(item.content || '')}`).join('\n\n');
  return handleOrganizeBody(body, res, { projectId, nodeId });
}

async function handleBoundCompact(projectId, nodeId, req, res) {
  const found = await requireProjectNode(projectId, nodeId);
  if (found.error) return json(res, 404, { error: found.error });
  const body = await readJson(req);
  const messages = found.node.messages || [];
  if (!messages.length) return json(res, 400, { error: '当前节点没有可 Compact 的消息。' });
  body.transcript = messages.map(item => `${item.role === 'user' ? '用户' : 'AI'}：${String(item.content || '')}`).join('\n\n');
  body.coveredMessageIds = messages.map(item => item.id).filter(Boolean);
  return handleCompactBody(body, res, { projectId, nodeId });
}

async function handleGetLocalConfig(res) {
  json(res, 200, {
    settings: localAppConfig || {},
    secretStatus: Object.fromEntries(Object.keys(localSecrets).map(id => [id, true])),
    storage: { envFile: '.env.local', settingsFile: 'data/settings.local.json' }
  });
}

async function handleSaveLocalConfig(req, res) {
  const body = await readJson(req);
  const settings = body && typeof body.settings === 'object' && !Array.isArray(body.settings) ? body.settings : {};
  localAppConfig = sanitizeLocalAppConfig(repairUtf8MojibakeDeep(settings).value);
  await mkdir(dataDir, { recursive: true });
  await writeFile(appConfigPath, JSON.stringify(localAppConfig, null, 2) + '\n', { mode: 0o600 });
  json(res, 200, { ok: true, settings: localAppConfig });
}

async function handleProviderSecret(req, res) {
  const body = await readJson(req);
  const providerId = String(body.providerId || '').trim();
  if (!providerId || !/^[a-zA-Z0-9._:-]{1,120}$/.test(providerId)) return json(res, 400, { error: '供应商 ID 无效' });
  if (!body.clear) {
    return json(res, 400, { error: 'API Key 只能通过“连接并同步模型”验证成功后保存。' });
  }
  delete localSecrets[providerId];
  await writeLocalSecrets();
  json(res, 200, { ok: true, providerId, hasKey: false });
}

function sanitizeLocalAppConfig(settings) {
  const allowed = ['constraints','providers','defaultProvider','defaultModel','defaultReasoningEffort','mergeProvider','mergeModel','mergeReasoningEffort','decomposePreset','decomposePrompt','activeProviderEditorId','sidebarWidth','autoCompactEnabled','autoCompactMessageLimit','connectionShape','connectionStroke','uiLanguage'];
  return Object.fromEntries(allowed.filter(key => key in settings).map(key => [key, settings[key]]));
}

function parseEnvValue(value) {
  let text = String(value || '').trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) text = text.slice(1, -1);
  return text.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

async function loadLocalSecrets() {
  try {
    const text = await readFile(envPath, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 1) continue;
      const name = line.slice(0, idx).trim();
      if (name !== 'THOUGHT_CANVAS_PROVIDER_KEYS') continue;
      const parsed = JSON.parse(parseEnvValue(line.slice(idx + 1)));
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return {};
      return Object.fromEntries(Object.entries(parsed).map(([id, key]) => [String(id), String(key)]).filter(([, key]) => key));
    }
    return {};
  } catch { return {}; }
}

async function writeLocalSecrets() {
  await mkdir(configRoot, { recursive: true });
  const serialized = JSON.stringify(localSecrets);
  const lines = [
    '# Thought Canvas local API keys',
    '# Generated by the local settings panel. Do not commit this file.',
    `THOUGHT_CANVAS_PROVIDER_KEYS=${JSON.stringify(serialized)}`,
    ''
  ];
  await writeFile(envPath, lines.join('\n'), { mode: 0o600 });
}

async function loadLocalAppConfig() {
  try {
    const original = JSON.parse(await readFile(appConfigPath, 'utf8'));
    const repaired = repairUtf8MojibakeDeep(original);
    const settings = sanitizeLocalAppConfig(repaired.value);
    if (repaired.repairs > 0) await writeFile(appConfigPath, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
    return settings;
  } catch { return {}; }
}

function resolveStoredSecret(providerId) { return providerId ? String(localSecrets[String(providerId)] || '') : ''; }

async function handleGenerate(req, res) {
  try {
    const body = await readJson(req);
    if (!body.prompt) return json(res, 400, { error: '缺少 prompt' });
    const text = await generateText({ ...normalizeConfig(body.config), prompt: promptWithOutputLanguage(body.prompt, body.uiLanguage) });
    json(res, 200, { text });
  } catch (error) {
    json(res, 500, { error: error.message || String(error) });
  }
}

function beginNdjson(res) {
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    'X-Content-Type-Options': 'nosniff',
    'Transfer-Encoding': 'chunked'
  });
}

function writeNdjson(res, payload) {
  if (!res.destroyed && !res.writableEnded) res.write(`${JSON.stringify(payload)}\n`);
}

function streamChunkSize(text, index) {
  const code = text.codePointAt(index) || 0;
  if (code >= 0x3400 && code <= 0x9fff) return 18;
  return 42;
}

async function delayWithSignal(ms, signal) {
  if (signal?.aborted) throw Object.assign(new Error('生成已停止'), { name: 'AbortError' });
  await new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
    const abort = () => {
      clearTimeout(timer);
      cleanup();
      reject(Object.assign(new Error('生成已停止'), { name: 'AbortError' }));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

async function emitTextChunks(text, onDelta, { signal, delayMs = 18 } = {}) {
  const value = String(text || '');
  for (let index = 0; index < value.length;) {
    if (signal?.aborted) throw Object.assign(new Error('生成已停止'), { name: 'AbortError' });
    const size = streamChunkSize(value, index);
    const delta = value.slice(index, index + size);
    index += delta.length;
    onDelta(delta);
    if (delayMs > 0) await delayWithSignal(delayMs, signal);
  }
}

async function streamGeneratedText(config, prompt, onDelta, { signal, maxTokens = 3800 } = {}) {
  if (config.protocol === 'codex-app-server') {
    const result = await callCodexAppServer(config, prompt, { signal, onDelta });
    return result.text;
  }
  if (config.protocol === 'openai-chat') {
    let emitted = 0;
    try {
      return await streamOpenAIChat(config, prompt, delta => {
        emitted += delta.length;
        onDelta(delta);
      }, { signal, maxTokens });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      if (emitted > 0) throw error;
      // Some OpenAI-compatible proxies do not implement SSE correctly. Fall
      // back to the normal response and still expose it through NDJSON.
    }
  }
  const text = await generateText({ ...config, prompt }, { signal });
  await emitTextChunks(text, onDelta, { signal, delayMs: config.protocol === 'mock' ? 28 : 4 });
  return text;
}

function streamTextValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(streamTextValue).join('');
  if (!value || typeof value !== 'object') return '';
  for (const key of ['text', 'output_text', 'content', 'value']) {
    const found = streamTextValue(value[key]);
    if (found) return found;
  }
  return '';
}

async function streamOpenAIChat(config, prompt, onDelta, { signal, maxTokens = 3800 } = {}) {
  validateRemoteConfig(config);
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), 90000);
  const abort = () => timeoutController.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const url = appendEndpoint(config.baseUrl, 'chat/completions');
    const response = await fetch(url, {
      method: 'POST',
      headers: authHeaders(config, { 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
      body: JSON.stringify(mergeReasoningIntoPayload({ model: config.model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, stream: true }, config)),
      signal: timeoutController.signal
    });
    if (!response.ok) {
      const payload = await responseJson(response);
      throw new Error(apiError(payload, `${config.providerName} HTTP ${response.status}`));
    }
    if (!response.body) throw new Error(`${config.providerName} 没有返回可读取的数据流`);
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = '';
    let text = '';
    const consumeLine = line => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') return;
      let payload;
      try { payload = JSON.parse(data); } catch { return; }
      const delta = streamTextValue(payload.choices?.[0]?.delta?.content) || streamTextValue(payload.choices?.[0]?.text);
      if (!delta) return;
      text += delta;
      onDelta(delta);
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) consumeLine(line);
    }
    buffer += decoder.decode();
    for (const line of buffer.split(/\r?\n/)) consumeLine(line);
    if (!text.trim()) throw new Error(`${config.providerName} 返回中没有可读取的流式文本`);
    return repairUtf8Mojibake(text);
  } catch (error) {
    if (signal?.aborted) throw Object.assign(new Error('生成已停止'), { name: 'AbortError' });
    if (error?.name === 'AbortError') throw new Error('请求超时');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

function normalizeUiLanguage(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'en' || raw.startsWith('en-')) return 'en';
  if (raw === 'ja' || raw.startsWith('ja-')) return 'ja';
  return 'zh-CN';
}

function outputLanguageInstruction(value) {
  const locale = normalizeUiLanguage(value);
  if (locale === 'en') return 'Response language: English. Use another language only when the user explicitly requests it.';
  if (locale === 'ja') return '回答言語：日本語。ユーザーが明示的に別の言語を求めた場合だけ、その言語へ切り替えてください。';
  return '回答语言：简体中文。只有用户明确要求其他语言时才切换。';
}

function promptWithOutputLanguage(prompt, locale) {
  const instruction = outputLanguageInstruction(locale);
  const source = String(prompt || '').trim();
  return source.includes(instruction) ? source : `${source}\n\n${instruction}`;
}

async function handleGenerateStream(req, res) {
  const body = await readJson(req).catch(error => ({ __error: error }));
  if (body.__error) return json(res, 400, { error: 'JSON 格式错误' });
  if (!body.prompt) return json(res, 400, { error: '缺少 prompt' });
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  beginNdjson(res);
  const requestId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  writeNdjson(res, { type: 'start', requestId });
  let text = '';
  try {
    const config = normalizeConfig(body.config);
    text = await streamGeneratedText(config, promptWithOutputLanguage(body.prompt, body.uiLanguage), delta => {
      text += delta;
      writeNdjson(res, { type: 'delta', text: delta });
    }, { signal: controller.signal });
    writeNdjson(res, { type: 'done', requestId, textLength: text.length });
    if (!res.writableEnded) res.end();
  } catch (error) {
    if (error?.name !== 'AbortError' && !res.destroyed) {
      writeNdjson(res, { type: 'error', error: error?.message || '生成失败' });
      res.end();
    }
  }
}

async function handleAnalyzeStream(req, res) {
  const body = await readJson(req).catch(error => ({ __error: error }));
  if (body.__error) return json(res, 400, { error: 'JSON 格式错误' });
  if (!body.prompt) return json(res, 400, { error: '缺少 prompt' });
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  beginNdjson(res);
  const requestId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  writeNdjson(res, { type: 'start', requestId });
  let answer = '';
  try {
    const config = normalizeConfig(body.config);
    const question = String(body.question || '当前问题').trim();
    let goalSuggestion = deriveGoalFallback(question, body.uiLanguage);
    if (config.protocol === 'mock') {
      const mock = mockAnalyze(question);
      goalSuggestion = mock.goalSuggestion;
      await emitTextChunks(mock.answer, delta => {
        answer += delta;
        writeNdjson(res, { type: 'delta', text: delta });
      }, { signal: controller.signal, delayMs: 28 });
    } else {
      const answerPrompt = [
        String(body.prompt),
        '请像成熟的思考伙伴一样直接回答用户，不要输出 JSON、XML 或内部字段。',
        '使用清晰 Markdown：先给核心判断，再分层讲解；必要时使用小标题、列表、引用、表格或代码块。',
        '不要在回答正文中输出画布节点；是否拆解由界面根据用户的拆解意图处理。',
        outputLanguageInstruction(body.uiLanguage)
      ].join('\n\n');
      answer = await streamGeneratedText(config, answerPrompt, delta => {
        answer += delta;
        writeNdjson(res, { type: 'delta', text: delta });
      }, { signal: controller.signal });
      answer = repairUtf8Mojibake(answer);
      try {
        const goalRaw = await generateText({
          ...config,
          prompt: [
            '根据下面的用户问题和已完成回答，只返回一句可修改的最终目标，不超过45字。',
            '不要 JSON，不要解释。',
            `用户问题：${question}`,
            `回答：\n${answer}`,
            outputLanguageInstruction(body.uiLanguage)
          ].join('\n\n')
        }, { signal: controller.signal });
        const candidate = unwrapUserFacingAnswer(goalRaw).replace(/^[-#*\s]+/, '').trim();
        if (candidate) goalSuggestion = candidate.slice(0, 160);
      } catch {}
    }
    writeNdjson(res, { type: 'meta', goalSuggestion, manualDecompose: true });
    writeNdjson(res, { type: 'done', requestId, textLength: answer.length });
    if (!res.writableEnded) res.end();
  } catch (error) {
    if (error?.name !== 'AbortError' && !res.destroyed) {
      writeNdjson(res, { type: 'error', error: error?.message || '生成失败' });
      res.end();
    }
  }
}

async function handleAnalyze(req, res) {
  try {
    const body = await readJson(req);
    const config = normalizeConfig(body.config);
    const question = String(body.question || '当前问题').trim();
    if (!body.prompt) return json(res, 400, { error: '缺少 prompt' });
    if (config.protocol === 'mock') {
      const mock = mockAnalyze(question);
      return json(res, 200, { goalSuggestion: mock.goalSuggestion, answer: mock.answer });
    }

    const answerPrompt = [
      String(body.prompt),
      '请像成熟的思考伙伴一样直接回答用户，不要输出 JSON、XML 或内部字段。',
      '使用清晰 Markdown：先给核心判断，再分层讲解；必要时使用小标题、列表、引用、表格或代码块。',
      '不要在回答正文中输出画布节点；是否拆解由界面根据用户的拆解意图处理。',
      outputLanguageInstruction(body.uiLanguage)
    ].join('\n\n');
    const rawAnswer = await generateText({ ...config, prompt: answerPrompt });
    const answer = unwrapUserFacingAnswer(rawAnswer);

    let goalSuggestion = deriveGoalFallback(question, body.uiLanguage);
    try {
      const goalRaw = await generateText({
        ...config,
        prompt: [
          '根据下面的用户问题和已完成回答，只返回一句可修改的最终目标，不超过45字。',
          '不要 JSON，不要解释。',
          `用户问题：${question}`,
          `回答：\n${answer}`,
          outputLanguageInstruction(body.uiLanguage)
        ].join('\n\n')
      });
      const candidate = unwrapUserFacingAnswer(goalRaw).replace(/^[-#*\s]+/, '').trim();
      if (candidate) goalSuggestion = candidate.slice(0, 160);
    } catch {}

    json(res, 200, { goalSuggestion, answer, manualDecompose: true });
  } catch (error) {
    json(res, 500, { error: error.message || String(error) });
  }
}

async function handleDecompose(req, res) {
  const body = await readJson(req);
  return handleDecomposeBody(body, res);
}

async function handleDecomposeBody(body, res, binding = {}) {
  try {
    const config = normalizeConfig(body.config);
    const text = String(body.text || body.answer || '').trim();
    if (!text) return json(res, 400, { error: '缺少待拆解内容' });
    const scope = String(body.scope || 'message');
    const customInstruction = String(body.customInstruction || '').trim();
    if (config.protocol === 'mock') {
      let sections = ensureSectionSourceFidelity(mockDecompose(body.question, text), text);
      if (!sections.length) sections = [{ title: '完整原文', content: text, summary: text.slice(0, 300), sourceText: text, sourceQuote: text, sourceStart: 0, sourceEnd: text.length, order: 0 }];
      return json(res, 200, { sections, binding });
    }

    const prompt = [
      '你正在拆解一条已有回答。',
      '目标：把用户阅读困难的长回答拆成多个可以独立阅读的内容模块。',
      `作用范围：${scope === 'selection' ? '用户在某条回答中选中的文字' : scope === 'node' ? '当前节点的完整讨论整理稿' : '一条具体 AI 回答'}`,
      `最终目标：${body.goal || ''}`,
      `用户约束：${(body.constraints || []).join('；')}`,
      `当前问题：${body.question || ''}`,
      '任务：把下方内容拆成容易逐个理解的讲解模块。拆的是现有答案，不是生成后续问题。',
      '强制规则：',
      '1. 只拆解原回答中已经存在的内容；',
      '2. 不生成新的延伸问题；',
      '3. 不改变原回答的主要结论；',
      '4. 每个模块必须包含足够完整的讲解；',
      '5. 保持原回答的逻辑顺序；',
      '6. 不遗漏影响最终判断的重要内容；',
      '7. 每个模块必须对应明确的连续原文片段；',
      '8. 输出标题、原文起止位置、完整原文片段和简短概括；',
      '9. 生成 2–8 个模块，避免过度切碎；',
      customInstruction ? `用户自定义拆解要求：${customInstruction}` : '',
      `待拆内容：\n${text}`,
      outputLanguageInstruction(body.uiLanguage),
      '只返回严格 JSON，不要代码围栏：{"sections":[{"title":"短标题","sourceStart":0,"sourceEnd":12,"sourceText":"从待拆内容中逐字复制的连续完整片段","summary":"一句摘要"}]}'
    ].filter(Boolean).join('\n\n');
    let raw = '';
    let sections = [];
    let warning = '';
    try {
      raw = await generateText({ ...config, prompt });
      const parsed = parseJsonObjectLenient(raw);
      sections = ensureSectionSourceFidelity(parsed.sections || [], text);
    } catch (error) {
      sections = ensureSectionSourceFidelity(fallbackSectionsFromAnswer(text), text);
      warning = /没有可读取的文本|没有返回可显示|empty/i.test(String(error?.message || error))
        ? `${config.providerName} 本次没有返回可读取正文，已直接按原文结构完成拆解。`
        : '模型返回格式异常或调用失败，已使用原文结构安全回退；内部 JSON 未显示。';
    }
    if (!sections.length) {
      sections = [{ title: '完整原文', content: text, summary: text.slice(0, 300), sourceText: text, sourceQuote: text, sourceStart: 0, sourceEnd: text.length, order: 0 }];
      warning = warning || '无法可靠拆成多个模块，已保留完整原文作为单一模块。';
    }
    json(res, 200, { sections, warning, binding });
  } catch (error) {
    json(res, 500, { error: error.message || String(error) });
  }
}

async function handleOrganize(req, res) {
  const body = await readJson(req);
  return handleOrganizeBody(body, res);
}

async function handleOrganizeBody(body, res, binding = {}) {
  try {
    const config = normalizeConfig(body.config);
    const transcript = String(body.transcript || '').trim();
    if (!transcript) return json(res, 400, { error: '当前节点没有可整理的对话。' });
    if (config.protocol === 'mock') {
      const organized = `## 当前讨论主题

${String(body.question || '当前节点讨论')}

## 已确认结论

${transcript.slice(0, 1200)}

## 被修改或推翻的判断

- 暂无明确记录。

## 尚未解决的问题

- 仍需验证的关键假设。

## 推荐下一步

阅读整理结果后，再决定是否手动拆解。`;
      return json(res, 200, { organized, result: organizeStructuredFallback(transcript), binding });
    }
    const organizePrompt = [
      '你是 Thought Canvas 的讨论整理器。',
      `最终目标：${body.goal || ''}`,
      `当前节点：${body.question || ''}`,
      '请把完整对话整理为一份去重后的 Markdown。必须包含：当前讨论主题、已确认结论、关键论据、被修改或推翻的判断、尚未解决的问题、推荐下一步。',
      '保留观点变化，不要加入对话中没有的新结论。不要自动拆成多个节点。',
      `完整对话：\n${transcript}`,
      outputLanguageInstruction(body.uiLanguage)
    ].join('\n\n');
    const organized = unwrapUserFacingAnswer(await generateText({ ...config, prompt: organizePrompt }));
    json(res, 200, { organized, result: organizeStructuredFallback(organized), binding });
  } catch (error) {
    json(res, 500, { error: error.message || String(error) });
  }
}

async function handleCompact(req, res) {
  const body = await readJson(req);
  return handleCompactBody(body, res);
}

async function handleCompactBody(body, res, binding = {}) {
  try {
    const transcript = String(body.transcript || '').trim();
    if (!transcript) return json(res, 400, { error: '没有可压缩的上下文。' });
    const config = normalizeConfig(body.config);
    if (config.protocol === 'mock') return json(res, 200, { compact: compactStructuredFallback(transcript, body.coveredMessageIds || []), binding });
    const prompt = [
      '你是 Thought Canvas 的上下文压缩器。',
      '把下面对话压缩成供后续模型继承的结构化记忆。',
      '必须保留：用户真实目标、长期约束、已确认事实、已确认结论、观点变化、被否定假设、未解决问题、重要引用和数字、节点关键关系。',
      '不能把不确定判断写成事实，不能删除原始消息，不能修改最终目标或节点状态。',
      `节点：${body.question || ''}`,
      `最终目标：${body.goal || ''}`,
      `完整对话：\n${transcript}`,
      outputLanguageInstruction(body.uiLanguage),
      '只返回严格 JSON：{"summary":"...","confirmedConclusions":[],"openQuestions":[],"rejectedAssumptions":[],"importantUserConstraints":[]}'
    ].join('\n\n');
    let compact;
    try { compact = normalizeCompact(parseJsonObjectLenient(await generateText({ ...config, prompt })), body.coveredMessageIds || []); }
    catch { compact = compactStructuredFallback(transcript, body.coveredMessageIds || []); }
    json(res, 200, { compact, binding });
  } catch (error) {
    json(res, 500, { error: error.message || String(error) });
  }
}

async function handleSynthesize(req, res) {
  try {
    const body = await readJson(req);
    const branches = Array.isArray(body.branches) ? body.branches : [];
    const mode = ['summary', 'compare', 'synthesis'].includes(body.mode) ? body.mode : 'synthesis';
    if (branches.length < 2) return json(res, 400, { error: '至少需要两个节点' });
    const config = normalizeConfig(body.config);
    if (config.protocol === 'mock') return json(res, 200, { text: mockSynthesis(mode, branches) });

    const focus = String(body.focus || '').trim();
    const task = mode === 'summary'
      ? '只压缩所选内容，保留关键事实、判断、疑问与细节，不增加新的结论。'
      : mode === 'compare'
        ? '比较所选内容，明确共同点、真正不同点、冲突结论、不同结论背后的前提。不要强行得出统一答案。'
        : '综合所选内容：先列共同点与差异，再判断哪些观点更适用于用户目标，形成可继续延伸的新结论，同时保留未解决问题。';
    const prompt = [
      '你是非线性思考画布的节点处理器。',
      `任务：${task}`,
      `最终目标：${body.goal || ''}`,
      `用户约束：${(body.constraints || []).map(x => `\n- ${x}`).join('')}`,
      focus ? `这次汇总最想回答的问题：${focus}` : '这次汇总没有额外焦点，请根据所选节点和最终目标形成最有用的综合。',
      ...branches.map((b, i) => `\n\n=== 节点 ${i + 1}：${b.title} (${b.provider || ''}/${b.model || ''}) ===\n${b.content || ''}`),
      mode === 'summary'
        ? '\n\n请按“核心内容 / 关键细节 / 尚未解决”输出。'
        : mode === 'compare'
          ? '\n\n请按“共同点 / 不同点 / 表面分歧与真正分歧 / 各自适用条件”输出。'
          : '\n\n请按“共同点 / 不同点 / 分歧背后的假设 / 各节点独有价值 / 综合结论 / 尚未解决 / 下一步”输出。',
      outputLanguageInstruction(body.uiLanguage)
    ].join('\n');
    const text = await generateText({ ...config, prompt });
    json(res, 200, { text });
  } catch (error) {
    json(res, 500, { error: error.message || String(error) });
  }
}

async function handleConnectProvider(req, res) {
  try {
    const body = await readJson(req);
    const suppliedKey = String(body.apiKey || '').trim();
    const config = normalizeConfig({ ...(body.config || {}), apiKey: suppliedKey || body.config?.apiKey || '' });
    if (config.protocol === 'codex-app-server') {
      return json(res, 400, { error: 'Codex 请使用 ChatGPT OAuth 连接，不使用 API Key 接入。' });
    }
    if (!config.providerId || !/^[a-zA-Z0-9._:-]{1,120}$/.test(config.providerId)) {
      return json(res, 400, { error: '供应商 ID 无效' });
    }
    if (!config.apiKey && !config.keyOptional && config.authMode !== 'none') {
      return json(res, 400, { error: `${config.providerName} 缺少 API Key` });
    }

    const started = Date.now();
    let models = [];
    let catalogSource = 'remote_catalog';
    let catalogWarning = '';
    try {
      models = await listModels(config);
      if (!models.length) throw new Error(`${config.providerName} 没有返回可用模型列表`);
    } catch (error) {
      if (!config.model) throw error;
      // A number of OpenAI-compatible gateways support generation but do not
      // expose a standards-compatible /models endpoint. Validate the configured
      // model and keep it as an explicit, auditable fallback instead of making
      // connection impossible.
      const test = await executeText(config, '只回复 CONNECTION_OK，不要添加其他内容。', { maxTokens: 32 });
      models = normalizeDiscoveredModels([{ id: config.model, label: config.model, capabilitySource: 'configured_fallback' }], {
        id: config.providerId,
        providerId: config.providerId,
        protocol: config.protocol,
        reasoningMode: config.reasoningMode
      });
      catalogSource = 'configured_fallback';
      catalogWarning = `模型目录不可用，已验证手动配置模型：${error.message || error}`;
      body.verifyGeneration = false;
      body.__fallbackPreview = String(test.text || '').trim().slice(0, 160);
    }
    const preferredModel = models.some(item => item.id === config.model)
      ? config.model
      : models.find(item => item.isDefault)?.id || models[0].id;
    let preview = String(body.__fallbackPreview || '');
    if (body.verifyGeneration !== false) {
      const test = await executeText({ ...config, model: preferredModel }, '只回复 CONNECTION_OK，不要添加其他内容。', { maxTokens: 32 });
      preview = String(test.text || '').trim().slice(0, 160);
    }

    if (suppliedKey) {
      localSecrets[config.providerId] = suppliedKey;
      await writeLocalSecrets();
    }
    const syncedAt = new Date().toISOString();
    json(res, 200, {
      ok: true,
      hasKey: Boolean(localSecrets[config.providerId]),
      models,
      preferredModel,
      preview,
      catalogSource,
      catalogWarning,
      latencyMs: Date.now() - started,
      syncedAt,
      connection: {
        status: 'connected',
        modelCount: models.length,
        syncedAt,
        catalogSource,
        warning: catalogWarning
      }
    });
  } catch (error) {
    json(res, 502, { error: error.message || String(error) });
  }
}

async function handleTestProvider(req, res) {
  try {
    const body = await readJson(req);
    const config = normalizeConfig(body.config);
    const started = Date.now();
    const result = await executeText(config, '只回复 CONNECTION_OK，不要添加其他内容。', { maxTokens: 32 });
    json(res, 200, {
      ok: true,
      status: result.status || 200,
      latencyMs: Date.now() - started,
      preview: String(result.text || '').trim().slice(0, 160)
    });
  } catch (error) {
    json(res, 502, { error: error.message || String(error) });
  }
}

async function handleListModels(req, res) {
  try {
    const body = await readJson(req);
    const config = normalizeConfig(body.config);
    const models = await listModels(config);
    json(res, 200, { models });
  } catch (error) {
    json(res, 502, { error: error.message || String(error) });
  }
}

function normalizeConfig(config = {}) {
  let customHeaders = {};
  if (config.customHeaders && typeof config.customHeaders === 'object' && !Array.isArray(config.customHeaders)) {
    const blocked = new Set(['authorization','proxy-authorization','cookie','set-cookie','host','origin','referer','content-length','connection','transfer-encoding','x-api-key','api-key','x-goog-api-key']);
    customHeaders = Object.fromEntries(Object.entries(config.customHeaders)
      .map(([key, value]) => [String(key).trim(), String(value)])
      .filter(([key]) => key && !blocked.has(key.toLowerCase())));
  }
  const providerId = String(config.providerId || config.provider || 'mock');
  const fallbackProtocol = providerId === 'openai'
    ? 'openai-responses'
    : providerId === 'anthropic'
      ? 'anthropic-messages'
      : providerId === 'gemini'
        ? 'gemini-generate-content'
        : providerId === 'mock'
          ? 'mock'
          : 'openai-chat';
  const rawProtocol = String(config.protocol || fallbackProtocol);
  const protocol = rawProtocol === 'codex-cli' ? 'codex-app-server' : rawProtocol;
  return {
    providerId,
    providerName: String(config.providerName || providerId),
    protocol,
    baseUrl: String(config.baseUrl || defaultBaseUrl(providerId)).trim().replace(/\/+$/, ''),
    model: String(config.model || ''),
    apiKey: String(config.apiKey || resolveStoredSecret(providerId) || ''),
    keyOptional: Boolean(config.keyOptional),
    authMode: String(config.authMode || 'bearer'),
    customHeaders,
    reasoningMode: String(config.reasoningMode || 'auto'),
    reasoningEffort: normalizeReasoningEffort(config.reasoningEffort, 'auto')
  };
}

function defaultBaseUrl(provider) {
  if (provider === 'openai') return 'https://api.openai.com/v1';
  if (provider === 'anthropic') return 'https://api.anthropic.com';
  if (provider === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta';
  if (provider === 'deepseek') return 'https://api.deepseek.com';
  return '';
}

async function generateText(configWithPrompt, { signal } = {}) {
  const { prompt, ...configInput } = configWithPrompt;
  return (await executeText(normalizeConfig(configInput), prompt, { signal })).text;
}

async function executeText(config, prompt, { maxTokens = 3800, signal } = {}) {
  if (signal?.aborted) throw Object.assign(new Error('生成已停止'), { name: 'AbortError' });
  if (config.protocol === 'mock') return { text: mockResponse(prompt), status: 200 };
  if (config.protocol === 'codex-app-server') return callCodexAppServer(config, prompt, { signal });
  validateRemoteConfig(config);
  if (config.protocol === 'openai-responses') return callOpenAIResponses(config, prompt, maxTokens, { signal });
  if (config.protocol === 'openai-chat') return callOpenAIChat(config, prompt, maxTokens, { signal });
  if (config.protocol === 'anthropic-messages') return callAnthropic(config, prompt, maxTokens, { signal });
  if (config.protocol === 'gemini-generate-content') return callGemini(config, prompt, maxTokens, { signal });
  throw new Error(`不支持的接口协议：${config.protocol}`);
}

function validateRemoteConfig(config) {
  if (!config.baseUrl || !/^https?:\/\//i.test(config.baseUrl)) throw new Error('Base URL 无效');
  if (!config.model) throw new Error(`${config.providerName} 缺少模型 ID`);
  if (!config.apiKey && !config.keyOptional && config.authMode !== 'none') throw new Error(`${config.providerName} 缺少 API Key`);
}

async function callOpenAIResponses(config, prompt, maxTokens, { signal } = {}) {
  const url = appendEndpoint(config.baseUrl, 'responses');
  const r = await fetchWithTimeout(url, {
    method: 'POST', headers: authHeaders(config, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(mergeReasoningIntoPayload({ model: config.model, input: prompt, max_output_tokens: maxTokens, store: false }, config))
  }, 45000, signal);
  const p = await responseJson(r);
  if (!r.ok) throw new Error(apiError(p, `${config.providerName} HTTP ${r.status}`));
  const text = typeof p.output_text === 'string'
    ? p.output_text
    : (p.output || []).flatMap(x => x.content || []).map(x => x.text || x.output_text || '').join('\n').trim();
  if (!text) throw new Error(`${config.providerName} 返回中没有可读取的文本`);
  return { text: repairUtf8Mojibake(text), status: r.status };
}

async function callOpenAIChat(config, prompt, maxTokens, { signal } = {}) {
  const url = appendEndpoint(config.baseUrl, 'chat/completions');
  const r = await fetchWithTimeout(url, {
    method: 'POST', headers: authHeaders(config, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(mergeReasoningIntoPayload({ model: config.model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, stream: false }, config))
  }, 45000, signal);
  const p = await responseJson(r);
  if (!r.ok) throw new Error(apiError(p, `${config.providerName} HTTP ${r.status}`));
  const choice = p.choices?.[0] || {};
  const message = choice.message || {};
  const text = firstReadableText(
    message.content,
    message.output_text,
    choice.text,
    p.output_text,
    message.tool_calls?.map(call => call?.function?.arguments),
    message.function_call?.arguments
  );
  if (!text) {
    const finish = choice.finish_reason ? `（finish_reason: ${choice.finish_reason}）` : '';
    throw new Error(`${config.providerName} 返回中没有可读取的文本${finish}`);
  }
  return { text, status: r.status };
}

function firstReadableText(...values) {
  const visit = value => {
    if (typeof value === 'string') return repairUtf8Mojibake(value.trim());
    if (Array.isArray(value)) return value.map(visit).filter(Boolean).join('\n').trim();
    if (!value || typeof value !== 'object') return '';
    for (const key of ['text','output_text','content','value','arguments']) {
      const found = visit(value[key]);
      if (found) return found;
    }
    return '';
  };
  for (const value of values) {
    const found = visit(value);
    if (found) return found;
  }
  return '';
}

async function callAnthropic(config, prompt, maxTokens, { signal } = {}) {
  const url = appendAnthropicEndpoint(config.baseUrl, 'messages');
  const r = await fetchWithTimeout(url, {
    method: 'POST',
    headers: authHeaders(config, { 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }),
    body: JSON.stringify(mergeReasoningIntoPayload({ model: config.model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }, config))
  }, 45000, signal);
  const p = await responseJson(r);
  if (!r.ok) throw new Error(apiError(p, `${config.providerName} HTTP ${r.status}`));
  const text = (p.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n').trim();
  if (!text) throw new Error(`${config.providerName} 返回中没有可读取的文本`);
  return { text: repairUtf8Mojibake(text), status: r.status };
}

async function callGemini(config, prompt, maxTokens, { signal } = {}) {
  const url = `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`;
  const headers = authHeaders(config, { 'content-type': 'application/json' });
  const r = await fetchWithTimeout(url, {
    method: 'POST', headers,
    body: JSON.stringify(mergeReasoningIntoPayload({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } }, config))
  }, 45000, signal);
  const p = await responseJson(r);
  if (!r.ok) throw new Error(apiError(p, `${config.providerName} HTTP ${r.status}`));
  const text = (p.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('\n').trim();
  if (!text) throw new Error(`${config.providerName} 返回中没有可读取的文本`);
  return { text: repairUtf8Mojibake(text), status: r.status };
}

async function listModels(config) {
  const profile = {
    id: config.providerId,
    providerId: config.providerId,
    protocol: config.protocol,
    reasoningMode: config.reasoningMode
  };
  if (config.protocol === 'mock') return normalizeDiscoveredModels([{ id: 'mock-thought', label: 'Mock Thought' }], profile);
  if (config.protocol === 'codex-app-server') {
    const account = await codexClient.accountRead({ refreshToken: false });
    if (!account?.account) throw new Error('Codex 尚未连接 ChatGPT 账号');
    return normalizeDiscoveredModels(await codexClient.listModels({ includeHidden: false }), profile);
  }
  if (!config.apiKey && !config.keyOptional && config.authMode !== 'none') throw new Error(`${config.providerName} 缺少 API Key`);
  let url;
  let headers = {};
  if (config.protocol === 'gemini-generate-content') {
    url = `${config.baseUrl}/models`;
    headers = authHeaders(config);
  } else if (config.protocol === 'anthropic-messages') {
    url = appendAnthropicEndpoint(config.baseUrl, 'models');
    headers = authHeaders(config, { 'anthropic-version': '2023-06-01' });
  } else {
    url = appendEndpoint(config.baseUrl, 'models');
    headers = authHeaders(config);
  }
  const r = await fetchWithTimeout(url, { method: 'GET', headers });
  const payload = await responseJson(r);
  if (!r.ok) throw new Error(apiError(payload, `${config.providerName} HTTP ${r.status}`));
  const raw = config.protocol === 'gemini-generate-content'
    ? (payload.models || []).map(item => ({ ...item, id: String(item?.name || '').replace(/^models\//, ''), label: item?.displayName || item?.name }))
    : (payload.data || payload.models || []);
  return normalizeDiscoveredModels(raw, profile);
}

function appendEndpoint(baseUrl, endpoint) {
  return `${String(baseUrl).replace(/\/+$/, '')}/${String(endpoint).replace(/^\/+/, '')}`;
}

function appendAnthropicEndpoint(baseUrl, endpoint) {
  const base = String(baseUrl).replace(/\/+$/, '');
  return /\/v1$/i.test(base) ? `${base}/${endpoint}` : `${base}/v1/${endpoint}`;
}

function authHeaders(config, extra = {}) {
  const headers = { ...extra };
  if (config.apiKey) {
    if (config.authMode === 'x-api-key') headers['x-api-key'] = config.apiKey;
    else if (config.authMode === 'api-key') headers['api-key'] = config.apiKey;
    else if (config.authMode === 'x-goog-api-key') headers['x-goog-api-key'] = config.apiKey;
    else if (config.authMode !== 'none') headers.Authorization = `Bearer ${config.apiKey}`;
  }
  return { ...headers, ...(config.customHeaders || {}) };
}

async function fetchWithTimeout(url, options, timeoutMs = 45000, externalSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) onExternalAbort();
  else externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (externalSignal?.aborted) throw Object.assign(new Error('生成已停止'), { name: 'AbortError' });
    if (timedOut || error.name === 'AbortError') throw new Error('请求超时');
    throw new Error(`无法连接供应商：${error.message || error}`);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

const CODEX_PROVIDER_PROFILE = {
  id: 'codex-cli',
  providerId: 'codex-cli',
  protocol: 'codex-app-server',
  reasoningMode: 'codex'
};

codexClient.on('account/login/completed', params => {
  const loginId = String(params?.loginId || '');
  const session = [...codexLoginSessions.values()].find(item => item.loginId === loginId || (!loginId && item.status === 'running'));
  if (!session) return;
  session.finishedAt = Date.now();
  session.error = params?.success ? '' : String(params?.error || (session.cancelRequested ? '授权已取消。' : 'Codex 授权失败。'));
  session.status = params?.success ? 'success' : session.cancelRequested ? 'cancelled' : 'error';
});

codexClient.on('account/updated', params => {
  if (!params?.authMode) return;
  const session = latestRunningCodexSession();
  if (!session) return;
  session.status = 'success';
  session.finishedAt = Date.now();
  session.error = '';
});

codexClient.on('exit', ({ error }) => {
  for (const session of codexLoginSessions.values()) {
    if (!['running', 'cancelling'].includes(session.status)) continue;
    session.status = 'error';
    session.finishedAt = Date.now();
    session.error = error?.message || 'Codex App Server 已退出。';
  }
});

function safeCodexAccount(account) {
  if (!account || typeof account !== 'object') return null;
  const safe = { type: String(account.type || '') };
  for (const key of ['email', 'planType', 'credentialSource']) {
    if (account[key] != null && String(account[key]).trim()) safe[key] = String(account[key]);
  }
  return safe;
}

async function detectCodexStatus({ includeModels = true } = {}) {
  try {
    await codexClient.start();
  } catch (error) {
    const missing = error?.code === 'ENOENT' || /ENOENT|not found|未找到/i.test(String(error?.message || error));
    return {
      installed: !missing,
      loggedIn: false,
      version: '',
      detail: missing ? 'Codex CLI 未安装或不在 PATH 中' : `Codex App Server 启动失败：${error.message || error}`,
      account: null,
      models: [],
      error: missing ? '' : String(error.message || error)
    };
  }
  try {
    const accountResult = await codexClient.accountRead({ refreshToken: false });
    const account = safeCodexAccount(accountResult?.account);
    const loggedIn = Boolean(account);
    let models = [];
    if (loggedIn && includeModels) models = normalizeDiscoveredModels(await codexClient.listModels({ includeHidden: false }), CODEX_PROVIDER_PROFILE);
    return {
      installed: true,
      loggedIn,
      version: 'App Server',
      detail: loggedIn
        ? `已通过 ${account.type === 'chatgpt' ? 'ChatGPT' : account.type || 'Codex'} 连接${account.planType ? ` · ${account.planType}` : ''}`
        : 'Codex App Server 可用，尚未连接 ChatGPT 账号。',
      requiresOpenaiAuth: Boolean(accountResult?.requiresOpenaiAuth),
      account,
      models
    };
  } catch (error) {
    return {
      installed: true,
      loggedIn: false,
      version: 'App Server',
      detail: `无法读取 Codex 账号状态：${error.message || error}`,
      account: null,
      models: [],
      error: String(error.message || error)
    };
  }
}

async function handleCodexStatus(res) {
  const status = await detectCodexStatus({ includeModels: true });
  const activeSession = latestRunningCodexSession();
  json(res, 200, { ...status, activeSession: activeSession ? publicCodexSession(activeSession) : null });
}

async function handleCodexStart(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const mode = String(body.mode || 'browser');
  if (!['browser', 'device'].includes(mode)) return json(res, 400, { error: '不支持的 Codex 授权方式。' });

  const detected = await detectCodexStatus({ includeModels: false });
  if (!detected.installed) return json(res, 400, { error: '未检测到支持 App Server 的 Codex CLI。请先安装或升级官方 Codex CLI。' });
  if (detected.error) return json(res, 502, { error: detected.detail });
  if (detected.loggedIn) {
    const models = normalizeDiscoveredModels(await codexClient.listModels({ includeHidden: false }), CODEX_PROVIDER_PROFILE);
    return json(res, 200, { status: 'success', mode, account: detected.account, models, message: 'Codex 已连接。' });
  }
  const activeSession = latestRunningCodexSession();
  if (activeSession) return json(res, 409, { error: '已有 Codex 授权会话正在进行，请先完成或取消。', session: publicCodexSession(activeSession) });

  pruneCodexSessions();
  try {
    const result = await codexClient.loginStart(mode);
    const loginId = String(result?.loginId || `codex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const session = {
      id: loginId,
      loginId,
      mode,
      status: 'running',
      authUrl: String(result?.authUrl || result?.authorizationUrl || result?.verificationUriComplete || ''),
      verificationUrl: String(result?.verificationUrl || result?.verificationUri || result?.verification_url || ''),
      userCode: String(result?.userCode || result?.deviceCode || result?.user_code || ''),
      startedAt: Date.now(),
      finishedAt: null,
      cancelRequested: false,
      error: ''
    };
    codexLoginSessions.set(session.id, session);
    json(res, 202, publicCodexSession(session));
  } catch (error) {
    json(res, 502, { error: error.message || String(error) });
  }
}

async function handleCodexSession(url, res) {
  const id = url.searchParams.get('id') || '';
  const session = codexLoginSessions.get(id);
  if (!session) return json(res, 404, { error: '授权会话不存在或已过期。' });
  if (session.status === 'running') {
    const status = await detectCodexStatus({ includeModels: false });
    if (status.loggedIn) {
      session.status = 'success';
      session.finishedAt = Date.now();
    }
  }
  const payload = publicCodexSession(session);
  if (session.status === 'success') {
    const status = await detectCodexStatus({ includeModels: true });
    payload.account = status.account;
    payload.models = status.models;
  }
  json(res, 200, payload);
}

async function handleCodexCancel(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const id = String(body.sessionId || body.loginId || '');
  const session = codexLoginSessions.get(id);
  if (!session) return json(res, 404, { error: '授权会话不存在或已过期。' });
  if (!['running', 'cancelling'].includes(session.status)) return json(res, 200, publicCodexSession(session));
  session.cancelRequested = true;
  session.status = 'cancelling';
  try {
    await codexClient.loginCancel(session.loginId);
    if (session.status === 'cancelling') {
      session.status = 'cancelled';
      session.finishedAt = Date.now();
      session.error = '授权已取消。';
    }
    json(res, 200, publicCodexSession(session));
  } catch (error) {
    session.status = 'error';
    session.finishedAt = Date.now();
    session.error = String(error.message || error);
    json(res, 502, { error: session.error, session: publicCodexSession(session) });
  }
}

async function handleCodexLogout(req, res) {
  await readJson(req).catch(() => ({}));
  for (const session of codexLoginSessions.values()) {
    if (!['running', 'cancelling'].includes(session.status)) continue;
    session.cancelRequested = true;
    await codexClient.loginCancel(session.loginId).catch(() => {});
    session.status = 'cancelled';
    session.finishedAt = Date.now();
    session.error = '授权已取消。';
  }
  try {
    await codexClient.logout();
    json(res, 200, { ok: true, message: '已退出 Codex ChatGPT 登录。' });
  } catch (error) {
    json(res, 502, { error: error.message || String(error) });
  }
}

function publicCodexSession(session) {
  const message = session.status === 'success'
    ? 'Codex 授权成功。'
    : session.status === 'cancelled'
      ? 'Codex 授权已取消。'
      : session.status === 'error'
        ? session.error || 'Codex 授权失败。'
        : session.mode === 'device'
          ? '请打开验证网址并输入设备码。'
          : '请在新窗口完成 ChatGPT 授权。';
  return {
    sessionId: session.id,
    id: session.id,
    loginId: session.loginId,
    mode: session.mode,
    status: session.status,
    authUrl: session.authUrl,
    verificationUrl: session.verificationUrl,
    userCode: session.userCode,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    error: session.error || '',
    message,
    log: message
  };
}

function latestRunningCodexSession() {
  return [...codexLoginSessions.values()]
    .filter(session => ['running', 'cancelling'].includes(session.status))
    .sort((a, b) => b.startedAt - a.startedAt)[0] || null;
}

function pruneCodexSessions() {
  const completed = [...codexLoginSessions.values()]
    .filter(session => !['running', 'cancelling'].includes(session.status))
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const session of completed.slice(20)) codexLoginSessions.delete(session.id);
}

async function callCodexAppServer(config, prompt, { signal, onDelta = () => {} } = {}) {
  if (signal?.aborted) throw Object.assign(new Error('生成已停止'), { name: 'AbortError' });
  const account = await codexClient.accountRead({ refreshToken: false });
  if (!account?.account) throw new Error('Codex 尚未完成 ChatGPT 授权');
  return codexClient.generate({
    model: config.model,
    effort: normalizeReasoningEffort(config.reasoningEffort, 'auto'),
    prompt,
    signal,
    onDelta
  });
}

function normalizeCompact(value, coveredMessageIds = []) {
  return {
    summary: String(value?.summary || '').trim().slice(0, 12000),
    confirmedConclusions: stringArray(value?.confirmedConclusions),
    openQuestions: stringArray(value?.openQuestions),
    rejectedAssumptions: stringArray(value?.rejectedAssumptions),
    importantUserConstraints: stringArray(value?.importantUserConstraints),
    coveredMessageIds: [...new Set((coveredMessageIds || []).map(String))]
  };
}

function stringArray(value) {
  return (Array.isArray(value) ? value : []).map(item => String(item || '').trim()).filter(Boolean).slice(0, 30);
}

function compactStructuredFallback(transcript, coveredMessageIds = []) {
  const clean = String(transcript || '').trim();
  return normalizeCompact({ summary: clean.slice(-5000), confirmedConclusions: [], openQuestions: [], rejectedAssumptions: [], importantUserConstraints: [] }, coveredMessageIds);
}

function organizeStructuredFallback(text) {
  const clean = String(text || '').trim();
  return {
    topic: clean.split(/\n/).find(Boolean)?.slice(0, 180) || '当前讨论',
    confirmedConclusions: [],
    keyArguments: clean ? [clean.slice(0, 1200)] : [],
    revisedOrRejectedJudgments: [],
    openQuestions: [],
    recommendedNextStep: '阅读整理结果后，决定继续追问或手动拆解该结果。'
  };
}

function mockAnalyze(question) {
  const answer = `## 核心判断\n\n你提出的是“${question}”。真正需要区分的不是谁会用 AI 生成视频，而是谁控制客户、数据、分发和交易。\n\n> **核心区别**\n> 普通人把 AI 当成生产工具；更高层的玩家把它嵌入一套可持续经营系统。\n\n## 1. 自营内容与交易\n\n使用低成本内容能力运营账号、联盟带货或自营商品。优势是启动直接，风险是同时承担选品、流量和转化。\n\n## 2. 产品化与基础设施\n\n把稳定的视频工作流包装为服务、SaaS 或 API。价值来自替客户降低组织生产的成本，而不是只提供一次生成。\n\n## 3. 行业工作流与结果交付\n\n选择一个行业，连接商品资料、品牌规则、发布、投放和成交数据，按持续结果收费。\n\n## 4. 数据、渠道与责任\n\n更长期的壁垒来自真实业务数据、客户入口、授权资产和对结果负责的能力。\n\n## 当前结论\n\n先逐块理解这些路径，再比较它们对个人资源、风险和启动速度的要求。`;
  return {
    goalSuggestion: `为“${String(question).slice(0, 24)}”选择可验证且可持续的路径`,
    answer,
    sections: fallbackSectionsFromAnswer(answer),
    structured: true
  };
}

function mockDecompose(question, answer) {
  return fallbackSectionsFromAnswer(answer).slice(0, 8);
}

function mockResponse(prompt) {
  const q = prompt.match(/当前用户明确问题（最高优先级）：\n([^\n]+)/)?.[1]?.trim()
    || prompt.match(/用户当前明确追问（最高优先级）：([^\n]+)/)?.[1]?.trim()
    || prompt.match(/当前要回答的问题：([^\n]+)/)?.[1]?.trim()
    || '当前问题';
  if (/代号/.test(q) && /北极星17/.test(prompt)) {
    return `## 直接回答\n\n项目代号是 **北极星17**。\n\n这个事实来自父节点的完整消息上下文。`;
  }
  return `## 我理解你的追问\n\n你现在想弄清的是：**${q}**。\n\n## 聚焦回答\n\n这个节点已经继承了父节点的讲解内容和祖先路径。接下来只需要围绕当前问题补足解释，不必重新展开整张画布。\n\n> **当前判断**\n> 先确认会改变最终决策的变量，再决定是否继续拆解。\n\n\`\`\`text\n这是一段可以复制的示例代码块。\n\`\`\``;
}

function mockSynthesis(mode, branches) {
  return `## 共同结论\n\n所选 ${branches.length} 个节点共同服务于同一目标。\n\n## 各节点独有内容\n${branches.map((b, i) => `${i + 1}. **${b.title}**：保留该节点最重要的解释。`).join('\n')}\n\n## 综合判断\n\n把一致结论作为新主线，把真正冲突的前提保留为待验证事项。`;
}

function normalizeForMatch(text) {
  return String(text || '').replace(/\r/g, '').trim();
}

function ensureSectionSourceFidelity(sections, originalText) {
  const original = normalizeForMatch(originalText);
  if (!original) return [];
  const candidates = (Array.isArray(sections) ? sections : []).slice(0, 8);
  const exact = [];
  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i] || {};
    const source = normalizeForMatch(item.sourceText || item.sourceQuote || item.source || item.content);
    if (!source || !original.includes(source)) continue;
    const start = original.indexOf(source);
    exact.push({
      title: String(item.title || `内容模块 ${i + 1}`).trim().slice(0, 80),
      content: source.slice(0, 12000),
      summary: String(item.summary || source).trim().slice(0, 360),
      sourceQuote: source.slice(0, 12000),
      sourceText: source.slice(0, 12000),
      sourceStart: start,
      sourceEnd: start + source.length,
      order: exact.length
    });
  }
  if (exact.length >= 2 || (candidates.length === 1 && exact.length === 1)) return exact;
  let cursor = 0;
  return fallbackSectionsFromAnswer(original).map((item, index) => {
    const start = original.indexOf(item.content, cursor);
    if (start >= 0) cursor = start + item.content.length;
    return { ...item, content: item.content, sourceQuote: item.content, sourceText: item.content, sourceStart: Math.max(0, start), sourceEnd: Math.max(0, start) + item.content.length, order: index };
  });
}

function sanitizeSections(sections) {
  return (Array.isArray(sections) ? sections : []).slice(0, 8).map((item, i) => {
    const title = String(item?.title || `内容模块 ${i + 1}`).trim().slice(0, 80);
    const content = String(item?.content || item?.explanation || item?.summary || '').trim().slice(0, 8000);
    const summary = String(item?.summary || content).trim().slice(0, 360);
    const sourceQuote = String(item?.sourceText || item?.sourceQuote || item?.source || '').trim().slice(0, 12000);
    return { title, content, summary, sourceQuote, sourceText: sourceQuote, order: i };
  }).filter(item => item.content);
}

function deriveGoalFallback(question, uiLanguage = 'zh-CN') {
  const clean = repairUtf8Mojibake(String(question || '')).replace(/\s+/g, ' ').trim();
  const locale = normalizeUiLanguage(uiLanguage);
  if (locale === 'en') return clean ? `Form an actionable judgment about “${clean.slice(0, 60)}”` : 'Turn the current complex question into an actionable judgment';
  if (locale === 'ja') return clean ? `「${clean.slice(0, 40)}」について実行可能な判断を形成する` : '現在の複雑な問いを実行可能な判断へまとめる';
  return clean ? `围绕“${clean.slice(0, 30)}”形成可执行的判断` : '把当前复杂问题形成可执行的判断';
}

function unwrapUserFacingAnswer(raw) {
  const text = repairUtf8Mojibake(String(raw || '').trim());
  if (!text) return '';
  try {
    const parsed = parseJsonObjectLenient(text);
    const candidate = parsed.answer ?? parsed.text ?? parsed.content ?? parsed.response;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  } catch {}
  return text.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function fallbackSectionsFromAnswer(answer) {
  const text = String(answer || '').trim();
  if (!text) return [];
  const headingRe = /^(#{1,4})\s+(.+)$/gm;
  const matches = [...text.matchAll(headingRe)];
  const result = [];
  if (matches.length) {
    for (let i = 0; i < matches.length; i++) {
      const title = matches[i][2].trim();
      if (/^(核心判断|当前结论|总结|结论)$/i.test(title) && matches.length > 4) continue;
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const content = text.slice(start, end).trim();
      if (!content || content.length < 12) continue;
      result.push({
        title: title.slice(0, 80),
        content: content.slice(0, 8000),
        summary: content.replace(/[#>*_`\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300),
        sourceQuote: content.slice(0, 12000),
        sourceText: content.slice(0, 12000),
        order: result.length
      });
    }
  }
  if (result.length >= 1) return result.slice(0, 8);
  const paragraphs = text.split(/\n\s*\n/).map(x => x.trim()).filter(x => x.length > 40 && !x.startsWith('```'));
  return paragraphs.slice(0, 6).map((content, i) => ({
    title: `内容模块 ${i + 1}`,
    content: content.slice(0, 8000),
    summary: content.replace(/[#>*_`\-]/g, ' ').replace(/\s+/g, ' ').slice(0, 300),
    sourceQuote: content.slice(0, 12000),
        sourceText: content.slice(0, 12000),
    order: i
  }));
}

function parseJsonObjectLenient(raw) {
  let cleaned = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const attempts = [cleaned];
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) attempts.push(cleaned.slice(start, end + 1));
  for (const candidate of attempts) {
    try { return repairUtf8MojibakeDeep(JSON.parse(candidate)).value; } catch {}
    try {
      const repaired = candidate
        .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
        .replace(/}\s*{/g, '},{')
        .replace(/"\s*\n\s*"(?=[A-Za-z_])/g, '",\n"')
        .replace(/]\s*\n\s*"/g, '],\n"')
        .replace(/}\s*\n\s*"/g, '},\n"');
      return repairUtf8MojibakeDeep(JSON.parse(repaired)).value;
    } catch {}
  }
  throw new Error('无法解析模型返回的 JSON');
}

function parseJsonObject(raw) { return parseJsonObjectLenient(raw); }

function injectRuntimeSessionToken(html) {
  const meta = `<meta name="thought-canvas-session" content="${runtimeSessionToken}">`;
  const source = String(html || '');
  if (source.includes('name="thought-canvas-session"')) return source;
  return source.includes('</head>') ? source.replace('</head>', `  ${meta}\n</head>`) : `${meta}\n${source}`;
}

async function serveStatic(pathname, res) {
  let requested = pathname === '/' ? '/index.html' : pathname;
  requested = decodeURIComponent(requested);
  const filePath = path.resolve(root, `.${requested}`);
  if (!filePath.startsWith(root)) return json(res, 403, { error: 'Forbidden' });
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Not file');
    const extension = path.extname(filePath);
    if (extension === '.html') {
      const html = injectRuntimeSessionToken(await readFile(filePath, 'utf8'));
      res.writeHead(200, { 'Content-Type': mime[extension], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.end(html);
    }
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': mime[extension] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  } catch {
    const html = injectRuntimeSessionToken(await readFile(path.join(root, 'index.html'), 'utf8'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(html);
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 2_000_000) req.destroy(); });
    req.on('end', () => {
      try {
        const repaired = repairUtf8MojibakeDeep(JSON.parse(data || '{}'));
        if (repaired.value && typeof repaired.value === 'object') {
          Object.defineProperty(repaired.value, REQUEST_ENCODING_REPAIR, { value: repaired.repairs, enumerable: false });
        }
        resolve(repaired.value);
      } catch {
        reject(new Error('JSON 格式错误'));
      }
    });
    req.on('error', reject);
  });
}
function json(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(payload));
}
async function responseJson(r) {
  const raw = repairUtf8Mojibake(await r.text());
  try { return raw ? repairUtf8MojibakeDeep(JSON.parse(raw)).value : {}; } catch { return { raw }; }
}
function apiError(p, fallback) { return p?.error?.message || p?.message || p?.raw || fallback; }
