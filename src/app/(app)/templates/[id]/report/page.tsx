import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getImportRun } from '@/lib/db/queries';
import { AlertIcon, InfoIcon } from '@/components/icons';
import { IssueBadge } from '../../../import/import-flow';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Import report · Template Importer' };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; reset?: string }>;
}) {
  const { id } = await params;
  const { saved, reset } = await searchParams;
  const run = await getImportRun(id);
  if (!run) notFound();

  const unsupported = run.issues.filter((i) => i.kind === 'unsupported').length;
  const empty = run.issues.filter((i) => i.kind === 'empty_in_source').length;
  const notices = run.issues.filter((i) => i.kind === 'notice');

  const totals = run.perSection.reduce(
    (acc, s) => ({ items: acc.items + s.items, comments: acc.comments + s.comments }),
    { items: 0, comments: 0 },
  );

  return (
    <div className="flex max-w-[1200px] flex-col gap-5">
      {saved || reset ? (
        <p className="flex items-center gap-2.5 rounded-lg border border-ok-line bg-ok-bg px-4 py-3 text-[13px] text-ok-ink">
          <InfoIcon className="size-4 shrink-0" />
          {reset
            ? 'Sample reset. The importer re-ran on the committed export.'
            : 'Saved. This report is kept with the template.'}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-grow flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <Link href="/templates" className="text-primary">
              Templates
            </Link>
            <span className="text-faint">/</span>
            <Link href={`/templates/${id}`} className="text-primary">
              {run.templateName}
            </Link>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Import report</h1>
          <p className="text-[13px] text-muted">
            Kept for the life of the template. This is the audit trail for what the parser did.
          </p>
        </div>
        <Link
          href={`/templates/${id}`}
          className="flex h-[36px] items-center rounded-md border border-control bg-surface px-3.5 text-[13.5px]"
        >
          Open editor
        </Link>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex w-full shrink-0 flex-col gap-3.5 xl:w-[340px]">
          <section className="rounded-[10px] border border-line bg-surface p-4">
            <h2 className="text-[13px] font-semibold">Run</h2>
            <dl className="mt-3 flex flex-col gap-2.5 text-[12.5px]">
              <Field label="File" value={run.filename} mono />
              <Field label="Size" value={formatBytes(run.byteSize)} />
              <Field
                label="Sheet"
                value={`${run.sheetName} · ${run.rowCount} rows × ${run.columnCount} cols`}
              />
              <Field label="Format" value="XLSX, sniffed from content" />
              <Field label="sha256" value={`${run.sha256.slice(0, 8)}…${run.sha256.slice(-4)}`} mono />
              <Field label="Imported" value={new Date(run.createdAt).toLocaleString()} />
              <Field label="Parser" value={run.parserVersion} mono />
              <Field label="Duration" value={`${run.durationMs} ms`} />
            </dl>
          </section>

          <section className="rounded-[10px] border border-line bg-surface p-4">
            <h2 className="text-[13px] font-semibold">Totals</h2>
            <dl className="mt-3 flex flex-col gap-2.5 text-[12.5px]">
              <Field label="Sections" value={String(run.perSection.length)} strong />
              <Field label="Items" value={String(totals.items)} strong />
              <Field label="Comments" value={String(totals.comments)} strong />
              <div className="h-px bg-line-soft" />
              <Field label="Unsupported" value={String(unsupported)} tone="warn" strong />
              <Field label="Empty in source" value={String(empty)} strong />
              <Field label="Notices" value={String(notices.length)} strong />
            </dl>
          </section>

          <div className="flex gap-2.5 rounded-lg border border-ok-line bg-ok-bg p-3.5">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-ok-ink" />
            <p className="text-xs leading-relaxed text-ok-ink">
              The original file is stored with this run, so the report can be re-checked against its
              source at any time.
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-grow flex-col gap-4">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className="flex gap-2.5 rounded-[10px] border border-primary/30 bg-primary-soft p-3.5"
            >
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="flex flex-col gap-1">
                <span className="text-[12.5px] font-semibold">Worth a look</span>
                <p className="text-[12.5px] leading-relaxed text-body">{notice.message}</p>
              </div>
            </div>
          ))}

          <section className="overflow-hidden rounded-[10px] border border-line bg-surface">
            <header className="border-b border-line bg-surface-2 px-4 py-2.5">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                Per section
              </span>
            </header>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line-soft text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-semibold">Section</th>
                  <th className="px-3 py-2 text-right font-semibold">Position</th>
                  <th className="px-3 py-2 text-right font-semibold">Items</th>
                  <th className="px-3 py-2 text-right font-semibold">Comments</th>
                  <th className="px-4 py-2 text-right font-semibold">Issues</th>
                </tr>
              </thead>
              <tbody>
                {run.perSection.map((s) => (
                  <tr key={s.position} className="border-b border-line-soft/60 text-[13px]">
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{s.position + 1}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.items}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.comments}</td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums ${s.issues > 0 ? 'font-semibold text-warn-ink' : 'text-faint'}`}
                    >
                      {s.issues}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="overflow-hidden rounded-[10px] border border-warn-line bg-surface">
            <header className="flex flex-wrap items-center gap-2 border-b border-warn-line bg-warn-bg px-4 py-2.5">
              <AlertIcon className="size-4 text-warn-ink" />
              <span className="text-[13px] font-semibold text-warn-ink">
                Issues ({run.issues.length})
              </span>
              <div className="flex-grow" />
              <span className="text-[11px] text-warn-ink">
                {unsupported} unsupported · {empty} empty in source · {notices.length} notice
              </span>
            </header>
            <div className="max-h-[460px] overflow-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-line-soft text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-semibold">Kind</th>
                    <th className="px-3 py-2 font-semibold">Location</th>
                    <th className="px-3 py-2 font-semibold">Raw value</th>
                    <th className="px-4 py-2 font-semibold">What it means</th>
                  </tr>
                </thead>
                <tbody>
                  {run.issues.map((issue) => (
                    <tr key={issue.id} className="border-b border-line-soft/60 align-top">
                      <td className="px-4 py-2.5">
                        <IssueBadge kind={issue.kind} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-muted">
                        {issue.sourceRow ? `row ${issue.sourceRow}` : 'template'}
                        {issue.sourceColumn ? ` · ${issue.sourceColumn}` : ''}
                        {issue.locationPath ? (
                          <span className="block text-[10.5px] text-faint">
                            {issue.locationPath}
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-2.5 font-mono text-[11px] text-body">
                        {issue.rawSnippet ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] leading-relaxed text-body">
                        {issue.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  strong,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
  tone?: 'warn';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={tone === 'warn' ? 'text-warn-ink' : 'text-muted'}>{label}</dt>
      <dd
        className={`min-w-0 truncate text-right ${mono ? 'font-mono text-[11.5px]' : ''} ${strong ? 'font-semibold' : ''} ${tone === 'warn' ? 'text-warn-ink' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
