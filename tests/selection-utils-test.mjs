import assert from 'node:assert/strict';
import { resolveMarkdownSelection, buildMarkdownVisibleIndex } from '../selection-utils.js';

const markdown = `# 核心区别

普通人卖 **内容**，高维玩家控制[客户入口](https://example.com/customer)、数据与交易。

> 更长期的壁垒来自真实业务数据、客户入口、授权资产和对结果负责的能力。

| 维度 | 方案 |
| --- | --- |
| 数据 | 自有 |

\`\`\`js
const permissionProfile = ':read-only';
\`\`\`
`;

const visible = '核心区别普通人卖内容，高维玩家控制客户入口、数据与交易。更长期的壁垒来自真实业务数据、客户入口、授权资产和对结果负责的能力。';
const mapped = resolveMarkdownSelection(markdown, visible, 0, visible.length);
assert.ok(mapped, 'formatted cross-block selection should map');
assert.equal(markdown.slice(mapped.start, mapped.end), mapped.text);
assert.ok(mapped.text.includes('**内容**'));
assert.ok(mapped.text.includes('[客户入口](https://example.com/customer)'));
assert.ok(mapped.text.includes('> 更长期'));

const linkOnly = resolveMarkdownSelection(markdown, '客户入口', 16, visible.length);
assert.ok(linkOnly);
assert.ok(['客户入口', '[客户入口](https://example.com/customer)'].some(part => linkOnly.text.includes(part)));

const tableSelection = resolveMarkdownSelection(markdown, '维度方案数据自有', visible.length, visible.length + 20);
assert.ok(tableSelection, 'rendered table text should map without delimiter row');
assert.ok(tableSelection.text.includes('维度 | 方案 |'));
assert.ok(tableSelection.text.includes('| 数据 | 自有'));

const codeSelection = resolveMarkdownSelection(markdown, "const permissionProfile = ':read-only';", visible.length + 20, visible.length + 80);
assert.ok(codeSelection, 'code block body should map while fence chrome stays excluded');
assert.equal(codeSelection.text, "const permissionProfile = ':read-only';");

const repeated = '结论：保留证据。\n\n中间内容。\n\n结论：保留证据。';
const second = resolveMarkdownSelection(repeated, '结论：保留证据。', 28, 32);
assert.equal(second.start, repeated.lastIndexOf('结论：保留证据。'));

const longSource = Array.from({ length: 300 }, (_, index) => `- 第 ${index + 1} 条：这是 **长期选择内容 ${index + 1}**，并引用[资料 ${index + 1}](https://example.com/${index + 1})。`).join('\n');
const longVisible = Array.from({ length: 180 }, (_, index) => `第 ${index + 61} 条：这是 长期选择内容 ${index + 61}，并引用资料 ${index + 61}。`).join('');
const longMapped = resolveMarkdownSelection(longSource, longVisible, 3000, 12000);
assert.ok(longMapped, 'large formatted selection should map without truncating the source');
assert.ok(longMapped.text.includes('长期选择内容 61'));
assert.ok(longMapped.text.includes('长期选择内容 240'));

const projection = buildMarkdownVisibleIndex(markdown);
assert.ok(!projection.text.includes('https://example.com/customer'));
assert.ok(!projection.text.includes('---'));
assert.ok(projection.text.includes('permissionProfile'));

assert.equal(resolveMarkdownSelection(markdown, '不存在且不能可靠映射的文字', 0, 1), null);

console.log('PASS: rendered Markdown selections map to source across formatting, links, tables, code, repeats and long ranges.');
