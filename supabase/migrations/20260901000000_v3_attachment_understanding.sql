-- =====================================================================
-- V3 Attachment Understanding — Database Schema
--
-- Adds attachment chunks table with pgvector support and full-text search
-- fallback for document retrieval and AI context assembly.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------------------
-- Enable pgvector for semantic search (was commented out in init.sql)
create extension if not exists "vector";

-- ---------------------------------------------------------------------
-- 1b. PROCESSING STATUS ON ATTACHMENTS
-- ---------------------------------------------------------------------
-- Lifecycle: queued -> processing -> ready | failed. 'unsupported' marks
-- file types the understanding pipeline never processes (images, audio,
-- video). The default 'queued' also backfills pre-V3 rows; the update
-- below re-labels those honestly instead of promising processing that
-- will never run for them.
alter table public.message_attachments
  add column if not exists processing_status text not null default 'queued',
  add column if not exists processing_error text,
  add column if not exists processed_at timestamptz;

do $$ begin
  alter table public.message_attachments
    add constraint message_attachments_status_check
    check (processing_status in ('unsupported','queued','processing','ready','failed'));
exception when duplicate_object then null; -- constraint already exists
end $$;

update public.message_attachments set processing_status = 'unsupported';

-- ---------------------------------------------------------------------
-- 2. ATTACHMENT CHUNKS TABLE
-- ---------------------------------------------------------------------
create table if not exists public.attachment_chunks (
  id                uuid primary key default gen_random_uuid(),
  attachment_id     uuid not null references public.message_attachments(id) on delete cascade,
  chunk_index       int not null,
  content           text not null,
  label             text not null,  -- e.g., "page 1", "section 2", or generic index
  token_count       int,
  page_number       int,           -- 1-based source page when the extractor knows it
  embedding         vector(1536),  -- Standard text embedding dimension
  created_at        timestamptz not null default now(),
  
  -- Ensure chunk order is unique per attachment
  constraint attachment_chunks_unique_order unique (attachment_id, chunk_index)
);

-- Indexes for retrieval
create index if not exists idx_attachment_chunks_attachment 
  on public.attachment_chunks(attachment_id);

-- Full-text search index for FTS fallback
alter table public.attachment_chunks 
  add column if not exists content_tsv tsvector
  generated always as (to_tsvector('english', coalesce(content, ''))) stored;

create index if not exists idx_attachment_chunks_fts 
  on public.attachment_chunks using gin(content_tsv);

-- Vector similarity index (ivfflat for performance)
create index if not exists idx_attachment_chunks_embedding 
  on public.attachment_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.attachment_chunks enable row level security;

