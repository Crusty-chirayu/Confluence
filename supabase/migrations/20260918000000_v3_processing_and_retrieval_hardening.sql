-- =====================================================================
-- V3 processing and retrieval hardening
--
-- Fixes the deployed V3 retrieval fusion, makes processor claims atomic,
-- and keeps empty-but-successful extraction states truthful.
-- =====================================================================

alter table public.message_attachments
  add column if not exists processing_started_at timestamptz;

/**
 * Atomically claim one attachment-processing job.
 *
 * A processing lease is reclaimable after 15 minutes so a crashed Edge
 * Function does not leave the attachment permanently stuck. This function is
 * service-role-only; caller authorization remains in attachment-processor.
 */
create or replace function public.claim_attachment_processing(
  p_attachment_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_started_at timestamptz;
begin
  select processing_status, processing_started_at
    into v_status, v_started_at
  from public.message_attachments
  where id = p_attachment_id
  for update;

  if not found then return 'missing'; end if;
  if v_status = 'ready' then return 'ready'; end if;
  if v_status = 'unsupported' then return 'unsupported'; end if;
  if v_status = 'processing'
     and v_started_at is not null
     and v_started_at > now() - interval '15 minutes' then
    return 'processing';
  end if;

  update public.message_attachments
  set processing_status = 'processing',
      processing_error = null,
      processed_at = null,
      processing_started_at = now()
  where id = p_attachment_id;

  return 'claimed';
end;
$$;

revoke execute on function public.claim_attachment_processing(uuid)
  from public, anon, authenticated;

-- A completed empty extraction is a valid terminal state: no text was found,
-- but no failure occurred. It must not remain shown as "processing" forever.
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
      processed_at = now(),
      processing_started_at = null
  where id = p_attachment_id
    and processing_status = 'processing'
    and (
      p_chunk_count = 0
      or exists (
        select 1 from public.attachment_chunks
        where attachment_id = p_attachment_id
      )
    );
end;
$$;

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
  delete from public.attachment_chunks
  where attachment_id = p_attachment_id
    and exists (
      select 1 from public.message_attachments
      where id = p_attachment_id and processing_status = 'processing'
    );

  update public.message_attachments
  set processing_status = 'failed',
      processing_error = left(coalesce(p_reason, 'processing_failed'), 500),
      processed_at = null,
      processing_started_at = null
  where id = p_attachment_id
    and processing_status = 'processing';
end;
$$;

/**
 * Retrieve conversation-scoped chunks with genuine reciprocal-rank fusion.
 * The original implementation collected vector and FTS rows independently,
 * which could duplicate chunks and never marked a result as hybrid. This
 * version joins the two ranked legs by chunk id before ordering the result.
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
#variable_conflict use_column
declare
  v_limit int;
  v_has_embeddings boolean;
  v_strict_tsquery tsquery;
  v_loose_tsquery tsquery;
  v_fts_tsquery tsquery;
begin
  if not exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) then return; end if;

  if p_query is null or btrim(p_query) = '' then return; end if;
  v_limit := greatest(1, least(coalesce(p_limit, 10), 50));

  -- Build strict websearch tsquery and conversational fallback OR tsquery
  v_strict_tsquery := websearch_to_tsquery('english', p_query);
  begin
    if plainto_tsquery('english', p_query)::text != '' then
      v_loose_tsquery := to_tsquery('english', replace(plainto_tsquery('english', p_query)::text, ' & ', ' | '));
    else
      v_loose_tsquery := v_strict_tsquery;
    end if;
  exception when others then
    v_loose_tsquery := v_strict_tsquery;
  end;

  if v_strict_tsquery is not null and exists (
    select 1
    from public.attachment_chunks ac
    join public.message_attachments ma on ma.id = ac.attachment_id
    join public.messages m on m.id = ma.message_id
    where m.conversation_id = p_conversation_id
      and ac.content_tsv @@ v_strict_tsquery
  ) then
    v_fts_tsquery := v_strict_tsquery;
  else
    v_fts_tsquery := coalesce(v_loose_tsquery, v_strict_tsquery);
  end if;

  select exists (
    select 1
    from public.attachment_chunks ac
    join public.message_attachments ma on ma.id = ac.attachment_id
    join public.messages m on m.id = ma.message_id
    where m.conversation_id = p_conversation_id and ac.embedding is not null
  ) into v_has_embeddings;

  return query
  with vector_hits as (
    select ac.id as chunk_id, ac.attachment_id, ac.chunk_index, ac.page_number,
      ac.content, ac.label, 1 - (ac.embedding <=> p_query_embedding) as raw_similarity,
      regexp_replace(ma.storage_path, '^.*/', '') as filename, ma.mime_type,
      row_number() over (order by ac.embedding <=> p_query_embedding)::int as vec_rank
    from public.attachment_chunks ac
    join public.message_attachments ma on ma.id = ac.attachment_id
    join public.messages m on m.id = ma.message_id
    where v_has_embeddings and p_query_embedding is not null
      and m.conversation_id = p_conversation_id and ac.embedding is not null
    order by ac.embedding <=> p_query_embedding
    limit v_limit
  ), fts_hits as (
    select ac.id as chunk_id, ac.attachment_id, ac.chunk_index, ac.page_number,
      ac.content, ac.label,
      ts_rank(ac.content_tsv, v_fts_tsquery) as raw_similarity,
      regexp_replace(ma.storage_path, '^.*/', '') as filename, ma.mime_type,
      row_number() over (
        order by ts_rank(ac.content_tsv, v_fts_tsquery) desc
      )::int as fts_rank
    from public.attachment_chunks ac
    join public.message_attachments ma on ma.id = ac.attachment_id
    join public.messages m on m.id = ma.message_id
    where m.conversation_id = p_conversation_id
      and v_fts_tsquery is not null
      and ac.content_tsv @@ v_fts_tsquery
    order by ts_rank(ac.content_tsv, v_fts_tsquery) desc
    limit v_limit
  ), fused as (
    select
      coalesce(v.chunk_id, f.chunk_id) as chunk_id,
      coalesce(v.attachment_id, f.attachment_id) as attachment_id,
      coalesce(v.chunk_index, f.chunk_index) as chunk_index,
      coalesce(v.page_number, f.page_number) as page_number,
      coalesce(v.content, f.content) as content,
      coalesce(v.label, f.label) as label,
      coalesce(v.filename, f.filename) as filename,
      coalesce(v.mime_type, f.mime_type) as mime_type,
      v.vec_rank, f.fts_rank,
      coalesce(v.raw_similarity, f.raw_similarity)::float as raw_similarity
    from vector_hits v full outer join fts_hits f using (chunk_id)
  )
  select fused.chunk_id, fused.attachment_id, fused.chunk_index, fused.page_number, fused.content, fused.label,
    (
      case when fused.vec_rank is not null then 1.0 / (60 + fused.vec_rank) else 0 end +
      case when fused.fts_rank is not null then 1.0 / (60 + fused.fts_rank) else 0 end
    )::float as similarity,
    case
      when fused.vec_rank is not null and fused.fts_rank is not null then 'hybrid'
      when fused.vec_rank is not null then 'vector'
      else 'fts'
    end as retrieval_method,
    fused.filename, fused.mime_type
  from fused
  order by similarity desc, fused.chunk_id
  limit v_limit;
end;
$$;

-- Keep this public helper accurate if a client uses it for attachment lists.
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
  select ma.id, regexp_replace(ma.storage_path, '^.*/', ''), ma.mime_type,
    count(ac.id)::int
  from public.message_attachments ma
  join public.messages m on m.id = ma.message_id
  left join public.attachment_chunks ac on ac.attachment_id = ma.id
  where m.conversation_id = p_conversation_id
    and public.is_conversation_member(m.conversation_id, auth.uid())
  group by ma.id, ma.storage_path, ma.mime_type
  order by ma.created_at desc;
$$;

-- =====================================================================
-- END OF MIGRATION
-- =====================================================================
