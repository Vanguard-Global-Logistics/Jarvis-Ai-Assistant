#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const OBSERVATION_SOURCE_TYPES = [
  "voice-turn",
  "tool-result",
  "owner-feedback",
  "runtime-metric",
  "manual",
];

export const OBSERVATION_CATEGORIES = [
  "success",
  "failure",
  "correction",
  "repetition",
  "latency",
  "preference",
];

export const OBSERVATION_OUTCOMES = ["success", "partial", "failure"];
export const OBSERVATION_SENSITIVITIES = ["public", "personal", "sensitive"];

const ALLOWED_OBSERVATION_KEYS = new Set([
  "schemaVersion",
  "id",
  "observedAt",
  "profileId",
  "sourceType",
  "category",
  "taskKey",
  "summary",
  "evidenceRef",
  "sensitivity",
  "outcome",
  "latencyMs",
]);

const SECRET_LIKE =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:api[_ -]?key|password|passwd|secret|bearer|access[_ -]?token|refresh[_ -]?token)\b\s*[:=]/i;
const SAFE_KEY = /^[a-z0-9][a-z0-9._:-]{1,159}$/;
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,127}$/;
const HIGH_RISK_TASK =
  /(?:^|[.:-])(?:aegis|identity|biometric|credential|secret|payment|spending|financial|policy|permission|send|email|deploy|download|shell|external)(?:$|[.:-])/i;

function requirePlainObject(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

function requireString(value, name, maximum) {
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maximum) {
    throw new Error(`${name} must contain 1-${maximum} characters`);
  }
  return trimmed;
}

function requireEnum(value, name, values) {
  if (!values.includes(value)) throw new Error(`${name} is invalid`);
  return value;
}

function requireTimestamp(value, name) {
  const timestamp = requireString(value, name, 64);
  if (!Number.isFinite(Date.parse(timestamp)))
    throw new Error(`${name} must be a timestamp`);
  return new Date(timestamp).toISOString();
}

function boundedOptionalString(value, name, maximum) {
  if (value === undefined) return undefined;
  return requireString(value, name, maximum);
}

export function validateObservation(value) {
  const raw = requirePlainObject(value, "observation");
  const unknown = Object.keys(raw).filter(
    (key) => !ALLOWED_OBSERVATION_KEYS.has(key),
  );
  if (unknown.length > 0)
    throw new Error(
      `observation contains unsupported fields: ${unknown.join(", ")}`,
    );
  if (raw.schemaVersion !== 1) throw new Error("schemaVersion must be 1");

  const observation = {
    schemaVersion: 1,
    id: requireString(raw.id, "id", 128),
    observedAt: requireTimestamp(raw.observedAt, "observedAt"),
    profileId: requireString(raw.profileId, "profileId", 128),
    sourceType: requireEnum(
      raw.sourceType,
      "sourceType",
      OBSERVATION_SOURCE_TYPES,
    ),
    category: requireEnum(raw.category, "category", OBSERVATION_CATEGORIES),
    taskKey: requireString(raw.taskKey, "taskKey", 160),
    summary: requireString(raw.summary, "summary", 280),
    evidenceRef: requireString(raw.evidenceRef, "evidenceRef", 512),
    sensitivity: requireEnum(
      raw.sensitivity,
      "sensitivity",
      OBSERVATION_SENSITIVITIES,
    ),
    outcome: requireEnum(raw.outcome, "outcome", OBSERVATION_OUTCOMES),
    ...(raw.latencyMs === undefined ? {} : { latencyMs: raw.latencyMs }),
  };

  if (!SAFE_ID.test(observation.id)) throw new Error("id must be normalized");
  if (!SAFE_ID.test(observation.profileId))
    throw new Error("profileId must be normalized");
  if (!SAFE_KEY.test(observation.taskKey))
    throw new Error("taskKey must be normalized");
  if (
    SECRET_LIKE.test(observation.summary) ||
    SECRET_LIKE.test(observation.evidenceRef)
  ) {
    throw new Error("observation appears to contain secret material");
  }
  if (
    observation.latencyMs !== undefined &&
    (!Number.isFinite(observation.latencyMs) ||
      observation.latencyMs < 0 ||
      observation.latencyMs > 3_600_000)
  ) {
    throw new Error("latencyMs is invalid");
  }

  return Object.freeze(observation);
}

