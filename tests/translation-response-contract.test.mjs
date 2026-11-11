import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTranslationResponse} from '../experiments/translation-response-contract.mjs';
test('accepts complete two-language output',()=>assert.equal(validateTranslationResponse({english:'My child will be absent today.',japaneseBackTranslation:'子どもは今日欠席します。'}).ok,true));
test('rejects English-only output',()=>assert.equal(validateTranslationResponse({english:'Absent today'}).error,'BACK_TRANSLATION_MISSING'));
test('rejects empty back-translation',()=>assert.equal(validateTranslationResponse({english:'Absent today',japaneseBackTranslation:'  '}).ok,false));
test('rejects empty English',()=>assert.equal(validateTranslationResponse({english:'',japaneseBackTranslation:'欠席'}).ok,false));
test('rejects oversized output',()=>assert.equal(validateTranslationResponse({english:'a'.repeat(2001),japaneseBackTranslation:'欠席'}).ok,false));
test('rejects malformed object',()=>assert.equal(validateTranslationResponse(null).ok,false));
