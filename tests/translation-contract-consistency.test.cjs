'use strict';
/**
 * Prevent docs/frontend/server contract drift without network or AI.
 * This is a static contract guard, not an assertion about the deployed Worker.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const read = path => readFileSync(join(__dirname, '..', path), 'utf8');
const html = read('index.html');
const quota = read('experiments/translation-quota.mjs');
const worker = read('experiments/mock-worker-handler.mjs');
const docs = read('docs/translation-connection.md');

test('shipped translation remains disabled until explicitly authorized', () => {
  assert.match(html, /const GP_TRANSLATION_ENABLED = false;/);
  assert.match(docs, /GP_TRANSLATION_ENABLED/);
});

test('browser sends consent explicitly without cookies', () => {
  assert.match(html, /body:\s*JSON\.stringify\(\{\s*text,\s*consent:\s*true\s*\}\)/);
  assert.match(html, /credentials:\s*'omit'/);
  assert.match(html, /translationConsent/);
});

test('offline Worker requires consent and an atomic reservation callback', () => {
  assert.match(quota, /payload\.consent\s*!==\s*true/);
  assert.match(quota, /await reserve\(/);
  assert.match(quota, /ATOMIC_STORE_NOT_CONFIGURED/);
  assert.match(worker, /authorizeTranslation\(/);
});

test('connection docs distinguish historical and test-only contracts', () => {
  assert.match(docs, /旧Worker契約/);
  assert.match(docs, /POST \`\{ "text": "日本語", "consent": true \}\`/);
  assert.match(docs, /本番Worker.*未確認/);
});

test('docs disclose that English-only output has no verified back-translation', () => {
  assert.match(docs, /現行APIは \`english\` のみ返す/);
  assert.match(docs, /確認用和訳は未実装/);
});
