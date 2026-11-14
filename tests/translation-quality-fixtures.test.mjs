import test from 'node:test';import assert from 'node:assert/strict';import {cases,evaluate} from '../experiments/translation-quality-fixtures.mjs';
for(const c of cases){test(c.id+' catches missing meaning',()=>{const r=evaluate(c,{english:'Hello',japaneseBackTranslation:'こんにちは'});assert.equal(r.pass,false);assert.ok(r.issues.some(s=>s.startsWith('MISSING:')));});}
test('accepts valid format and required terms',()=>{const c=cases[0];assert.equal(evaluate(c,{english:'My child will be absent today due to a family commitment.',japaneseBackTranslation:'家族の予定で欠席します'}).pass,true)});
test('rejects invented medical reason',()=>{const c=cases[0];assert.ok(evaluate(c,{english:'My child is absent due to family reasons and is sick.',japaneseBackTranslation:'欠席'}).issues.includes('UNSUPPORTED:sick'))});
test('requires back translation',()=>assert.equal(evaluate(cases[0],{english:'absent family'}).pass,false));
