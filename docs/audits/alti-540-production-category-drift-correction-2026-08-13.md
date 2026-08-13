# ALTI-540 production category drift correction — 2026-08-13

The first production deployment of the ALTI-540 reviewed Decision Making
mapping stopped at its immutable fail-closed source-category guard. Read-only
inspection found three stable IDs whose live category differed from both the
original `Syllogisms` source and the reviewed target.

| Stem ID | Live category at failure | ALTI-540 target | Final decision |
| --- | --- | --- | --- |
| `00e845fc-83db-455d-91c8-f3d436563a1c` | Logical Puzzles | Interpreting Information and Drawing Conclusions | Logical Puzzles — an applied ordering puzzle |
| `611ad210-c7c7-4093-880a-0ee9870b2daa` | Probabilistic and Statistical Reasoning | Interpreting Information and Drawing Conclusions | Interpreting Information and Drawing Conclusions — graph interpretation without probability reasoning |
| `cfbff7c7-baaf-4856-bc06-4cdd2034306f` | Logical Puzzles | Syllogisms | Logical Puzzles — a closed sibling-ordering puzzle |

The reviewed migration remains unchanged. Migration `20260810142900` bridges
only these exact IDs from their exact observed categories into the immutable
mapping's accepted source state. Migration `20260810143100` then restores the
three explicit final decisions and verifies them. Both migrations accept an
absent row and an already-correct row, so inserting them into development's
already-applied history remains safe with `supabase db push --include-all`.

No production rows were mutated during diagnosis.
