/**
 * DeepSeek live smoke test.
 * Usage:
 *   DEEPSEEK_API_KEY='...' npm run test:deepseek
 *
 * The key is read from the process environment, never written to disk or printed.
 */
const apiKey = process.env.DEEPSEEK_API_KEY;
const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
if (!apiKey) {
  console.error('BLOCKED: missing DEEPSEEK_API_KEY environment variable.');
  process.exit(2);
}
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30000);
const started = Date.now();
try {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: '只回复 CONNECTION_OK' }],
      max_tokens: 16,
      stream: false
    }),
    signal: controller.signal
  });
  const raw = await response.text();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { raw }; }
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || String(payload?.raw || '').slice(0, 180) || `HTTP ${response.status}`;
    console.error(`FAIL: HTTP ${response.status}; ${message}`);
    process.exit(1);
  }
  const content = payload?.choices?.[0]?.message?.content;
  if (!String(content || '').includes('CONNECTION_OK')) {
    console.error(`FAIL: unexpected response after ${Date.now() - started}ms.`);
    process.exit(1);
  }
  console.log(`PASS: ${model}; HTTP ${response.status}; ${Date.now() - started}ms; CONNECTION_OK`);
} catch (error) {
  const reason = error?.name === 'AbortError' ? 'timeout' : String(error?.message || error);
  console.error(`BLOCKED_OR_FAIL: unable to reach DeepSeek (${reason}).`);
  process.exit(1);
} finally {
  clearTimeout(timer);
}
