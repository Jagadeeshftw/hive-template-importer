# Hive vs Binsr — Spectora template import test

Manual test via browser, 20 Sept 2026. Hive trial org "Hive FDE Assignment".
Input: samples/spectora/internachi-residential-2026-09-20.xls (Spectora InterNACHI Residential, Export to spreadsheet → Export HTML Text).
Counts below are the browser agent's observations; see Phase 1 for file-verified numbers.

---

Both imports ran clean. Report below.

**Baseline I diffed against** (parsed from the .xls myself): 13 sections / 69 items / 392 comment rows · 78 `info`, 12 `limit`, 302 `defect` · categories 281×`0` + 21×`1`, **no `-1` rows** · 72 rows with multiple-choice options · 3 rows with unit options · 4 rows with a Recommendation (`pro`×3, `monitor`×1) · **0** default locations, **0** locked, **0** simple-format, **0** default photos · all 392 rows carry the identical estimate range **$10–$1000** · 198 rows contain HTML markup.

---

## 1. Hive import results

**Every option the modal offered**, and what I chose:

| Option | Values | My choice |
|---|---|---|
| Select Template Source | Spectora · HIP (Home Inspector Pro) · HomeGauge · Horizon (Carson Dunlop) | **Spectora** |
| Upload Template File | "Excel files only (.xls, .xlsx)" | the file |
| Import cost estimates | checkbox, **off by default** | **on** |

That is the entire configuration surface. No column mapping, no preview, no dry-run.

**Counts: exact match.** Overview reports **13 Sections / 69 Subsections / 392 Fields**. I expanded all 13 sections and diffed the full 69-subsection tree against the source — every name and every position identical. Spot-checked field counts in six subsections, all exact:

| Subsection | Hive (Info / Lim / Def) | Source |
|---|---|---|
| Exterior › Siding, Flashing & Trim | 1 / 0 / 11 | 1 / 0 / 11 ✓ |
| Exterior › Vegetation, Grading, Drainage & Retaining Walls | 0 / 0 / 5 | 0 / 0 / 5 ✓ |
| Basement… › Foundation | 1 / 0 / 7 | 1 / 0 / 7 ✓ |
| Heating › Equipment | 3 / 1 / 8 | 3 / 1 / 8 ✓ |
| Built-in Appliances › Dishwasher | 1 / 2 / 4 | 1 / 2 / 4 ✓ |
| Garage › Ceiling | 0 / 1 / 3 | 0 / 1 / 3 ✓ |

**What survived**

- **Order** — kept, within and across groups. Inspection Details › General reads In Attendance, Occupancy, Style, Temperature, Type of Building, Weather Conditions, matching the source `Order` column.
- **`&amp;` decoded** — the export writes the literal string `Basement, Foundation, Crawlspace &amp; Structure` into the cell; Hive unescapes it correctly. So does Binsr. Worth knowing it's a Spectora bug both vendors absorb.
- **Categories** — `0` → **Recommendations**, `1` → **Safety Concerns**. Confirmed: Basement › Foundation › "Foundation Cracks - Major" ("Severe cracking noted at the foundation…") lands on Safety Concerns. **`-1` → Maintenance Items is untested** — this file has no `-1` rows, so that third of the mapping is unproven.
- **Recommendations** — on *defect* rows only. Exterior › Vegetation… › Negative Grading ("Grading is sloping towards the home…") carries `monitor` → Defect/Deficiency Service = **Monitor**.
- **Estimates** — with the box ticked, defect fields get Estimated Cost **"$10 – $1,000"**. Exactly the junk the modal warns about, faithfully carried. Info and limitation fields have no cost field at all, so 90 of the 392 ranges silently have nowhere to go.
- **Multiple choice** — full and in order. Heating › Equipment › Heat Type imported as `multipleChoices` with all ten options, Heat Pump → None.
- **HTML** — rendered as real rich text, not escaped tags, and **hyperlinks stay live**. Exterior › Exterior Doors › Loose Hinge ("Loose hinges were observed on exterior door…") keeps its two paragraphs and its clickable familyhandyman.com link.

**Silent losses** — no error, no warning, nothing in the UI to tell you:

| Section › Item › Comment | What was lost |
|---|---|
| Inspection Details › General › **Temperature** | `number` → **Text**; units `Fahrenheit (F), Celsius (C)` dropped; `pro` dropped |
| Cooling › Cooling Equipment › **SEER Rating** ("Modern standards call for at least 13 SEER rating…") | `number` → **Text**; unit `SEER` dropped |
| Plumbing › Hot Water Systems, Controls, Flues & Vents › **Capacity** | `number` → **Text**; unit `gallons` dropped |
| Attic, Insulation & Ventilation › Attic Insulation › **R-value** | `number` → **Text** |
| Heating › General › **Homeowner's Responsibility** ("Most HVAC systems in houses are relatively simple…") | Recommendation `pro` dropped |
| Fireplace › General › **Type** | Recommendation `pro` dropped |

