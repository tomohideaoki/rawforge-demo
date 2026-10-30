'use strict';
/**
 * Offline client ↔ server admission contract checks.
 * Runs the actual index.html inline script; the transport is entirely mocked.
 * No AI, Cloudflare, credentials, HTTP requests, or deployment.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
const gate = import('../experiments/translation-quota.mjs');

function page({ enabled = false, transport } = {}) {
  assert.equal(scripts.length, 1, 'expected one inline application script');
  const elements = new Map();
  const calls = [];
  for (const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const listeners = {};
    elements.set(match[2], {
      value: match[2] === 'type' ? 'absence' : '', textContent: '', checked: false,
      hidden: /\bhidden\b/.test(match[0]), disabled: /\bdisabled\b/.test(match[0]),
      addEventListener(event, fn) { (listeners[event] ??= []).push(fn); },
      async emit(event) { for (const fn of listeners[event] ?? []) await fn(); },
      focus() {}, select() {}
    });
  }
  const get = id => { assert.ok(elements.has(id), `Missing DOM element: ${id}`); return elements.get(id); };
  const context = vm.createContext({
    document: { getElementById: get },
    navigator: { clipboard: { async writeText() {} } },
    alert() {}, AbortController, setTimeout, clearTimeout,
    fetch: async (...args) => {
      calls.push(args);
      assert.equal(typeof transport, 'function', 'unexpected external request');
      return transport(...args);
    }
  });
  const source = enabled
    ? scripts[0][1].replace('const GP_TRANSLATION_ENABLED = false;', 'const GP_TRANSLATION_ENABLED = true;')
    : scripts[0][1];
  vm.runInContext(source, context, { timeout: 1000 });
  return { get, calls, run: () => get('translate').emit('click') };
}

const sample = '家族の予定で欠席します';
const fixtureResponse = 'Subject: Absence\n\nMy child will be absent.';
const success = { ok: true, status: 200, json: async () => ({ english: fixtureResponse }) };
function ready(p) {
  p.get('freeText').value = sample;
  p.get('translationConsent').checked = true;
  return p;
}

test('production default blocks API calls even when click event is forced', async () => {
  const p = ready(page({ transport: async () => { throw Error('must not call transport'); } }));
  assert.equal(p.get('translate').disabled, true);
  await p.run();
  assert.equal(p.calls.length, 0);
});

test('client sends consent and trimmed text; server gate accepts same contract', async () => {
  const { authorizeTranslation } = await gate;
  let used = 0;
  const p = ready(page({ enabled: true, transport: async (_, options) => {
    const decision = await authorizeTranslation({
      enabled: true, maxDailyRequests: 1,
      payload: JSON.parse(options.body),
      reserve: async () => { used++; return true; }
    });
    assert.equal(decision.allowed, true);
    assert.equal(options.credentials, 'omit');
    return success;
  } }));
  p.get('freeText').value = `  ${sample}  `;
  await p.run();
  assert.equal(p.calls.length, 1);
  assert.deepEqual(JSON.parse(p.calls[0][1].body), { text: sample, consent: true });
  assert.equal(used, 1);
  assert.equal(p.get('english').value, fixtureResponse);
});

test('legacy request without consent is rejected before quota reservation', async () => {
  const { authorizeTranslation } = await gate;
  let reservations = 0;
  const result = await authorizeTranslation({
    enabled: true, maxDailyRequests: 1,
    payload: { text: sample }, reserve: async () => { reservations++; return true; }
  });
  assert.equal(result.reason, 'CONSENT_REQUIRED');
  assert.equal(reservations, 0);
});

test('daily quota rejects third click with 429; preserves the last English text', async () => {
  const { authorizeTranslation } = await gate;
  let used = 0;
  const p = ready(page({ enabled: true, transport: async (_, options) => {
    const decision = await authorizeTranslation({
      enabled: true, maxDailyRequests: 2, payload: JSON.parse(options.body),
      reserve: async () => used++ < 2
    });
    return decision.allowed ? success : { ok: false, status: decision.status };
  } }));
  await p.run(); await p.run();
  const previous = p.get('english').value;
  await p.run();
  assert.equal(used, 3); // Third reservation attempt is denied; two accepted.
  assert.equal(p.calls.length, 3); // No automatic retries.
  assert.equal(p.get('english').value, previous);
  assert.match(p.get('status').textContent, /利用制限/);
});

test('missing persistent reservation fails closed without translation', async () => {
  const { authorizeTranslation } = await gate;
  const result = await authorizeTranslation({ enabled: true, maxDailyRequests: 2, payload: { text: sample, consent: true } });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'ATOMIC_STORE_NOT_CONFIGURED');
});

test('supplementary Unicode codepoints are accepted consistently', async () => {
  const { authorizeTranslation } = await gate;
  const p = ready(page({ enabled: true, transport: async (_, options) => {
    const decision = await authorizeTranslation({
      enabled: true, maxDailyRequests: 1, payload: JSON.parse(options.body), reserve: async () => true
    });
    assert.equal(decision.allowed, true);
    return success;
  } }));
  p.get('freeText').value = '😀'.repeat(600);
  await p.run();
  assert.equal(p.calls.length, 1);
});

test('server 503 does not overwrite the previous English text', async () => {
  const p = ready(page({ enabled: true, transport: async () => ({ ok: false, status: 503 }) }));
  p.get('english').value = 'Keep previous draft';
  await p.run();
  assert.equal(p.get('english').value, 'Keep previous draft');
  assert.equal(p.calls.length, 1);
});
