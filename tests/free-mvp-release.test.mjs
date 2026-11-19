import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('premium stays disabled',()=>{assert.match(html,/const PREMIUM_ENABLED = false/);assert.match(html,/const endpoint = null/)});
test('honest free MVP disclosure',()=>{assert.match(html,/日本語の自由入力は自動英訳されません/);assert.match(html,/料金は発生しません/)});
test('manual prompt still available',()=>assert.match(html,/id="aiGenerate"/));
test('no embedded live secrets',()=>assert.doesNotMatch(html,/sk-proj-|STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/));
