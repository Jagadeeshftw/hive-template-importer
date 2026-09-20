import { describe, expect, it } from 'vitest';
import { checkUpload, formatBytes, MAX_UPLOAD_BYTES } from '@/lib/file-checks';

const file = (name: string, size: number) => ({ name, size });

describe('checkUpload', () => {
  it('accepts the Spectora export, which is XLSX bytes named .xls', () => {
    expect(
      checkUpload(file('InterNACHI Residential -2026-09-20.xls', 1_400_000)),
    ).toEqual({ ok: true });
  });

  it('accepts .xlsx and ignores case in the extension', () => {
    expect(checkUpload(file('export.xlsx', 2048)).ok).toBe(true);
    expect(checkUpload(file('EXPORT.XLS', 2048)).ok).toBe(true);
    expect(checkUpload(file('Export.XlSx', 2048)).ok).toBe(true);
  });

  it('rejects a file that is not a spreadsheet, and says what is wanted', () => {
    const result = checkUpload(file('template.html', 4096));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('Export HTML Text');
  });

  it('rejects a double extension that only looks like a spreadsheet', () => {
    expect(checkUpload(file('template.xlsx.exe', 4096)).ok).toBe(false);
    expect(checkUpload(file('template.xls.zip', 4096)).ok).toBe(false);
  });

  it('rejects an empty file', () => {
    const result = checkUpload(file('export.xls', 0));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('That file is empty.');
  });

  it('accepts a file exactly on the limit and rejects one byte over', () => {
    expect(checkUpload(file('export.xls', MAX_UPLOAD_BYTES)).ok).toBe(true);

    const result = checkUpload(file('export.xls', MAX_UPLOAD_BYTES + 1));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('10 MB');
  });

  it('does not claim to identify the format', () => {
    // A .xls name passes this filter whatever the bytes are. Legacy BIFF and
    // plain-text files are rejected by the parser's content sniffing, not here.
    expect(checkUpload(file('legacy-biff.xls', 5000)).ok).toBe(true);
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
