import { z } from 'zod';

/**
 * Venture-portfolio contracts — the "Road To Freedom" demo's payload shapes
 * (plan `docs/superpowers/plans/2026-07-17-experience-prototype-plan.md` §3).
 *
 * `Venture.name` covers the official long-term modules named in CLAUDE.md §7
 * (BCI Agent, Vanguard Performance Labs, Peptastic, Sophisticated Sips) —
 * **names only**. No business data, no clinical/financial logic, no per-module
 * behavior: those modules are NOT IMPLEMENTED and this schema does not imply
 * otherwise.
 */

export const VENTURE_PHASES = ['concept', 'foundation', 'build', 'launch', 'operating'] as const;

export const VENTURE_HEALTH = ['healthy', 'attention', 'critical'] as const;

export const VentureSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    phase: z.enum(VENTURE_PHASES),
    health: z.enum(VENTURE_HEALTH),
  })
  .strict();

export type Venture = z.infer<typeof VentureSchema>;

/** Direction of an automation metric since the last sample — mock data only. */
export const TRENDS = ['up', 'flat', 'down'] as const;

export const AutomationProgressSchema = z
  .object({
    area: z.string().min(1),
    percentAutomated: z.number().min(0).max(100),
    trend: z.enum(TRENDS),
  })
  .strict();

export type AutomationProgress = z.infer<typeof AutomationProgressSchema>;

export const TimeRecoveredSchema = z
  .object({
    hoursPerWeek: z.number().min(0),
    series: z
      .array(
        z
          .object({
            label: z.string().min(1),
            hours: z.number().min(0),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type TimeRecovered = z.infer<typeof TimeRecoveredSchema>;

export const GrowthRoadmapSchema = z
  .object({
    horizon: z.string().min(1),
    milestones: z
      .array(
        z
          .object({
            title: z.string().min(1),
            target: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type GrowthRoadmap = z.infer<typeof GrowthRoadmapSchema>;
