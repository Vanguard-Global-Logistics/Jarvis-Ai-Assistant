import { z } from 'zod';

/**
 * Mission Control contracts — the "Prepare Me For Work" demo's payload shapes
 * (plan `docs/superpowers/plans/2026-07-17-experience-prototype-plan.md` §3).
 *
 * Client-agnostic, same as the model contracts: no Electron types, no Date
 * objects. `dueDate` is an ISO date string rather than a `Date` so the schema
 * survives serialization across the IPC boundary and any future non-Electron
 * client unchanged.
 *
 * These are the same contracts a live Mission Control service must satisfy
 * later — the mock provider (`MockExperienceProvider`) is replaceable exactly
 * because both sides parse against the schemas defined here, once.
 */

/** Closed project lifecycle states. */
export const PROJECT_STATUSES = ['onTrack', 'atRisk', 'blocked', 'waiting', 'complete'] as const;

/** Shared severity scale — used by both `Project.riskLevel` and `Risk.severity`. */
export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

export const ProjectSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    client: z.string().min(1),
    urgency: z.number().int().min(1).max(5),
    status: z.enum(PROJECT_STATUSES),
    dueDate: z.string().min(1),
    riskLevel: z.enum(RISK_LEVELS),
  })
  .strict();

export type Project = z.infer<typeof ProjectSchema>;

export const RiskSchema = z
  .object({
    projectId: z.string().min(1),
    severity: z.enum(RISK_LEVELS),
    summary: z.string().min(1),
    mitigation: z.string().min(1),
  })
  .strict();

export type Risk = z.infer<typeof RiskSchema>;

export const MeetingBriefSchema = z
  .object({
    time: z.string().min(1),
    attendees: z.array(z.string().min(1)).min(1),
    objective: z.string().min(1),
    talkingPoints: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type MeetingBrief = z.infer<typeof MeetingBriefSchema>;

export const PreparedEmailSchema = z
  .object({
    to: z.string().min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
    intent: z.string().min(1),
  })
  .strict();

export type PreparedEmail = z.infer<typeof PreparedEmailSchema>;

export const ActionPlanSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            title: z.string().min(1),
            why: z.string().min(1),
            estimateMin: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type ActionPlan = z.infer<typeof ActionPlanSchema>;
