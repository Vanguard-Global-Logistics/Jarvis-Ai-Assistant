import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  appendObservation,
  buildDailyImprovementReport,
  createObservation,
  parseObservationJsonLines,
  runDailyImprovement,
  validateObservation,
} from "../jarvis-hermes/scripts/daily-improvement-loop.mjs";

const NOW = new Date("2026-08-09T12:00:00.000Z");

function observation(overrides = {}) {
  return createObservation(
    {
      id: overrides.id ?? `event-${Math.random().toString(16).slice(2)}`,
      observedAt: overrides.observedAt ?? "2026-08-08T12:00:00.000Z",
      profileId: "william",
      sourceType: "owner-feedback",
      category: "repetition",
      taskKey: "job.daily-report",
      summary: "Repeated governed workflow",
      evidenceRef: overrides.evidenceRef ?? "session:test",
      sensitivity: "personal",
      outcome: "success",
      ...overrides,
    },
    NOW,
  );
}

describe("daily continual-improvement policy", () => {
  it("creates a proposed skill candidate after three repetitions in seven days", () => {
    const report = buildDailyImprovementReport(
      [
        observation({ id: "one" }),
        observation({ id: "two" }),
        observation({ id: "three" }),
      ],
      { now: NOW, profileId: "william" },
    );

    expect(report.proposals).toHaveLength(1);
    expect(report.proposals[0]).toMatchObject({
      taskKey: "job.daily-report",
      kind: "skill-candidate",
      status: "proposed",
      autoPromote: false,
      requiredGates: ["owner-approval", "sandbox-test", "rollback-proof"],
    });
    expect(report.promoted).toEqual([]);
  });

  it("blocks high-risk changes behind architecture and AEGIS gates", () => {
    const report = buildDailyImprovementReport(
      [
        observation({
          id: "one",
          taskKey: "aegis.policy",
          category: "failure",
          outcome: "failure",
        }),
        observation({
          id: "two",
          taskKey: "aegis.policy",
          category: "failure",
          outcome: "failure",
        }),
      ],
      { now: NOW, profileId: "william" },
    );

    expect(report.proposals[0]).toMatchObject({
      status: "blocked-pending-architecture",
      risk: "high",
      autoPromote: false,
    });
    expect(report.proposals[0].requiredGates).toContain("aegis-boundary");
    expect(report.proposals[0].requiredGates).toContain("independent-review");
  });

  it("keeps other profiles and expired observations out of William reports", () => {
    const report = buildDailyImprovementReport(
      [
        observation({ id: "old-1", observedAt: "2026-07-01T12:00:00.000Z" }),
        observation({ id: "amy-1", profileId: "amy" }),
        observation({ id: "valid-1" }),
      ],
      { now: NOW, profileId: "william" },
    );

    expect(report.observationCount).toBe(1);
    expect(report.proposals).toEqual([]);
  });

  it("rejects secret-like material and unsupported transcript fields", () => {
    expect(() =>
      observation({ summary: "password=do-not-store-this" }),
    ).toThrow(/secret/);
    expect(() =>
      validateObservation({
        ...observation(),
        transcript: "raw speech should not be stored",
      }),
    ).toThrow(/unsupported fields/);
  });

  it("fails closed on malformed JSONL instead of silently dropping evidence", () => {
    expect(() =>
      parseObservationJsonLines(`${JSON.stringify(observation())}\nnot-json\n`),
    ).toThrow(/line 2/);
  });

  it("writes private reports and never writes a promotion record", () => {
    const stateRoot = mkdtempSync(join(tmpdir(), "jarvis-learning-"));
    const eventPath = join(stateRoot, "observations.jsonl");
    for (const id of ["one", "two", "three"])
      appendObservation(eventPath, observation({ id }));

    const report = runDailyImprovement({
      stateRoot,
      now: NOW,
      profileId: "william",
    });
    const stored = JSON.parse(
      readFileSync(join(stateRoot, "last-run.json"), "utf8"),
    );

    expect(report.proposals).toHaveLength(1);
    expect(stored.proposals).toHaveLength(1);
    expect(stored.promoted).toEqual([]);
  });
});
