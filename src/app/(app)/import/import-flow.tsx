'use client';

import { useRef, useState, useTransition } from 'react';
import { checkUpload, formatBytes, MAX_UPLOAD_BYTES } from '@/lib/file-checks';
import { AlertIcon, FileIcon, InfoIcon, UploadIcon } from '@/components/icons';
import { previewImport, type ImportPreview } from './preview-action';
import { saveImport } from '../templates/actions';

type Stage = 'choose' | 'preview';

export function ImportFlow() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [name, setName] = useState('');
  const [stage, setStage] = useState<Stage>('choose');
  const [pending, startTransition] = useTransition();

  function accept(candidate: File | undefined) {
    if (!candidate) return;
    const result = checkUpload(candidate);
    if (!result.ok) {
      setFile(null);
      setError(result.reason);
      return;
    }
    setError(null);
    setFile(candidate);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setError(null);
    setStage('choose');
    if (inputRef.current) inputRef.current.value = '';
  }

  function runPreview() {
    if (!file) return;
    startTransition(async () => {
      const data = new FormData();
      data.set('file', file);
      const result = await previewImport(null, data);
      if (!result) return;
      if (!result.ok) {
        setError(result.error);
        setPreview(null);
        return;
      }
      setError(null);
      setPreview(result);
      setName(result.suggestedName);
      setStage('preview');
    });
  }

  function save() {
    if (!file || !name.trim()) return;
    startTransition(async () => {
      const data = new FormData();
      data.set('file', file);
      data.set('name', name);
      const result = await saveImport({ error: null }, data);
      // A successful save redirects; only a failure comes back.
      if (result?.error) setError(result.error);
    });
  }

  if (stage === 'preview' && preview) {
    return (
      <PreviewScreen
        preview={preview}
        name={name}
        onName={setName}
        onDiscard={reset}
        onSave={save}
        pending={pending}
        error={error}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <div className="flex-grow min-w-0 flex flex-col gap-3.5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            accept(e.dataTransfer.files[0]);
          }}
          className={`flex flex-col items-center justify-center gap-3.5 rounded-[10px] border-[1.5px] border-dashed bg-surface px-6 py-12 text-center ${
            dragging ? 'border-primary bg-primary-soft' : 'border-control'
          }`}
        >
          <UploadIcon className="size-7 text-primary" />
          <div className="flex flex-col gap-1.5">
            <p className="text-[15px] font-medium">Drop your Spectora export here</p>
            <p className="text-[13px] text-muted">
              A single{' '}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">.xls</code> or{' '}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">.xlsx</code>{' '}
              file, up to {formatBytes(MAX_UPLOAD_BYTES)}
            </p>
          </div>
          <label
            htmlFor="template-file"
            className="flex h-[38px] cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-ink"
          >
            Choose file
          </label>
          <input
            ref={inputRef}
            id="template-file"
            name="template-file"
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => accept(e.target.files?.[0])}
            className="sr-only"
          />
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        {file ? (
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 sm:flex-row sm:items-center">
            <FileIcon className="size-[18px] shrink-0 text-muted" />
            <div className="flex-grow min-w-0 flex flex-col gap-0.5">
              <span className="truncate font-mono text-[13.5px] font-medium">{file.name}</span>
              <span className="text-xs text-muted">
                {formatBytes(file.size)} · selected, not yet parsed
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={reset}
                className="h-[34px] rounded-md border border-control bg-surface px-3 text-[13px]"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={runPreview}
                disabled={pending}
                className="h-[34px] rounded-md bg-primary px-4 text-[13.5px] font-semibold text-primary-ink disabled:opacity-50"
              >
                {pending ? 'Parsing…' : 'Parse and preview'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="w-full shrink-0 rounded-[10px] border border-line bg-surface p-4.5 lg:w-[340px]">
        <h2 className="text-sm font-semibold">Getting the export from Spectora</h2>
        <ol className="mt-3.5 flex list-decimal flex-col gap-2.5 pl-4.5 text-[12.5px] leading-relaxed text-body">
          <li>Open the template in Spectora.</li>
          <li>
            Choose <strong className="font-semibold">Export to spreadsheet</strong>.
          </li>
          <li>
            Choose <strong className="font-semibold">Export HTML Text</strong>, not the plain
            spreadsheet.
          </li>
          <li>
            Upload the downloaded spreadsheet here. Spectora names it{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px]">.xls</code>
            , though the file is really XLSX.
          </li>
        </ol>
        <div className="mt-3.5 flex gap-2.5 rounded-md border border-warn-line bg-warn-bg p-3">
          <AlertIcon className="size-[15px] shrink-0 mt-0.5 text-warn-ink" />
          <p className="text-xs leading-relaxed text-warn-ink">
            &ldquo;HTML Text&rdquo; means HTML inside the comment cells of a spreadsheet, not an
            HTML document. The format is checked by reading the file, not by trusting its name.
          </p>
        </div>
      </aside>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-danger-line bg-danger-bg px-4 py-3 text-[13px] leading-relaxed text-danger-ink"
    >
      <AlertIcon className="size-4 shrink-0 mt-0.5" />
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------

type PreviewScreenProps = {
  preview: ImportPreview;
  name: string;
  onName: (value: string) => void;
  onDiscard: () => void;
  onSave: () => void;
  pending: boolean;
  error: string | null;
};

function PreviewScreen({
  preview,
  name,
  onName,
  onDiscard,
  onSave,
  pending,
  error,
}: PreviewScreenProps) {
  const notImported = preview.issues.filter((i) => i.kind !== 'notice').length;
  const notices = preview.issues.filter((i) => i.kind === 'notice');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface p-4 lg:flex-row lg:items-end">
        <div className="flex-grow min-w-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[14px] font-semibold">{preview.filename}</span>
            <span className="inline-flex h-5 items-center rounded-full bg-ok-bg px-2 text-[11px] font-medium text-ok-ink">
              XLSX confirmed by content, not by name
            </span>
          </div>
          <p className="text-xs text-muted">
            {formatBytes(preview.byteSize)} · {preview.stats.sheetName}, {preview.stats.rowCount}{' '}
            rows × {preview.stats.columnCount} columns · parsed in {preview.stats.durationMs} ms ·
            sha256 {preview.sha256.slice(0, 8)}… ·{' '}
            <strong className="font-semibold text-warn-ink">nothing saved yet</strong>
          </p>
          <div className="flex flex-col gap-1.5 pt-1">
            <label htmlFor="template-name" className="text-[13px] font-medium">
              Template name
            </label>
            <input
              id="template-name"
              value={name}
              onChange={(e) => onName(e.target.value)}
              className="h-10 max-w-[420px] rounded-md border border-control bg-surface px-3 text-sm"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onDiscard}
            className="h-[38px] rounded-md border border-control bg-surface px-4 text-sm"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !name.trim()}
            className="h-[38px] rounded-md bg-primary px-4 text-sm font-semibold text-primary-ink disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save to library'}
          </button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-5">
        <Stat label="Sections" value={preview.stats.sectionCount} />
        <Stat label="Items" value={preview.stats.itemCount} />
        <Stat label="Comments" value={preview.stats.commentCount} />
        <Stat label="Not imported" value={notImported} tone="warn" />
        <Stat label="Notices" value={notices.length} />
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
        <SourceRows rows={preview.rows} sheet={preview.stats.sheetName} />
        <ParsedTree sections={preview.sections} />
      </div>

      <IssueTable issues={preview.issues} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'warn';
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface px-4 py-3">
      <span
        className={`text-[11px] font-semibold uppercase tracking-wide ${tone === 'warn' ? 'text-warn-ink' : 'text-muted'}`}
      >
        {label}
      </span>
      <span
        className={`text-[22px] font-semibold tabular-nums ${tone === 'warn' && value > 0 ? 'text-warn-ink' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

function SourceRows({ rows, sheet }: { rows: ImportPreview['rows']; sheet: string }) {
  const shown = rows.slice(0, 60);
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line bg-surface-2 px-3.5 py-2.5">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Source</span>
        <span className="text-xs text-muted">
          {sheet} · rows {shown[0]?.sourceRow}–{shown.at(-1)?.sourceRow} of {rows.length}
        </span>
      </header>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-line-soft text-[10px] uppercase tracking-wide text-muted">
              <th className="px-3 py-2 text-right font-semibold">Row</th>
              <th className="px-2 py-2 font-semibold">Section</th>
              <th className="px-2 py-2 font-semibold">Item</th>
              <th className="px-2 py-2 font-semibold">Type</th>
              <th className="px-2 py-2 font-semibold">Comment</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.sourceRow} className="border-b border-line-soft/60 align-top">
                <td className="px-3 py-1.5 text-right font-mono text-[11px] text-faint">
                  {row.sourceRow}
                </td>
                <td className="max-w-[110px] truncate px-2 py-1.5 text-[11.5px] text-body">
                  {row.section}
                </td>
                <td className="max-w-[130px] truncate px-2 py-1.5 text-[11.5px] text-body">
                  {row.item}
                </td>
                <td className="px-2 py-1.5 text-[10.5px]">
                  <TypeBadge type={row.commentType} />
                </td>
                <td className="max-w-[260px] truncate px-2 py-1.5 font-mono text-[11px] text-body">
                  {row.isQuestion
                    ? `${row.commentName} · ${row.optionCount} options`
                    : (row.textHtml || row.commentName)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length ? (
        <footer className="border-t border-line-soft px-3.5 py-2 text-xs text-muted">
          Showing the first {shown.length}. All {rows.length} are imported.
        </footer>
      ) : null}
    </section>
  );
}

function ParsedTree({ sections }: { sections: ImportPreview['sections'] }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line bg-surface-2 px-3.5 py-2.5">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
          Parsed tree
        </span>
        <span className="text-xs text-muted">what will be written</span>
      </header>
      <div className="max-h-[420px] overflow-auto py-1.5">
        {sections.map((section) => (
          <details key={section.name} open={section === sections[0]} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-1.5 text-[13.5px] font-semibold marker:hidden">
              <span className="text-muted group-open:rotate-90">›</span>
              {section.name}
              <span className="text-[11.5px] font-normal text-muted">
                {section.items.length} items · {section.commentCount} comments
              </span>
              {section.issueCount > 0 ? (
                <span className="text-[11.5px] font-medium text-warn-ink">
                  {section.issueCount} issues
                </span>
              ) : null}
            </summary>
            {section.items.map((item) => (
              <div key={item.name} className="pl-7">
                <div className="py-1 text-[13px] font-medium">
                  {item.name}
                  <span className="ml-2 text-[11.5px] font-normal text-muted">
                    {item.comments.length}
                  </span>
                </div>
                {item.comments.slice(0, 4).map((comment) => (
                  <div key={comment.sourceRow} className="py-0.5 pl-3 pr-3.5">
                    <CommentPreview comment={comment} />
                  </div>
                ))}
                {item.comments.length > 4 ? (
                  <p className="py-0.5 pl-3 text-[11.5px] text-muted">
                    +{item.comments.length - 4} more
                  </p>
                ) : null}
              </div>
            ))}
          </details>
        ))}
      </div>
    </section>
  );
}

function CommentPreview({
  comment,
}: {
  comment: ImportPreview['sections'][number]['items'][number]['comments'][number];
}) {
  const units = comment.options.filter((o) => o.kind === 'unit');
  const choices = comment.options.filter((o) => o.kind === 'choice');

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] text-faint">r{comment.sourceRow}</span>
        <span className="text-[12px] font-medium">{comment.name}</span>
        <TypeBadge type={comment.commentType} />
        {comment.answerType === 'number' ? (
          <span className="text-[10.5px] text-muted">
            number{units.length ? ` · ${units.map((u) => u.label).join(', ')}` : ' · no units'}
          </span>
        ) : null}
      </div>
      {comment.isQuestion ? (
        <p className="text-[11.5px] text-muted">
          question · {choices.map((c) => c.label).join(', ')}
        </p>
      ) : comment.textHtml ? (
        <div
          className="line-clamp-2 text-[12px] leading-relaxed text-body [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: comment.textHtml }}
        />
      ) : (
        <p className="text-[11.5px] italic text-warn-ink">no comment text in the export</p>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: 'info' | 'limit' | 'defect' }) {
  const tone =
    type === 'defect'
      ? 'bg-danger-bg text-danger-ink'
      : type === 'limit'
        ? 'bg-warn-bg text-warn-ink'
        : 'bg-surface-2 text-muted';
  return (
    <span className={`inline-flex h-[17px] items-center rounded px-1.5 text-[10px] ${tone}`}>
      {type}
    </span>
  );
}

function IssueTable({ issues }: { issues: ImportPreview['issues'] }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-[10px] border border-ok-line bg-ok-bg px-4 py-3">
        <InfoIcon className="size-4 shrink-0 text-ok-ink" />
        <p className="text-[13px] text-ok-ink">
          Everything in the export was imported. No issues to report.
        </p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[10px] border border-warn-line bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-warn-line bg-warn-bg px-4 py-2.5">
        <AlertIcon className="size-4 text-warn-ink" />
        <span className="text-[13px] font-semibold text-warn-ink">
          Not imported ({issues.length})
        </span>
        <span className="text-xs text-warn-ink">
          each keeps its raw value, so nothing is lost silently
        </span>
      </header>
      <div className="max-h-[300px] overflow-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-line-soft text-[10px] uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-semibold">Kind</th>
              <th className="px-3 py-2 font-semibold">Location</th>
              <th className="px-3 py-2 font-semibold">Raw value</th>
              <th className="px-3 py-2 font-semibold">What it means</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, i) => (
              <tr key={i} className="border-b border-line-soft/60 align-top">
                <td className="px-3 py-2">
                  <IssueBadge kind={issue.kind} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-muted">
                  {issue.sourceRow ? `row ${issue.sourceRow}` : 'template'}
                  {issue.sourceColumn ? ` · ${issue.sourceColumn}` : ''}
                </td>
                <td className="max-w-[280px] truncate px-3 py-2 font-mono text-[11px] text-body">
                  {issue.rawSnippet ?? '—'}
                </td>
                <td className="px-3 py-2 text-[12px] leading-relaxed text-body">{issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function IssueBadge({ kind }: { kind: 'unsupported' | 'empty_in_source' | 'notice' }) {
  const label =
    kind === 'unsupported' ? 'unsupported' : kind === 'empty_in_source' ? 'empty in source' : 'notice';
  const tone =
    kind === 'unsupported'
      ? 'bg-warn-bg text-warn-ink'
      : kind === 'empty_in_source'
        ? 'bg-surface-2 text-body'
        : 'bg-primary-soft text-primary';
  return (
    <span className={`inline-flex h-5 items-center whitespace-nowrap rounded-full px-2 text-[10.5px] font-medium ${tone}`}>
      {label}
    </span>
  );
}
