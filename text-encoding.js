const WINDOWS_1252_REVERSE = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f]
]);

const COMMON_MOJIBAKE_LEADS = new Set([
  'Ã', 'Â', 'â', 'ð', 'ä', 'å', 'æ', 'ç', 'è', 'é', 'ê', 'ë',
  'ì', 'í', 'î', 'ï', 'ñ', 'ò', 'ó', 'ô', 'õ', 'ö', 'ø', 'ù',
  'ú', 'û', 'ü', 'ý', 'þ', 'ã', 'Ð', 'Ñ'
]);

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function windows1252Byte(codePoint) {
  if (codePoint >= 0 && codePoint <= 0xff) return codePoint;
  return WINDOWS_1252_REVERSE.get(codePoint) ?? -1;
}

function encodeWindows1252(value) {
  const bytes = [];
  for (const character of String(value ?? '')) {
    const byte = windows1252Byte(character.codePointAt(0));
    if (byte < 0) return null;
    bytes.push(byte);
  }
  return Uint8Array.from(bytes);
}

function decodeWindows1252AsUtf8(value) {
  const bytes = encodeWindows1252(value);
  if (!bytes) return null;
  try {
    return UTF8_DECODER.decode(bytes);
  } catch {
    return null;
  }
}

function mojibakeSignalScore(value) {
  const text = String(value ?? '');
  let score = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (character === '\ufffd') score += 8;
    if (codePoint >= 0x80 && codePoint <= 0x9f) score += 5;
    if (WINDOWS_1252_REVERSE.has(codePoint)) score += 2;
    if (COMMON_MOJIBAKE_LEADS.has(character)) score += 1;
  }
  score += (text.match(/(?:Ã.|Â.|â..|ð..|[äåæçèéêëìíîïã][\u0080-\u00ff\u0100-\u2122])/g) || []).length * 2;
  return score;
}

function unicodeContentScore(value) {
  const text = String(value ?? '');
  const meaningful = text.match(/[\p{L}\p{N}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Extended_Pictographic}]/gu) || [];
  const controls = text.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g) || [];
  return meaningful.length - controls.length * 4 - (text.match(/\ufffd/g) || []).length * 8;
}

function shouldAcceptRepair(source, candidate) {
  if (!candidate || candidate === source) return false;
  const before = mojibakeSignalScore(source);
  const after = mojibakeSignalScore(candidate);
  if (before < 2) return false;
  const improvement = before - after;
  if (improvement < Math.max(2, Math.ceil(before * 0.35))) return false;
  if (/\ufffd/.test(candidate)) return false;
  return true;
}

function decodeRepresentableRun(run) {
  if (mojibakeSignalScore(run) < 2) return run;
  return decodeWindows1252AsUtf8(run) || run;
}

function decodeSinglePass(value) {
  const text = String(value ?? '');
  const whole = mojibakeSignalScore(text) >= 2 ? decodeWindows1252AsUtf8(text) : null;
  if (whole && whole !== text) return whole;

  let result = '';
  let run = '';
  const flush = () => {
    if (!run) return;
    result += decodeRepresentableRun(run);
    run = '';
  };
  for (const character of text) {
    if (windows1252Byte(character.codePointAt(0)) >= 0) run += character;
    else {
      flush();
      result += character;
    }
  }
  flush();
  return result;
}

export function inspectUtf8Mojibake(value, { maxPasses = 2 } = {}) {
  const original = String(value ?? '');
  const candidates = [{ text: original, passes: 0 }];
  let current = original;
  for (let index = 0; index < Math.max(1, Number(maxPasses) || 1); index += 1) {
    const candidate = decodeSinglePass(current);
    if (candidate === current) break;
    current = candidate;
    candidates.push({ text: current, passes: index + 1 });
  }
  candidates.sort((left, right) => {
    const signalDelta = mojibakeSignalScore(left.text) - mojibakeSignalScore(right.text);
    if (signalDelta) return signalDelta;
    return unicodeContentScore(right.text) - unicodeContentScore(left.text);
  });
  const best = candidates[0];
  const accepted = shouldAcceptRepair(original, best.text);
  const text = accepted ? best.text : original;
  return {
    text,
    repaired: text !== original,
    passes: accepted ? best.passes : 0,
    beforeScore: mojibakeSignalScore(original),
    afterScore: mojibakeSignalScore(text)
  };
}

export function repairUtf8Mojibake(value, options) {
  return inspectUtf8Mojibake(value, options).text;
}

export function hasLikelyUtf8Mojibake(value) {
  const result = inspectUtf8Mojibake(value);
  return result.repaired && result.beforeScore > result.afterScore;
}

export function repairUtf8MojibakeDeep(value, { mutate = false, maxDepth = 48 } = {}) {
  let repairs = 0;
  const seen = new WeakMap();
  const visit = (current, depth) => {
    if (typeof current === 'string') {
      const repaired = repairUtf8Mojibake(current);
      if (repaired !== current) repairs += 1;
      return repaired;
    }
    if (!current || typeof current !== 'object' || depth > maxDepth) return current;
    if (seen.has(current)) return seen.get(current);
    if (Array.isArray(current)) {
      const target = mutate ? current : [];
      seen.set(current, target);
      for (let index = 0; index < current.length; index += 1) target[index] = visit(current[index], depth + 1);
      return target;
    }
    const target = mutate ? current : {};
    seen.set(current, target);
    for (const [key, child] of Object.entries(current)) target[key] = visit(child, depth + 1);
    return target;
  };
  return { value: visit(value, 0), repairs };
}
