import type { Metadata } from 'next';
import { AlertIcon } from '@/components/icons';
import { UploadField } from './upload-field';

export const metadata: Metadata = { title: 'Import · Template Importer' };

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-5 max-w-[1100px]">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Import a template
        </h1>
        <p className="text-[13px] text-muted">
          Nothing is saved until you review the parsed result.
        </p>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex-grow min-w-0">
          <UploadField />
        </div>

        <aside className="w-full shrink-0 rounded-[10px] border border-line bg-surface p-4.5 lg:w-[340px]">
          <h2 className="text-sm font-semibold">
            Getting the export from Spectora
          </h2>
          <ol className="mt-3.5 flex list-decimal flex-col gap-2.5 pl-4.5 text-[12.5px] leading-relaxed text-body">
            <li>Open the template in Spectora.</li>
            <li>
              Choose <strong className="font-semibold">Export to spreadsheet</strong>.
            </li>
            <li>
              Choose <strong className="font-semibold">Export HTML Text</strong>,
              not the plain spreadsheet.
            </li>
            <li>
              Upload the downloaded spreadsheet here. Spectora names it{' '}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px]">
                .xls
              </code>
              , though the file is really XLSX.
            </li>
          </ol>

          <div className="mt-3.5 flex gap-2.5 rounded-md border border-warn-line bg-warn-bg p-3">
            <AlertIcon className="size-[15px] shrink-0 mt-0.5 text-warn-ink" />
            <p className="text-xs leading-relaxed text-warn-ink">
              &ldquo;HTML Text&rdquo; means HTML inside the comment cells of a
              spreadsheet,
              not an HTML document. The format is checked by reading the file,
              not by trusting its name; anything else is rejected with an
              explanation, not a partial import.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
