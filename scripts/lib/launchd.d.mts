/**
 * Types for the launchd plist builders behind `npm run install:autostart`
 * (ADR 0033).
 *
 * Implementation stays JavaScript — `scripts/*.mjs` run under bare `node` with
 * no build step. Declaring the shape here means the test can exercise it under
 * the same strict settings as the rest of the codebase.
 */

export interface PlistSpec {
  readonly label: string;
  readonly npmPath: string;
  readonly npmScript: string;
  readonly repoDir: string;
  readonly logPath: string;
  readonly keepAlive?: boolean;
  readonly startIntervalSeconds?: number;
}

export declare function buildPlist(spec: PlistSpec): string;

export interface Agent {
  readonly filename: string;
  readonly content: string;
}

export declare function buildAgents(spec: {
  readonly repoDir: string;
  readonly npmPath: string;
  readonly logsDir: string;
}): readonly Agent[];