export function createObservation(input, now = new Date()) {
  return validateObservation({
    schemaVersion: 1,
    id: input.id ?? randomUUID(),
    observedAt: input.observedAt ?? now.toISOString(),
    ...input,
  });
}

export function parseObservationJsonLines(source) {
  const observations = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      observations.push(validateObservation(JSON.parse(line)));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`invalid observation on line ${index + 1}: ${message}`);
    }
  }
  return observations;
}

function candidateId(profileId, taskKey, kind, windowEnd) {
  const digest = createHash("sha256")
    .update(`${profileId}\0${taskKey}\0${kind}\0${windowEnd}`)
    .digest("hex")
    .slice(0, 16);
  return `improvement-${digest}`;
}

function classifyCandidate(group) {
  if (group.categories.has("latency")) return "performance-test";
  if (group.categories.has("correction")) return "prompt-or-skill-review";
  if (group.categories.has("failure")) return "reliability-review";
  return "skill-candidate";
}

function reasonFor(group) {
  if (group.categories.has("correction"))
    return `${group.corrections} owner corrections recorded`;
  if (group.categories.has("failure"))
    return `${group.failures} failures recorded`;
  if (group.categories.has("latency"))
    return `${group.latencies.length} latency observations recorded`;
  return `${group.total} repetitions recorded`;
}

function candidateThresholdMet(group) {
  if (group.corrections >= 2) return true;
  if (group.failures >= 2) return true;
  if (group.repetitions >= 3) return true;
  if (group.latencies.length >= 3) return true;
  return false;
}

export function buildDailyImprovementReport(observations, options = {}) {
  const now =
    options.now instanceof Date
      ? options.now
      : new Date(options.now ?? Date.now());
  if (!Number.isFinite(now.getTime()))
    throw new Error("now must be a valid date");
  const lookbackDays = Math.max(
    1,
    Math.min(30, Math.trunc(options.lookbackDays ?? 7)),
  );
  const start = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const profileId = options.profileId ?? "william";
  if (!SAFE_ID.test(profileId)) throw new Error("profileId must be normalized");

  const eligible = observations
    .map((item) => validateObservation(item))
    .filter((item) => item.profileId === profileId)
    .filter((item) => {
      const observed = Date.parse(item.observedAt);
      return observed >= start.getTime() && observed <= now.getTime();
    });

  const groups = new Map();
  for (const observation of eligible) {
    let group = groups.get(observation.taskKey);
    if (!group) {
      group = {
        taskKey: observation.taskKey,
        total: 0,
        failures: 0,
        corrections: 0,
        repetitions: 0,
        latencies: [],
        categories: new Set(),
        evidenceRefs: new Set(),
      };
      groups.set(observation.taskKey, group);
    }
    group.total += 1;
    group.categories.add(observation.category);
    group.evidenceRefs.add(observation.evidenceRef);
    if (observation.category === "failure" || observation.outcome === "failure")
      group.failures += 1;
    if (observation.category === "correction") group.corrections += 1;
    if (observation.category === "repetition") group.repetitions += 1;
    if (observation.latencyMs !== undefined)
      group.latencies.push(observation.latencyMs);
  }

  const generatedAt = now.toISOString();
  const proposals = [...groups.values()]
    .filter(candidateThresholdMet)
    .sort((left, right) => left.taskKey.localeCompare(right.taskKey))
    .map((group) => {
      const kind = classifyCandidate(group);
      const highRisk = HIGH_RISK_TASK.test(group.taskKey);
      const averageLatencyMs =
        group.latencies.length === 0
          ? undefined
          : Math.round(
              group.latencies.reduce((sum, value) => sum + value, 0) /
                group.latencies.length,
            );
      return {
        schemaVersion: 1,
        id: candidateId(
          profileId,
          group.taskKey,
          kind,
          generatedAt.slice(0, 10),
        ),
        profileId,
        taskKey: group.taskKey,
        kind,
        status: highRisk ? "blocked-pending-architecture" : "proposed",
        risk: highRisk ? "high" : "low",
        reason: reasonFor(group),
        observationCount: group.total,
        ...(averageLatencyMs === undefined ? {} : { averageLatencyMs }),
        evidenceRefs: [...group.evidenceRefs].sort().slice(0, 20),
        requiredGates: highRisk
          ? [
              "owner-approval",
              "independent-review",
              "sandbox-test",
              "rollback-proof",
              "aegis-boundary",
            ]
          : ["owner-approval", "sandbox-test", "rollback-proof"],
        autoPromote: false,
      };
    });

  return {
    schemaVersion: 1,
    generatedAt,
    profileId,
    window: { start: start.toISOString(), end: generatedAt, lookbackDays },
    observationCount: eligible.length,
    proposals,
    promoted: [],
    invariant:
      "This loop produces evidence-backed proposals only; it never changes live code, policy, identity, permissions, AEGIS, credentials, or external actions.",
  };
}

function ensurePrivateDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
}

function atomicWriteJson(path, value) {
  ensurePrivateDirectory(dirname(path));
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(temporary, 0o600);
  renameSync(temporary, path);
}

export function appendObservation(path, observation) {
  const validated = validateObservation(observation);
  ensurePrivateDirectory(dirname(path));
  appendFileSync(path, `${JSON.stringify(validated)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodSync(path, 0o600);
  return validated;
}

export function runDailyImprovement(options = {}) {
  const stateRoot = resolve(
    options.stateRoot ?? join(homedir(), ".jarvis", "continual-learning"),
  );
  const observationPath = join(stateRoot, "observations.jsonl");
  let observations = [];
  try {
    observations = parseObservationJsonLines(
      readFileSync(observationPath, "utf8"),
    );
  } catch (cause) {
    if (cause && typeof cause === "object" && cause.code === "ENOENT")
      observations = [];
    else throw cause;
  }
  const report = buildDailyImprovementReport(observations, options);
  const date = report.generatedAt.slice(0, 10);
  atomicWriteJson(join(stateRoot, "reports", `${date}.json`), report);
  atomicWriteJson(join(stateRoot, "last-run.json"), report);
  return report;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--state-root") options.stateRoot = argv[++index];
    else if (argument === "--profile") options.profileId = argv[++index];
    else if (argument === "--now") options.now = new Date(argv[++index]);
    else if (argument === "--observe-json") options.observeJson = argv[++index];
    else if (argument === "--run") options.run = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

function main(argv) {
  const options = parseArguments(argv);
  const stateRoot = resolve(
    options.stateRoot ?? join(homedir(), ".jarvis", "continual-learning"),
  );
  if (options.observeJson !== undefined) {
    const observation = createObservation(
      JSON.parse(options.observeJson),
      options.now ?? new Date(),
    );
    appendObservation(join(stateRoot, "observations.jsonl"), observation);
    process.stdout.write(
      `${JSON.stringify({ stored: true, observationId: observation.id })}\n`,
    );
    return;
  }
  const report = runDailyImprovement(options);
  process.stdout.write(
    `${JSON.stringify({ observationCount: report.observationCount, proposalCount: report.proposals.length, report: join(stateRoot, "last-run.json") })}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main(process.argv.slice(2));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    process.stderr.write(`ERROR: ${message}\n`);
    process.exitCode = 1;
  }
}
