# 07 — Security Reference

- **Layer:** 2 — Foundation
- **Category:** foundation
- **Design status:** DRAFT — pending William's individual review
- **Implementation status:** not applicable — this document is permanently a pointer
- **References:** the authorities in the table below; nothing else
- **Adopted by:** ADR 0005

## The two sentences

> **Jarvis never controls AEGIS.**
> **AEGIS can restrict Jarvis.**

These are the only security rules a foundation document may restate, and they must be
restated verbatim.

## Where the real rules live

This document states no security rules of its own. Everything beyond the two sentences
above is a pointer:

| Subject                                                                      | Authority                                                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| The complete security boundary contract                                      | `reference/design-handoff/SECURITY-BOUNDARIES.md` — archived, immutable                     |
| Ownership, permissions, AEGIS levels, recovery                               | `reference/design-handoff/JARVIS-MASTER-SPEC.md` — archived, immutable — and `CLAUDE.md` §2 |
| Every channel crossing the renderer/main trust boundary                      | `docs/IPC-SURFACE.md`                                                                       |
| What is _not_ enforced today — including the app-layer AEGIS enforcement gap | `docs/KNOWN-LIMITATIONS.md`                                                                 |
| Boundary decisions and their rationale                                       | `docs/DECISIONS/` — ADR 0002 in particular                                                  |

## The standing rule for library documents

Documents of the layered library — the foundation set (01–06, 08–09), every
`docs/architecture/` document, and the vision layer — cite this file wherever security
is relevant. Restating, summarizing, or paraphrasing a rule from the authorities above
anywhere in the library is a defect: two statements of one rule will drift, and for
security rules drift is a security failure (`CLAUDE.md` §3).

Device trust, per-device permissions, and cross-device rules (the multi-client
platform, ADR 0005) are no exception: `docs/architecture/device-trust-model.md`, when
drafted, is built by pointer on the handoff — the handoff already forbids secrets in
mobile/watch clients, localStorage, and HTML.

## If this document grows

If this file ever accumulates rules of its own, that is a defect — not an upgrade. Fix
it by moving the rule to its proper authority and restoring the pointer.
