# CI/CD pipelines

These are the GitHub Actions workflows for the §1 "push everything" release policy.

They live here rather than in `.github/workflows/` because the GitHub App used to push
this branch doesn't hold the `workflows` permission, so commits touching that directory
are rejected by the server.

## Activating them

```bash
mkdir -p .github/workflows
git mv ci/ci.yml       .github/workflows/ci.yml
git mv ci/release.yml  .github/workflows/release.yml
git commit -m "ci: activate workflows"
git push
```

Push that from a local clone (or any credential with the `workflow` scope) and both
pipelines go live immediately.

## What they do

| File | Trigger | Steps |
| --- | --- | --- |
| `ci.yml` | every push + PR to `main` | `npm ci` → `tsc --noEmit` → `npm run lint` → `npm run build`, plus `deno check` on all three Edge Functions |
| `release.yml` | push to `main`, or manual dispatch | **1** `supabase db push` → **2** deploy `ai-orchestrator`, `moderation-check`, `invite-consume` → **3** build & deploy the frontend to Vercel |

`release.yml` runs strictly in that order via `needs:`, so a schema change is always live
before the functions that depend on it, and the frontend ships last. A partial deploy is
treated as a failed deploy.

## Required repository secrets

| Secret | Used by |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ci build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ci build |
| `SUPABASE_ACCESS_TOKEN` | migrations, functions |
| `SUPABASE_PROJECT_REF` | migrations, functions |
| `SUPABASE_DB_PASSWORD` | migrations |
| `VERCEL_TOKEN` | frontend deploy |
| `VERCEL_ORG_ID` | frontend deploy |
| `VERCEL_PROJECT_ID` | frontend deploy |

The AI provider key is **not** a GitHub secret — it's a Supabase Edge Function secret:

```bash
supabase secrets set AI_PROVIDER_API_KEY=sk-ant-...
```
