/**
 * @jarvis/config — environment validation and structured logging.
 *
 * STATUS: IMPLEMENTED AND VERIFIED (unit tests only — no integration exists to
 * exercise it yet, because nothing consumes it).
 *
 * This package is main-process/services only. It must never be imported by the
 * renderer: it reads `process.env`, and secrets are server-side only
 * (CLAUDE.md §3). That restriction is enforced in eslint.config.js.
 */

export { EnvValidationError, SECRET_KEYS, describeEnv, parseEnv, requireEnv } from './env.js';
export type { Env } from './env.js';

export { createLogger } from './logger.js';
export type { LogLevel, LogRecord, Logger, LoggerOptions } from './logger.js';
