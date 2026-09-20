export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Extensions the upload field will hand on. Spectora's "Export HTML Text"
 * produces a spreadsheet whose comment cells contain HTML — and it ships it
 * named `.xls` even though the bytes are XLSX, so both are accepted.
 */
const ALLOWED_EXTENSIONS = ['.xls', '.xlsx'];

export type FileCheck = { ok: true } | { ok: false; reason: string };

/**
 * First filter only, on the filename and size.
 *
 * It deliberately does not decide what the file *is*: the extension on a
 * Spectora export lies, so the real format check is content sniffing in the
 * parser, server-side. Everything here is a courtesy to save a round trip.
 */
export function checkUpload(file: { name: string; size: number }): FileCheck {
  const name = file.name.toLowerCase();

  if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return {
      ok: false,
      reason:
        'That is not a spreadsheet. Spectora’s "Export to spreadsheet → Export HTML Text" produces an .xls or .xlsx file.',
    };
  }

  if (file.size === 0) {
    return { ok: false, reason: 'That file is empty.' };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
    };
  }

  return { ok: true };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  const mb = bytes / (1024 * 1024);
  // Whole numbers read better on the limit copy ("up to 10 MB").
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}
