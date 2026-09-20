import { createClient } from '@/lib/supabase/server';

export type TemplateSummary = {
  id: string;
  name: string;
  isSample: boolean;
  copiedFromId: string | null;
  copiedFromName: string | null;
  sectionCount: number;
  itemCount: number;
  commentCount: number;
  issueCount: number;
  importRunId: string | null;
  sourceFilename: string | null;
  createdAt: string;
};

export type CommentRow = {
  id: string;
  name: string;
  textHtml: string;
  position: number;
  commentType: 'info' | 'limit' | 'defect';
  category: 'low' | 'med' | 'high' | null;
  answerType: string;
  isQuestion: boolean;
  recommendation: string | null;
  estimateMin: number | null;
  estimateMax: number | null;
  sourceRow: number;
  options: { kind: 'choice' | 'unit'; label: string; position: number }[];
};

export type ItemRow = { id: string; name: string; position: number; comments: CommentRow[] };
export type SectionRow = { id: string; name: string; position: number; items: ItemRow[] };

export type TemplateDetail = {
  id: string;
  name: string;
  isSample: boolean;
  copiedFromName: string | null;
  sections: SectionRow[];
  issueCount: number;
  importRunId: string | null;
};

/** The list screen: one row per template, with the counts it shows. */
export async function listTemplates(): Promise<TemplateSummary[]> {
  const supabase = await createClient();

  const { data: templates, error } = await supabase
    .from('templates')
    .select('id, name, is_sample, copied_from_id, created_at')
    .order('is_sample', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!templates || templates.length === 0) return [];

  const ids = templates.map((t) => t.id);

  // Counts are gathered in three flat queries rather than per template.
  const { data: sections } = await supabase
    .from('sections')
    .select('id, template_id')
    .in('template_id', ids);

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: items } = sectionIds.length
    ? await supabase.from('items').select('id, section_id').in('section_id', sectionIds)
    : { data: [] as { id: string; section_id: string }[] };

  const itemIds = (items ?? []).map((i) => i.id);
  const { data: comments } = itemIds.length
    ? await supabase.from('comments').select('id, item_id').in('item_id', itemIds)
    : { data: [] as { id: string; item_id: string }[] };

  const { data: runs } = await supabase
    .from('import_runs')
    .select('id, template_id, filename')
    .in('template_id', ids);

  const runIds = (runs ?? []).map((r) => r.id);
  const { data: issues } = runIds.length
    ? await supabase.from('import_issues').select('id, import_run_id').in('import_run_id', runIds)
    : { data: [] as { id: string; import_run_id: string }[] };

  const sectionToTemplate = new Map((sections ?? []).map((s) => [s.id, s.template_id]));
  const itemToTemplate = new Map(
    (items ?? []).map((i) => [i.id, sectionToTemplate.get(i.section_id)!]),
  );

  const count = <T>(rows: T[], key: (row: T) => string | undefined) => {
    const out = new Map<string, number>();
    for (const row of rows) {
      const id = key(row);
      if (id) out.set(id, (out.get(id) ?? 0) + 1);
    }
    return out;
  };

  const sectionCounts = count(sections ?? [], (s) => s.template_id);
  const itemCounts = count(items ?? [], (i) => sectionToTemplate.get(i.section_id));
  const commentCounts = count(comments ?? [], (c) => itemToTemplate.get(c.item_id));

  const runByTemplate = new Map((runs ?? []).map((r) => [r.template_id, r]));
  const issueCounts = count(issues ?? [], (i) => {
    const run = (runs ?? []).find((r) => r.id === i.import_run_id);
    return run?.template_id ?? undefined;
  });

  const nameById = new Map(templates.map((t) => [t.id, t.name]));

  return templates.map((t) => {
    const run = runByTemplate.get(t.id);
    return {
      id: t.id,
      name: t.name,
      isSample: t.is_sample,
      copiedFromId: t.copied_from_id,
      copiedFromName: t.copied_from_id ? (nameById.get(t.copied_from_id) ?? null) : null,
      sectionCount: sectionCounts.get(t.id) ?? 0,
      itemCount: itemCounts.get(t.id) ?? 0,
      commentCount: commentCounts.get(t.id) ?? 0,
      issueCount: issueCounts.get(t.id) ?? 0,
      importRunId: run?.id ?? null,
      sourceFilename: run?.filename ?? null,
      createdAt: t.created_at,
    };
  });
}

