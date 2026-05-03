# Edge Marketplace Hub — Antigravity Execution Brief

## 0) Mission
Take Edge Marketplace Hub from current stabilized-but-not-finished state to clean rapid deployment with reliable CI/CD, verified promotion/rollback, and complete onboarding flow readiness.

Primary goal: finish the project safely and quickly with production confidence.

---

## 1) Operating Mode
- Use plan-first execution (propose -> review -> execute).
- Keep blast radius constrained to this repo/workspace only.
- Prefer short, copy/paste-safe one-liner commands.
- Do not expose secrets in prompts, logs, commits, or docs.
- For risky changes, create small commits with clear rollback points.

---

## 2) Canonical Project Context

### Repository
- GitHub: https://github.com/edgemarketplace/ecomstore
- Branch: `main`
- Local path: `/home/creativecapital/ecommerce`

### Cloud/Firebase
- Project ID: `edge-marketplace-hub`
- Project Number: `321447962014`
- Runtime target: Firebase Hosting + SSR
- Hosting URL: `https://edge-marketplace-hub.web.app`

### Current CI Workflow
- File: `.github/workflows/firebase-release.yml`
- Trigger: push to main + workflow_dispatch
- Stages intended:
  - deploy staging
  - resolve staging URL
  - smoke test
  - optional promote to live

### Critical Current Blocker
Workflow auth fails in `google-github-actions/auth@v2` because secret appears blank at runtime.

Observed evidence from failed run logs:
- `GCP_SA_KEY_EDGE_MARKETPLACE_HUB:` resolves empty in env.
- Error: must specify exactly one of `workload_identity_provider` or `credentials_json`.

Interpretation: secret exists by name in GitHub, but value injection is empty/invalid.

---

## 3) What’s Already Done (Do NOT redo blindly)

1. gcloud + ADC auth established and validated.
2. Firebase deploy path stabilized after IAM/policy troubleshooting.
3. Production/site availability restored.
4. Release scripts created:
   - `scripts/deploy-firebase-hosting.sh`
   - `scripts/smoke-test-prod.sh`
   - `scripts/deploy-staging-channel.sh`
   - `scripts/promote-staging-to-live.sh`
   - `scripts/rollback-live.sh`
5. Smoke contract aligned with API behavior:
   - `GET /api/onboarding/status` without `intake_id` should return 400.
6. Lint/tooling guardrails added.
7. GitHub repo migration completed and `main` pushed.
8. CI workflow patched with a diagnostic step proving secret is blank in runtime.

---

## 4) Product Scope Snapshot

Current app includes:
- Landing page (root route)
- Checkout flow (`/checkout`)
- Stripe integration paths
- Onboarding intake + status APIs
- Tenant onboarding progress/state data model
- Admin settings/connect surfaces

Important files:
- `app/page.tsx`
- `app/checkout/**`
- `app/api/onboarding/intake/route.ts`
- `app/api/onboarding/status/route.ts`
- `components/OnboardingWizard.tsx`
- `components/OnboardingProgressCard.tsx`
- `lib/onboarding-engine.ts`
- `app/actions/stripe.ts`
- `app/api/webhooks/stripe/route.ts`
- `lib/stripe-connect.ts`

Note: explicit "60-minute onboarding SLA" behavior is not yet clearly implemented end-to-end.

---

## 5) Required Outcomes (Definition of Done)

A. CI/CD + Release
1. Fix GitHub Actions auth to GCP (secret or WIF) so staging deploy job passes.
2. Confirm `push -> staging deploy -> smoke` is green on `main`.
3. Confirm `workflow_dispatch promote_to_live=true` succeeds.
4. Confirm rollback script works from a known backup channel.

B. Product Validation
5. Validate landing page + checkout + onboarding API contract in deployed environments.
6. Ensure smoke tests reflect real intended behavior and fail loudly on regressions.

C. 60-Minute Onboarding Goal
7. Implement or complete operational 60-minute onboarding model:
   - measurable timestamps/milestones
   - admin visibility
   - failure/retry states
   - clear success criteria (`ready_to_launch`/`live`)

D. Final Handoff
8. Deliver concise runbook with exact commands for:
   - staging deploy
   - smoke
   - promote
   - rollback
   - incident recovery basics

---

## 6) Prioritized Execution Plan

### Phase 1 — Unblock CI auth (highest priority)
- Verify repository secret value is non-empty and valid JSON key.
- If key-based auth remains brittle, migrate to Workload Identity Federation for GitHub Actions.
- Keep auth method singular and explicit in workflow.
- Re-run workflow and capture evidence of pass/fail.

### Phase 2 — Verify release pipeline
- Staging deploy from CI
- Staging smoke pass
- Promote-to-live pass
- Live smoke pass
- Rollback drill pass

### Phase 3 — Validate app-critical journeys
- Landing page renders correctly
- Checkout happy path + failure path checks
- Onboarding intake creation
- Onboarding status polling behavior
- Admin onboarding/connect links and status refresh

### Phase 4 — 60-minute onboarding completion
- Add explicit SLA tracking fields + timestamps if missing.
- Add UI/admin visibility for elapsed time and bottlenecks.
- Add transition logic + alerts/retry semantics where needed.

### Phase 5 — Documentation and closeout
- Update runbook and checklist.
- Provide exact changed files and rationale.
- Provide release confidence summary and known residual risks.

---

## 7) Technical Constraints
- Keep changes minimal and reversible.
- Commit in small logical units.
- Never commit secrets or key files.
- Keep compatibility with current Firebase/Next setup.
- Respect existing smoke contract for onboarding status endpoint behavior.

---

## 8) Suggested Multi-Agent Split (Antigravity)

Agent A — Release/DevOps
- Own CI auth repair + staging/promo/rollback verification.

Agent B — App QA
- Own route/API contract checks and smoke test reliability.

Agent C — Onboarding SLA
- Own 60-minute onboarding implementation + admin observability.

Agent D — Docs/Runbook
- Own final operator docs and deployment quickstart.

---

## 9) Completion Deliverables
Provide all of the following:
1. Green workflow evidence (run URLs/IDs).
2. List of modified files with short purpose statement.
3. Final runbook commands (copy/paste-safe one-liners).
4. 60-minute onboarding implementation summary.
5. Rollback test evidence.
6. Outstanding risks + mitigation recommendations.

---

## 10) Start Here (First Actions)
1. Diagnose and fix GitHub Actions GCP auth injection issue.
2. Get staging CI green.
3. Promote and verify live.
4. Finish onboarding SLA layer.
5. Produce final handoff artifacts.
