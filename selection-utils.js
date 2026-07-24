/**
 * Map a selection made against rendered Markdown back to the source Markdown.
 *
 * The result intentionally keeps the exact source slice when a stable mapping
 * exists. Callers should still keep the visible selection separately for UI
 * copy, because the source slice can contain Markdown markers.
 */
export function resolveMarkdownSelection(rawText, visibleText, visibleStart = 0, visibleTotal = 0) {
  const raw = String(rawText || '');
  const selected = normalizeSelectedText(visibleText);
  if (!raw || !selected) return null;

  const expectedRaw = visibleTotal > 0
    ? Math.round(raw.length * Math.max(0, visibleStart) / Math.max(1, visibleTotal))
    : 0;

  const direct = allIndexes(raw, selected);
  if (direct.length) {
    const start = nearestIndex(direct, expectedRaw);
    return sourceSlice(raw, start, start + selected.length);
  }

  // Build a source-indexed approximation of what the browser renders. This
  // strips Markdown punctuation, link destinations, fence lines and table
  // separators while retaining a source offset for every visible character.
  const projection = buildMarkdownVisibleIndex(raw);
  const projectedSelection = normalizeLooseSelection(selected);
  if (projectedSelection) {
    const starts = allIndexes(projection.text, projectedSelection);
    if (starts.length) {
      const expectedProjected = projection.rawToVisible(expectedRaw);
      const projectedStart = nearestIndex(starts, expectedProjected);
      const rawStart = projection.map[projectedStart];
      const rawEndIndex = projectedStart + projectedSelection.length - 1;
      const rawEnd = (projection.map[rawEndIndex] ?? rawStart) + 1;
      const result = sourceSlice(raw, rawStart, rawEnd);
      if (result) return result;
    }
  }

  // Last-resort anchor matching is deliberately conservative. It handles
  // long selections whose whitespace or formatting changed significantly,
  // while returning null when the source range would be ambiguous.
  const anchors = selectionAnchors(selected);
  if (!anchors.length) return null;
  const first = anchors[0];
  const starts = allIndexes(raw, first);
  const candidates = [];
  for (const candidateStart of starts) {
    let cursor = candidateStart + first.length;
    let end = cursor;
    let matched = 1;
    for (const token of anchors.slice(1)) {
      const at = raw.indexOf(token, cursor);
      if (at < 0 || at - cursor > 1600) break;
      cursor = at + token.length;
      end = cursor;
      matched += 1;
    }
    const minimum = Math.max(2, Math.ceil(anchors.length * 0.72));
    if (matched >= minimum || (anchors.length === 1 && matched === 1)) {
      candidates.push({
        start: candidateStart,
        end,
        matched,
        distance: Math.abs(candidateStart - expectedRaw),
        span: end - candidateStart
      });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) =>
    b.matched - a.matched ||
    a.distance - b.distance ||
    a.span - b.span
  );
  const best = candidates[0];
  return sourceSlice(raw, best.start, best.end);
}

export function normalizeLooseSelection(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\s\u200b\u200c\u200d]+/g, '')
    .replace(/[•·]/g, '')
    .trim();
}

/**
 * Returns a whitespace-free representation of the rendered Markdown plus a
 * map from each projected character to its source Markdown offset.
 */
