# CI/CD pipelines

GitHub Actions workflows for the §1 "push everything" release policy.

> **Status: ACTIVE.** Both workflows are live under [`../.github/workflows/`](../.github/workflows/)
> — they originally shipped in this directory because the GitHub App used for the first
> push lacked the `workflows` permission, and were activated with commit `99ebad0`
> ("ci: activate workflows"). No workflow files live in `ci/` anymore; this README is
> their documentation.

## What they do

| Workflow | File | Trigger | Steps |
| --- | --- | --- | --- |
| CI | `.github/workflows/ci.yml` | every push + PR to `main` | `npm ci` → `tsc --noEmit` → `npm run lint` → unit tests → `npm run build`, **plus** `deno check` on all three Edge Functions, the moderation fail-closed integration test (`deno test`), and a gitleaks secret scan |
| Release | `.github/workflows/release.yml` | push to `main`, or manual dispatch | **1** `supabase db push` → **2** deploy `ai-orchestrator`, `moderation-check`, `invite-consume` → **3** build & deploy the frontend to Vercel |

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

## Required repository secrets

| Secret | Used by |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ci build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ci build |
| `SUPABASE_ACCESS_TOKEN` | release: migrations, functions |
| `SUPABASE_PROJECT_REF` | release: migrations, functions |
| `SUPABASE_DB_PASSWORD` | release: migrations |
| `VERCEL_TOKEN` | release: frontend deploy |
| `VERCEL_ORG_ID` | release: frontend deploy |
| `VERCEL_PROJECT_ID` | release: frontend deploy |

The AI provider key is **not** a GitHub secret — it's a Supabase Edge Function secret:

```bash
supabase secrets set AI_PROVIDER_API_KEY=sk-ant-...
```
