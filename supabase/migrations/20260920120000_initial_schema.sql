-- Template Importer schema.
--
-- Shaped from the Phase 1 inventory of the Spectora "Export HTML Text"
-- spreadsheet, not from a guess at what an inspection template looks like.
-- Every comment keeps the spreadsheet row it came from, so any row in this
-- database can be traced back to a cell in the source file.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- templates
-- ---------------------------------------------------------------------------
create table public.templates (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  -- Editable, and defaulted at import to a cleaned filename, never the raw one.
  name            text not null check (length(trim(name)) > 0),
  -- Set when this template came from "Make a copy".
  copied_from_id  uuid references public.templates (id) on delete set null,
  -- Exactly one sample per owner; "Reset sample" may replace only this.
  is_sample       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index templates_one_sample_per_owner
  on public.templates (owner_id)
  where is_sample;

create index templates_owner_idx on public.templates (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- sections -> items -> comments
--
-- Order is row order from the spreadsheet, rewritten as a dense position.
-- Item identity is (section, item name, first row): "General" repeats across
-- eight sections, so the name alone is not an identity.
-- ---------------------------------------------------------------------------
create table public.sections (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.templates (id) on delete cascade,
  name         text not null,
  position     integer not null,
  -- First spreadsheet row this section appeared on.
  source_row   integer,
  unique (template_id, position) deferrable initially deferred
);

create index sections_template_idx on public.sections (template_id, position);

create table public.items (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references public.sections (id) on delete cascade,
  name        text not null,
  position    integer not null,
  source_row  integer,
  unique (section_id, position) deferrable initially deferred
);

create index items_section_idx on public.items (section_id, position);

create type public.comment_type as enum ('info', 'limit', 'defect');

-- -1 / 0 / 1 in the export. Present only on defect rows; info and limit rows
-- carry no category, which is semantics, not missing data.
create type public.comment_category as enum ('low', 'med', 'high');

create table public.comments (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.items (id) on delete cascade,
  -- "Comment Name" in the export. Kept verbatim, trailing spaces included.
  name            text not null,
  -- "Comment Text": HTML, sanitized on import against the allowlist.
  text_html       text not null default '',
  position        integer not null,

  comment_type    public.comment_type not null,
  category        public.comment_category,
  -- boolean | checkbox | number | text (date and range exist in the header but
  -- have no rows in this export).
  answer_type     text not null,
  -- True for checkbox rows, which are questions with options rather than prose
  -- comments. Their empty comment text is correct data, not a defect.
  is_question     boolean not null default false,
  recommendation  text,
  default_value   text,
  estimate_min    numeric,
  estimate_max    numeric,

  -- Audit trail back to the spreadsheet.
  source_row      integer not null,
  -- Column J "Order (w/i item)". Stored for the audit trail only: 38 of 69
  -- items carry duplicate values, so it is never used for sorting.
  source_order    integer,

  unique (item_id, position) deferrable initially deferred
);

create index comments_item_idx on public.comments (item_id, position);

-- Multiple-choice options and unit options share a table: both are ordered
-- lists of labels hanging off a comment, and order is part of the data.
create type public.option_kind as enum ('choice', 'unit');

create table public.comment_options (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.comments (id) on delete cascade,
  kind        public.option_kind not null,
  label       text not null,
  position    integer not null,
  unique (comment_id, kind, position) deferrable initially deferred
);

create index comment_options_comment_idx
  on public.comment_options (comment_id, kind, position);

-- ---------------------------------------------------------------------------
-- import runs and issues
-- ---------------------------------------------------------------------------
create table public.import_runs (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid references public.templates (id) on delete cascade,
  owner_id      uuid not null references auth.users (id) on delete cascade,
  filename      text not null,
  byte_size     integer not null,
  sha256        text not null,
  sheet_name    text,
  row_count     integer,
  column_count  integer,
  parser_version text not null,
  duration_ms   integer,
  -- The original file, kept so a report can be re-checked against its source.
  raw_source    bytea,
  created_at    timestamptz not null default now()
);

create index import_runs_template_idx on public.import_runs (template_id);
create index import_runs_owner_idx on public.import_runs (owner_id, created_at desc);

-- unsupported     : the export holds something we cannot represent
-- empty_in_source : the export itself carries nothing there
-- These are kept apart on purpose; they are different failures.
create type public.issue_kind as enum ('unsupported', 'empty_in_source', 'notice');

create table public.import_issues (
  id            uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.import_runs (id) on delete cascade,
  kind          public.issue_kind not null,
  -- Null for template-level issues, e.g. "every row shares one estimate range".
  source_row    integer,
  source_column text,
  -- Human-readable path, e.g. "Roof > Coverings".
  location_path text,
  message       text not null,
  raw_snippet   text,
  created_at    timestamptz not null default now()
);

create index import_issues_run_idx on public.import_issues (import_run_id, source_row);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger templates_touch_updated_at
  before update on public.templates
  for each row execute function public.touch_updated_at();
