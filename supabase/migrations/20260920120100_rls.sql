-- Row-level security: every row belongs to one owner, and nobody sees another
-- owner's rows. Child tables have no owner_id of their own, so they are scoped
-- by walking back to the template that owns them.

alter table public.templates       enable row level security;
alter table public.sections        enable row level security;
alter table public.items           enable row level security;
alter table public.comments        enable row level security;
alter table public.comment_options enable row level security;
alter table public.import_runs     enable row level security;
alter table public.import_issues   enable row level security;

-- ---------------------------------------------------------------------------
-- templates: owned directly
-- ---------------------------------------------------------------------------
create policy templates_select on public.templates
  for select using (owner_id = (select auth.uid()));

create policy templates_insert on public.templates
  for insert with check (owner_id = (select auth.uid()));

create policy templates_update on public.templates
  for update using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy templates_delete on public.templates
  for delete using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- sections
-- ---------------------------------------------------------------------------
create policy sections_all on public.sections
  for all
  using (
    exists (
      select 1 from public.templates t
      where t.id = sections.template_id and t.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.templates t
      where t.id = sections.template_id and t.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------
create policy items_all on public.items
  for all
  using (
    exists (
      select 1
      from public.sections s
      join public.templates t on t.id = s.template_id
      where s.id = items.section_id and t.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.sections s
      join public.templates t on t.id = s.template_id
      where s.id = items.section_id and t.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
create policy comments_all on public.comments
  for all
  using (
    exists (
      select 1
      from public.items i
      join public.sections s on s.id = i.section_id
      join public.templates t on t.id = s.template_id
      where i.id = comments.item_id and t.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.items i
      join public.sections s on s.id = i.section_id
      join public.templates t on t.id = s.template_id
      where i.id = comments.item_id and t.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- comment_options
-- ---------------------------------------------------------------------------
create policy comment_options_all on public.comment_options
  for all
  using (
    exists (
      select 1
      from public.comments c
      join public.items i on i.id = c.item_id
      join public.sections s on s.id = i.section_id
      join public.templates t on t.id = s.template_id
      where c.id = comment_options.comment_id and t.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.comments c
      join public.items i on i.id = c.item_id
      join public.sections s on s.id = i.section_id
      join public.templates t on t.id = s.template_id
      where c.id = comment_options.comment_id and t.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- import_runs / import_issues: runs carry their own owner_id, because a run
-- outlives a failed import that never produced a template.
-- ---------------------------------------------------------------------------
create policy import_runs_all on public.import_runs
  for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy import_issues_all on public.import_issues
  for all
  using (
    exists (
      select 1 from public.import_runs r
      where r.id = import_issues.import_run_id and r.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.import_runs r
      where r.id = import_issues.import_run_id and r.owner_id = (select auth.uid())
    )
  );
