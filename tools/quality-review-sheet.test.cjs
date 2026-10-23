'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCases, csv } = require('./quality-review-sheet.cjs');
const line = id => '| ' + id + ' | 入力 | Expected | Must review |';
const valid = Array.from({ length: 12 }, (_, i) => line('Q' + String(i + 1).padStart(2, '0'))).join('\n');
test('extract exactly 12 unique cases from Markdown table', () => {
  const cases = parseCases(valid); assert.equal(cases.length, 12); assert.equal(cases[0].id, 'Q01');
});
test('reject missing or duplicated cases rather than silently passing', () => {
  assert.throws(() => parseCases(valid.split('\n').slice(0, 11).join('\n')));
  assert.throws(() => parseCases(valid + '\n' + line('Q01')));
});
test('CSV has one header and twelve review rows, leaving verdicts blank', () => {
  const lines = csv(parseCases(valid)).trim().split('\n');
  assert.equal(lines.length, 13);
  assert.match(lines[0], /manual_judgment_PASS_FAIL/);
  assert.ok(lines[1].endsWith('"","","","",""'));
});
