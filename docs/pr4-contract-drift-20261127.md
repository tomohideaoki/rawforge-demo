# Draft PR #4 contract audit — 2026-11-27

Scope: read-only review of the actual open Draft PR #4 diff and the separate offline v2 Worker contract. No changes to PR #4, no deployment, no API request.

## 1. PR #4 as currently submitted

PR: https://github.com/tomohideaoki/rawforge-demo/pull/4
Title: feat: prepare translation API connection with live requests disabled
State observed 2026-11-27: open, Draft, not merged.
Head: `feat/translation-connection-offline-20261019`
Base: `main`
Changed paths: `docs/translation-connection.md`, `index.html`, `tests/translation.test.cjs`.

The actual diff shows:
- The UI contains a consent checkbox (`translationConsent`) and checks it before the browser request.
- The POST body is `JSON.stringify({ text })`; it does **not** include `consent`.
- Success response validation requires only `data.english`.
- The UI explicitly says the AI Japanese confirmation translation has not been created.
- The translation toggle remains `GP_TRANSLATION_ENABLED = false`; the PR says no live calls occur unless separately enabled.
- The code has a hard-coded historical Worker URL, but the live Worker source, authentication, CORS, persistence, limits, model, response, and current account billing were not inspected.

## 2. Why this is a contract break, not just a wording difference

The later offline v2 handler calls `authorizeTranslation`, which rejects any payload where `payload.consent !== true` with `400 CONSENT_REQUIRED`. The existing mock-worker tests explicitly assert that a legacy v1 `{text}` payload is rejected without spending quota.

Therefore, the PR #4 browser request as currently written will fail against the v2 offline handler even when the checkbox has been checked. The checkbox check is only client-side; the consent value is not propagated to the server.

The docs on later branches describe the v2 contract as `{text, consent:true}`. They must not be read as evidence that PR #4 itself sends that contract or that the live Worker accepts it.

## 3. Product-critical response gap

PR #4 validates and returns only `english`. The current bilingual response validator already requires both:
- `english`
- `japaneseBackTranslation`

The bilingual validator rejects English-only responses. PR #4 cannot be wired directly to the bilingual UI path without a separately reviewed API contract and Worker implementation. Never populate the back-translation from the original Japanese input; it must be generated from the exact English output.

## 4. Required acceptance criteria before an API can be enabled

1. Agree one versioned request schema. At minimum, send the explicit consent field from UI to server, and have the server reject a missing/false value before quota reservation or model invocation.
2. Agree one response schema that contains a non-empty English message and a Japanese back-translation of that exact English. Any clarification state must be explicit; do not infer one from missing fields.
3. Validate request and response types, Unicode code-point lengths, maximum output lengths, content type, JSON parse failures, timeouts, and all failure statuses.
4. Authenticate identity on the server. Do not trust client-provided `userId`, `plan`, or consent alone as account identity or billing permission.
5. Enforce both global and per-user limits with atomic durable storage before any AI request. If authentication, quota storage, model pricing, or reservation fails, do not call the model.
6. Confirm live Worker source, exact CORS policy, current deployed route, account plan, included allocation, and overage behavior before any live test.
7. Execute Q01–Q16 against a real selected model only after free allowance and cost limits are confirmed; one critical semantic loss/reversal fails that case.
8. Keep the public MVP's AI flag disabled until all of the above is verified.

## 5. Existing assets that should be reused

- Existing Q01–Q12: `docs/portable-school-workflow-v0.1.md`.
- Back-translation Q13–Q16 and pass/fail criteria: `docs/plugin-migration-readiness-20261124.md`.
- Offline v2 consent gate: `experiments/translation-quota.mjs` and `experiments/mock-worker-handler.mjs`.
- Two-language output validator: `experiments/translation-response-contract.mjs`.
- Global/per-user quota prototype: `experiments/atomic-budget.mjs` and `experiments/sqlite-budget-ledger.mjs`.
- Plugin/source manifest: `plugins/global-parents/README.md`.

Do not make another copy of those evaluation cases or shared instructions.

## 6. Custom GPT source capture observations — user screenshots, 2026-11-27

The screenshots supplied in this conversation show:
- GPT name: RAWFORGE Global Parents AI.
- Description: 英語が苦手な日本人保護者のための国際教育アシスタント.
- The Instructions field visibly begins with `Official Instructions V1.0`.
- Four Conversation Starters are visible: teacher email, SLC discussion, PTA English help, and overseas-move preparation.
- In the visible Knowledge area, the upload control is shown; no attached file names are visible in the supplied frame. This does **not** prove that the full Knowledge list is empty.
- The Actions area shows “Add action”; no configured action is visible in the supplied frame.
- The editor header showed a saved-draft notice. This does not establish whether a separate published version exists.

The user performed a Save As operation for a local TXT backup, but the file itself was not uploaded to this repository or made available for independent inspection. Its exact contents, completeness, filename, and successful final save remain unverified. No private instruction text, child data, or local files are copied into this public repository.

## 7. Official migration timing (checked 2026-11-27)

OpenAI's current Custom GPT retirement and migration FAQ states:
- Standard retirement: 2026-12-11; the date is 14 days after 2026-11-27.
- Migration access can arrive at different times; the in-product notice for the account/workspace takes precedence.
- Migration uses the latest published GPT version. Drafts and unpublished edits do not transfer.
- Publishing does not require public sharing.
- Instructions become a skill; Knowledge files become reference files; connected apps are added as apps.
- Custom Actions do not transfer automatically and require a separately rebuilt and tested integration.
- The migrated plugin starts private; existing GPT users do not automatically receive access.
- The original GPT becomes read-only after migration and remains usable until its retirement date.

Official source: https://help.openai.com/en/articles/20001519-custom-gpt-retirement-and-migration-faq

## 8. Work completed and restrictions

- Re-read PR #4 actual metadata/diff and its full changed-file list.
- Re-read the separate offline v2 admission gate and tests showing consent rejection for a legacy payload.
- Re-read the bilingual output validator and its tests.
- Recorded exact contract drift and acceptance gates here, without touching PR #4.
- No AI API, live Worker, Cloudflare dashboard, payment, deployment, secret, permission, main branch, PR merge, publish, external send, or social post was used.
- Cost: 0.
