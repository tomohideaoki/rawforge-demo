'use strict';
/**
 * Actual index.html inline script -> intercepted fetch -> actual OFFLINE mock Worker.
 * No real network, AI, Cloudflare, deployment, secrets or personal data.
 * The production feature flag is NEVER changed; tests enable it in the VM only.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { makeOfflineMockHandler } = require('../experiments/mock-worker-handler.mjs');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
const fixture = '家族の予定で欠席します';

function store() {
  let count = 0;
  return {
    reserve: async ({ limit }) => {
      if (count >= limit) return false;
      count += 1;
      return true;
    },
    get count() { return count; },
  };
}

function makePage({ enabled = true, handler } = {}) {
  assert.equal(scripts.length, 1, 'single inline script is expected');
  assert.match(scripts[0][1], /const GP_TRANSLATION_ENABLED = false;/, 'production flag must remain off');
  const elements = new Map();
  const calls = [];
  for (const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const listeners = {};
    elements.set(match[2], {
      value: match[2] === 'type' ? 'absence' : '',
      textContent: '', checked: false,
      hidden: /\bhidden\b/.test(match[0]),
      disabled: /\bdisabled\b/.test(match[0]),
      addEventListener(name, fn) { (listeners[name] ??= []).push(fn); },
      async emit(name) { for (const fn of listeners[name] ?? []) await fn(); },
      focus() {}, select() {},
    });
  }
  const get = id => {
    assert.ok(elements.has(id), 'missing element: ' + id);
    return elements.get(id);
  };
  const sandbox = vm.createContext({
    document: { getElementById: get },
    navigator: { clipboard: { async writeText() {} } },
    alert() {}, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      calls.push({ url, options });
      assert.equal(url, 'https://global-parents-api.tomohide49aoki.workers.dev/');
      assert.equal(typeof handler, 'function', 'unexpected network request');
      // Local Request construction only: the URL is never contacted.
      const req = new Request('https://offline.invalid/', {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: options.signal,
      });
      return handler(req);
    },
  });
  const script = enabled
    ? scripts[0][1].replace('const GP_TRANSLATION_ENABLED = false;', 'const GP_TRANSLATION_ENABLED = true;')
    : scripts[0][1];
  vm.runInContext(script, sandbox, { timeout: 1000 });
  get('freeText').value = fixture;
  get('translationConsent').checked = true;
  return { get, calls, click: () => get('translate').emit('click') };
}

function mock({ enabled = true, maxDailyRequests = 2, reserve } = {}) {
  return makeOfflineMockHandler({
    enabled, maxDailyRequests, reserve,
    now: new Date('2026-10-30T00:00:00Z'),
  });
}

test('shipping configuration never contacts the Worker', async () => {
  const p = makePage({ enabled: false, handler: () => { throw Error('network must stay disabled'); } });
  assert.equal(p.get('translate').disabled, true);
  await p.click();
  assert.equal(p.calls.length, 0);
});

test('real page sends explicit consent; real mock Worker admits and returns fixture', async () => {
  const quota = store();
  const p = makePage({ handler: mock({ reserve: quota.reserve }) });
  p.get('freeText').value = '  ' + fixture + '  ';
  await p.click();
  assert.equal(p.calls.length, 1);
  assert.deepEqual(JSON.parse(p.calls[0].options.body), { text: fixture, consent: true });
  assert.equal(p.calls[0].options.credentials, 'omit');
  assert.equal(quota.count, 1);
  assert.match(p.get('english').value, /OFFLINE MOCK ONLY/);
  assert.match(p.get('japanese').value, /未作成/);
});

test('consent unchecked blocks client and never reserves server quota', async () => {
  const quota = store();
  const p = makePage({ handler: mock({ reserve: quota.reserve }) });
  p.get('translationConsent').checked = false;
  await p.click();
  assert.equal(p.calls.length, 0);
  assert.equal(quota.count, 0);
  assert.match(p.get('status').textContent, /同意/);
});

test('quota 429 preserves prior English draft and does not retry', async () => {
  const quota = store();
  const p = makePage({ handler: mock({ maxDailyRequests: 1, reserve: quota.reserve }) });
  await p.click();
  const previous = p.get('english').value;
  await p.click();
  assert.equal(p.calls.length, 2);
  assert.equal(quota.count, 1);
  assert.equal(p.get('english').value, previous);
  assert.match(p.get('status').textContent, /利用制限/);
});

test('disabled Worker fails closed and preserves the original draft', async () => {
  const quota = store();
  const p = makePage({ handler: mock({ enabled: false, reserve: quota.reserve }) });
  const previous = p.get('english').value;
  await p.click();
  assert.equal(p.calls.length, 1);
  assert.equal(quota.count, 0);
  assert.equal(p.get('english').value, previous);
});

test('missing atomic reservation fails closed without changing draft', async () => {
  const p = makePage({ handler: mock() });
  const previous = p.get('english').value;
  await p.click();
  assert.equal(p.calls.length, 1);
  assert.equal(p.get('english').value, previous);
  assert.match(p.get('status').textContent, /翻訳できません/);
});
