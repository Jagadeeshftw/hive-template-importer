export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.html', '.htm'];

export type FileCheck = { ok: true } | { ok: false; reason: string };

/**
 * Client-side guard on the upload field. It is a courtesy, not a security
 * boundary — the server re-checks before parsing, because anything reaching a
 * parser from a browser is untrusted.
 */
export function checkUpload(file: { name: string; size: number }): FileCheck {
  const name = file.name.toLowerCase();

  if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return {
      ok: false,
      reason:
        'That is not an HTML file. Spectora’s "Export HTML Text" produces a .html file.',
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
