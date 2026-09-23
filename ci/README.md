# CI/CD pipelines

GitHub Actions workflows for the §1 "push everything" release policy.

> **Status: ACTIVE.** Both workflows are live under [`../.github/workflows/`](../.github/workflows/)
> — they originally shipped in this directory because the GitHub App used for the first
> push lacked the `workflows` permission, and were activated with commit `99ebad0`
> ("ci: activate workflows"). No workflow files live in `ci/` anymore; this README is
> their documentation.
>
> **Landed:** the Playwright `e2e` job, the token-contrast step and the Node-24 action
> bumps held in [`patches/ci-playwright-and-contrast.patch`](patches/ci-playwright-and-contrast.patch)
> are now present in `.github/workflows/ci.yml` — the patch no longer applies because its
> post-image is the committed file. It is kept for reference only.
>
> **Pending — 2026-09-18:** `attachment-processor` is absent from **both** workflows — it
> is not in the `edge-functions` job's `deno check` loop (so it is never typechecked) and
> not in `release.yml`'s deploy matrix (so a release would never ship it, and V3 attachment
> processing would not exist in production). The GitHub App credential used here lacks the
> `workflows` permission and GitHub rejects any push that touches a workflow file
> (`refusing to allow a GitHub App to create or update workflow … without 'workflows'
> permission` — reproduced 2026-09-18). All three changes are held at
> [`patches/ci-attachment-processor-workflows.patch`](patches/ci-attachment-processor-workflows.patch),
> verified with `git apply --check` against the current `main`. Owner action:
> `git apply ci/patches/ci-attachment-processor-workflows.patch && git commit -am "ci: typecheck and deploy attachment-processor" && git push`.
>
> The third change adds a `deno test tests/pdf-extraction.test.ts` step. Vitest has to
> stub pdf.js (`tests/stubs/pdfjs.ts`), so the PDF branch of `extract.ts` has no coverage
> there at all — which is exactly how a broken `GlobalWorkerOptions.workerSrc` assignment
> shipped: every PDF failed extraction in production while the stubbed suite stayed green.
> `tests/pdf-extraction.test.ts` builds a real PDF in memory and runs the real library.
>
> Everything the patch adds has been run locally (Deno 2.9.6): `deno check` passes for all
> four functions **including under `--frozen`**, which is Deno's default when `CI=true`, and
> `npm run test:pdf` passes 4/4. `deno.lock` was regenerated for this and is committed —
> it was stale, missing `pdfjs-dist` entirely and carrying an older peer resolution for
> `next`, so a frozen check would have failed on it regardless of the patch.
>
> One gate still cannot run locally: `tests/moderation-fail-closed.test.ts` imports
> `jsr:@std/assert@1` and `jsr.io` is unreachable from this environment, so `npm run
> test:edge` has no local evidence. `tests/pdf-extraction.test.ts` deliberately asserts
> with `node:assert` instead, so it runs anywhere Deno does.
>
> **E2E status changed 2026-09-18.** The `e2e` job now runs in CI: Chromium installs and
> the suite executes — but the `Run Playwright suite` step exits 1. This is
> **pre-existing**, reproduced on `357ca0d` (run 35358311915) before the V3 work began,
> and on every run since. Which tests fail could not be determined: the Actions log hosts
> are unreachable from the development sandbox and the job annotations carry only
> "Process completed with exit code 1".
>
> Locally the position is unchanged — **no test in `e2e/` has ever been executed**,
> because Chromium cannot be installed here (`cdn.playwright.dev` is unreachable,
> re-verified 2026-09-18). The suite's only local evidence remains collection
> (`npx playwright test --list`, 36 tests / 14 files) and a clean typecheck.
>
> **Release status.** Separately, the `Release` workflow has **never** completed: every
> run fails in 10–16 s at `Link project`, before migrations or function deploys are
> reached. See follow-up 2 in [`../AUDIT.md`](../AUDIT.md) — it means no migration has
> been pushed and no Edge Function deployed by the pipeline.

## What they do

| Workflow | File | Trigger | Steps |
| --- | --- | --- | --- |
| CI | `.github/workflows/ci.yml` | every push + PR to `main` | `npm ci` → `tsc --noEmit` → `npm run lint` → unit tests (incl. 13 axe tests) → `node scripts/contrast.mjs` (WCAG AA token gate) → `npm run build`, **plus** a Playwright E2E + browser axe job (`e2e`), `deno check` on `ai-orchestrator`, `moderation-check` and `invite-consume`, the moderation fail-closed integration test (`deno test`), and a gitleaks secret scan. **After the owner applies the pending patch:** `deno check` also covers `attachment-processor`, and the PDF extraction integration test runs |
| Release | `.github/workflows/release.yml` | push to `main`, or manual dispatch | **1** `supabase db push` → **2** deploy `ai-orchestrator`, `moderation-check`, `invite-consume` → **3** build & deploy the frontend to Vercel. **After the owner applies the pending patch:** step 2 also deploys `attachment-processor` |

