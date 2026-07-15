/**
 * Preload — the only bridge between the untrusted renderer and the trusted main
 * process.
 *
 * STATUS: NOT IMPLEMENTED. It exposes NOTHING, and that is the finished state
 * for this stage, not an oversight.
 *
 * The audit (CURRENT-STATE-AUDIT.md §19) names this file as the single
 * highest-risk surface in Phase 1: an over-exposed bridge "silently reintroduces
 * the exact boundary violation the spec forbids." The safest bridge is an empty
 * one, so the foundation ships with zero attack surface and each channel has to
 * be argued for individually.
 *
 * The pattern every future channel must follow — no exceptions:
 *
 *   1. Define the request and response schemas in @jarvis/contracts (Zod).
 *   2. Register a named handler in main that validates the payload BEFORE acting.
 *      Reject on failure; never coerce.
 *   3. Expose ONE narrow, purpose-named function here. Never `invoke(channel,
 *      ...args)` — a generic passthrough hands the renderer the whole main
 *      process and makes the allowlist meaningless.
 *   4. Declare its type in ./index.d.ts so the renderer is typed against the
 *      real contract.
 *
 * Explicitly forbidden on this bridge, from SECURITY-BOUNDARIES.md and
 * CLAUDE.md §3: shell execution, arbitrary filesystem paths, raw SQL, secrets,
 * config patches, and anything that could lower an AEGIS level.
 *
 * `contextBridge` is intentionally not called yet — there is nothing to expose,
 * and exposing an empty namespace would only invite someone to fill it.
 */

export {};