/** The editor: the whole tree for one template, in order. */
export async function getTemplate(templateId: string): Promise<TemplateDetail | null> {
  const supabase = await createClient();

  const { data: template } = await supabase
    .from('templates')
    .select('id, name, is_sample, copied_from_id')
    .eq('id', templateId)
    .maybeSingle();

  if (!template) return null;

  let copiedFromName: string | null = null;
  if (template.copied_from_id) {
    const { data } = await supabase
      .from('templates')
      .select('name')
      .eq('id', template.copied_from_id)
      .maybeSingle();
    copiedFromName = data?.name ?? null;
  }

  const { data: sections } = await supabase
    .from('sections')
    .select('id, name, position')
    .eq('template_id', templateId)
    .order('position');

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: items } = sectionIds.length
    ? await supabase
        .from('items')
        .select('id, name, position, section_id')
        .in('section_id', sectionIds)
        .order('position')
    : { data: [] as never[] };

  const itemIds = (items ?? []).map((i) => i.id);
  const { data: comments } = itemIds.length
    ? await supabase
        .from('comments')
        .select(
          'id, name, text_html, position, comment_type, category, answer_type, is_question, recommendation, estimate_min, estimate_max, source_row, item_id',
        )
        .in('item_id', itemIds)
        .order('position')
    : { data: [] as never[] };

  const commentIds = (comments ?? []).map((c) => c.id);
  const { data: options } = commentIds.length
    ? await supabase
        .from('comment_options')
        .select('comment_id, kind, label, position')
        .in('comment_id', commentIds)
        .order('position')
    : { data: [] as never[] };

  const optionsByComment = new Map<string, CommentRow['options']>();
  for (const o of options ?? []) {
    const list = optionsByComment.get(o.comment_id) ?? [];
    list.push({ kind: o.kind, label: o.label, position: o.position });
    optionsByComment.set(o.comment_id, list);
  }

  const commentsByItem = new Map<string, CommentRow[]>();
  for (const c of comments ?? []) {
    const list = commentsByItem.get(c.item_id) ?? [];
    list.push({
      id: c.id,
      name: c.name,
      textHtml: c.text_html,
      position: c.position,
      commentType: c.comment_type,
      category: c.category,
      answerType: c.answer_type,
      isQuestion: c.is_question,
      recommendation: c.recommendation,
      estimateMin: c.estimate_min,
      estimateMax: c.estimate_max,
      sourceRow: c.source_row,
      options: optionsByComment.get(c.id) ?? [],
    });
    commentsByItem.set(c.item_id, list);
  }

  const itemsBySection = new Map<string, ItemRow[]>();
  for (const i of items ?? []) {
    const list = itemsBySection.get(i.section_id) ?? [];
    list.push({
      id: i.id,
      name: i.name,
      position: i.position,
      comments: commentsByItem.get(i.id) ?? [],
    });
    itemsBySection.set(i.section_id, list);
  }

  const { data: run } = await supabase
    .from('import_runs')
    .select('id')
    .eq('template_id', templateId)
    .maybeSingle();

  let issueCount = 0;
  if (run) {
    const { count } = await supabase
      .from('import_issues')
      .select('*', { count: 'exact', head: true })
      .eq('import_run_id', run.id);
    issueCount = count ?? 0;
  }

  return {
    id: template.id,
    name: template.name,
    isSample: template.is_sample,
    copiedFromName,
    issueCount,
    importRunId: run?.id ?? null,
    sections: (sections ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      position: s.position,
      items: itemsBySection.get(s.id) ?? [],
    })),
  };
}

export type ImportRunDetail = {
  id: string;
  templateId: string | null;
  templateName: string | null;
  filename: string;
  byteSize: number;
  sha256: string;
  sheetName: string | null;
  rowCount: number | null;
  columnCount: number | null;
  parserVersion: string;
  durationMs: number | null;
  createdAt: string;
  issues: {
    id: string;
    kind: 'unsupported' | 'empty_in_source' | 'notice';
    sourceRow: number | null;
    sourceColumn: string | null;
    locationPath: string | null;
    message: string;
    rawSnippet: string | null;
  }[];
  perSection: { name: string; position: number; items: number; comments: number; issues: number }[];
};

export async function getImportRun(templateId: string): Promise<ImportRunDetail | null> {
  const supabase = await createClient();

  const { data: run } = await supabase
    .from('import_runs')
    .select('*')
    .eq('template_id', templateId)
    .maybeSingle();

  if (!run) return null;

  const { data: issues } = await supabase
    .from('import_issues')
    .select('id, kind, source_row, source_column, location_path, message, raw_snippet')
    .eq('import_run_id', run.id)
    .order('source_row', { nullsFirst: true });

  const template = await getTemplate(templateId);

  // An issue belongs to a section when its row falls inside that section's rows.
  const perSection = (template?.sections ?? []).map((s) => {
    const rows = s.items.flatMap((i) => i.comments.map((c) => c.sourceRow));
    const lo = Math.min(...rows);
    const hi = Math.max(...rows);
    return {
      name: s.name,
      position: s.position,
      items: s.items.length,
      comments: s.items.reduce((n, i) => n + i.comments.length, 0),
      issues: (issues ?? []).filter(
        (i) => i.source_row !== null && i.source_row >= lo && i.source_row <= hi,
      ).length,
    };
  });

  return {
    id: run.id,
    templateId: run.template_id,
    templateName: template?.name ?? null,
    filename: run.filename,
    byteSize: run.byte_size,
    sha256: run.sha256,
    sheetName: run.sheet_name,
    rowCount: run.row_count,
    columnCount: run.column_count,
    parserVersion: run.parser_version,
    durationMs: run.duration_ms,
    createdAt: run.created_at,
    issues: (issues ?? []).map((i) => ({
      id: i.id,
      kind: i.kind,
      sourceRow: i.source_row,
      sourceColumn: i.source_column,
      locationPath: i.location_path,
      message: i.message,
      rawSnippet: i.raw_snippet,
    })),
    perSection,
  };
}
