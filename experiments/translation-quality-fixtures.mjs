export const cases = [
{id:'absence',source:'今日は家族の予定があるため学校を欠席します。',required:['absent','family'],forbidden:['sick','doctor','tomorrow']},
{id:'late',source:'明日は10時ごろ登校します。',required:['tomorrow','10'],forbidden:['absent','sick']},
{id:'meeting',source:'来週、先生と面談したいです。',required:['meeting','next week'],forbidden:['urgent','complaint']},
{id:'thanks',source:'昨日の面談ありがとうございました。',required:['thank','yesterday'],forbidden:['tomorrow','absence']},
{id:'early',source:'金曜日は午後2時に早退します。',required:['friday','2'],forbidden:['sick','doctor']}
];
export function evaluate(c, output) {
 const en=output?.english, ja=output?.japaneseBackTranslation;
 if(typeof en!=='string'||!en.trim()||typeof ja!=='string'||!ja.trim()) return {pass:false,issues:['BILINGUAL_REQUIRED']};
 const lower=en.toLowerCase();
 const issues=[...c.required.filter(w=>!lower.includes(w)).map(w=>'MISSING:'+w),...c.forbidden.filter(w=>lower.includes(w)).map(w=>'UNSUPPORTED:'+w)];
 return {pass:issues.length===0,issues,manualReviewRequired:true};
}
