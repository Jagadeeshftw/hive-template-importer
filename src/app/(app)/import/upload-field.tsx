'use client';

import { useRef, useState } from 'react';
import { checkUpload, formatBytes, MAX_UPLOAD_BYTES } from '@/lib/file-checks';
import { AlertIcon, FileIcon, UploadIcon } from '@/components/icons';

type Accepted = { name: string; size: number };

export function UploadField() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<Accepted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function accept(candidate: File | undefined) {
    if (!candidate) return;
    const result = checkUpload(candidate);
    if (!result.ok) {
      setFile(null);
      setError(result.reason);
      return;
    }
    setError(null);
    setFile({ name: candidate.name, size: candidate.size });
  }

  function clear() {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex flex-col gap-3.5">
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
          <p className="text-[15px] font-medium">
            Drop your Spectora export here
          </p>
          <p className="text-[13px] text-muted">
            A single{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
              .xls
            </code>{' '}
            or{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
              .xlsx
            </code>{' '}
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

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger-line bg-danger-bg px-4 py-3 text-[13px] leading-relaxed text-danger-ink"
        >
          <AlertIcon className="size-4 shrink-0 mt-0.5" />
          {error}
        </p>
      ) : null}

      {file ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 sm:flex-row sm:items-center">
          <FileIcon className="size-[18px] shrink-0 text-muted" />
          <div className="flex-grow min-w-0 flex flex-col gap-0.5">
            <span className="truncate font-mono text-[13.5px] font-medium">
              {file.name}
            </span>
            <span className="text-xs text-muted">
              {formatBytes(file.size)} · selected, not yet parsed
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={clear}
              className="h-[34px] rounded-md border border-control bg-surface px-3 text-[13px]"
            >
              Remove
            </button>
            {/*
              Parsing waits on the importer, which waits on the Phase 1 report.
              The button stays visible so the flow reads correctly.
            */}
            <button
              type="button"
              disabled
              title="Available once the importer lands"
              className="h-[34px] rounded-md bg-primary px-4 text-[13.5px] font-semibold text-primary-ink opacity-45"
            >
              Parse and preview
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
