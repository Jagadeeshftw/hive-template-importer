import type { Metadata } from 'next';
import { ImportFlow } from './import-flow';

export const metadata: Metadata = { title: 'Import · Template Importer' };

export default function ImportPage() {
  return (
    <div className="flex max-w-[1400px] flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Import a template</h1>
        <p className="text-[13px] text-muted">
          Nothing is saved until you review the parsed result.
        </p>
      </div>
      <ImportFlow />
    </div>
  );
}
