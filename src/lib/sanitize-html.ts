import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

/**
 * Allowlist-based HTML sanitizer for comment cells.
 *
 * Comment HTML comes out of a customer's spreadsheet and is untrusted, so it is
 * sanitized on import *and* again on render. Nothing is dropped quietly: every
 * removal comes back in `removals`, with the raw snippet, so the importer can
 * turn it into an import_issue the user can see.
 *
 * The policy is a parameter rather than a constant, because the final allowlist
 * is decided from the tag inventory of the real export.
 */

export type RemovalKind = 'tag' | 'attribute' | 'uri' | 'comment';

export type Removal = {
  kind: RemovalKind;
  /** Tag name, attribute name, or the offending scheme. */
  name: string;
  /** Element path from the fragment root, e.g. "p > span". */
  path: string;
  /** Why it went, in words a non-technical inspector can read. */
  reason: string;
  /** The source as it was written, truncated. */
  snippet: string;
  /** True when the element's text survived even though its markup did not. */
  textKept: boolean;
};

export type SanitizeResult = { html: string; removals: Removal[] };

export type SanitizePolicy = {
  allowedTags: readonly string[];
  /** Attributes permitted per tag. Everything else is removed. */
  allowedAttributes: Readonly<Record<string, readonly string[]>>;
  /** Schemes an href may use. A URL with no scheme is rejected too. */
  allowedUriSchemes: readonly string[];
  /** Tags removed together with their contents, because the content is code. */
  dropWithContent: readonly string[];
  /** Forced onto every surviving link. */
  linkRel: string;
  /** Longest snippet kept on a removal. */
  maxSnippet: number;
};

/**
 * Provisional policy, pending the tag inventory from the real export.
 * Widening it is a one-line change; the tests pin the behaviour, not the list.
 */
export const PROVISIONAL_POLICY: SanitizePolicy = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a'],
  allowedAttributes: { a: ['href'] },
  allowedUriSchemes: ['http', 'https', 'mailto'],
  dropWithContent: [
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'noscript',
    'template',
    'svg',
    'math',
    'link',
    'meta',
    'base',
  ],
  linkRel: 'noopener noreferrer',
  maxSnippet: 300,
};

export function sanitizeHtml(
  input: string,
  policy: SanitizePolicy = PROVISIONAL_POLICY,
): SanitizeResult {
  // Fragment mode: no <html>/<body> wrapper is invented around a cell's markup.
  const $ = cheerio.load(input, null, false);
  const removals: Removal[] = [];

  const allowedTags = new Set(policy.allowedTags.map(lower));
  const dropWithContent = new Set(policy.dropWithContent.map(lower));
  const schemes = new Set(policy.allowedUriSchemes.map(lower));

  function truncate(value: string): string {
    return value.length > policy.maxSnippet
      ? `${value.slice(0, policy.maxSnippet)}…`
      : value;
  }

  function record(removal: Omit<Removal, 'snippet'> & { snippet: string }) {
    removals.push({ ...removal, snippet: truncate(removal.snippet) });
  }

  function processNode(node: AnyNode, path: readonly string[]): void {
    if (node.type === 'text') return;

    if (node.type === 'comment') {
      record({
        kind: 'comment',
        name: '#comment',
        path: path.join(' > ') || '(root)',
        reason: 'HTML comment, which carries no content for the template.',
        snippet: `<!--${node.data}-->`,
        textKept: false,
      });
      $(node).remove();
      return;
    }

    if (!isElement(node)) {
      // Doctypes, processing instructions and anything else non-element.
      record({
        kind: 'tag',
        name: node.type,
        path: path.join(' > ') || '(root)',
        reason: 'Not an element, so it cannot be represented.',
        snippet: $.html(node),
        textKept: false,
      });
      $(node).remove();
      return;
    }

    const tag = lower(node.tagName);
    const here = [...path, tag];
    const where = here.join(' > ');

    if (dropWithContent.has(tag)) {
      record({
        kind: 'tag',
        name: tag,
        path: where,
        reason: `<${tag}> is never imported — its contents are code or styling, not template text.`,
        snippet: $.html(node),
        textKept: false,
      });
      $(node).remove();
      return;
    }

    if (!allowedTags.has(tag)) {
      const kids = $(node).contents().toArray();
      record({
        kind: 'tag',
        name: tag,
        path: where,
        reason: `<${tag}> is not in the allowlist. Its text was kept, its formatting was not.`,
        snippet: $.html(node),
        textKept: kids.length > 0,
      });

      // Unwrap: the element goes, its children stay in its place.
      const $node = $(node);
      for (const kid of kids) $node.before(kid);
      $node.remove();
      for (const kid of kids) processNode(kid, path);
      return;
    }

    sanitizeAttributes(node, tag, where);

    for (const child of $(node).contents().toArray()) {
      processNode(child, here);
    }
  }

  function sanitizeAttributes(node: Element, tag: string, where: string): void {
    const allowed = new Set((policy.allowedAttributes[tag] ?? []).map(lower));

    const attributes: Array<[string, string]> = Object.entries({
      ...node.attribs,
    });

    for (const [rawName, rawValue] of attributes) {
      const name = lower(rawName);

      if (!allowed.has(name)) {
        record({
          kind: 'attribute',
          name,
          path: where,
          reason: isEventHandler(name)
            ? `Event handler ${name}="…" removed — scripts never survive import.`
            : `Attribute ${name}="…" is not allowed on <${tag}>.`,
          snippet: `${rawName}="${rawValue}"`,
          textKept: true,
        });
        delete node.attribs[rawName];
        continue;
      }

      if (name === 'href' && !schemeAllowed(rawValue, schemes)) {
        record({
          kind: 'uri',
          name: 'href',
          path: where,
          reason: `Link target is not an allowed scheme (${[...schemes].join(', ')}). The link text was kept.`,
          snippet: `href="${rawValue}"`,
          textKept: true,
        });
        delete node.attribs[rawName];
      }
    }

    // Any link that still has a target leaves with its rel forced on.
    if (tag === 'a' && typeof node.attribs.href === 'string') {
      node.attribs.rel = policy.linkRel;
    }
  }

  for (const node of $.root().contents().toArray()) {
    processNode(node, []);
  }

  return { html: $.html(), removals };
}

function lower(value: string): string {
  return value.toLowerCase();
}

function isElement(node: AnyNode): node is Element {
  return node.type === 'tag' || node.type === 'script' || node.type === 'style';
}

function isEventHandler(name: string): boolean {
  return name.startsWith('on');
}

/**
 * Entities are already decoded by the parser, so obfuscation like
 * `java&#9;script:` arrives here as a real tab. Control characters and spaces
 * are stripped before the scheme is read, which is what makes that safe.
 */
function schemeAllowed(raw: string, schemes: ReadonlySet<string>): boolean {
  const value = raw.replace(/[\u0000- \u007f]+/g, '').toLowerCase();

  // Protocol-relative URLs inherit the page's scheme; treat them as untrusted.
  if (value.startsWith('//')) return false;

  const match = /^([a-z][a-z0-9+.\-]*):/.exec(value);
  if (!match) return false; // No scheme at all — not one of the allowed ones.

  return schemes.has(match[1]);
}
