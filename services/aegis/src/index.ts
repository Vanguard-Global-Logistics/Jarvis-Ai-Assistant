/**
 * @jarvis/aegis — independent security and containment runtime.
 *
 * STATUS: NOT IMPLEMENTED.
 *
 * There is no state engine, no level, no capability grid, no audit log, and no
 * software review. AEGIS does not exist yet. Nothing in this repository is
 * protected by it, and no code, comment, or UI may imply otherwise.
 *
 * This package is deliberately empty rather than stubbed. A placeholder that
 * returns GREEN, or an in-memory `currentLevel` variable, would be MOCK SECURITY
 * — the exact thing CLAUDE.md §8 forbids and the most dangerous kind of fake,
 * because a security control that appears to work is worse than one that is
 * visibly absent.
 *
 * What must be true when it is built (from JARVIS-MASTER-SPEC.md,
 * SECURITY-BOUNDARIES.md, and CLAUDE.md §2 — these are non-negotiable):
 *
 *   - AEGIS restrains Jarvis. Jarvis can never lower an AEGIS level, disable
 *     AEGIS, rewrite its rules, or grant itself permissions.
 *   - The boundary must exist in code — separate process, separate storage,
 *     separate credentials — not as a UI convention.
 *   - Levels: GREEN → YELLOW (restricted) → RED (isolated) → BLACK (blackout).
 *     Severity may only be RAISED by Jarvis or by voice. Never lowered.
 *   - Restart does not bypass lockdown. Escape does not bypass Blackout.
 *     Blackout cannot be hidden. BLACK state persists outside Jarvis-writable
 *     storage; recovery is a separate authenticated human workflow.
 *   - Deterministic: no generative-AI dependency anywhere in the enforcement
 *     path. Enforced at authoring time in eslint.config.js.
 *   - The audit log is append-only and not editable or deletable from the UI.
 *   - Forge and Ledger may READ the level. Neither may write it.
 *
 * Known gap to state plainly when it ships: in Phase 1 the boundary is
 * application-layer, not OS-layer. See docs/KNOWN-LIMITATIONS.md.
 */

export {};
