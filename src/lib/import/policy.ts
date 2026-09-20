import { PROVISIONAL_POLICY, type SanitizePolicy } from '@/lib/sanitize-html';

/**
 * The allowlist for Spectora comment HTML, settled from the Phase 1 tag
 * inventory of the committed export.
 *
 * That file exercises only `p`, `a`, `strong` and one `div`. The inline
 * formatting tags below are kept anyway — they are safe, and other Spectora
 * templates use them — but no table tags are included, because none appear.
 * The one `div` is a YouTube embed wrapper; it unwraps and reports as
 * unsupported.
 *
 * `target` is allowed on links because 39 of 43 anchors carry `target="_blank"`
 * and stripping it would bury the report in 39 issues about a benign attribute.
 * Every surviving link still gets rel="noopener noreferrer" forced on, which is
 * what actually makes `target="_blank"` safe.
 */
export const SPECTORA_POLICY: SanitizePolicy = {
  ...PROVISIONAL_POLICY,
  allowedTags: ['p', 'a', 'strong', 'b', 'em', 'i', 'u', 'br', 'ul', 'ol', 'li'],
  allowedAttributes: { a: ['href', 'target'] },
};
