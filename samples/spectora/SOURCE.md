# Source of the committed sample

| | |
| --- | --- |
| Template | **InterNACHI Residential** |
| Origin | Added from the Spectora Template Center, where it is published by Spectora |
| Exported | 20 September 2026 |
| Export path | **Export to spreadsheet → EXPORT HTML TEXT** |
| Original filename | `InterNACHI Residential -2026-09-20.xls` (verbatim — note the space before the hyphen, and none after it) |
| Committed as | `internachi-residential-2026-09-20.xls` |
| Size | 55,420 bytes |
| sha256 | `27d2c50df5076790e30bc07c5c35d12dc4aa598ed5ef4741e786eb4c284c156d` |

The bytes are committed exactly as exported. Only the filename was changed, and
the checksum above was verified before and after the rename.

## "HTML Text" does not mean an HTML document

This is the trap in the format, and it is kept on purpose.

Spectora's **Export HTML Text** produces a **spreadsheet** whose comment cells
contain HTML. It is not an HTML document. The file is named `.xls`, but the
bytes are **XLSX** — a ZIP beginning `PK\x03\x04`, containing
`[Content_Types].xml` and `xl/worksheets/sheet1.xml`. `file(1)` reports
"Microsoft Excel 2007+".

So the extension lies twice over: it says HTML is absent when HTML is the
payload, and it says legacy `.xls` when the container is XLSX.

The misleading extension is **deliberately preserved** here. It is the test case
that forces the importer to identify formats by reading the content, never by
trusting the name. A true legacy BIFF `.xls` must be rejected with an honest
message rather than silently mis-parsed.

## Other notes on the container

- There is **no `xl/sharedStrings.xml`**, so cell text is stored inline
  (`t="inlineStr"`). A reader that only understands shared strings will read this
  workbook as empty rather than failing loudly.
- One worksheet, `sheet1.xml`, ~338 KB of the ~351 KB uncompressed total.
