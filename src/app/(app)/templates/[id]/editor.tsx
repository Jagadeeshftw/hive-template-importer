'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CommentRow, TemplateDetail } from '@/lib/db/queries';
import { AlertIcon } from '@/components/icons';
import {
  move,
  renameComment,
  renameItem,
  renameSection,
  updateCommentText,
} from '../actions';

type Draft = { textHtml?: string; name?: string };

export function TemplateEditor({ template }: { template: TemplateDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Unsaved edits live here until Save. Nothing is written on keystroke.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedId, setSelectedId] = useState<string | null>(
    template.sections[0]?.items[0]?.comments[0]?.id ?? null,
  );
  const [query, setQuery] = useState('');

  const allComments = useMemo(
    () =>
      template.sections.flatMap((s) =>
        s.items.flatMap((i) =>
          i.comments.map((c) => ({ comment: c, section: s.name, item: i.name })),
        ),
      ),
    [template],
  );

  const selected = allComments.find((c) => c.comment.id === selectedId) ?? null;
  const dirtyCount = Object.keys(drafts).length;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const ids = new Set<string>();
    for (const { comment, section, item } of allComments) {
      const haystack = `${section} ${item} ${comment.name} ${comment.textHtml}`.toLowerCase();
      if (haystack.includes(q)) ids.add(comment.id);
    }
    return ids;
  }, [query, allComments]);

  function setDraft(id: string, patch: Draft) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  function discard() {
    setDrafts({});
    setError(null);
  }

  function save() {
    const entries = Object.entries(drafts);
    if (entries.length === 0) return;

    startTransition(async () => {
      for (const [id, draft] of entries) {
        if (draft.name !== undefined) {
          const [kind, realId] = splitKey(id);
          const result =
            kind === 'section'
              ? await renameSection(realId, draft.name)
              : kind === 'item'
                ? await renameItem(realId, draft.name)
                : await renameComment(realId, draft.name);
          if (result.error) {
            setError(result.error);
            return;
          }
        }
        if (draft.textHtml !== undefined) {
          const [, realId] = splitKey(id);
          const result = await updateCommentText(realId, draft.textHtml);
          if (result.error) {
            setError(result.error);
            return;
          }
        }
      }
      setDrafts({});
      setError(null);
      setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      router.refresh();
    });
  }

  function reorder(level: 'section' | 'item' | 'comment', id: string, direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await move(level, id, direction);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex min-h-0 flex-grow flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2.5 sm:px-6">
        {dirtyCount > 0 ? (
          <span className="inline-flex h-[26px] items-center gap-2 rounded-full border border-warn-line bg-warn-bg px-3 text-[12.5px] font-medium text-warn-ink">
            <span className="size-[7px] rounded-full bg-warn-dot" />
            {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
          </span>
        ) : (
          <span className="inline-flex h-[26px] items-center gap-2 rounded-full border border-line bg-surface-2 px-3 text-[12.5px] text-muted">
            <span className="size-[7px] rounded-full bg-faint" />
            No unsaved changes
          </span>
        )}
        {savedAt ? <span className="text-[12.5px] text-muted">Last saved {savedAt}</span> : null}

        <div className="flex-grow" />

        <button
          type="button"
          onClick={discard}
          disabled={dirtyCount === 0 || pending}
          className="h-[34px] rounded-md border border-control bg-surface px-3.5 text-[13.5px] disabled:opacity-40"
        >
          Discard changes
        </button>
        <button
          type="button"
          onClick={save}
          disabled={dirtyCount === 0 || pending}
          className="h-[34px] rounded-md bg-primary px-4 text-[13.5px] font-semibold text-primary-ink disabled:opacity-40"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2.5 border-b border-danger-line bg-danger-bg px-4 py-2.5 text-[13px] text-danger-ink sm:px-6"
        >
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-grow flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-line bg-surface lg:w-[440px] lg:border-b-0 lg:border-r">
          <div className="border-b border-line-soft p-3">
            <label htmlFor="tree-search" className="sr-only">
              Search sections, items and comments
            </label>
            <div className="flex h-9 items-center gap-2 rounded-md border border-line bg-input px-3">
              <input
                id="tree-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the template"
                className="min-w-0 flex-grow bg-transparent text-[13.5px] outline-none"
              />
              {matches ? (
                <span className="whitespace-nowrap text-[11.5px] text-muted">
                  {matches.size} matches
                </span>
              ) : null}
            </div>
          </div>

          <div className="max-h-[560px] overflow-auto py-1.5 lg:max-h-none">
            {template.sections.map((section, sIndex) => {
              const sectionKey = key('section', section.id);
              const sectionName = drafts[sectionKey]?.name ?? section.name;
              const commentCount = section.items.reduce((n, i) => n + i.comments.length, 0);

              return (
                <div key={section.id}>
                  <Row indent={0}>
                    <EditableName
                      value={sectionName}
                      dirty={drafts[sectionKey]?.name !== undefined}
                      onChange={(v) => setDraft(sectionKey, { name: v })}
                      className="text-[13.5px] font-semibold"
                      label={`Section name, ${section.name}`}
                    />
                    <span className="whitespace-nowrap text-[11.5px] text-muted">
                      {section.items.length} items · {commentCount}
                    </span>
                    <MoveButtons
                      label={`section ${section.name}`}
                      first={sIndex === 0}
                      last={sIndex === template.sections.length - 1}
                      onMove={(d) => reorder('section', section.id, d)}
                      disabled={pending}
                    />
                  </Row>

                  {section.items.map((item, iIndex) => {
                    const itemKey = key('item', item.id);
                    const itemName = drafts[itemKey]?.name ?? item.name;
                    return (
                      <div key={item.id}>
                        <Row indent={1}>
                          <EditableName
                            value={itemName}
                            dirty={drafts[itemKey]?.name !== undefined}
                            onChange={(v) => setDraft(itemKey, { name: v })}
                            className="text-[13px] font-medium"
                            label={`Item name, ${item.name}`}
                          />
                          <span className="text-[11.5px] text-muted">{item.comments.length}</span>
                          <MoveButtons
                            label={`item ${item.name}`}
                            first={iIndex === 0}
                            last={iIndex === section.items.length - 1}
                            onMove={(d) => reorder('item', item.id, d)}
                            disabled={pending}
                          />
                        </Row>

                        {item.comments.map((comment, cIndex) => {
                          const commentKey = key('comment', comment.id);
                          const dirty = drafts[commentKey] !== undefined;
                          const hidden = matches ? !matches.has(comment.id) : false;
                          if (hidden) return null;

                          return (
                            <div
                              key={comment.id}
                              className={`flex items-start gap-2 py-1 pl-14 pr-2 ${
                                comment.id === selectedId
                                  ? 'border-l-2 border-primary bg-primary-soft'
                                  : ''
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedId(comment.id)}
                                className="min-w-0 flex-grow text-left"
                              >
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono text-[10px] text-faint">
                                    r{comment.sourceRow}
                                  </span>
                                  <span className="text-[12.5px]">
                                    {drafts[commentKey]?.name ?? comment.name}
                                  </span>
                                  {comment.isQuestion ? (
                                    <span className="rounded bg-surface-2 px-1.5 text-[10px] text-muted">
                                      question
                                    </span>
                                  ) : null}
                                  {comment.answerType === 'number' ? (
                                    <span className="rounded bg-surface-2 px-1.5 text-[10px] text-muted">
                                      number
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                              {dirty ? <span className="mt-1.5 size-[7px] rounded-full bg-warn-dot" /> : null}
                              <MoveButtons
                                label={`comment ${comment.name}`}
                                first={cIndex === 0}
                                last={cIndex === item.comments.length - 1}
                                onMove={(d) => reorder('comment', comment.id, d)}
                                disabled={pending}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 flex-grow p-4 sm:p-6">
          {selected ? (
            <CommentDetail
              comment={selected.comment}
              path={`${selected.section} › ${selected.item}`}
              draft={drafts[key('comment', selected.comment.id)]}
              onText={(html) => setDraft(key('comment', selected.comment.id), { textHtml: html })}
              onName={(name) => setDraft(key('comment', selected.comment.id), { name })}
            />
          ) : (
            <p className="text-[13px] text-muted">Select a comment from the tree.</p>
          )}
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function key(kind: 'section' | 'item' | 'comment', id: string) {
  return `${kind}:${id}`;
}

function splitKey(value: string): ['section' | 'item' | 'comment', string] {
  const [kind, ...rest] = value.split(':');
  return [kind as 'section' | 'item' | 'comment', rest.join(':')];
}

function Row({ indent, children }: { indent: number; children: React.ReactNode }) {
  const pad = indent === 0 ? 'pl-2.5' : 'pl-8';
  return <div className={`flex items-center gap-2 py-1 pr-2 ${pad}`}>{children}</div>;
}

function EditableName({
  value,
  dirty,
  onChange,
  className,
  label,
}: {
  value: string;
  dirty: boolean;
  onChange: (value: string) => void;
  className: string;
  label: string;
}) {
  return (
    <span className="flex min-w-0 flex-grow items-center gap-1.5">
      <input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`min-w-0 flex-grow truncate rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-line focus:border-primary focus:bg-surface ${className}`}
      />
      {dirty ? <span className="size-[7px] shrink-0 rounded-full bg-warn-dot" /> : null}
    </span>
  );
}

function MoveButtons({
  label,
  first,
  last,
  onMove,
  disabled,
}: {
  label: string;
  first: boolean;
  last: boolean;
  onMove: (direction: 'up' | 'down') => void;
  disabled: boolean;
}) {
  const base =
    'flex size-[30px] shrink-0 items-center justify-center rounded text-muted disabled:opacity-25';
  return (
    <span className="flex shrink-0">
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={first || disabled}
        onClick={() => onMove('up')}
        className={base}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={last || disabled}
        onClick={() => onMove('down')}
        className={base}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <polyline points="19 12 12 19 5 12" />
        </svg>
      </button>
    </span>
  );
}

function CommentDetail({
  comment,
  path,
  draft,
  onText,
  onName,
}: {
  comment: CommentRow;
  path: string;
  draft: Draft | undefined;
  onText: (html: string) => void;
  onName: (name: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const dirty = draft !== undefined;
  const choices = comment.options.filter((o) => o.kind === 'choice');
  const units = comment.options.filter((o) => o.kind === 'unit');

  function wrap(tag: 'strong' | 'em') {
    document.execCommand(tag === 'strong' ? 'bold' : 'italic');
    if (editorRef.current) onText(editorRef.current.innerHTML);
  }

  return (
    <div className="flex max-w-[900px] flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-grow flex-col gap-1">
          <span className="font-mono text-[11.5px] text-muted">
            {path} · row {comment.sourceRow} · position {comment.position + 1}
          </span>
          <input
            aria-label="Comment name"
            value={draft?.name ?? comment.name}
            onChange={(e) => onName(e.target.value)}
            className="max-w-[520px] rounded border border-transparent bg-transparent px-1 py-0.5 text-[17px] font-semibold tracking-tight hover:border-line focus:border-primary focus:bg-surface"
          />
        </div>
        {dirty ? (
          <span className="inline-flex h-[26px] items-center gap-2 rounded-full border border-warn-line bg-warn-bg px-3 text-[12px] font-medium text-warn-ink">
            <span className="size-[7px] rounded-full bg-warn-dot" />
            Unsaved
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 text-[11.5px]">
        <Chip label="type" value={comment.commentType} />
        {comment.category ? <Chip label="category" value={comment.category} /> : null}
        <Chip label="answer" value={comment.answerType} />
        {comment.recommendation ? (
          <Chip label="recommendation" value={comment.recommendation} />
        ) : null}
        {comment.estimateMin !== null ? (
          <Chip label="estimate" value={`$${comment.estimateMin}–$${comment.estimateMax}`} />
        ) : null}
      </div>

      {comment.isQuestion ? (
        <section className="rounded-[10px] border border-line bg-surface p-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            Question · {choices.length} options
          </h3>
          <ol className="mt-3 flex flex-col gap-1.5">
            {choices.map((option, i) => (
              <li key={i} className="flex items-center gap-2.5 text-[13px]">
                <span className="w-5 text-right font-mono text-[11px] text-faint">{i + 1}</span>
                <span className="flex size-4 items-center justify-center rounded border border-control" />
                {option.label}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11.5px] text-muted">
            Options are kept in the order the export listed them.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-[10px] border border-line bg-surface">
          <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-3 py-2">
            <button
              type="button"
              aria-label="Bold"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => wrap('strong')}
              className="size-[30px] rounded border border-line bg-surface text-[13px] font-bold"
            >
              B
            </button>
            <button
              type="button"
              aria-label="Italic"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => wrap('em')}
              className="size-[30px] rounded border border-line bg-surface font-serif text-[13px] italic"
            >
              I
            </button>
            <div className="flex-grow" />
            <span className="text-[11.5px] text-muted">
              Only the formatting the export uses. Anything else is stripped on save.
            </span>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Comment text"
            onInput={(e) => onText((e.target as HTMLDivElement).innerHTML)}
            className="min-h-[160px] p-4 text-sm leading-relaxed outline-none [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: comment.textHtml }}
          />
        </section>
      )}

      {comment.answerType === 'number' ? (
        <section className="rounded-[10px] border border-line bg-surface p-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            Number field
          </h3>
          <p className="mt-2 text-[13px]">
            <strong className="font-semibold">{comment.name.trim()}</strong>: number
            {units.length > 0 ? (
              <>
                {' · '}
                <span className="font-medium">{units.map((u) => u.label).join(', ')}</span>
              </>
            ) : (
              <span className="text-muted"> · no unit options in the export</span>
            )}
          </p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
            Units are kept as structured data rather than flattened into text, so the field is still
            a measurement after import.
          </p>
        </section>
      ) : null}

      <section className="rounded-[10px] border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            As imported
          </h3>
          <div className="flex-grow" />
          <button
            type="button"
            onClick={() => {
              if (editorRef.current) editorRef.current.innerHTML = comment.textHtml;
              onText(comment.textHtml);
            }}
            className="h-[28px] rounded border border-control bg-surface px-2.5 text-[12.5px]"
          >
            Revert to this
          </button>
        </div>
        <pre className="mt-2.5 overflow-x-auto rounded bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed text-body">
          {comment.textHtml || '(no comment text in the export)'}
        </pre>
        <p className="mt-2 text-[11.5px] text-muted">
          Row {comment.sourceRow} · column Comment Text
        </p>
      </section>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-surface-2 px-2.5">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

export function EditorHeader({ template }: { template: TemplateDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-line bg-surface px-4 py-3 sm:px-6">
      <Link href="/templates" className="text-[13px] text-primary">
        Templates
      </Link>
      <span className="text-faint">/</span>
      <span className="text-sm font-semibold">{template.name}</span>
      {template.copiedFromName ? (
        <span className="inline-flex h-5 items-center rounded-full bg-surface-2 px-2 text-[11px] text-body">
          copy of {template.copiedFromName}
        </span>
      ) : null}
      {template.importRunId ? (
        <Link
          href={`/templates/${template.id}/report`}
          className="text-[12.5px] text-warn-ink underline"
        >
          {template.issueCount} import {template.issueCount === 1 ? 'issue' : 'issues'}
        </Link>
      ) : null}
    </div>
  );
}
