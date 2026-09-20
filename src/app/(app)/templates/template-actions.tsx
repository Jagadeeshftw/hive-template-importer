'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { AlertIcon, CopyIcon, RefreshIcon } from '@/components/icons';
import { copyTemplate, resetSample, type ActionState } from './actions';

const INITIAL: ActionState = { error: null };

export function CopyButton({
  templateId,
  templateName,
  counts,
}: {
  templateId: string;
  templateName: string;
  counts: { sections: number; items: number; comments: number };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(copyTemplate, INITIAL);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-[30px] items-center gap-1.5 rounded-md border border-control bg-surface px-2.5 text-[13px]"
      >
        <CopyIcon className="size-3.5" />
        Copy
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4">
          <div
            role="dialog"
            aria-labelledby="copy-title"
            aria-modal="true"
            className="w-full max-w-[520px] rounded-xl border border-line bg-surface shadow-2xl"
          >
            <form action={formAction}>
              <input type="hidden" name="templateId" value={templateId} />

              <div className="flex flex-col gap-1.5 px-6 pt-5">
                <h2 id="copy-title" className="text-[17px] font-semibold tracking-tight">
                  Make a copy
                </h2>
                <p className="text-[13px] leading-relaxed text-muted">
                  Copying <strong className="font-semibold text-ink">{templateName}</strong> —{' '}
                  {counts.sections} sections, {counts.items} items, {counts.comments} comments.
                </p>
              </div>

              <div className="flex flex-col gap-4 px-6 py-5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="copy-name" className="text-[13px] font-medium">
                    Name for the copy
                  </label>
                  <input
                    id="copy-name"
                    name="name"
                    defaultValue={`${templateName} (copy)`}
                    className="h-10 rounded-md border border-control bg-surface px-3 text-sm"
                  />
                </div>

                <ul className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-body">
                  <li>
                    Every section, item and comment is duplicated. The copy is fully independent —
                    editing it never touches the original.
                  </li>
                  <li>
                    Runs as one Postgres function in a single transaction. If any row fails, nothing
                    is written.
                  </li>
                  <li>
                    The copy records its origin, and is never the sample, so Reset sample cannot
                    overwrite it.
                  </li>
                </ul>

                {state.error ? (
                  <p role="alert" className="text-[13px] text-danger-ink">
                    {state.error}
                  </p>
                ) : null}
              </div>

              <div className="flex justify-end gap-2.5 border-t border-line-soft px-6 py-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-[38px] rounded-md border border-control bg-surface px-4 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="h-[38px] rounded-md bg-primary px-4 text-sm font-semibold text-primary-ink disabled:opacity-50"
                >
                  {pending ? 'Copying…' : 'Create copy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ResetSampleButton({ hasSample }: { hasSample: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(resetSample, INITIAL);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-[38px] items-center gap-2 rounded-md border border-control bg-surface px-3.5 text-sm"
      >
        <RefreshIcon className="size-[15px]" />
        Reset sample
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4">
          <div
            role="dialog"
            aria-labelledby="reset-title"
            aria-modal="true"
            className="w-full max-w-[520px] rounded-xl border border-line bg-surface shadow-2xl"
          >
            <form action={formAction}>
              <div className="flex flex-col gap-1.5 px-6 pt-5">
                <h2 id="reset-title" className="text-[17px] font-semibold tracking-tight">
                  Reset the sample template?
                </h2>
                <p className="text-[13px] leading-relaxed text-muted">
                  This re-runs the importer on the committed Spectora export and replaces your
                  sample template.
                </p>
              </div>

              <div className="flex flex-col gap-3 px-6 py-5">
                <div className="flex gap-2.5 rounded-lg border border-warn-line bg-warn-bg p-3.5">
                  <AlertIcon className="mt-0.5 size-4 shrink-0 text-warn-ink" />
                  <p className="text-[12.5px] leading-relaxed text-warn-ink">
                    {hasSample
                      ? 'Your current sample and any edits you made to it will be discarded.'
                      : 'You have no sample right now; this will create one.'}{' '}
                    Templates you imported or copied yourself are not touched.
                  </p>
                </div>
                {state.error ? (
                  <p role="alert" className="text-[13px] text-danger-ink">
                    {state.error}
                  </p>
                ) : null}
              </div>

              <div className="flex justify-end gap-2.5 border-t border-line-soft px-6 py-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-[38px] rounded-md border border-control bg-surface px-4 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="h-[38px] rounded-md bg-primary px-4 text-sm font-semibold text-primary-ink disabled:opacity-50"
                >
                  {pending ? 'Re-importing…' : 'Reset sample'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function TemplateRowActions({
  templateId,
  templateName,
  counts,
  hasReport,
}: {
  templateId: string;
  templateName: string;
  counts: { sections: number; items: number; comments: number };
  hasReport: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {hasReport ? (
        <Link
          href={`/templates/${templateId}/report`}
          className="flex h-[30px] items-center rounded-md border border-control bg-surface px-2.5 text-[13px]"
        >
          Report
        </Link>
      ) : (
        <span className="flex h-[30px] items-center rounded-md border border-line bg-surface px-2.5 text-[13px] text-faint">
          Report
        </span>
      )}
      <CopyButton templateId={templateId} templateName={templateName} counts={counts} />
      <Link
        href={`/templates/${templateId}`}
        className="flex h-[30px] items-center rounded-md bg-primary px-3 text-[13px] font-medium text-primary-ink"
      >
        Open
      </Link>
    </div>
  );
}
