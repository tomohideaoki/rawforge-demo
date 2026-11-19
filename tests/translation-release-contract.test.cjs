'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// Contract gates only: no network calls, no AI, no production Worker.
function validateV2Request(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (payload.consent !== true || typeof payload.text !== 'string') return false;
  const count = [...payload.text.trim()].length;
  return count >= 1 && count <= 1000;
}
function validateV2Response(payload) {
  return !!payload && typeof payload === 'object' && !Array.isArray(payload) &&
    typeof payload.english === 'string' && payload.english.trim().length > 0;
}
function validateV3Response(payload) {
  return validateV2Response(payload) &&
    typeof payload.subject === 'string' && payload.subject.trim().length > 0 &&
    typeof payload.back_translation_ja === 'string' && payload.back_translation_ja.trim().length > 0;
}

test('v2 accepts explicit consent and nonempty Japanese text', () => assert.equal(validateV2Request({text:'本日は欠席します。',consent:true}),true));
test('v2 rejects missing consent', () => assert.equal(validateV2Request({text:'欠席',consent:false}),false));
test('v2 rejects whitespace-only text', () => assert.equal(validateV2Request({text:'   ',consent:true}),false));
test('v2 rejects over 1000 Unicode code points', () => assert.equal(validateV2Request({text:'あ'.repeat(1001),consent:true}),false));
test('v2 accepts 1000 Unicode code points', () => assert.equal(validateV2Request({text:'あ'.repeat(1000),consent:true}),true));
test('v2 response needs English', () => assert.equal(validateV2Response({english:'Absent today.'}),true));
test('v3 must not mistake v2 response for back translation', () => assert.equal(validateV3Response({english:'Absent today.'}),false));
test('v3 requires actual back-translation field', () => assert.equal(validateV3Response({english:'Absent today.',subject:'Absence',back_translation_ja:'本日は欠席します。'}),true));