-- Chunks inherit the same visibility as their parent attachments
drop policy if exists "chunks_select_member" on public.attachment_chunks;
create policy "chunks_select_member" on public.attachment_chunks
  for select using (
    exists (
      select 1 from public.message_attachments ma
      join public.messages m on m.id = ma.message_id
      where ma.id = attachment_id
        and public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

-- Only service_role can insert chunks (via attachment-processor)
drop policy if exists "chunks_insert_service_only" on public.attachment_chunks;
create policy "chunks_insert_service_only" on public.attachment_chunks
  for insert with check (false);

-- Only service_role can update/delete chunks
drop policy if exists "chunks_update_service_only" on public.attachment_chunks;
create policy "chunks_update_service_only" on public.attachment_chunks
  for update using (false);

drop policy if exists "chunks_delete_service_only" on public.attachment_chunks;
create policy "chunks_delete_service_only" on public.attachment_chunks
  for delete using (false);

-- ---------------------------------------------------------------------
-- 4. RETRIEVAL FUNCTIONS
-- ---------------------------------------------------------------------

/**
 * Retrieve relevant chunks for a conversation using hybrid search.
 *
 * Merges pgvector similarity (when both a query embedding and chunk
 * embeddings exist) with PostgreSQL full-text search, then combines the
 * result sets deterministically:
 *   - a chunk found by both methods gets a fused score (Reciprocal Rank
 *     Fusion) and `retrieval_method = 'hybrid'`;
 *   - a chunk found by only one keeps its single method and rank.
 *
 * Authorization is enforced EXPLICITLY (not only via RLS): every branch
 * joins messages/conversation_members on the calling user, so the function
 * cannot leak cross-conversation chunks even if invoked with a crafted
 * security context. RLS stays enabled underneath as defense in depth.
 *
 * The caller decides the fallback: pass p_query_embedding => null when no
 * query embedding is available and only FTS is used.
 */
create or replace function public.retrieve_attachment_chunks(
  p_conversation_id uuid,
  p_query text,
  p_query_embedding vector(1536),
  p_limit int default 10
)
returns table (
  chunk_id uuid,
  attachment_id uuid,
  chunk_index int,
  page_number int,
  content text,
  label text,
  similarity float,
  retrieval_method text,
  filename text,
  mime_type text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_member uuid;
  v_has_embeddings boolean;
  v_limit int;
begin
  -- 1. Authorization: the caller must be a member of the conversation.
  select user_id into v_member
  from public.conversation_members
  where conversation_id = p_conversation_id
    and user_id = auth.uid();
  if v_member is null then
    -- Empty result, not an error: a non-member learns nothing.
    return;
  end if;

  if p_query is null or btrim(p_query) = '' then
    return;
  end if;

  -- Hard cap: never return more than 50 chunks.
  v_limit := least(coalesce(p_limit, 10), 50);

  -- 2. Do any chunks in this conversation carry embeddings?
  select exists (
    select 1
    from public.attachment_chunks ac
    join public.message_attachments ma on ma.id = ac.attachment_id
    join public.messages m on m.id = ma.message_id
    where m.conversation_id = p_conversation_id
      and ac.embedding is not null
  ) into v_has_embeddings;

  -- 3. Scratch table for the two retrieval legs (vector / full-text).
  -- Recreated per call; `on commit drop` cleans up when the RPC commits.
  create temp table if not exists _v3_retrieval_legs (
    chunk_id uuid, attachment_id uuid, chunk_index int, page_number int,
    content text, label text, similarity float, retrieval_method text,
    filename text, mime_type text, vec_rank int, fts_rank int
  ) on commit drop;
  delete from pg_temp._v3_retrieval_legs;

  if v_has_embeddings and p_query_embedding is not null then
    insert into pg_temp._v3_retrieval_legs
    select
      ac.id, ac.attachment_id, ac.chunk_index, ac.page_number,
      ac.content, ac.label,
      1 - (ac.embedding <=> p_query_embedding),
      'vector',
      ma.storage_path,   -- filename extracted in the final projection
      ma.mime_type,
      row_number() over (order by ac.embedding <=> p_query_embedding),
      null
    from public.attachment_chunks ac
    join public.message_attachments ma on ma.id = ac.attachment_id
    join public.messages m on m.id = ma.message_id
    where m.conversation_id = p_conversation_id
      and ac.embedding is not null
    order by ac.embedding <=> p_query_embedding
    limit v_limit;
  end if;

  -- 4. FTS leg (always computed; also the standalone fallback).
  insert into pg_temp._v3_retrieval_legs
  select
    ac.id, ac.attachment_id, ac.chunk_index, ac.page_number,
    ac.content, ac.label,
    ts_rank(ac.content_tsv, websearch_to_tsquery('english', p_query)),
    'fts',
    ma.storage_path,
    ma.mime_type,
    null,
    row_number() over (order by ts_rank(ac.content_tsv, websearch_to_tsquery('english', p_query)) desc)
  from public.attachment_chunks ac
  join public.message_attachments ma on ma.id = ac.attachment_id
  join public.messages m on m.id = ma.message_id
  where m.conversation_id = p_conversation_id
    and ac.content_tsv @@ websearch_to_tsquery('english', p_query)
  order by ts_rank(ac.content_tsv, websearch_to_tsquery('english', p_query)) desc
  limit v_limit;

  -- 5. Deterministic merge with deduplication + Reciprocal Rank Fusion.
  return query
  with merged as (
    select
      leg.chunk_id, leg.attachment_id, leg.chunk_index, leg.page_number,
      leg.content, leg.label,
      leg.similarity,
      case
        when leg.vec_rank is not null and leg.fts_rank is not null then 'hybrid'
        else leg.retrieval_method
      end as method,
      leg.filename, leg.mime_type,
      coalesce(leg.vec_rank, 2147483647) as vr,
      coalesce(leg.fts_rank, 2147483647) as fr
    from _v3_retrieval_legs leg
  ),
  fused as (
    select
      m.*,
      case
        when m.vr < 2147483647 and m.fr < 2147483647
          then 1.0 / (60 + m.vr) + 1.0 / (60 + m.fr)
        when m.vr < 2147483647 then 1.0 / (60 + m.vr)
        else 1.0 / (60 + m.fr)
      end as rrf
    from merged m
  )
  select
    f.chunk_id, f.attachment_id, f.chunk_index, f.page_number,
    f.content, f.label, f.similarity, f.method,
    split_part(f.filename, '/', 3) as filename,
    f.mime_type
  from fused f
  order by f.rrf desc, f.chunk_id
  limit v_limit;
end;
$$;

-- Grant execute on retrieval function to authenticated users
grant execute on function public.retrieve_attachment_chunks(uuid, text, vector(1536), int) to authenticated;

/**
 * Attachment processing status for the calling user's own conversations.
 *
 * Explicit membership filter (defense in depth alongside RLS). Returns one
 * row per attachment; `page_count` comes from the chunk table when ready.
 */
create or replace function public.get_attachment_processing_status(
  p_attachment_ids uuid[]
)
returns table (
  attachment_id uuid,
  status text,
  error text,
  processed_at timestamptz,
  chunk_count int
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    ma.id,
    ma.processing_status,
    case ma.processing_status when 'failed' then ma.processing_error else null end,
    ma.processed_at,
    (select count(*)::int from public.attachment_chunks ac where ac.attachment_id = ma.id)
  from public.message_attachments ma
  join public.messages m on m.id = ma.message_id
  where ma.id = any(p_attachment_ids)
    and public.is_conversation_member(m.conversation_id, auth.uid());
$$;

grant execute on function public.get_attachment_processing_status(uuid[]) to authenticated;

/**
 * Get attachment metadata for context assembly.
 * Returns attachment details that are visible to the calling user.
 */
create or replace function public.get_attachment_context(
  p_conversation_id uuid
)
returns table (
  attachment_id uuid,
  filename text,
  mime_type text,
  chunk_count int
)
language sql
security invoker
set search_path = public
as $$
  select 
    ma.id as attachment_id,
    split_part((storage.foldername(ma.storage_path))[3], '/', 1) as filename,
    ma.mime_type,
    count(ac.id) as chunk_count
  from public.message_attachments ma
  join public.messages m on m.id = ma.message_id
  left join public.attachment_chunks ac on ac.attachment_id = ma.id
  where m.conversation_id = p_conversation_id
    and public.is_conversation_member(m.conversation_id, auth.uid())
  group by ma.id, ma.storage_path, ma.mime_type
  order by ma.created_at desc;
$$;

grant execute on function public.get_attachment_context(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. PROCESSING COMPLETION (service-role only)
-- ---------------------------------------------------------------------

/**
 * Mark an attachment processed. Called by attachment-processor (service
 * role) AFTER its chunks are durably inserted; the ownership guard makes
 * the call idempotent and keeps `ready` truthful — a failed run never
 * marks the document ready.
 */
create or replace function public.mark_attachment_processed(
  p_attachment_id uuid,
  p_chunk_count int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.message_attachments
  set processing_status = 'ready',
      processing_error = null,
      processed_at = now()
  where id = p_attachment_id
    and exists (select 1 from public.attachment_chunks where attachment_id = p_attachment_id);
end;
$$;

/**
 * Mark an attachment failed. Called by attachment-processor when extraction
 * or persistence errors out. Revoke-first so a re-run can retry cleanly.
 */
create or replace function public.mark_attachment_failed(
  p_attachment_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.attachment_chunks where attachment_id = p_attachment_id;
  update public.message_attachments
  set processing_status = 'failed',
      processing_error = left(coalesce(p_reason, 'processing_failed'), 500),
      processed_at = null
  where id = p_attachment_id;
end;
$$;

revoke execute on function public.mark_attachment_processed(uuid, int) from public, anon, authenticated;
revoke execute on function public.mark_attachment_failed(uuid, text) from public, anon, authenticated;

-- =====================================================================
-- END OF MIGRATION
-- =====================================================================