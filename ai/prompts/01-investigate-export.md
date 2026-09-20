# Prompt: investigate a Spectora HTML Text export

Reusable for any new export format we are asked to import.

> You are given a single HTML file: a Spectora "Export HTML Text" template export.
> Do not write the importer yet. Investigate and report.
>
> 1. Map the real structure. How are sections, items, comments, categories and
>    ratings encoded? How is order expressed — document order, explicit numbering,
>    or an attribute? How deep does nesting go?
> 2. Inventory the rich content: bold, italics, lists, links, images, tables,
>    entities and special characters, empty nodes, stray whitespace, duplicated
>    headings.
> 3. Produce two distinct lists: constructs you would support, and constructs you
>    would flag as unsupported. Keep "absent from the export" separate from
>    "dropped by our importer" — they are different failures and the user needs to
>    tell them apart.
> 4. Quantify: counts per level, deepest nesting, longest text node, anything that
>    appears exactly once (those are the constructs that break parsers).
> 5. Propose a schema that fits what the file actually contains, not what you
>    expected it to contain.
>
> Quote real snippets from the file for every claim. If a construct appears only
> once, say so — a single occurrence is a trap, not a pattern.