The number loss isn't a mapping bug — it's a capability gap. Hive's Information field type list is **Checkbox Item, Multiple Choice, Text**. There is no numeric type and no unit concept, so a `number` row has nowhere to land. I verified the flattening two ways: the field-type badge reads "Text — A text input field", and the row icon is `lucide-type` (T) where every sibling is `lucide-list`.

**Two friction points unrelated to fidelity**

- The modal's file drop-zone renders **below the visible fold**. At a 980px-tall window you see the four source radios and a greyed-out "Import Template" button; I confirmed `disabled: true` in the DOM with Spectora selected. It reads as a broken feature until you happen to scroll *inside* the dialog, which shows no scroll affordance.
- The docs contradict the UI. `docs.hiveinspect.com/switching` says *"Export the template as HTML, then bring it into Hive."* The modal says **"Excel files only (.xls, .xlsx)."** Both are sort of true — Spectora's HTML-Text export *is* a spreadsheet — but a migrating inspector reading that sentence will go looking for an .html file.

Also: the template arrives named **`InterNACHI_Residential_-2026-09-20`** (the filename, underscores and datestamp included), there's no post-import summary of any kind, and opening the imported template immediately shows **"You have unsaved changes"** before you touch anything.

---

## 2. Binsr import results

Five-step wizard: Upload → AI Analysis → Review Strategy → Configure → Complete. I left Special Instructions blank deliberately, to see the unguided behaviour. **I ticked "I confirm that I own or have authorization to use this template" on your behalf** — the importer won't proceed without it. Flagging that since it's an attestation, not a preference.

**It shows you the numbers before it commits.**

- *Review Strategy* (step 3): **392 Total Rows · 13 Est. Sections · 69 Est. Line Items**, plus a data preview with all 42 columns parsed.
- *Configure* (step 4): comment types derived with provenance — Information **78 comments** *(Matched from: "info")*, Limitations **12** *("limit")*, Deficiencies **302** *("defect")*. Then defect levels from the Category column: Moderate **281 comments, Category: "0"**; Major **21 comments, Category: "1"**; **Minor shows no count** — it correctly represents `-1` as unused rather than inventing rows for it. Footer: *"302 deficiency comments will receive defect levels (of 302 total)."*

Those are my baseline numbers, to the row, surfaced before anything is written.

**Result: exact.** Final summary read Sections 13 / Line Items 69 / Comments 392. The template editor then shows per-section counts natively — all 13 match:

| | Items/Comments | | Items/Comments |
|---|---|---|---|
| Inspection Details | 1 / 6 ✓ | Plumbing | 7 / 43 ✓ |
| Exterior | 7 / 50 ✓ | Electrical | 7 / 40 ✓ |
| Roof | 5 / 35 ✓ | Fireplace | 5 / 13 ✓ |
| Basement, Foundation… | 7 / 33 ✓ | Attic, Insulation… | 5 / 20 ✓ |
| Heating | 4 / 22 ✓ | Doors, Windows & Interior | 7 / 54 ✓ |
| Cooling | 3 / 24 ✓ | Built-in Appliances | 5 / 26 ✓ |
| | | Garage | 6 / 26 ✓ |

**Did the AI invent, merge, reword or drop anything?**

- **Reword: no.** Text is byte-verbatim, including the source's own typos. Exterior › Siding… › Splitting keeps *"Siding shingles **was** splitting"*; Hail Damage - Minor keeps *"any areas that **being** to allow moisture intrusion"*; Warping/Buckling keeps *"nailing siding boards **to** tight to the home"*. An LLM asked to clean up copy would have fixed all three. The AI here does structure detection only — per-comment rewriting is a separate, opt-in **"Rewrite Comment"** button with Low/Medium/High detail, never fired during import.
- **Merge: no.** No item or comment collapsed; every count matches.
- **Drop: yes, two things.** All **392 estimate ranges** — Binsr's comment editor has no cost field at all, so `Default Estimate Min/Max` has nowhere to go. And the **Recommendation column is unmapped**: Exterior › Vegetation… › Negative Grading carries `monitor` in the source and shows **Tags: "Select…" (none)** in Binsr.
- **Invent: yes, and disclosed.** It created four tags — **Safety Hazard, Recommendation, Maintenance Item, Other** — that appear nowhere in the file, and **applied none of them to any comment**. It also authored the defect-level names and descriptions ("Minor defects with low impact") and the comment-type descriptions ("Areas that could not be fully inspected"). All of it appears on the Configure screen, renameable and deletable, before you commit.

