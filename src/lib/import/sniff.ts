import { ImportError } from './types';

/**
 * Decides what a file actually is by reading it, never by its name.
 *
 * This matters more than usual here: Spectora ships XLSX bytes under a `.xls`
 * name, so trusting the extension would either reject the real export or try to
 * parse a legacy workbook as OOXML. Both failures would be silent-ish and
 * confusing; an honest, specific message is the whole point.
 */
export function assertSpectoraWorkbook(bytes: Uint8Array): void {
  if (bytes.length === 0) {
    throw new ImportError('empty_file', 'That file is empty.');
  }

  // Legacy BIFF .xls — a real Excel file, but the old compound-document format.
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) {
    throw new ImportError(
      'legacy_xls',
      'This is a legacy Excel file (.xls, BIFF format). Spectora’s "Export to ' +
        'spreadsheet → Export HTML Text" produces a newer XLSX workbook. Re-export ' +
        'and upload that file.',
    );
  }

  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    // A few common wrong-file cases get named specifically.
    const head = new TextDecoder('utf-8', { fatal: false })
      .decode(bytes.subarray(0, 512))
      .trimStart()
      .toLowerCase();

    if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
      throw new ImportError(
        'html_document',
        'This is an HTML document. Despite the name, Spectora’s "Export HTML ' +
          'Text" produces a spreadsheet whose comment cells contain HTML — not an ' +
          'HTML page. Use "Export to spreadsheet → Export HTML Text".',
      );
    }

    if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) {
      throw new ImportError('pdf', 'This is a PDF, not a spreadsheet.');
    }

    throw new ImportError(
      'not_a_workbook',
      'This is not an XLSX workbook. The file does not begin with a ZIP header, ' +
        'which every .xlsx file does, whatever its name says.',
    );
  }
}

/**
 * Confirms the ZIP really is a spreadsheet and not some other OOXML or archive.
 * Called after the workbook is opened, using the parts the reader found.
 */
export function assertWorksheetPresent(sheetNames: readonly string[]): void {
  if (sheetNames.length === 0) {
    throw new ImportError(
      'no_worksheet',
      'This ZIP archive contains no worksheet. A .docx or .pptx has the same ' +
        'outer shape as a .xlsx, but no spreadsheet inside.',
    );
  }
}

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((byte, i) => bytes[i] === byte);
}
