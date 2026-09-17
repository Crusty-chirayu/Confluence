-- =====================================================================
-- V3 Verified citations — storage for citation metadata on AI messages
--
-- Citations are derived server-side from the attachment chunks that were
-- actually retrieved for the prompt (see _shared/citations.ts). The column
-- stores the serialized, already-verified list; the client renders only
-- what is here and never trusts model prose alone.
--
-- Row visibility follows the existing messages RLS — no extra policies.
-- =====================================================================

alter table public.messages
  add column if not exists citations jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.messages
    add constraint messages_citations_is_array
    check (jsonb_typeof(citations) = 'array');
exception when duplicate_object then null; -- constraint already exists
end $$;

-- =====================================================================
-- END OF MIGRATION
-- =====================================================================
