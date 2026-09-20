import { describe, expect, it } from 'vitest';
import { checkUpload, formatBytes, MAX_UPLOAD_BYTES } from '@/lib/file-checks';

const file = (name: string, size: number) => ({ name, size });

describe('checkUpload', () => {
  it('accepts a Spectora-shaped .html export', () => {
    expect(checkUpload(file('internachi-residential.html', 1_400_000))).toEqual({
      ok: true,
    });
  });

  it('accepts .htm and ignores case in the extension', () => {
    expect(checkUpload(file('EXPORT.HTM', 2048)).ok).toBe(true);
    expect(checkUpload(file('Export.HtMl', 2048)).ok).toBe(true);
  });

  it('rejects a file that is not HTML, and says what is wanted', () => {
    const result = checkUpload(file('template.xlsx', 4096));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('Export HTML Text');
  });

  it('rejects a name that merely contains .html without ending in it', () => {
    expect(checkUpload(file('report.html.pdf', 4096)).ok).toBe(false);
  });

  it('rejects an empty file', () => {
    const result = checkUpload(file('export.html', 0));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('That file is empty.');
  });

  it('accepts a file exactly on the limit and rejects one byte over', () => {
    expect(checkUpload(file('export.html', MAX_UPLOAD_BYTES)).ok).toBe(true);

    const result = checkUpload(file('export.html', MAX_UPLOAD_BYTES + 1));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The message should name both the actual size and the limit.
    expect(result.reason).toContain('10 MB');
  });
});

describe('formatBytes', () => {
  it('scales the unit and keeps whole megabytes clean', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(MAX_UPLOAD_BYTES)).toBe('10 MB');
    expect(formatBytes(1_572_864)).toBe('1.5 MB');
  });
});
