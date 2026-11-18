# Global Parents — release gate and payment readiness v0.1
Date: 2026-11-18. Preparation only. Not production approval.

## Minimum release gate (all mandatory)
1. Obtain current Cloudflare Worker source and compare deployed POST contract against offline v2 {text,consent:true} -> {english}. No inference from mock.
2. Verify authentication and per-user access limits on server; reject unauthenticated/invalid consent and fail closed when durable quota store is unavailable.
3. Measure worst-case model cost with actual provider pricing and token caps; confirm account-specific free tier and set hard stop. No real API requests until authorized.
4. Verify personal data minimization, privacy notice, retention/deletion policy, and protection against prompt injection. Do not put real child data in GitHub.
5. Test generated English, true back-translation of that English, 12 semantic cases, and 60 tone/locale cases. No invented facts, especially dates, negation, conditional statements.
6. Verify checkout recurring billing, cancellations/refunds, consumer disclosures, and customer support process before charging. Do not create payment links or activate billing without approval.
7. Validate onboarding, consent, error states (400/401/403/429/503), and mobile usability with no external API calls.
8. Record actual evidence per gate: file/commit, test command, run id, pass/fail, owner and timestamp. A plan is not a passing test.

## Minimal paid product definition (hypothesis, not validated)
Audience: Japanese-speaking parents who need school correspondence in English.
Proposed ¥1,500/month: draft subject/body, accurate Japanese back-translation, editable copy, limited monthly quota. Exact quota pending real model costs and usage research.
Do not promise instant accuracy, teacher responses, medical/legal advice or school-specific policy.

## Blocking inputs
- Deployed Worker source (remove secrets before sharing).
- Current custom GPT instructions/knowledge file inventory (no personal records).
- Model/provider cost and account billing caps.
- Payment provider and legal merchant information.
- Official Plugin integration specification and permission model.

## Release policy
Keep translation disabled, no main merge, no Cloudflare deploy, no social posting, no external send, no payment activation, no secrets/permissions changes. This document is an internal checklist, not a compatibility or quality test.
