import { describe, expect, it } from 'vitest';
import {
  PROVISIONAL_POLICY,
  sanitizeHtml,
  type SanitizePolicy,
} from '@/lib/sanitize-html';

const kinds = (html: string) =>
  sanitizeHtml(html).removals.map((r) => `${r.kind}:${r.name}`);

describe('sanitizeHtml — content that should survive', () => {
  it('keeps the allowlisted formatting untouched', () => {
    const input =
      '<p><strong>Granule loss.</strong> Shingles show <em>granule loss</em>.</p>';
    const { html, removals } = sanitizeHtml(input);
    expect(html).toBe(input);
    expect(removals).toEqual([]);
  });

  it('keeps lists and line breaks', () => {
    const input = '<ul><li>Monitor annually</li><li>Budget<br>for replacement</li></ul>';
    const { html, removals } = sanitizeHtml(input);
    expect(html).toBe(input);
    expect(removals).toEqual([]);
  });

  it('preserves entities and special characters as text', () => {
    const { html } = sanitizeHtml('<p>Gutters are full of debris &amp; should be cleaned.</p>');
    expect(html).toBe('<p>Gutters are full of debris &amp; should be cleaned.</p>');
  });

  it('forces rel on a link it keeps', () => {
    const { html, removals } = sanitizeHtml('<a href="https://example.com/x">spec</a>');
    expect(html).toBe('<a href="https://example.com/x" rel="noopener noreferrer">spec</a>');
    expect(removals).toEqual([]);
  });

  it('allows mailto', () => {
    const { html } = sanitizeHtml('<a href="mailto:inspector@example.com">email</a>');
    expect(html).toContain('href="mailto:inspector@example.com"');
  });
});

describe('sanitizeHtml — hostile input', () => {
  it('drops a script element together with its code', () => {
    const { html, removals } = sanitizeHtml('<p>before</p><script>alert(1)</script><p>after</p>');
    expect(html).toBe('<p>before</p><p>after</p>');
    expect(html).not.toContain('alert');
    expect(removals).toHaveLength(1);
    expect(removals[0]).toMatchObject({ kind: 'tag', name: 'script', textKept: false });
    // The raw source is kept so it can be shown as an import issue.
    expect(removals[0].snippet).toContain('alert(1)');
  });

  it('strips an onerror handler, and the img that carried it', () => {
    const { html, removals } = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(html).toBe('');
    expect(html).not.toContain('onerror');
    expect(removals.map((r) => r.name)).toContain('img');
    expect(removals[0].snippet).toContain('onerror');
  });

  it('unwraps a javascript: link to its text', () => {
    const { html, removals } = sanitizeHtml('<a href="javascript:alert(1)">click me</a>');
    // No inert anchor left behind — just the words the inspector wrote.
    expect(html).toBe('click me');
    expect(html).not.toContain('javascript');
    expect(html).not.toContain('<a');
    expect(removals).toHaveLength(1);
    expect(removals[0]).toMatchObject({ kind: 'uri', name: 'href', textKept: true });
    expect(removals[0].snippet).toContain('javascript:alert(1)');
  });

  it('unwraps an anchor that never had a target', () => {
    const { html, removals } = sanitizeHtml('<a>bare</a>');
    expect(html).toBe('bare');
    expect(removals[0]).toMatchObject({ kind: 'tag', name: 'a' });
  });

  it('sees through case and whitespace obfuscation in a scheme', () => {
    for (const href of [
      'JaVaScRiPt:alert(1)',
      'java&#9;script:alert(1)',
      ' javascript:alert(1)',
      'java\nscript:alert(1)',
    ]) {
      const { html } = sanitizeHtml(`<a href="${href}">x</a>`);
      expect(html, href).toBe('x');
    }
  });

  it('rejects data: and protocol-relative targets', () => {
    expect(sanitizeHtml('<a href="data:text/html,<script>">x</a>').html).toBe('x');
    expect(sanitizeHtml('<a href="//evil.example.com">x</a>').html).toBe('x');
  });

  it('strips inline styles and event handlers from allowed tags', () => {
    const { html, removals } = sanitizeHtml(
      '<p style="position:fixed" onclick="steal()">text</p>',
    );
    expect(html).toBe('<p>text</p>');
    expect(kinds('<p style="x" onclick="y">t</p>')).toEqual([
      'attribute:style',
      'attribute:onclick',
    ]);
    expect(removals.find((r) => r.name === 'onclick')?.reason).toMatch(/scripts never survive/i);
  });

  it('drops a script nested inside svg', () => {
    const { html } = sanitizeHtml('<p>a</p><svg><script>alert(1)</script></svg>');
    expect(html).toBe('<p>a</p>');
  });

  it('removes HTML comments', () => {
    const { html, removals } = sanitizeHtml('<p>a</p><!-- hidden note -->');
    expect(html).toBe('<p>a</p>');
    expect(removals[0]).toMatchObject({ kind: 'comment', name: '#comment' });
  });
});

