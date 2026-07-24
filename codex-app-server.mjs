import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import readline from 'node:readline';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { repairUtf8Mojibake } from './text-encoding.js';

const DEFAULT_REQUEST_TIMEOUT = 45_000;
const DEFAULT_TURN_TIMEOUT = 180_000;
const BUILT_IN_READ_ONLY_PERMISSION_PROFILE = ':read-only';

function appServerError(payload, fallback = 'Codex App Server 请求失败') {
  const value = payload?.error || payload;
  const message = value?.message || value?.error?.message || fallback;
  const error = new Error(repairUtf8Mojibake(String(message)));
  if (value?.code != null) error.code = value.code;
  if (value?.data != null) error.data = value.data;
  return error;
}

function errorDetails(error) {
  const values = [error?.message, error?.data?.message, error?.data];
  return values
    .map(value => typeof value === 'string' ? value : (value && typeof value === 'object' ? JSON.stringify(value) : ''))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isExperimentalCompatibilityError(error) {
  const text = errorDetails(error);
  return error?.code === -32601
    || /method not found|unsupported|unknown field|unknown variant|experimentalapi|experimental api/.test(text);
}

function isPermissionProfileCompatibilityError(error) {
  const text = errorDetails(error);
  return Number(error?.code) === -32601
    || /method not found|unknown method|unknown field|unknown variant/.test(text)
    || /permissionprofile|permission profile/.test(text)
      && /unsupported|not supported|not recognized|requires experimental/.test(text);
}

function abortError() {
  return Object.assign(new Error('生成已停止'), { name: 'AbortError' });
}

function safeText(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  for (const key of ['delta', 'text', 'output_text', 'content', 'value']) {
    const found = safeText(value[key]);
    if (found) return found;
  }
  if (Array.isArray(value)) return value.map(safeText).join('');
  return '';
}

function notificationThreadId(params = {}) {
  return String(params.threadId || params.thread?.id || params.turn?.threadId || '');
}

function notificationTurnId(params = {}) {
  return String(params.turnId || params.turn?.id || params.item?.turnId || '');
}

function finalAgentText(params = {}) {
  const item = params.item || params;
  if (item?.type !== 'agentMessage') return '';
  return safeText(item.text || item.content || '');
}

export class CodexAppServerClient extends EventEmitter {
  constructor({ command = 'codex', cwd = process.cwd(), env = process.env, version = '1.2.5' } = {}) {
    super();
    this.command = command;
    this.cwd = cwd;
    this.env = env;
    this.version = version;
    this.child = null;
    this.reader = null;
    this.pending = new Map();
    this.nextId = 1;
    this.startPromise = null;
    this.stderrTail = '';
    this.closed = false;
    this.experimentalApi = false;
    this.permissionProfileSupport = 'unknown';
  }

  get running() {
    return Boolean(this.child && this.child.exitCode == null && !this.child.killed);
  }

  async start() {
    if (this.running) return this;
    if (this.startPromise) return this.startPromise;
    this.closed = false;
    this.startPromise = this.#startProcess();
    try {
      await this.startPromise;
      return this;
    } finally {
      this.startPromise = null;
    }
  }

  async #startProcess() {
    this.experimentalApi = false;
    this.permissionProfileSupport = 'unknown';
    this.stderrTail = '';
    const child = spawn(this.command, ['app-server'], {
      cwd: this.cwd,
      env: this.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    this.child = child;
    child.stdin.setDefaultEncoding('utf8');
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => {
      this.stderrTail = `${this.stderrTail}${String(chunk)}`.slice(-8_000);
    });
    this.reader = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
    this.reader.on('line', line => this.#handleLine(line));
    child.on('close', (code, signal) => this.#handleClose(code, signal));

    await new Promise((resolve, reject) => {
      const onSpawn = () => { cleanup(); resolve(); };
      const onError = error => { cleanup(); reject(error); };
      const cleanup = () => {
        child.off('spawn', onSpawn);
        child.off('error', onError);
      };
      child.once('spawn', onSpawn);
      child.once('error', onError);
    });

    const initializeParams = {
      clientInfo: {
        name: 'thought_canvas',
        title: 'Thought Canvas',
        version: this.version
      }
    };
    try {
      await this.request('initialize', {
        ...initializeParams,
        capabilities: { experimentalApi: true }
      }, { skipStart: true, timeoutMs: 15_000 });
      this.experimentalApi = true;
    } catch (error) {
      if (!isExperimentalCompatibilityError(error)) throw error;
      await this.request('initialize', initializeParams, { skipStart: true, timeoutMs: 15_000 });
      this.experimentalApi = false;
    }
    this.notify('initialized', {});
  }

  #handleLine(line) {
    const value = String(line || '').trim();
    if (!value) return;
    let message;
    try { message = JSON.parse(value); }
    catch {
      this.emit('protocol-warning', { message: 'Codex App Server 返回了非 JSONL 内容。' });
      return;
    }
    if (message.id != null && (Object.hasOwn(message, 'result') || Object.hasOwn(message, 'error'))) {
      const pending = this.pending.get(String(message.id));
      if (!pending) return;
      this.pending.delete(String(message.id));
      clearTimeout(pending.timer);
      if (message.error) pending.reject(appServerError(message));
      else pending.resolve(message.result ?? {});
      return;
    }
    if (message.id != null && message.method) {
      // Thought Canvas does not expose approvals or host-managed token refresh.
      // Fail closed so the turn cannot hang waiting for an unsupported host action.
      this.#write({ id: message.id, error: { code: -32601, message: `Unsupported client request: ${message.method}` } });
      this.emit('server-request', message);
      return;
    }
    if (message.method) {
      this.emit('notification', message);
      // EventEmitter treats the literal event name `error` as fatal when no
      // listener is attached. Keep the protocol notification observable without
      // allowing a provider-side turn error to crash the local server process.
      if (message.method === 'error') this.emit('serverError', message.params || {});
      else this.emit(message.method, message.params || {});
    }
  }

  #handleClose(code, signal) {
    const wasClosed = this.closed;
    this.child = null;
    this.reader?.close();
    this.reader = null;
    const detail = this.stderrTail.trim();
    const suffix = detail ? `：${detail.slice(-600)}` : '';
    const error = new Error(`Codex App Server 已退出（${code ?? signal ?? 'unknown'}）${suffix}`);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.experimentalApi = false;
    this.permissionProfileSupport = 'unknown';
    if (!wasClosed) this.emit('exit', { code, signal, error });
  }

  #write(message) {
    if (!this.running || !this.child?.stdin?.writable) throw new Error('Codex App Server 未运行');
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  notify(method, params = {}) {
    this.#write({ method, params });
  }

  async request(method, params = {}, { timeoutMs = DEFAULT_REQUEST_TIMEOUT, skipStart = false } = {}) {
    if (!skipStart) await this.start();
    const id = String(this.nextId++);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex App Server 请求超时：${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      try { this.#write({ method, id: Number(id), params }); }
      catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async accountRead({ refreshToken = false } = {}) {
    return this.request('account/read', { refreshToken });
  }

  async loginStart(mode = 'browser') {
    const params = mode === 'device'
      ? { type: 'chatgptDeviceCode' }
      : { type: 'chatgpt', useHostedLoginSuccessPage: true, appBrand: 'chatgpt' };
    return this.request('account/login/start', params, { timeoutMs: 30_000 });
  }

  async loginCancel(loginId) {
    if (!loginId) throw new Error('缺少 Codex loginId');
    return this.request('account/login/cancel', { loginId }, { timeoutMs: 20_000 });
  }

  async logout() {
    return this.request('account/logout', {}, { timeoutMs: 30_000 });
  }

  async listModels({ includeHidden = false, limit = 100 } = {}) {
    const collected = [];
    let cursor = null;
    for (let page = 0; page < 20; page += 1) {
      const params = { limit, includeHidden };
      if (cursor) params.cursor = cursor;
      const result = await this.request('model/list', params, { timeoutMs: 30_000 });
      if (Array.isArray(result?.data)) collected.push(...result.data);
      cursor = result?.nextCursor || null;
      if (!cursor) break;
    }
    return collected;
  }

  async listPermissionProfiles({ cwd, limit = 100 } = {}) {
    if (!this.experimentalApi || this.permissionProfileSupport === 'unsupported') return [];
    const collected = [];
    let cursor = null;
    try {
      for (let page = 0; page < 20; page += 1) {
        const params = { limit };
        if (cwd) params.cwd = String(cwd);
        if (cursor) params.cursor = cursor;
        const result = await this.request('permissionProfile/list', params, { timeoutMs: 20_000 });
        if (Array.isArray(result?.data)) collected.push(...result.data);
        cursor = result?.nextCursor || null;
        if (!cursor) break;
      }
      this.permissionProfileSupport = 'supported';
      return collected;
    } catch (error) {
      if (!isPermissionProfileCompatibilityError(error)) throw error;
      this.permissionProfileSupport = 'unsupported';
      return [];
    }
  }

  async #startReadOnlyThread({ model, cwd }) {
    const baseParams = {
      model: String(model),
      cwd: String(cwd),
      approvalPolicy: 'never',
      serviceName: 'thought_canvas'
    };

    const profiles = await this.listPermissionProfiles({ cwd });
    if (this.permissionProfileSupport === 'supported') {
      const readOnly = profiles.find(profile => String(profile?.id || '') === BUILT_IN_READ_ONLY_PERMISSION_PROFILE);
      if (!readOnly) {
        throw new Error('Codex 当前没有提供内置只读权限配置（:read-only），Thought Canvas 已停止本次生成以避免扩大本机访问范围。');
      }
      if (readOnly.allowed === false) {
        throw new Error('Codex 当前管理策略不允许使用内置只读权限配置（:read-only）。');
      }
      try {
        const result = await this.request('thread/start', {
          ...baseParams,
          permissions: BUILT_IN_READ_ONLY_PERMISSION_PROFILE,
          ephemeral: true
        }, { timeoutMs: 45_000 });
        return { result, permissionMode: 'permissionProfile' };
      } catch (error) {
        // Some transition-era App Server builds expose the profile catalog but
        // still reject the `permissions` thread field. Fall back only for an
        // explicit protocol-shape incompatibility. Managed-policy denials and
        // all other failures remain fatal and cannot widen local access.
        if (!isPermissionProfileCompatibilityError(error)) throw error;
        this.permissionProfileSupport = 'unsupported';
      }
    }

    const result = await this.request('thread/start', {
      ...baseParams,
      sandbox: 'read-only'
    }, { timeoutMs: 45_000 });
    return { result, permissionMode: 'legacySandbox' };
  }

  async generate({ model, effort = 'auto', prompt, signal, onDelta = () => {}, cleanupThread = true } = {}) {
    if (!String(model || '').trim()) throw new Error('Codex 缺少模型 ID');
    if (!String(prompt || '').trim()) throw new Error('Codex 缺少 prompt');
    if (signal?.aborted) throw abortError();
    await this.start();

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'thought-canvas-codex-'));
    let threadId = '';
    let turnId = '';
    let accumulated = '';
    let finalText = '';
    let completed = false;
    let turnError = null;
    let abortRequested = false;

    const matches = params => {
      const eventThreadId = notificationThreadId(params);
      const eventTurnId = notificationTurnId(params);
      if (eventThreadId && threadId && eventThreadId !== threadId) return false;
      if (eventTurnId && turnId && eventTurnId !== turnId) return false;
      return Boolean(threadId);
    };

    let resolveCompletion;
    let rejectCompletion;
    const completion = new Promise((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });

    const onNotification = message => {
      const params = message.params || {};
      if (!matches(params)) return;
      if (message.method === 'item/agentMessage/delta') {
        const delta = safeText(params.delta ?? params.text ?? params);
        if (delta) {
          accumulated += delta;
          onDelta(delta);
        }
        return;
      }
      if (message.method === 'item/completed') {
        const candidate = finalAgentText(params);
        if (candidate) finalText = candidate;
        return;
      }
      if (message.method === 'error') {
        const errorInfo = params.error || params;
        turnError = appServerError(errorInfo, 'Codex 生成失败');
        return;
      }
      if (message.method === 'turn/completed') {
        const status = String(params.turn?.status || params.status || '').toLowerCase();
        completed = true;
        if (status === 'failed') rejectCompletion(turnError || new Error(params.turn?.error?.message || 'Codex 生成失败'));
        else if (status === 'interrupted' || abortRequested) rejectCompletion(abortError());
        else resolveCompletion(params.turn || params);
      }
    };
    this.on('notification', onNotification);

    const interrupt = async () => {
      abortRequested = true;
      if (!threadId || !turnId || completed) return;
      try { await this.request('turn/interrupt', { threadId, turnId }, { timeoutMs: 15_000 }); }
      catch {}
    };
    const onAbort = () => { void interrupt(); };
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const { result: threadResult, permissionMode } = await this.#startReadOnlyThread({
        model: String(model),
        cwd: tempDir
      });
      threadId = String(threadResult?.thread?.id || '');
      if (!threadId) throw new Error('Codex App Server 未返回 threadId');
      if (signal?.aborted) throw abortError();

      // The thread already owns the selected read-only permission profile (or
      // the legacy read-only sandbox). Do not send a turn-level readOnly.access
      // override: current Codex versions reject that deprecated shape.
      const turnParams = {
        threadId,
        input: [{ type: 'text', text: String(prompt) }],
        model: String(model),
        approvalPolicy: 'never'
      };
      if (effort && effort !== 'auto') turnParams.effort = effort;
      const turnResult = await this.request('turn/start', turnParams, { timeoutMs: 45_000 });
      turnId = String(turnResult?.turn?.id || '');
      if (!turnId) throw new Error('Codex App Server 未返回 turnId');
      if (signal?.aborted) await interrupt();

      const timeout = setTimeout(() => rejectCompletion(new Error('Codex 生成超时')), DEFAULT_TURN_TIMEOUT);
      try { await completion; }
      finally { clearTimeout(timeout); }
      const text = repairUtf8Mojibake(String(finalText || accumulated).trim());
      if (!text) throw new Error('Codex 没有返回可读取的最终回答');
      return { text, status: 200, threadId, turnId, permissionMode };
    } finally {
      signal?.removeEventListener('abort', onAbort);
      this.off('notification', onNotification);
      if (signal?.aborted && threadId && turnId && !completed) await interrupt();
      if (threadId) {
        await this.request('thread/unsubscribe', { threadId }, { timeoutMs: 8_000 }).catch(() => {});
        if (cleanupThread) await this.request('thread/delete', { threadId }, { timeoutMs: 12_000 }).catch(() => {});
      }
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async close() {
    this.closed = true;
    const child = this.child;
    if (!child || child.exitCode != null) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch {}
        resolve();
      }, 1_500);
      child.once('close', () => { clearTimeout(timer); resolve(); });
      try { child.kill('SIGTERM'); } catch { clearTimeout(timer); resolve(); }
    });
  }
}
