-- Deep copy of a template, in one transaction.
--
-- A function body is a single transaction: if any row fails, nothing is
-- written. The copy is fully independent — editing it never touches the
-- original — and records copied_from_id so its origin stays traceable.
--
-- Written as set-based inserts with id maps rather than row loops, so copying
-- 392 comments is four statements, not 392 round trips.

create or replace function public.copy_template(
  source_template_id uuid,
  new_name text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller_id  uuid := (select auth.uid());
  new_id     uuid;
  source_name text;
  target_name text;
begin
  if caller_id is null then
    raise exception 'copy_template requires an authenticated user';
  end if;

  -- RLS applies to this select (security invoker), so a template belonging to
  -- someone else is simply not visible and this raises.
  select name into source_name
  from public.templates
  where id = source_template_id;

  if source_name is null then
    raise exception 'template % not found', source_template_id
      using errcode = 'no_data_found';
  end if;

  target_name := coalesce(nullif(trim(new_name), ''), source_name || ' (copy)');

  -- A copy is never the sample: "Reset sample" must not be able to overwrite it.
  insert into public.templates (owner_id, name, copied_from_id, is_sample)
  values (caller_id, target_name, source_template_id, false)
  returning id into new_id;

  -- sections ---------------------------------------------------------------
  create temporary table _section_map (old_id uuid primary key, new_id uuid not null)
    on commit drop;

  with inserted as (
    insert into public.sections (template_id, name, position, source_row)
    select new_id, s.name, s.position, s.source_row
    from public.sections s
    where s.template_id = source_template_id
    order by s.position
    returning id, position
  )
  insert into _section_map (old_id, new_id)
  select s.id, i.id
  from inserted i
  join public.sections s
    on s.template_id = source_template_id and s.position = i.position;

  -- items ------------------------------------------------------------------
  create temporary table _item_map (old_id uuid primary key, new_id uuid not null)
    on commit drop;

  with source_items as (
    select i.id, i.section_id, i.name, i.position, i.source_row, m.new_id as new_section_id
    from public.items i
    join _section_map m on m.old_id = i.section_id
  ),
  inserted as (
    insert into public.items (section_id, name, position, source_row)
    select si.new_section_id, si.name, si.position, si.source_row
    from source_items si
    returning id, section_id, position
  )
  insert into _item_map (old_id, new_id)
  select si.id, ins.id
  from inserted ins
  join source_items si
    on si.new_section_id = ins.section_id and si.position = ins.position;

  -- comments ---------------------------------------------------------------
  create temporary table _comment_map (old_id uuid primary key, new_id uuid not null)
    on commit drop;

  with source_comments as (
    select c.*, m.new_id as new_item_id
    from public.comments c
    join _item_map m on m.old_id = c.item_id
  ),
  inserted as (
    insert into public.comments (
      item_id, name, text_html, position, comment_type, category, answer_type,
      is_question, recommendation, default_value, estimate_min, estimate_max,
      source_row, source_order
    )
    select
      sc.new_item_id, sc.name, sc.text_html, sc.position, sc.comment_type,
      sc.category, sc.answer_type, sc.is_question, sc.recommendation,
      sc.default_value, sc.estimate_min, sc.estimate_max, sc.source_row,
      sc.source_order
    from source_comments sc
    returning id, item_id, position
  )
  insert into _comment_map (old_id, new_id)
  select sc.id, ins.id
  from inserted ins
  join source_comments sc
    on sc.new_item_id = ins.item_id and sc.position = ins.position;

  -- options ----------------------------------------------------------------
  insert into public.comment_options (comment_id, kind, label, position)
  select m.new_id, o.kind, o.label, o.position
  from public.comment_options o
  join _comment_map m on m.old_id = o.comment_id;

  return new_id;
end;
$$;

comment on function public.copy_template(uuid, text) is
  'Deep-copies a template and everything under it in one transaction. The copy '
  'records copied_from_id, is never the sample, and is fully independent of the '
  'original.';
