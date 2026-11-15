# Global Parents — native tone and locale acceptance specification v0.1
Date: 2026-11-15. Status: offline specification only. No model/API/Plugin compatibility testing performed.

## Scope
Audience: Japanese-speaking parents writing to international-school staff. Preserve all source facts; do not invent names, illnesses, school policies, times, commitments, or diagnoses. Generate a subject, English body, and Japanese back-translation of the actual English body. No sending.

## Tone choices
- natural (default): concise, idiomatic and courteous.
- polite: slightly more deferential, no extra requests.
- friendly: warm but professional, no invented familiarity.
- formal: restrained, institution-appropriate, no legalistic inflation.
- short: minimal while retaining every material fact, date, negation and conditional.

## Locale choices
- en-US: American spelling and school-appropriate terminology.
- en-GB: British spelling and school-appropriate terminology.
Locale must not change dates, meaning, or imply a school policy. Avoid locale-specific vocabulary where an unambiguous neutral phrase works.

## Acceptance cases
A. 今日は家族の予定があるため、学校を欠席します。
Expected facts: absence today, family commitment. Forbidden: illness, homework request, promise to return tomorrow.
B. 熱はありませんが、咳があります。
Expected: no fever, cough. Forbidden: fever present, diagnosis, return-to-school decision.
C. 体調が良ければ明日登校する予定です。
Expected: conditional intention for tomorrow. Forbidden: unconditional return.
D. 10月28日は14時30分に早退させたいです。
Expected: requested early departure October 28 at 14:30. Forbidden: inventing year, treating request as approval.
E. 明日は学校に行きますが、体育は見学させてください。
Expected: attending school tomorrow, not participating in PE. Forbidden: full-day absence.
F. 来週の金曜、いつもの時間にお願いします。
Expected: ask for clarification where schedule/context is missing. Forbidden: inventing a meeting or pickup time.

For each of 5 tones × 2 locales × 6 cases = 60 outputs, verify meaning preservation, tone distinction, no invented facts, and back-translation based on generated English. Any critical factual failure is a fail; aggregate pass rate must not mask critical errors.

## Proposed API v3 (NOT implemented)
Request: {text:string,consent:true,tone:"natural"|"polite"|"friendly"|"formal"|"short",locale:"en-US"|"en-GB"}
Response: {subject:string,english:string,back_translation_ja:string}
Errors: fail closed on missing consent, invalid enum, quota unavailable, upstream failure. Do not assume compatibility with v2 POST {text,consent:true} → {english}. Keep feature flag disabled until explicit approval and real-worker, privacy, billing, and quality checks.

## Plugin portability
Share instructions, examples and grading rubric, not credentials or user data. Existing GPT instructions/knowledge, official Plugin API schema, real Worker code and Plugin runtime tests remain missing. Prepared is not migrated.
