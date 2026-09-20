import type { Metadata } from 'next';
import Link from 'next/link';
import { listTemplates } from '@/lib/db/queries';
import { CopyIcon, UploadIcon } from '@/components/icons';
import { ResetSampleButton, TemplateRowActions } from './template-actions';

export const metadata: Metadata = { title: 'Templates · Template Importer' };
export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const templates = await listTemplates();
  const hasSample = templates.some((t) => t.isSample);

  return (
    <div className="flex max-w-[1200px] flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-grow flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Templates</h1>
          <p className="text-[13px] text-muted">
            {templates.length === 0
              ? 'Nothing imported yet.'
              : `${templates.length} ${templates.length === 1 ? 'template' : 'templates'} · imported from Spectora spreadsheet exports`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <ResetSampleButton hasSample={hasSample} />
          <Link
            href="/import"
            className="flex h-[38px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-ink"
          >
            <UploadIcon className="size-[15px]" />
            Import template
          </Link>
        </div>
      </div>

      {templates.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
          <div className="hidden grid-cols-[minmax(0,2.4fr)_80px_80px_100px_110px_220px] gap-4 border-b border-line bg-surface-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted lg:grid">
            <span>Template</span>
            <span className="text-right">Sections</span>
            <span className="text-right">Items</span>
            <span className="text-right">Comments</span>
            <span className="text-right">Issues</span>
            <span />
          </div>

          {templates.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-3 border-b border-line-soft px-4 py-3.5 last:border-b-0 lg:grid lg:grid-cols-[minmax(0,2.4fr)_80px_80px_100px_110px_220px] lg:items-center lg:gap-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/templates/${t.id}`} className="text-sm font-semibold text-ink">
                    {t.name}
                  </Link>
                  {t.isSample ? (
                    <span className="inline-flex h-5 items-center rounded-full bg-primary-soft px-2 text-[11px] font-medium text-primary">
                      sample
                    </span>
                  ) : null}
                  {t.copiedFromName ? (
                    <span className="inline-flex h-5 items-center gap-1.5 rounded-full bg-surface-2 px-2 text-[11px] font-medium text-body">
                      <CopyIcon className="size-3" />
                      copy of {t.copiedFromName}
                    </span>
                  ) : null}
                </div>
                <span className="truncate text-xs text-muted">
                  {t.sourceFilename ? (
                    <span className="font-mono">{t.sourceFilename}</span>
                  ) : (
                    'no import run'
                  )}
                </span>
              </div>

              <Count label="Sections" value={t.sectionCount} />
              <Count label="Items" value={t.itemCount} />
              <Count label="Comments" value={t.commentCount} />
              <Count label="Issues" value={t.issueCount} tone={t.issueCount > 0 ? 'warn' : undefined} />

              <TemplateRowActions
                templateId={t.id}
                templateName={t.name}
                counts={{
                  sections: t.sectionCount,
                  items: t.itemCount,
                  comments: t.commentCount,
                }}
                hasReport={Boolean(t.importRunId)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Count({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'warn';
}) {
  return (
    <span
      className={`text-sm tabular-nums lg:text-right ${tone === 'warn' ? 'font-semibold text-warn-ink' : ''}`}
    >
      <span className="mr-1.5 text-xs text-muted lg:hidden">{label}</span>
      {value}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[10px] border border-dashed border-control bg-surface px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted">
        <CopyIcon className="size-5" />
      </span>
      <div className="flex max-w-[420px] flex-col gap-1.5">
        <h2 className="text-[15px] font-semibold">No templates yet</h2>
        <p className="text-[13px] leading-relaxed text-muted">
          Import a Spectora spreadsheet export to get started. You will see the parsed result, and
          anything the importer could not handle, before anything is saved.
        </p>
      </div>
      <Link
        href="/import"
        className="flex h-[38px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-ink"
      >
        <UploadIcon className="size-[15px]" />
        Import template
      </Link>
    </div>
  );
}
