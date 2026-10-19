# Copilot CLI built-in GITHUB_TOKEN — preparation only

**Status:** no AI execution, no token access, no workflow run authorized, no merge, no deployment.

## Official documentation reviewed (October 19, 2026)
- https://docs.github.com/en/copilot/concepts/agents/copilot-cli/copilot-cli-in-github-actions
  - Direct Copilot CLI in Actions can authenticate using built-in GITHUB_TOKEN.
  - In a **personal** repository, Copilot credits are attributed to the repository owner's Copilot entitlement.
- https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli-in-actions
  - Actual Copilot CLI calls need `permissions: contents: read; copilot-requests: write`, a recent CLI version, and `GITHUB_TOKEN`.
  - None of those AI-request permissions or invocations are present in this preparation workflow.
- https://docs.github.com/en/actions/tutorials/develop-agentic-workflows-in-github-actions
  - GitHub **Agentic Workflows** documentation separately describes PAT requirements for personal repositories. This plan concerns direct Copilot CLI, **not** Agentic Workflows.

## Existing safeguards observed from owner-provided screenshots
- Copilot Free, inline suggestions 0% and AI credit usage 0% at time of screenshot.
- Billing budgets included All AI Credit SKUs $0.00 with "Usage blocked"; additional usage reportedly disabled.
- These snapshots do not prove future billing conditions or guarantee that all kinds of usage are blocked.
- Recheck immediately before any real AI request.

## Files and execution gates
- Branch: `test/copilot-github-token-prep-20261019`, created from `main`.
- Workflow: `.github/workflows/copilot-token-offline.yml` has `workflow_dispatch` only and `permissions: {}`.
- This branch-only workflow is not listed as manually runnable in Actions unless it is on the default branch; **do not merge** just to make it visible.
- It does not checkout source, read credentials, install packages, invoke Copilot, create artifacts, push, merge, or deploy.
- Do not add a push trigger, enable a schedule, grant `copilot-requests: write`, or execute AI without explicit separate approval.

## Proposed later real AI experiment — NOT IMPLEMENTED
1. Confirm that personal-repository built-in token auth works for Copilot Free and that premium-request allowance remains available.
2. Confirm additional paid usage cannot occur; if this is uncertain, stop and report.
3. Require manual one-time explicit approval; use a separate branch and a minimal read-only source checkout.
4. Allow at most one bounded Copilot CLI invocation, strict timeout, no retries, no network/tool access beyond the minimum needed.
5. Validate a single tiny proposed change offline; do not push or deploy. Review any output before deciding whether to create a PR.

**Never infer that creating this document authorizes an AI request or charges.**
