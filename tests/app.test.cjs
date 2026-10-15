const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

// Execute the actual inline application script with a minimal DOM adapter.
// No browser, network, npm packages, credentials, or AI APIs are used.
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
function app({ clipboardFails = false } = {}) {
  const elements = new Map();
  for (const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const listeners = {};
    elements.set(match[2], {
      value: match[2] === 'type' ? 'absence' : '', textContent: '',
      hidden: /\bhidden\b/.test(match[0]), focused: false, selected: false,
      addEventListener(event, callback) { (listeners[event] ??= []).push(callback); },
      async emit(event) { for (const callback of listeners[event] ?? []) await callback(); },
      focus() { this.focused = true; }, select() { this.selected = true; }
    });
  }
  const copied = [], alerts = [];
  const context = vm.createContext({
    document: { getElementById: id => {
      assert.ok(elements.has(id), `Missing element: ${id}`); return elements.get(id);
    } },
    navigator: { clipboard: { async writeText(value) {
      if (clipboardFails) throw new Error('Permission denied'); copied.push(value);
    } } },
    alert: value => alerts.push(value)
  });
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  vm.runInContext(scripts[0][1], context, { timeout: 1000 });
  return { get: id => elements.get(id), context, copied, alerts };
}

const cases = [
  ['absence', 'Absence Notification', 'will be absent', false, false],
  ['late', 'Late Arrival Notification', 'will arrive late', true, false],
  ['early', 'Early Departure Notification', 'leave school early', true, false],
  ['health', 'Health Update', 'health update', false, true],
  ['question', 'Question About School', 'I have a question', false, true],
  ['meeting', 'Request for a Meeting', 'request a meeting', false, true],
  ['thanks', 'Thank You', 'continued support', false, true]
];
for (const [type, subject, phrase, needsTime, needsDetail] of cases) {
  test(`Generate ${type} and show the correct fields`, async () => {
    const a = app(); a.get('type').value = type;
    await a.get('type').emit('change');
    assert.ok(a.get('english').value.startsWith(`Subject: ${subject}\n`));
    assert.ok(a.get('english').value.includes(phrase));
    assert.ok(a.get('japanese').value.startsWith('件名：'));
    assert.equal(a.get('timeWrap').hidden, !needsTime);
    assert.equal(a.get('detailWrap').hidden, !needsDetail);
  });
}
test('Date and child name changes update the output', async () => {
  const a = app(); a.get('date').value = '2026-10-15'; a.get('name').value = 'Alex';
  await a.get('name').emit('input');
  assert.ok(a.get('english').value.includes('Alex will be absent'));
  assert.ok(a.get('english').value.includes('October 15, 2026'));
  assert.ok(a.get('japanese').value.includes('2026年10月15日'));
});
test('Invalid calendar dates use a safe fallback', () => {
  const a = app();
  for (const date of ['2026-02-30', 'invalid', '']) {
    a.get('date').value = date; vm.runInContext('generate()', a.context);
    assert.ok(a.get('english').value.includes('the selected date'));
  }
});
test('Names cannot inject extra message lines and are length limited', () => {
  const a = app();
  assert.equal(vm.runInContext("safeName(' Alex\\nSubject: test\\t ')", a.context), 'Alex Subject: test');
  assert.equal(vm.runInContext("safeName('x'.repeat(200)).length", a.context), 100);
});
test('Late and early messages include the selected time', async () => {
  const a = app(); a.get('time').value = '10:30';
  for (const type of ['late', 'early']) {
    a.get('type').value = type; await a.get('type').emit('change');
    assert.ok(a.get('english').value.includes('at approximately 10:30'));
  }
});
test('Japanese free input is not silently presented as translated', async () => {
  const a = app(); const previous = a.get('english').value;
  a.get('freeText').value = '家族の予定で欠席します'; await a.get('freeText').emit('input');
  assert.equal(a.get('english').value, previous);
  assert.ok(a.get('status').textContent.includes('まだ自動英訳に対応していません'));
});
test('Details warn that manual English editing is required', async () => {
  const a = app(); a.get('type').value = 'health'; a.get('detail').value = '咳があります';
  await a.get('type').emit('change');
  assert.ok(a.get('status').textContent.includes('自動翻訳されません'));
  assert.ok(!a.get('english').value.includes('咳があります'));
});
test('Copy uses the current edited English', async () => {
  const a = app(); a.get('english').value = 'Edited message'; await a.get('copy').emit('click');
  assert.deepEqual(a.copied, ['Edited message']);
  assert.equal(a.get('status').textContent, '英文をコピーしました。');
});
test('Clipboard failure selects English and explains manual copying', async () => {
  const a = app({ clipboardFails: true }); await a.get('copy').emit('click');
  assert.equal(a.get('english').focused, true); assert.equal(a.get('english').selected, true);
  assert.ok(a.get('status').textContent.includes('Ctrl + C'));
});
test('AI handoff rejects empty text and copies instructions plus user text', async () => {
  const a = app(); await a.get('aiGenerate').emit('click');
  assert.equal(a.copied.length, 0); assert.ok(a.alerts[0].includes('先に日本語'));
  a.get('freeText').value = '  家族の予定で欠席します  ';
  await a.get('aiGenerate').emit('click');
  assert.ok(a.copied[0].includes('意味を変えず、情報を付け足さず'));
  assert.ok(a.copied[0].endsWith('\n\n家族の予定で欠席します'));
});
test('AI handoff reports clipboard failure', async () => {
  const a = app({ clipboardFails: true }); a.get('freeText').value = '質問です';
  await a.get('aiGenerate').emit('click'); assert.ok(a.alerts[0].includes('コピーできませんでした'));
});
test('Editing English invalidates the old Japanese translation', async () => {
  const a = app(); await a.get('english').emit('input');
  assert.equal(a.get('japanese').value, '英文が編集されました。日本語訳は更新されていません。');
});
test('Regenerate restores the template', async () => {
  const a = app(); const previous = a.get('english').value;
  a.get('english').value = 'Edited'; await a.get('regenerate').emit('click');
  assert.equal(a.get('english').value, previous);
});
