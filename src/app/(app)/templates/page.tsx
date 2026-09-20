import type { Metadata } from 'next';
import Link from 'next/link';
import { listTemplates } from '@/lib/templates';
import { CopyIcon, RefreshIcon, UploadIcon } from '@/components/icons';

export const metadata: Metadata = { title: 'Templates · Template Importer' };

export default async function TemplatesPage() {
  const templates = await listTemplates();

  return (
    <div className="flex flex-col gap-5 max-w-[1100px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-grow flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Templates</h1>
          <p className="text-[13px] text-muted">
            {templates.length === 0
              ? 'Nothing imported yet.'
              : `${templates.length} ${templates.length === 1 ? 'template' : 'templates'} · imported from Spectora HTML Text exports`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/*
            Reset sample re-runs the importer on the committed export and
            replaces only this account's sample. It stays disabled until the
            importer and the sample template exist.
          */}
          <button
            type="button"
            disabled
            title="Available once the sample template is seeded"
            className="flex h-[38px] items-center gap-2 rounded-md border border-control bg-surface px-3.5 text-sm text-ink opacity-45"
          >
            <RefreshIcon className="size-[15px]" />
            Reset sample
          </button>

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
        <div className="flex flex-col items-center gap-4 rounded-[10px] border border-dashed border-control bg-surface px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted">
            <CopyIcon className="size-5" />
          </span>
          <div className="flex flex-col gap-1.5 max-w-[420px]">
            <h2 className="text-[15px] font-semibold">No templates yet</h2>
            <p className="text-[13px] leading-relaxed text-muted">
              Import a Spectora HTML Text export to get started. You will see
              the parsed result, and anything the importer could not handle,
              before anything is saved.
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
      ) : null}
    </div>
  );
}
