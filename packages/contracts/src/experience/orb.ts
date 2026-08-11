import { z } from 'zod';

/**
 * Orb state contract — the single visual focus of the Jarvis experience
 * (plan `docs/superpowers/plans/2026-07-17-experience-prototype-plan.md` §3).
 *
 * The twelve states are a closed set: adding a thirteenth is a deliberate
 * design act, not a runtime value.
 *
 * **Two of them are demo-only, and for the same reason.** A visual state that
 * nothing real can drive must never appear outside a labeled demo
 * (`DemoScriptSchema.mockDisclosure`), because an orb showing it is a claim
 * about what Jarvis is doing:
 *
 *   - `aegisLockdown` — AEGIS is NOT IMPLEMENTED (`docs/KNOWN-LIMITATIONS.md`
 *     §1). Rendering it outside a demo asserts a security engine exists.
 *   - `executing` — the sixth state on the approved Orb Family sheet
 *     (`docs/design/ORB-FAMILY.md`), amber/gold, "systems activate, energy
 *     transfers". Jarvis has no tools, no actions, and no orchestrator beyond a
 *     single stateless model call, so there is nothing for it to execute.
 *     Rendering it outside a demo asserts Jarvis is *doing* something to the
 *     world. It is coded now so the approved design is not lost, and it becomes
 *     a real state on the day something real drives it.
 */
export const ORB_STATES = [
  'idle',
  'wake',
  'listening',
  'thinking',
  'reasoning',
  'speaking',
  'executing',
  'success',
  'warning',
  'critical',
  'offline',
  'aegisLockdown',
] as const;

export const OrbStateSchema = z.enum(ORB_STATES);

export type OrbState = z.infer<typeof OrbStateSchema>;
