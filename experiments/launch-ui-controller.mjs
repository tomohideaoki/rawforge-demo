/** Global Parents browser controller. API endpoint is injected; no implicit network calls. */
export function createTranslationController({requestTranslation, enabled=false}={}) {
  let busy=false;
  return async function translate({text,consent}={}) {
    if (!enabled) return {ok:false,error:'AI機能は公開準備中です。'};
    if (busy) return {ok:false,error:'翻訳処理中です。'};
    if (!consent) return {ok:false,error:'送信前に同意してください。'};
    if(typeof text!=='string'||!text.trim()||[...text.trim()].length>1000) return {ok:false,error:'日本語を1〜1000文字で入力してください。'};
    if(typeof requestTranslation!=='function') return {ok:false,error:'接続先が設定されていません。'};
    busy=true;
    try {
      const result=await requestTranslation({text:text.trim(),consent:true});
      if(!result||typeof result.english!=='string'||!result.english.trim()||typeof result.japaneseBackTranslation!=='string'||!result.japaneseBackTranslation.trim()) return {ok:false,error:'翻訳結果が不完全です。'};
      return {ok:true,english:result.english.trim(),japaneseBackTranslation:result.japaneseBackTranslation.trim()};
    } catch {return {ok:false,error:'接続できませんでした。時間をおいて再試行してください。'};}
    finally {busy=false;}
  };
}
