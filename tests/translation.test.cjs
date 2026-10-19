const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const source = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

// Test the shipped inline script. Transport is always fake; never use global fetch.
function setup({ enabled = true, transport, instantTimeout = false } = {}) {
  const elements = new Map(), calls = [];
  for (const match of source.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const listeners = {};
    elements.set(match[2], {
      value: match[2] === 'type' ? 'absence' : '', textContent: '', checked: false,
      hidden: /\bhidden\b/.test(match[0]), disabled: /\bdisabled\b/.test(match[0]),
      addEventListener(event, fn) { (listeners[event] ??= []).push(fn); },
      async emit(event) { for (const fn of listeners[event] ?? []) await fn(); },
      focus() {}, select() {}
    });
  }
  const context = vm.createContext({
    document: { getElementById: id => { assert.ok(elements.has(id), id); return elements.get(id); } },
    navigator: { clipboard: { async writeText() {} } }, alert() {}, AbortController,
    setTimeout: (fn, ms) => setTimeout(fn, instantTimeout ? 0 : ms), clearTimeout,
    fetch: async (...args) => { calls.push(args); return transport ? transport(...args) : { ok: true, json: async () => ({ english: 'Subject: Absence\n\nMy child will be absent.' }) }; }
  });
  const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  const script = enabled ? scripts[0][1].replace('const GP_TRANSLATION_ENABLED = false;', 'const GP_TRANSLATION_ENABLED = true;') : scripts[0][1];
  vm.runInContext(script, context, { timeout: 1000 });
  const get = id => elements.get(id);
  get('freeText').value = '家族の予定で欠席します';
  get('translationConsent').checked = true;
  return { get, calls, run: () => get('translate').emit('click') };
}

test('Shipped configuration blocks API calls even if a click is dispatched', async () => {
  const a = setup({ enabled: false });
  assert.equal(a.get('translate').disabled, true);
  assert.equal(a.get('translationConsentWrap').hidden, true);
  await a.run(); assert.equal(a.calls.length, 0);
});
test('No request is sent on page load', () => { assert.equal(setup().calls.length, 0); });
for (const [label, value] of [['empty', '  '], ['too long', 'あ'.repeat(1001)]]) {
  test(`Reject ${label} input without a request`, async () => {
    const a = setup(); a.get('freeText').value = value;
    await a.run(); assert.equal(a.calls.length, 0);
  });
}
test('Require consent before sending child-related text', async () => {
  const a = setup(); a.get('translationConsent').checked = false;
  await a.run(); assert.equal(a.calls.length, 0);
});
test('Send only trimmed text using the shared Worker contract', async () => {
  const a = setup(); a.get('freeText').value = '  欠席します  ';
  await a.run(); assert.equal(a.calls.length, 1);
  const [url, options] = a.calls[0];
  assert.equal(url, 'https://global-parents-api.tomohide49aoki.workers.dev/');
  assert.equal(options.method, 'POST'); assert.equal(options.credentials, 'omit');
  assert.equal(options.redirect, 'error');
  assert.deepEqual(JSON.parse(options.body), { text: '欠席します' });
  assert.deepEqual(Object.keys(options.headers), ['Content-Type']);
  assert.ok(a.get('english').value.includes('My child will be absent'));
  assert.ok(a.get('japanese').value.includes('未作成'));
});
test('Allow the 1000-character boundary', async () => {
  const a = setup(); a.get('freeText').value = 'あ'.repeat(1000); await a.run();
  assert.equal(a.calls.length, 1);
});
for (const code of [400, 401, 403, 429, 500]) {
  test(`HTTP ${code} preserves the current English and does not retry`, async () => {
    const a = setup({ transport: async () => ({ ok: false, status: code }) });
    a.get('english').value = 'Keep this'; await a.run();
    assert.equal(a.get('english').value, 'Keep this'); assert.equal(a.calls.length, 1);
    assert.equal(a.get('translate').disabled, false);
  });
}
for (const [label, payload] of [['null', null], ['wrong key', { translation: 'wrong' }],
  ['empty English', { english: ' ' }], ['nonstring', { english: 123 }],
  ['oversized output', { english: 'a'.repeat(20001) }]]) {
  test(`Reject ${label} response without overwriting English`, async () => {
    const a = setup({ transport: async () => ({ ok: true, json: async () => payload }) });
    a.get('english').value = 'Keep this'; await a.run();
    assert.equal(a.get('english').value, 'Keep this'); assert.equal(a.calls.length, 1);
  });
}
test('Invalid JSON is handled without exposing raw server diagnostics', async () => {
  const a = setup({ transport: async () => ({ ok: true, json: async () => { throw Error('server-private'); } }) });
  await a.run(); assert.ok(!a.get('status').textContent.includes('server-private'));
});
test('Network errors are handled without retry', async () => {
  const a = setup({ transport: async () => { throw Error('network'); } });
  await a.run(); assert.equal(a.calls.length, 1);
  assert.ok(a.get('status').textContent.includes('翻訳できません'));
});
test('Timeout aborts the request and unlocks the button without retry', async () => {
  const a = setup({ instantTimeout: true, transport: () => new Promise(() => {}) });
  await a.run(); assert.equal(a.calls.length, 1);
  assert.equal(a.calls[0][1].signal.aborted, true);
  assert.equal(a.get('translate').disabled, false);
  assert.ok(a.get('status').textContent.includes('時間切れ'));
});
test('Duplicate clicks do not send duplicate requests', async () => {
  let resolve;
  const a = setup({ transport: () => new Promise(r => { resolve = r; }) });
  const pending = a.run(); assert.equal(a.get('translate').disabled, true);
  await a.run(); assert.equal(a.calls.length, 1);
  resolve({ ok: true, json: async () => ({ english: 'Translated' }) });
  await pending; assert.equal(a.get('translate').disabled, false);
});
for (const [id, event] of [['freeText', 'input'], ['english', 'input'], ['type', 'change'],
  ['regenerate', 'click'], ['translationConsent', 'change']]) {
  test(`Ignore stale response after ${id} ${event}`, async () => {
    let resolve;
    const a = setup({ transport: () => new Promise(r => { resolve = r; }) });
    const pending = a.run();
    await a.get(id).emit(event);
    const expected = a.get('english').value;
    resolve({ ok: true, json: async () => ({ english: 'Stale translation' }) });
    await pending; assert.equal(a.get('english').value, expected);
  });
}
test('HTML-looking output is assigned as textarea text', async () => {
  const text = '<img src=x onerror=alert(1)>';
  const a = setup({ transport: async () => ({ ok: true, json: async () => ({ english: text }) }) });
  await a.run(); assert.equal(a.get('english').value, text);
  assert.equal(a.get('english').innerHTML, undefined);
});
