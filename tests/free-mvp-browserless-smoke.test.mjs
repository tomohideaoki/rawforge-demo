import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
function mount(){
  assert.ok(script,'inline free template script');
  const ids=['type','date','name','time','detail','english','japanese','status','freeText','timeWrap','detailWrap','detailLabel','detailHint','regenerate','copy','aiGenerate','translationStyle'];
  const nodes=new Map(ids.map(id=>[id,{value:'',textContent:'',hidden:false,checked:false,addEventListener(event,fn){this[event]=fn},focus(){},select(){}}]));
  nodes.get('type').value='absence';nodes.get('translationStyle').value='natural';
  const context={document:{getElementById:id=>{assert.ok(nodes.has(id),'unknown element '+id);return nodes.get(id)}},Date,Array,String,Object,JSON,navigator:{clipboard:{writeText:async()=>{}}},alert:()=>{}};
  vm.runInNewContext(script,context,{timeout:1000});
  return {nodes,context};
}
test('free template renders absence and Japanese verification',()=>{const {nodes}=mount();assert.match(nodes.get('english').value,/will be absent/);assert.match(nodes.get('japanese').value,/欠席/);});
test('late template includes selected time',()=>{const {nodes}=mount();nodes.get('type').value='late';nodes.get('time').value='09:30';nodes.get('type').change();assert.match(nodes.get('english').value,/09:30/);assert.match(nodes.get('japanese').value,/09:30/);});
test('question and meeting templates remain available',()=>{const {nodes}=mount();for(const type of ['question','meeting']){nodes.get('type').value=type;nodes.get('type').change();assert.ok(nodes.get('english').value.length>30);}});
test('free text does not silently enter English template',()=>{const {nodes}=mount();nodes.get('freeText').value='PRIVATE_TEST_SENTINEL';nodes.get('regenerate').click();assert.doesNotMatch(nodes.get('english').value,/PRIVATE_TEST_SENTINEL/);});
test('premium disabled and no endpoint configured',()=>{assert.match(html,/const PREMIUM_ENABLED = false/);assert.match(html,/const endpoint = null/);assert.match(html,/id="premiumTranslate"[^>]*disabled/);});
test('no automatic network call in free inline script',()=>{assert.doesNotMatch(script,/\bfetch\s*\(|XMLHttpRequest|sendBeacon/);});
test('privacy and no-payment disclosures remain visible',()=>{assert.match(html,/児童の氏名・健康情報/);assert.match(html,/料金は発生しません/);});

test('all seven free templates render bilingual text',()=>{const {nodes}=mount();for(const kind of ['absence','late','early','health','question','meeting','thanks']){nodes.get('type').value=kind;nodes.get('type').change();assert.match(nodes.get('english').value,/Subject:/);assert.match(nodes.get('japanese').value,/件名：/);}});
test('editing English invalidates stale Japanese translation',()=>{const {nodes}=mount();nodes.get('english').value='Edited by parent';nodes.get('english').input();assert.match(nodes.get('japanese').value,/更新されていません/);});
test('invalid calendar date is not silently normalized to a different date',()=>{const {nodes}=mount();nodes.get('date').value='2026-02-30';nodes.get('date').input();assert.match(nodes.get('english').value,/selected date/);});
test('manual translation prompt preserves safety constraints',()=>{const {context}=mount();const prompt=vm.runInNewContext('buildManualTranslationPrompt("今日は欠席します","natural")',context);assert.match(prompt,/病名・理由・名前/);assert.match(prompt,/確認用和訳/);assert.match(prompt,/今日は欠席します/);});
