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
-- 2. ATTACHMENT CHUNKS TABLE
-- ---------------------------------------------------------------------
create table if not exists public.attachment_chunks (
  id                uuid primary key default gen_random_uuid(),
  attachment_id     uuid not null references public.message_attachments(id) on delete cascade,
  chunk_index       int not null,
  content           text not null,
  label             text not null,  -- e.g., "page 1", "section 2", or generic index
  token_count       int,
  embedding         vector(1536),  -- OpenAI text-embedding-3-small dimension
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
 * Retrieve relevant chunks for a conversation using vector similarity.
 * Falls back to full-text search if embeddings are unavailable.
 * Respects conversation membership via RLS.
 */
create or replace function public.retrieve_attachment_chunks(
  p_conversation_id uuid,
  p_query text,
  p_limit int default 10
)
returns table (
  chunk_id uuid,
  attachment_id uuid,
  chunk_index int,
  content text,
  label text,
  similarity float
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_has_embeddings boolean;
begin
  -- Check if any chunks in this conversation have embeddings
  select exists (
    select 1 from public.attachment_chunks ac
    join public.message_attachments ma on ma.id = ac.attachment_id
    join public.messages m on m.id = ma.message_id
    where m.conversation_id = p_conversation_id
      and ac.embedding is not null
  ) into v_has_embeddings;

  if v_has_embeddings then
    -- Vector similarity search using pgvector
    -- First, we need to generate an embedding for the query
    -- This requires the embedding service, so we'll use FTS as fallback for now
    -- TODO: Add embedding generation for query when embedding service is available
    return query
    select 
      ac.id as chunk_id,
      ac.attachment_id,
      ac.chunk_index,
      ac.content,
      ac.label,
      0.0 as similarity  -- Placeholder until embedding service is integrated
    from public.attachment_chunks ac
    join public.message_attachments ma on ma.id = ac.attachment_id
    join public.messages m on m.id = ma.message_id
    where m.conversation_id = p_conversation_id
      and ac.content_tsv @@ websearch_to_tsquery('english', p_query)
    order by ts_rank(ac.content_tsv, websearch_to_tsquery('english', p_query)) desc
    limit least(coalesce(p_limit, 10), 50);
  else
    -- Full-text search fallback
    return query
    select 
      ac.id as chunk_id,
      ac.attachment_id,
      ac.chunk_index,
      ac.content,
      ac.label,
      ts_rank(ac.content_tsv, websearch_to_tsquery('english', p_query)) as similarity
    from public.attachment_chunks ac
    join public.message_attachments ma on ma.id = ac.attachment_id
    join public.messages m on m.id = ma.message_id
    where m.conversation_id = p_conversation_id
      and ac.content_tsv @@ websearch_to_tsquery('english', p_query)
    order by similarity desc
    limit least(coalesce(p_limit, 10), 50);
  end if;
end;
$$;

-- Grant execute on retrieval function to authenticated users
grant execute on function public.retrieve_attachment_chunks(uuid, text, int) to authenticated;

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
-- 5. HELPER FUNCTIONS
-- ---------------------------------------------------------------------

/**
 * Mark an attachment as processed (called by attachment-processor).
 * This can be used to track processing status if needed.
 */
create or replace function public.mark_attachment_processed(p_attachment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- For now, the presence of chunks indicates successful processing
  -- This function can be extended to add a processing_status column
  -- if explicit state tracking is needed
  null;
end;
$$;

-- =====================================================================
-- END OF MIGRATION
-- =====================================================================