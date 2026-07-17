import { z } from 'zod';
import { OrbStateSchema } from './orb.js';
import {
  ActionPlanSchema,
  MeetingBriefSchema,
  PreparedEmailSchema,
  ProjectSchema,
  RiskSchema,
} from './mission-control.js';
import {
  AutomationProgressSchema,
  GrowthRoadmapSchema,
  TimeRecoveredSchema,
  VentureSchema,
} from './ventures.js';

/**
 * Demo script contracts — the data that drives the DemoPlayer
 * (plan `docs/superpowers/plans/2026-07-17-experience-prototype-plan.md` §3).
 * "Prepare Me For Work" and "The Road To Freedom" are `DemoScript` data files,
 * not components; the DemoPlayer renders any script that parses against this
 * schema.
 */

/** One scene's payload — a closed union over every demo panel shape. */
export const DemoPanelSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('projects'),
      projects: z.array(ProjectSchema).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('risks'),
      risks: z.array(RiskSchema).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('meetingBrief'),
      brief: MeetingBriefSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('preparedEmails'),
      emails: z.array(PreparedEmailSchema).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('actionPlan'),
      plan: ActionPlanSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('ventures'),
      ventures: z.array(VentureSchema).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('automationProgress'),
      items: z.array(AutomationProgressSchema).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('timeRecovered'),
      timeRecovered: TimeRecoveredSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('growthRoadmap'),
      roadmap: GrowthRoadmapSchema,
    })
    .strict(),
]);

export type DemoPanel = z.infer<typeof DemoPanelSchema>;

/**
 * `panels` may be empty — a wake scene narrates and animates the Orb with no
 * data panel at all. `advance === 'auto'` without `durationMs` is rejected: an
 * auto-advancing scene must know how long it lasts, or the DemoPlayer has
 * nothing to schedule against.
 */
export const DemoSceneSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    orbState: OrbStateSchema,
    narration: z.string().min(1),
    advance: z.enum(['auto', 'manual']),
    durationMs: z.number().int().positive().optional(),
    panels: z.array(DemoPanelSchema),
  })
  .strict()
  .superRefine((scene, ctx) => {
    if (scene.advance === 'auto' && scene.durationMs === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'An auto-advancing scene must set durationMs.',
        path: ['durationMs'],
      });
    }
  });

export type DemoScene = z.infer<typeof DemoSceneSchema>;

/**
 * `mockDisclosure` is the schema-enforced honesty rule (plan §1): a script
 * that does not declare itself mock does not parse. The DemoPlayer renders a
 * persistent `SCRIPTED DEMO · MOCK DATA` watermark from it (CLAUDE.md §6
 * guardrail — every live-looking metric, feed, and control in a demo is
 * mocked sample data and must be labeled as such).
 */
export const DemoScriptSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    mockDisclosure: z.literal(true),
    scenes: z.array(DemoSceneSchema).min(1),
  })
  .strict();

export type DemoScript = z.infer<typeof DemoScriptSchema>;
