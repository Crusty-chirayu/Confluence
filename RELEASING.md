# Releasing Confluence (MU H — release readiness)

This is the owner-run release checklist. Each step is **blocked on owner-held
credentials or a `workflows`-permission push** — the GitHub App credential used
for this branch cannot write workflow files and cannot start a release against
a Supabase/Vercel project you haven't wired up. Everything is listed in order
so the release can be executed against a real deployment.

## 0. Current state

- `main` contains: MU2 (Playwright E2E + browser axe + §6 AA tokens), MU-C (k6
  harness), MU-D (attachments), MU-E (read receipts), MU-F (offline), MU-G
  (security/perf/a11y audit). All CI jobs on `main` are green.
- The Playwright CI **job is not active on `main` yet** — the CI-activation
  change is held **out of** `arena/01a047d7-group-chatbot` (the session's
  GitHub App credential cannot push workflow files; GitHub rejects it
  server-side) and ships in the branch as
  `ci/patches/ci-playwright-and-contrast.patch`, awaiting the one-time owner
  action described in §3. The tests themselves (22 tests) are committed and
  collected.
- The **Release** workflow currently fails at "Push migrations" because the
  Supabase release secrets are not set (expected until you run §4).

## 1. Secrets — server-side (Edge Functions)

Set in Supabase, never in source control or the browser:

```bash
supabase secrets set AI_PROVIDER_API_KEY=sk-ant-...   # Anthropic Messages key
```

Optional, for the training pipeline (unanimous-consent gate):
```bash
supabase secrets set TRAINING_PIPELINE_URL=...
```

## 2. Secrets — client-safe (public)

Add to the hosting env (Vercel) and to GitHub Actions:

- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the public anon key

**These are public** (the anon key is safe to expose); only the `service_role`
key and the provider key must stay server-side.

## 3. Activate CI (one-time owner push)

**State as of 2026-08-28 (after credential reconnect):** the session's
GitHub credential was restored, but a push of any commit touching
`.github/workflows/ci.yml` is **rejected server-side by GitHub**:
"refusing to allow a GitHub App to create or update workflow
`.github/workflows/ci.yml` without `workflows` permission" — the session
credential is a GitHub App without that permission. The CI-activation commit
is therefore **not in `arena/01a047d7-group-chatbot`** (the branch carries
the a11y fixes, the spec alignment and these docs, and pushes/PRs/merges
normally); the byte-identical change ships in the branch as
`ci/patches/ci-playwright-and-contrast.patch` and lands on `main` with the
merge.

One-time owner action (either path):

- **A. Grant the session's GitHub App the `workflows` permission** (repo
  Settings → GitHub Apps → the installation → Repository permissions →
  *Workflows*: read & write) and let this session know — the session then
  applies the patch, commits, pushes, PRs, merges and verifies CI.
- **B. Apply the patch on `main` yourself** — with any credential that has
  `workflows: write`:

  ```bash
  git apply ci/patches/ci-playwright-and-contrast.patch
  git add .github/workflows/ci.yml
  git commit -m "ci: run Playwright E2E + token-contrast; bump actions to Node-24-safe"
  git push
  ```

The patch in `ci/patches/` is the exact diff of the held-back CI-activation
commit — verified byte-identical and clean-applying to `main` (e2e job +
contrast step + `actions/checkout@v4 -> @v5`, `actions/setup-node@v4 -> @v5`,
`gitleaks/gitleaks-action@v2 -> @v3`). Without the bump, the Node-20 actions
run on the Node 24 runners and intermittently crash the gitleaks job (no
secret finding — documented in `SECURITY.md`).

Once the job is live it needs **no secrets**: the suite runs the app in demo
mode (the `webServer` env forces empty Supabase vars).

## 4. Release workflow secrets (owner)

`release.yml` runs `db push`, `functions deploy`, and a Vercel deploy. It needs
these GitHub repository secrets:

- `SUPABASE_ACCESS_TOKEN` — Supabase token
- `SUPABASE_PROJECT_REF` — the project ref
- `SUPABASE_DB_PASSWORD` — DB password
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` — Vercel deploy creds

Set them, then re-run the Release workflow (or push to `main`).

## 5. Apply the database schema + functions (once, against live)

The migration already contains the tables, RLS policies, storage buckets, and
policies. Apply and deploy:

```bash
supabase link --project-ref <ref>
supabase db push
supabase functions deploy ai-orchestrator moderation-check invite-consume
supabase functions deploy --no-verify-jwt 2>/dev/null || true   # if needed
```

## 6. Verify production

- Run the Playwright suite against the deployed build:
  `npx playwright test` (the `e2e` job does this in CI once §3 is done).
- Run the live load test and record real numbers in `load/k6/README.md`
  (see `load/k6/` for the harness + acceptance thresholds).
- Confirm the signed-URL attachment flow against the real bucket (the policies
  are in the schema; the client mints 24h member-scoped URLs).

## 7. Go/no-go

All CI on `main` green, §1–§5 executed, attachments + read receipts + offline
validated against the live deployment, then flip the room `ai_mode` and ship.
