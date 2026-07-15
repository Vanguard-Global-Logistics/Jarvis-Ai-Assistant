/**
 * @jarvis/contracts — the single definition of every cross-boundary contract.
 *
 * STATUS: NOT IMPLEMENTED. This package is scaffolding only. No contracts are
 * defined yet, because defining them is design work that has not been approved.
 *
 * Why this package exists, and why it is empty rather than pre-filled:
 *
 * CLAUDE.md §3 requires no duplicated logic — "If a rule exists in two files, it
 * will drift, and for AEGIS rules, drift is a security failure." Every schema that
 * crosses a process, IPC, or storage boundary is defined here exactly once, and
 * every other workspace imports it. Nothing re-declares a shape it did not define.
 *
 * What will live here (none of it is written yet, and none of it is designed):
 *   - AEGIS level and transition schemas
 *   - Typed IPC message schemas for the Electron preload allowlist
 *   - Permission descriptors
 *   - Database record schemas
 *   - Model-provider request/response contracts
 *
 * Deliberately NOT started: writing the AEGIS level enum here would look like
 * progress on the security model while providing none of its enforcement. The
 * enum is the easy 1% of that work and would misrepresent the other 99%.
 * See CLAUDE.md §8.
 */

export {};
