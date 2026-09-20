# Prompt: investigate a Spectora template export

Reusable for any new export format we are asked to import.

> You are given a single file: a Spectora "Export HTML Text" template export.
> Do not write the importer yet. Investigate and report.
>
> 0. Establish what the file actually is before anything else. Read its magic
>    bytes, not its extension — Spectora ships XLSX bytes under a `.xls` name,
>    and "HTML Text" means HTML inside the comment cells of a spreadsheet, not
>    an HTML document. If the extension and the content disagree, say so.
> 1. Map the real structure. How are sections, items, comments, categories and
>    ratings encoded? How is order expressed — row order, an explicit position
>    column, or something else? Which columns carry the hierarchy?
> 2. Inventory every column: its header, what it means, sample values, how often
>    it is blank. Then inventory the HTML found inside comment cells: every tag,
>    attribute and entity that actually appears, with counts.
> 3. Produce two distinct lists: constructs you would support, and constructs you
>    would flag as unsupported. Keep "absent from the export" separate from
>    "dropped by our importer" — they are different failures and the user needs
>    to tell them apart.
> 4. Quantify: rows, counts per level, the longest cell, anything that appears
>    exactly once. A single occurrence is a trap, not a pattern.
> 5. Propose a schema that fits what the file actually contains, not what you
>    expected it to contain. Every row must be traceable back to a source row.
>
> Quote real values from the file for every claim, with their row and column.
> Report counts you measured yourself; if someone handed you expected numbers,
> verify them and state any disagreement rather than repeating them.