export function buildMarkdownVisibleIndex(rawText) {
  const raw = String(rawText || '');
  const text = [];
  const map = [];
  let index = 0;
  let lineStart = true;
  let fenced = false;

  const push = (char, rawIndex) => {
    if (!char || /\s/.test(char) || /[•·]/.test(char)) return;
    text.push(char);
    map.push(rawIndex);
  };

  while (index < raw.length) {
    const lineEnd = raw.indexOf('\n', index);
    const end = lineEnd < 0 ? raw.length : lineEnd;
    const line = raw.slice(index, end);
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      fenced = !fenced;
      index = lineEnd < 0 ? raw.length : lineEnd + 1;
      lineStart = true;
      continue;
    }

    // Markdown table delimiter rows are not rendered as user-visible text.
    if (!fenced && isTableDelimiterLine(line)) {
      index = lineEnd < 0 ? raw.length : lineEnd + 1;
      lineStart = true;
      continue;
    }

    let cursor = index;
    if (!fenced) cursor += linePrefixLength(line);
    lineStart = false;

    while (cursor < end) {
      const char = raw[cursor];

      if (!fenced && char === '\\' && cursor + 1 < end) {
        push(raw[cursor + 1], cursor + 1);
        cursor += 2;
        continue;
      }

      if (!fenced && char === '!' && raw[cursor + 1] === '[') {
        const image = parseMarkdownLink(raw, cursor + 1, end);
        if (image) {
          for (let i = image.labelStart; i < image.labelEnd; i += 1) push(raw[i], i);
          cursor = image.end;
          continue;
        }
      }

      if (!fenced && char === '[') {
        const link = parseMarkdownLink(raw, cursor, end);
        if (link) {
          for (let i = link.labelStart; i < link.labelEnd; i += 1) push(raw[i], i);
          cursor = link.end;
          continue;
        }
      }

      if (!fenced && ('*_`~'.includes(char))) {
        cursor += 1;
        continue;
      }

      // Table pipes and optional outer pipes are layout punctuation.
      if (!fenced && char === '|') {
        cursor += 1;
        continue;
      }

      push(char, cursor);
      cursor += 1;
    }

    index = lineEnd < 0 ? raw.length : lineEnd + 1;
    lineStart = true;
  }

  return {
    text: text.join(''),
    map,
    rawToVisible(rawIndex) {
      let low = 0;
      let high = map.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (map[mid] < rawIndex) low = mid + 1;
        else high = mid;
      }
      return low;
    }
  };
}

export function allIndexes(text, needle) {
  const haystack = String(text || '');
  const target = String(needle || '');
  const indexes = [];
  if (!target) return indexes;
  let from = 0;
  while (from <= haystack.length - target.length) {
    const index = haystack.indexOf(target, from);
    if (index < 0) break;
    indexes.push(index);
    from = index + Math.max(1, target.length);
  }
  return indexes;
}

function normalizeSelectedText(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u200c\u200d]/g, '')
    .trim();
}

function nearestIndex(indexes, expected) {
  return [...indexes].sort((a, b) => Math.abs(a - expected) - Math.abs(b - expected))[0];
}

function sourceSlice(raw, start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > raw.length) return null;
  return { start, end, text: raw.slice(start, end) };
}

function linePrefixLength(line) {
  return line.match(/^\s*(?:#{1,6}\s+|>\s?|[-+*]\s+|\d+[.)]\s+)/)?.[0]?.length || 0;
}

function isTableDelimiterLine(line) {
  const value = String(line || '').trim().replace(/^\||\|$/g, '');
  if (!value.includes('-')) return false;
  const cells = value.split('|').map(cell => cell.trim());
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

function parseMarkdownLink(raw, openBracket, lineEnd) {
  const closeBracket = findUnescaped(raw, ']', openBracket + 1, lineEnd);
  if (closeBracket < 0 || raw[closeBracket + 1] !== '(') return null;
  const closeParen = findClosingParen(raw, closeBracket + 2, lineEnd);
  if (closeParen < 0) return null;
  return {
    labelStart: openBracket + 1,
    labelEnd: closeBracket,
    end: closeParen + 1
  };
}

function findUnescaped(text, needle, from, limit) {
  for (let index = from; index < limit; index += 1) {
    if (text[index] === needle && text[index - 1] !== '\\') return index;
  }
  return -1;
}

function findClosingParen(text, from, limit) {
  let depth = 1;
  for (let index = from; index < limit; index += 1) {
    if (text[index] === '\\') { index += 1; continue; }
    if (text[index] === '(') depth += 1;
    else if (text[index] === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function selectionAnchors(selected) {
  const tokens = String(selected || '')
    .split(/\s+/)
    .map(token => token.replace(/^[#>*_`~\-–—•\d.)（(【\[]+|[>*_`~\-–—•，。；：！？!?、）)】\]]+$/g, ''))
    .filter(Boolean);
  if (!tokens.length) return [];
  const anchors = tokens.filter((token, index) => token.length >= 2 || index === 0 || index === tokens.length - 1);
  if (anchors.length <= 96) return anchors;
  // Keep the beginning/end and evenly sample a long selection so the fallback
  // remains bounded without losing its shape.
  const sampled = [];
  for (let i = 0; i < 96; i += 1) {
    sampled.push(anchors[Math.round(i * (anchors.length - 1) / 95)]);
  }
  return sampled;
}
