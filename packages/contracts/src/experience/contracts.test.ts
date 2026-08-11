import { describe, expect, it } from 'vitest';
import { ORB_STATES, OrbStateSchema } from './orb.js';
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
import { DemoPanelSchema, DemoScriptSchema } from './demo.js';

describe('OrbStateSchema', () => {
  it('has exactly twelve states', () => {
    expect(ORB_STATES.length).toBe(12);
  });

  it('accepts each of the twelve states', () => {
    for (const state of ORB_STATES) {
      expect(OrbStateSchema.safeParse(state).success).toBe(true);
    }
  });

  it('rejects an unknown state', () => {
    expect(OrbStateSchema.safeParse('excited').success).toBe(false);
  });
});

describe('ProjectSchema', () => {
  const valid = {
    id: 'proj-1',
    name: 'Warehouse rollout',
    client: 'Vanguard Global Logistics',
    urgency: 3,
    status: 'onTrack',
    dueDate: '2026-08-01',
    riskLevel: 'medium',
  };

  it('accepts a representative valid project', () => {
    expect(ProjectSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an extra field', () => {
    expect(ProjectSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
  });

  it('rejects urgency out of range (0 and 6)', () => {
    expect(ProjectSchema.safeParse({ ...valid, urgency: 0 }).success).toBe(false);
    expect(ProjectSchema.safeParse({ ...valid, urgency: 6 }).success).toBe(false);
  });
});

describe('RiskSchema', () => {
  const valid = {
    projectId: 'proj-1',
    severity: 'high',
    summary: 'Vendor slipping on delivery.',
    mitigation: 'Escalate to the account manager this week.',
  };

  it('accepts a representative valid risk', () => {
    expect(RiskSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an extra field', () => {
    expect(RiskSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
  });

  it('rejects an unknown severity', () => {
    expect(RiskSchema.safeParse({ ...valid, severity: 'severe' }).success).toBe(false);
  });
});

describe('MeetingBriefSchema', () => {
  const valid = {
    time: '09:00',
    attendees: ['William Lavold'],
    objective: 'Align on rollout timeline.',
    talkingPoints: ['Vendor risk', 'Budget check-in'],
  };

  it('accepts a representative valid brief', () => {
    expect(MeetingBriefSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an extra field', () => {
    expect(MeetingBriefSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
  });

  it('rejects an empty attendees list', () => {
    expect(MeetingBriefSchema.safeParse({ ...valid, attendees: [] }).success).toBe(false);
  });

  it('rejects an empty talking points list', () => {
    expect(MeetingBriefSchema.safeParse({ ...valid, talkingPoints: [] }).success).toBe(false);
  });
});

describe('PreparedEmailSchema', () => {
  const valid = {
    to: 'vendor@example.com',
    subject: 'Delivery timeline check-in',
    body: 'Can you confirm the revised delivery date?',
    intent: 'Escalate the vendor delay.',
  };

  it('accepts a representative valid email', () => {
    expect(PreparedEmailSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an extra field', () => {
    expect(PreparedEmailSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
  });
});

describe('ActionPlanSchema', () => {
  const valid = {
    items: [{ title: 'Call the vendor', why: 'Confirm slip', estimateMin: 15 }],
  };

  it('accepts a representative valid plan', () => {
    expect(ActionPlanSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an extra field on an item', () => {
    expect(
      ActionPlanSchema.safeParse({
        items: [{ ...valid.items[0], extra: true }],
      }).success,
    ).toBe(false);
  });

  it('rejects estimateMin of 0', () => {
    expect(
      ActionPlanSchema.safeParse({
        items: [{ ...valid.items[0], estimateMin: 0 }],
      }).success,
    ).toBe(false);
  });

  it('rejects an empty items list', () => {
    expect(ActionPlanSchema.safeParse({ items: [] }).success).toBe(false);
  });
});

describe('VentureSchema', () => {
  const valid = { id: 'bci', name: 'BCI Agent', phase: 'build', health: 'healthy' };

  it('accepts a representative valid venture', () => {
    expect(VentureSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an extra field', () => {
    expect(VentureSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
  });

  it('rejects an unknown phase', () => {
    expect(VentureSchema.safeParse({ ...valid, phase: 'sunset' }).success).toBe(false);
  });
});

describe('AutomationProgressSchema', () => {
  const valid = { area: 'Invoicing', percentAutomated: 62, trend: 'up' };

  it('accepts a representative valid entry', () => {
    expect(AutomationProgressSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an extra field', () => {
    expect(AutomationProgressSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
  });

  it('rejects percentAutomated of 101', () => {
    expect(AutomationProgressSchema.safeParse({ ...valid, percentAutomated: 101 }).success).toBe(
      false,
    );
  });
});

describe('TimeRecoveredSchema', () => {
  const valid = {
    hoursPerWeek: 6,
    series: [{ label: 'Week 1', hours: 4 }],
  };

  it('accepts a representative valid entry', () => {
    expect(TimeRecoveredSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an extra field', () => {
    expect(TimeRecoveredSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
  });

  it('rejects an empty series', () => {
    expect(TimeRecoveredSchema.safeParse({ ...valid, series: [] }).success).toBe(false);
  });
});

describe('GrowthRoadmapSchema', () => {
  const valid = {
    horizon: '12 months',
    milestones: [{ title: 'Launch Peptastic MVP', target: 'Q4 2026' }],
  };

  it('accepts a representative valid roadmap', () => {
    expect(GrowthRoadmapSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an extra field', () => {
    expect(GrowthRoadmapSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
  });

  it('rejects an empty milestones list', () => {
    expect(GrowthRoadmapSchema.safeParse({ ...valid, milestones: [] }).success).toBe(false);
  });
});

describe('DemoPanelSchema', () => {
  it('rejects an unknown panel kind', () => {
    expect(DemoPanelSchema.safeParse({ kind: 'unknown' }).success).toBe(false);
  });

  it('accepts a valid projects panel', () => {
    expect(
      DemoPanelSchema.safeParse({
        kind: 'projects',
        projects: [
          {
            id: 'proj-1',
            name: 'Warehouse rollout',
            client: 'Vanguard Global Logistics',
            urgency: 3,
            status: 'onTrack',
            dueDate: '2026-08-01',
            riskLevel: 'medium',
          },
        ],
      }).success,
    ).toBe(true);
  });
});

describe('DemoScriptSchema', () => {
  const projectsPanel = {
    kind: 'projects' as const,
    projects: [
      {
        id: 'proj-1',
        name: 'Warehouse rollout',
        client: 'Vanguard Global Logistics',
        urgency: 3,
        status: 'onTrack',
        dueDate: '2026-08-01',
        riskLevel: 'medium',
      },
    ],
  };

  const validScript = {
    id: 'prepare-me-for-work',
    title: 'Prepare Me For Work',
    mockDisclosure: true,
    scenes: [
      {
        id: 'wake',
        title: 'Wake',
        orbState: 'wake',
        narration: 'Good morning, William.',
        advance: 'auto',
        durationMs: 2000,
        panels: [],
      },
      {
        id: 'projects',
        title: 'Projects',
        orbState: 'reasoning',
        narration: 'Here is what needs attention today.',
        advance: 'manual',
        panels: [projectsPanel],
      },
    ],
  };

  it('accepts a valid script with one auto scene and one manual scene', () => {
    expect(DemoScriptSchema.safeParse(validScript).success).toBe(true);
  });

  it('rejects mockDisclosure: false', () => {
    expect(DemoScriptSchema.safeParse({ ...validScript, mockDisclosure: false }).success).toBe(
      false,
    );
  });

  it('rejects a missing mockDisclosure', () => {
    const { mockDisclosure: _omitted, ...withoutDisclosure } = validScript;
    expect(DemoScriptSchema.safeParse(withoutDisclosure).success).toBe(false);
  });

  it('rejects an auto scene without durationMs', () => {
    const badScene = { ...validScript.scenes[0], durationMs: undefined };
    expect(DemoScriptSchema.safeParse({ ...validScript, scenes: [badScene] }).success).toBe(false);
  });

  it('rejects an unknown panel kind inside a scene', () => {
    const badScene = {
      ...validScript.scenes[1],
      panels: [{ kind: 'mystery' }],
    };
    expect(DemoScriptSchema.safeParse({ ...validScript, scenes: [badScene] }).success).toBe(false);
  });

  it('rejects an empty scenes list', () => {
    expect(DemoScriptSchema.safeParse({ ...validScript, scenes: [] }).success).toBe(false);
  });
});
