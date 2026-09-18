-- =====================================================================
-- V3 processing function grants
--
-- The three service-role-only processing helpers revoke EXECUTE from
-- public/anon/authenticated so that no browser client can drive the
-- attachment lifecycle. That revocation is only safe if the caller that
-- legitimately needs them — `attachment-processor`, running under
-- SUPABASE_SERVICE_ROLE_KEY — is granted EXECUTE explicitly rather than
-- relying on the project's default privileges for newly created functions.
--
-- These grants are additive and narrow: they name `service_role` only,
-- which is a server-side key that is never shipped to the browser. No
-- policy is weakened and no previously reachable path becomes reachable
-- for anon or authenticated callers.
-- =====================================================================

grant execute on function public.claim_attachment_processing(uuid) to service_role;
grant execute on function public.mark_attachment_processed(uuid, int) to service_role;
grant execute on function public.mark_attachment_failed(uuid, text) to service_role;

-- Defence in depth: keep the browser-facing roles revoked even if a later
-- migration re-creates one of these functions (CREATE OR REPLACE preserves
-- grants, so an explicit revoke here is idempotent and self-documenting).
revoke execute on function public.claim_attachment_processing(uuid)
  from public, anon, authenticated;
revoke execute on function public.mark_attachment_processed(uuid, int)
  from public, anon, authenticated;
revoke execute on function public.mark_attachment_failed(uuid, text)
  from public, anon, authenticated;

-- =====================================================================
-- END OF MIGRATION
-- =====================================================================
