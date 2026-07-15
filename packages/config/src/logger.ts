/**
 * Structured logging.
 *
 * Deliberately dependency-free and small. Per SECURITY-BOUNDARIES.md, no secret
 * may reach a log, so the logging surface is one of the places a leak can happen
 * and is worth owning outright rather than delegating to a library whose
 * serializer we would then have to audit.
 *
 * This is transport-only: it emits structured JSON lines to stdout/stderr. It
 * does NOT redact automatically — it cannot know which of your fields is a
 * secret. Callers pass values through `describeEnv` (or omit them) before
 * logging. An automatic redactor here would create false confidence.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogRecord {
  readonly level: LogLevel;
  readonly time: string;
  readonly scope: string;
  readonly message: string;
  readonly fields?: Readonly<Record<string, unknown>> | undefined;
}

export interface Logger {
  readonly debug: (message: string, fields?: Record<string, unknown>) => void;
  readonly info: (message: string, fields?: Record<string, unknown>) => void;
  readonly warn: (message: string, fields?: Record<string, unknown>) => void;
  readonly error: (message: string, fields?: Record<string, unknown>) => void;
  readonly child: (childScope: string) => Logger;
}

export interface LoggerOptions {
  readonly scope: string;
  readonly minLevel?: LogLevel;
  readonly sink?: (record: LogRecord) => void;
}

const defaultSink = (record: LogRecord): void => {
  const line = JSON.stringify(record);
  if (record.level === 'error' || record.level === 'warn') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
};

export function createLogger(options: LoggerOptions): Logger {
  const { scope, minLevel = 'info', sink = defaultSink } = options;
  const threshold = LEVEL_ORDER[minLevel];

  const emit = (level: LogLevel, message: string, fields?: Record<string, unknown>): void => {
    if (LEVEL_ORDER[level] < threshold) return;

    sink({
      level,
      time: new Date().toISOString(),
      scope,
      message,
      fields,
    });
  };

  return {
    debug: (message, fields) => {
      emit('debug', message, fields);
    },
    info: (message, fields) => {
      emit('info', message, fields);
    },
    warn: (message, fields) => {
      emit('warn', message, fields);
    },
    error: (message, fields) => {
      emit('error', message, fields);
    },
    child: (childScope) => createLogger({ ...options, scope: `${scope}:${childScope}` }),
  };
}