**Where Binsr beat Hive on fidelity:** Inspection Details › General › Temperature imported with **Input Type = Number**. Units (`Fahrenheit (F), Celsius (C)`) are dropped there too — neither product has a unit concept.

**HTML:** same result as Hive. Exterior › Exterior Doors › Loose Hinge keeps both paragraphs and a live anchor with the full `familyhandyman.com/doors/repair/fix-sagging-or-sticking-doors/view-all` href.

---

## 3. Head-to-head

| | Hive | Binsr |
|---|---|---|
| Structural fidelity | 13/69/392 exact | 13/69/392 exact |
| Accepted formats | .xls, .xlsx | .csv, .xls, .xlsx |
| Pre-import preview | none | row/section/item counts + 42-column data preview |
| Mapping shown before commit | none | type counts with "Matched from" provenance, editable |
| Post-import receipt | none | Sections/Line Items/Comments summary |
| Name the template | filename, no prompt | filename, **editable before saving** |
| Cost estimates | **imported** (opt-in checkbox) | **dropped** — no cost field exists |
| Recommendation column | **mapped** → Defect/Deficiency Service | **dropped** — tags created but unapplied |
| Numeric fields | flattened to Text | **kept as Number** |
| Unit options | dropped | dropped |
| Per-section counts in editor | none — 69 clicks to audit | Items + Comments columns on the section table |
| Non-spreadsheet formats | chat bubble, "at no extra cost if it is possible" | **"Email your template"** button, names HomeGauge / HIP / PalmTech |
| Ownership attestation | none | required checkbox |
| Curated template library | **Template Hub, 31 community templates** | none found |
| In-place guidance | onboarding videos in a banner | interactive walkthrough at the moment you click Create Template |

Hive is genuinely better at two things: it maps more Spectora-specific columns (cost estimates, recommendation service), and Template Hub is a real asset Binsr has no answer to. Note the hub has its own accuracy gap — the "Hive Inspect Residential" card advertises **29 sections** and the imported template reports **28**.

Binsr wins the *migration experience* decisively, and the gap is almost entirely about **showing your work**. Both importers are equally accurate; only one proves it.

---

## 4. Five suggestions for Hive

1. **Show a pre-import strategy screen.** Parse, then display "392 rows → 13 sections, 69 subsections, 78 Information / 12 Limitations / 302 Defects" *before* writing anything. Binsr's version took no extra clicks and would have let me verify the entire import in four seconds instead of thirty minutes of clicking. This is the single highest-leverage change.

2. **Report what you couldn't map.** Six rows in this file lost data with zero indication. A post-import receipt — *"4 numeric fields imported as text; unit options dropped for Temperature, SEER Rating, Capacity; Recommendation dropped on 3 information fields"* — turns a silent corruption into a to-do list. Right now an inspector discovers it mid-inspection when the temperature field won't take a number.

3. **Fix the modal's hidden drop-zone.** Make the dialog body scroll visibly, or reveal the upload area on source selection, or disable-with-reason ("Choose a file to continue") instead of a dead grey button. I initially concluded the feature was broken, and I was looking for bugs on purpose — a migrating customer will just email support.

4. **Add a Number field type with units.** Not a mapping fix, a missing primitive: Information fields offer only Checkbox Item / Multiple Choice / Text. SEER, R-value, water-heater capacity and temperature are core inspection data, every competitor's export carries them as numbers, and Binsr kept them. While you're in there, `-1 → Maintenance Items` is untested by any stock Spectora template — worth a deliberate test, since a wrong severity on a safety item is the expensive kind of bug.

5. **Two small things that cost almost nothing.** Let people name the template at import time rather than shipping `InterNACHI_Residential_-2026-09-20` into their list — Binsr puts an editable name field on the completion screen. And put Items/Comments counts on the section rows in the template editor; auditing a 69-subsection import currently means 69 clicks, which is why nobody will check.

Also fix the docs line at `/switching` — *"Export the template as HTML"* against a modal that says *"Excel files only"* is the kind of contradiction that generates support tickets during exactly the moment you're trying to win someone off a competitor.

---

Nothing was published, no settings changed, and the Hive template was left unsaved. Side-findings: Spectora's export is an **XLSX package with a `.xls` extension** (openpyxl refuses it outright on the extension alone, and the export route sends no `Content-Disposition` — the filename only appears on the `/downloads/{id}` second hop), and Hive's published report stamps **"8:00 AM EDT"** on an inspection scheduled in Phoenix.