# Security & privacy

This document records the security posture of Confluence and the audit performed
on the current `main`, so claims are verifiable rather than assumed.

## Secrets

- The AI provider key (`AI_PROVIDER_API_KEY`) is **server-only**. It is read in
  the Edge Functions via `Deno.env.get(...)` and never logged or returned. The
  browser only ever sees `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (the public anon key, safe to expose).
- The `SUPABASE_SERVICE_ROLE_KEY` is used **only** inside `invite-consume`/
  `ai-orchestrator`/`moderation-check` via `supabase/functions/_shared/supabase.ts`;
  it bypasses RLS by design and is never shipped to the client.
- Client-side `.env*` files are gitignored; only `.env.example` (placeholders)
  is committed.
- A repository-wide scan for `sk-ant-`, `service_role`, `BEGIN ... PRIVATE KEY`,
  JWTs and hardcoded keys found **no committed real secrets** — only
  documentation placeholders and a synthetic test fixture in
  `tests/moderation-fail-closed.test.ts` (which exercises the credential-leak
  classifier on purpose).

## Authorization / RLS

- RLS is enabled on **every** user-accessible table; membership is enforced by
  `is_conversation_member()` policies on `conversations`, `messages`,
  `reactions`, `message_attachments`.
- Admin actions are gated by `is_conversation_admin()` (owner/admin).
- Audit tables (`moderation_events`, `rate_limit_events`, `ai_usage_log`) have
  RLS **enabled with zero policies** → unreachable from `anon`/`authenticated`;
  only `service_role` (inside Edge Functions) can touch them.
- Invite redemption goes through the `invite-consume` Edge Function
  (`service_role`), so the client has no direct RLS path to an invite for a
  room it has not joined.
- Storage (private attachments) policies mirror the same membership checks;
  access is via signed URLs only. (Upload UI is not yet implemented.)

## Input / output handling

- Markdown is rendered with `react-markdown` **without** `rehypeRaw` — raw HTML
  in message bodies is escaped, not executed. Links get `rel="noopener
  noreferrer"`. The only `dangerouslySetInnerHTML` is the trusted, inlined theme
  script in the root layout.
- **Moderation fails closed.** If the classifier cannot confirm a verdict an
  `error_failed_closed` block is emitted and the request is **not** routed to
  the model (both pre- and post-generation). This is covered by
  `tests/moderation-fail-closed.test.ts`.
- **Training consent is conservative.** AI training routing requires *unanimous*
  opt-in: every current member must have `profiles.training_opt_in = true`. Any
  opt-out, missing record, failed read or count mismatch disables routing.
- Edge Functions validate the caller's membership, rate-limit, and never return
  stack traces / provider secrets; errors map to safe `detail` strings.

## Known open items (owner/config)

These are **not** code defects but require owner-held credentials or a
workflow-permitted push:

1. **`.github/workflows/*` push permission.** The GitHub App used for pushes
   lacks the `workflows` scope, so it cannot write workflow files. To activate
   the Playwright CI job (and bump GitHub Actions to Node-24-compatible
   versions, see below) an owner with the `workflows` permission must push
   `.github/workflows/ci.yml`.
2. **gitleaks on Node 24.** `actions/checkout@v4` and `gitleaks/gitleaks-action@v2`
   target Node 20, which GitHub deprecated (2025-09-19) and now forces onto
   Node 24 — causing intermittent gitleaks job failures with **no secret
   finding**. Bump to `actions/checkout@v5` and `gitleaks/gitleaks-action@v3`
   (owner push).
3. **Release secrets.** `release.yml` fails until the owner sets
   `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`,
   `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (see `ci/README.md`).
4. **AI provider key.** `supabase secrets set AI_PROVIDER_API_KEY=sk-...`
   (server-side, never in source control).
