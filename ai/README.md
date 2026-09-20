# AI assets

Everything in here is reusable: the prompts that drove the build, and the scripts
the agent runs. Kept in the repo because the brief asks for it, and because the
import path itself deliberately contains **no** LLM — the model helped write the
parser, it never runs inside it.

| Path                     | What it is                                              |
| ------------------------ | ------------------------------------------------------- |
| `prompts/`               | Task prompts used to drive the build, in the order used |
| `scripts/`               | Scripts the agent runs (screenshots, fixture checks)    |

## Ground rules given to the agent

- The Spectora export is the source of truth. A faithful import outranks a pretty one.
- The importer is deterministic: same bytes in, same rows out, every row traceable
  to a node in the source.
- Content that is not supported is surfaced to the user, never silently dropped
  and never rewritten.
- "Missing from the export" and "dropped by our importer" are different problems
  and are reported separately.