describe('sanitizeHtml — unsupported markup keeps its text', () => {
  it('unwraps an unknown tag and keeps what it wrapped', () => {
    const { html, removals } = sanitizeHtml('<div><p>kept</p></div>');
    expect(html).toBe('<p>kept</p>');
    expect(removals).toHaveLength(1);
    expect(removals[0]).toMatchObject({ kind: 'tag', name: 'div', textKept: true });
  });

  it('unwraps nested unsupported tags down to the allowed ones', () => {
    const { html } = sanitizeHtml(
      '<table><tr><td><span>Slope</span></td></tr></table>',
    );
    expect(html).toBe('Slope');
  });

  it('reports the path so an issue can point at the place', () => {
    const { removals } = sanitizeHtml('<p><span>x</span></p>');
    expect(removals[0].path).toBe('p > span');
  });

  it('truncates a very long snippet', () => {
    const long = `<div>${'a'.repeat(1000)}</div>`;
    const { removals } = sanitizeHtml(long);
    expect(removals[0].snippet.length).toBeLessThanOrEqual(PROVISIONAL_POLICY.maxSnippet + 1);
    expect(removals[0].snippet.endsWith('…')).toBe(true);
  });
});

describe('sanitizeHtml — the policy is a parameter', () => {
  it('honours a widened allowlist without code changes', () => {
    const withTables: SanitizePolicy = {
      ...PROVISIONAL_POLICY,
      // tbody is required: the HTML parser inserts one even when the source
      // omits it, so a table allowlist without it reports a phantom removal.
      allowedTags: [...PROVISIONAL_POLICY.allowedTags, 'table', 'tbody', 'tr', 'td'],
    };
    const { html, removals } = sanitizeHtml(
      '<table><tr><td>Slope</td></tr></table>',
      withTables,
    );
    expect(html).toBe('<table><tbody><tr><td>Slope</td></tr></tbody></table>');
    expect(removals).toEqual([]);
  });

  it('reports the implicit tbody when a table allowlist forgets it', () => {
    const withoutTbody: SanitizePolicy = {
      ...PROVISIONAL_POLICY,
      allowedTags: [...PROVISIONAL_POLICY.allowedTags, 'table', 'tr', 'td'],
    };
    const { removals } = sanitizeHtml(
      '<table><tr><td>Slope</td></tr></table>',
      withoutTbody,
    );
    expect(removals.map((r) => r.name)).toEqual(['tbody']);
  });

  it('honours a narrowed allowlist', () => {
    const textOnly: SanitizePolicy = { ...PROVISIONAL_POLICY, allowedTags: ['p'] };
    const { html } = sanitizeHtml('<p><strong>bold</strong></p>', textOnly);
    expect(html).toBe('<p>bold</p>');
  });

  it('is deterministic — same input, same output', () => {
    const input = '<div onclick="x"><p>a</p><script>b</script></div>';
    const first = sanitizeHtml(input);
    const second = sanitizeHtml(input);
    expect(second).toEqual(first);
  });

  it('handles empty and whitespace-only input', () => {
    expect(sanitizeHtml('')).toEqual({ html: '', removals: [] });
    expect(sanitizeHtml('   ').html).toBe('   ');
  });
});