`release.yml` runs strictly in that order via `needs:`, so a schema change is always live
before the functions that depend on it, and the frontend ships last. A partial deploy is
treated as a failed deploy.

## Deno configuration contract (Edge Functions)

The functions import `@supabase/supabase-js` as a **bare specifier**. Deno discovers its
config from the *invocation directory*, not from the file being checked, so two config
files resolve that one specifier — and their `imports`/`compilerOptions` **must stay
identical**:

| Config | Applied when | Example |
| --- | --- | --- |
| `deno.json` (repo root) | CI runs `deno check` / `deno test` from the repo root | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| `supabase/functions/deno.json` | the Supabase CLI bundles functions for deploy; `deno check` run from inside `supabase/functions/` | `supabase functions deploy …` |

Both map `@supabase/supabase-js` → `npm:@supabase/supabase-js@2.112.4`, pinned to the
version in the frontend `package-lock.json` so browser and Edge Functions share one
dependency graph.

Notes learned the hard way (do not regress):

- The specifier is **`npm:`, not `jsr:`** — the JSR build of `@supabase/supabase-js`
  hard-pins its npm dependencies (e.g. `npm:@supabase/realtime-js@2.112.4`), which
  cannot be resolved from a root invocation (see next point). That is what broke the
  first CI run (`99ebad0`).
- **Deno resolves npm packages through the root `package.json` when invoked from the
  repo root** (byonm: "bring your own node_modules") — import maps, aliases, and
  workspaces do not bypass it. The root `deno.json` therefore sets
  `nodeModulesDir: "auto"` and the repo commits a **`deno.lock`**, so `deno check`
  provisions exactly the locked versions on demand. The CI job that type-checks the
  functions needs no separate `npm ci` step, and resolution stays deterministic.
- The committed `deno.lock` matters for another reason: Deno's *minimum dependency
  age* policy (24h, supply-chain protection) blocks resolving freshly-published npm
  versions — e.g. `@testing-library/react@16.3.3` on the day it shipped. Versions
  already pinned in `deno.lock` install fine, so the lock both pins and unblocks.
  If you intentionally bump dependencies, regenerate the lock
  (`deno check supabase/functions/ai-orchestrator/index.ts` writes it) and commit it.
  Regenerate it whenever a function starts importing a new package, too: GitHub Actions
  sets `CI=true`, Deno then implies `--frozen`, and a lock that does not already contain
  the import fails the job instead of updating itself.

## Required repository secrets

| Secret | Used by |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ci build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ci build |
| `GITHUB_TOKEN` | *optional* — raises the GitHub API rate limit for `/changelog` during the build |
| `SUPABASE_ACCESS_TOKEN` | release: migrations, functions |
| `SUPABASE_PROJECT_REF` | release: migrations, functions |
| `SUPABASE_DB_PASSWORD` | release: migrations |
| `VERCEL_TOKEN` | release: frontend deploy |
| `VERCEL_ORG_ID` | release: frontend deploy |
| `VERCEL_PROJECT_ID` | release: frontend deploy |

The AI provider key is **not** a GitHub secret — it's a Supabase Edge Function secret:

```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-...
supabase secrets set OPENAI_API_KEY=sk-...        # optional: V3 semantic retrieval
```

Without `OPENAI_API_KEY` no chunk or query embeddings are generated, so
`retrieve_attachment_chunks` runs its full-text leg only. Retrieval still works and
stays conversation-scoped; it is lexical rather than semantic, and each row reports
`fts` instead of `hybrid`/`vector`.


Edge Function secrets that are **optional but worth setting before launch**:

```bash
supabase secrets set ALLOWED_ORIGINS=https://your-domain.com   # CORS; defaults to "*"
supabase secrets set MODERATION_WEBHOOK_URL=...                # optional external classifier
supabase secrets set TRAINING_PIPELINE_URL=...                 # §8, gated on unanimous opt-in
```

The `e2e` job needs **no secrets at all** — the Playwright `webServer` starts the app in
demo mode with the Supabase variables forced empty.
