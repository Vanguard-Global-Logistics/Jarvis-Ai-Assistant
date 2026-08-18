/**
 * Types for the health checks behind `npm run health` (ADR 0033).
 *
 * Implementation stays JavaScript — `scripts/*.mjs` run under bare `node` with
 * no build step. Declaring the shape here means the test can exercise it under
 * the same strict settings as the rest of the codebase.
 */

export interface CheckResult {
  readonly ok: boolean;
  readonly detail: string;
}

export declare function checkNodeVersion(version?: string): CheckResult;
export declare function checkCommitsBehind(repoDir: string): CheckResult;
export declare function checkDependencies(repoDir: string): CheckResult;
export declare function defaultDatabasePath(
  platform?: string,
  home?: string,
  userDataDir?: string,
): string;
export declare function checkDatabase(dbPath: string): CheckResult;
export declare function checkEnvFile(repoDir: string): CheckResult;
export declare function checkDiskSpace(repoDir: string, minimumFreeBytes?: number): CheckResult;
export declare function runAllChecks(
  repoDir: string,
  dbPath?: string,
): readonly (readonly [string, CheckResult])[];
