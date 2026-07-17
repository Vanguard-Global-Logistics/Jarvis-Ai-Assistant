import { z } from 'zod';

/**
 * Orb state contract — the single visual focus of the Jarvis experience
 * (plan `docs/superpowers/plans/2026-07-17-experience-prototype-plan.md` §3).
 *
 * The eleven states are a closed set: adding a twelfth is a deliberate design
 * act, not a runtime value. `aegisLockdown` is a **demo-only visual state** —
 * AEGIS is NOT IMPLEMENTED (`docs/KNOWN-LIMITATIONS.md` §1), and nothing
 * outside a labeled demo (`DemoScriptSchema.mockDisclosure`) may render it or
 * otherwise imply a real AEGIS state engine exists.
 */
export const ORB_STATES = [
  'idle',
  'wake',
  'listening',
  'thinking',
  'reasoning',
  'speaking',
  'success',
  'warning',
  'critical',
  'offline',
  'aegisLockdown',
] as const;

export const OrbStateSchema = z.enum(ORB_STATES);

export type OrbState = z.infer<typeof OrbStateSchema>;
