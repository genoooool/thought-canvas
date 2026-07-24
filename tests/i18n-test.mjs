import assert from 'node:assert/strict';
import {
  DEFAULT_UI_LANGUAGE,
  UI_LANGUAGE_OPTIONS,
  getUiLanguage,
  hasTranslation,
  localeForIntl,
  normalizeUiLanguage,
  responseLanguageInstruction,
  setUiLanguage,
  t
} from '../i18n.js';

assert.equal(DEFAULT_UI_LANGUAGE, 'zh-CN');
assert.deepEqual(UI_LANGUAGE_OPTIONS.map(item => item.id), ['zh-CN', 'en', 'ja']);
assert.deepEqual(UI_LANGUAGE_OPTIONS.map(item => item.nativeLabel), ['简体中文', 'English', '日本語']);

assert.equal(normalizeUiLanguage('zh-CN'), 'zh-CN');
assert.equal(normalizeUiLanguage('zh-Hans'), 'zh-CN');
assert.equal(normalizeUiLanguage('EN-us'), 'en');
assert.equal(normalizeUiLanguage('ja-JP'), 'ja');
assert.equal(normalizeUiLanguage('unsupported'), 'zh-CN');

assert.equal(localeForIntl('zh-CN'), 'zh-CN');
assert.equal(localeForIntl('en'), 'en-US');
assert.equal(localeForIntl('ja'), 'ja-JP');

assert.equal(t('设置', {}, 'en'), 'Settings');
assert.equal(t('设置', {}, 'ja'), '設定');
assert.equal(t('设置', {}, 'zh-CN'), '设置');
assert.equal(
  t('尚未连接可用模型。先用 API Key 或 ChatGPT OAuth 完成连接。', {}, 'en'),
  'No usable model is connected yet. Connect one with an API key or ChatGPT OAuth.'
);
assert.equal(
  t('尚未连接可用模型。先用 API Key 或 ChatGPT OAuth 完成连接。', {}, 'ja'),
  '利用可能なモデルがまだ接続されていません。API キーまたは ChatGPT OAuth で接続してください。'
);
assert.equal(t('3 分钟前', {}, 'en'), '3 minutes ago');
assert.equal(t('3 分钟前', {}, 'ja'), '3 分前');
assert.equal(t('已采用 · v7', {}, 'en'), 'Accepted · v7');
assert.equal(t('已采用 · v7', {}, 'ja'), '採用済み · v7');
assert.equal(
  t('检测到 {count} 处 UTF-8 文本被按 Windows-1252 解读；已恢复可读文字，并在项目保存时写回修复结果。', { count: 4 }, 'en'),
  'Detected 4 UTF-8 text value(s) that had been decoded as Windows-1252. Readable text was restored and will be written back when the project is saved.'
);
assert.equal(
  t('检测到 {count} 处 UTF-8 文本被按 Windows-1252 解读；已恢复可读文字，并在项目保存时写回修复结果。', { count: 2 }, 'ja'),
  'UTF-8 テキストが Windows-1252 として解釈された箇所を 2 件検出しました。読める文字へ復元し、プロジェクト保存時に修復結果を書き戻します。'
);
assert.equal(hasTranslation('模型供应商与上下文'), true);
assert.equal(hasTranslation('不会被翻译的用户自定义内容'), false);

assert.match(responseLanguageInstruction('en'), /Response language: English/);
assert.match(responseLanguageInstruction('ja'), /回答言語：日本語/);
assert.match(responseLanguageInstruction('zh-CN'), /回答语言：简体中文/);

// These functions are also imported by Node-side tests and must be safe without a DOM.
assert.equal(setUiLanguage('ja', { localize: false }), 'ja');
assert.equal(getUiLanguage(), 'ja');
assert.equal(setUiLanguage('en', { localize: false }), 'en');
assert.equal(getUiLanguage(), 'en');
assert.equal(setUiLanguage(DEFAULT_UI_LANGUAGE, { localize: false }), DEFAULT_UI_LANGUAGE);

console.log('PASS UI language dictionaries, patterns, locale normalization and response-language instructions');
