# Copilot token trial: safe preparation only

This branch prepares a **no-AI** GitHub Actions smoke test. No execution is authorized by creating these files.

## Scope
- Branch: `test/copilot-token-smoke-20261019` (separate from PR #2).
- Workflow: `.github/workflows/copilot-token-smoke.yml`.
- Trigger: **push only** to the exact branch **and** changes to `.github/copilot-smoke-trigger.txt`.
- The trigger file is intentionally **not created** in this preparation.
- Permissions: `{}` (no GitHub write privileges).
- Standard public-repository runner; one-minute timeout; no checkout, AI inference, PAT, secrets, artifact, PR write, merge, deployment, paid API, or schedule.

## What this proves (only after separately approved trigger)
GitHub-hosted Actions can run a narrowly scoped branch job while the user's PC is off.
It does **not** prove Copilot CLI authorization, AI quota, pricing, or AI coding.

## Later stages (not authorized here)
1. Confirm GitHub's **current** official documentation on whether the repo-scoped `GITHUB_TOKEN` with `copilot-requests: write` can bill only the personal Copilot Free allowance for this personal repo.
2. Confirm the account's no-paid-overage enforcement and remaining allowance; stop if zero additional charge cannot be ensured.
3. Request explicit authorization before changing permissions, enabling an AI invocation, setting a trigger, or running any job.
4. If approved, create a **separate** strictly bounded AI experiment without pushes or deployments. Keep PR #2 Draft and unmerged.

## Zero-charge rule
No AI run is included. No guarantee about future Copilot billing is asserted. If billing cannot be verified, stop.
