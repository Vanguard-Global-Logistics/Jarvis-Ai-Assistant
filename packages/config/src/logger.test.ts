import { describe, expect, it } from 'vitest';
import type { LogRecord } from './logger.js';
import { createLogger } from './logger.js';

function collect(): { records: LogRecord[]; sink: (r: LogRecord) => void } {
  const records: LogRecord[] = [];
  return { records, sink: (r) => records.push(r) };
}

describe('createLogger', () => {
  it('emits a structured record with scope, level, and message', () => {
    const { records, sink } = collect();
    createLogger({ scope: 'aegis', sink }).info('level changed', { to: 'YELLOW' });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      level: 'info',
      scope: 'aegis',
      message: 'level changed',
      fields: { to: 'YELLOW' },
    });
  });

  it('suppresses records below the minimum level', () => {
    const { records, sink } = collect();
    const log = createLogger({ scope: 'test', minLevel: 'warn', sink });

    log.debug('ignored');
    log.info('ignored');
    log.warn('kept');
    log.error('kept');

    expect(records.map((r) => r.level)).toEqual(['warn', 'error']);
  });

  it('defaults to info level', () => {
    const { records, sink } = collect();
    const log = createLogger({ scope: 'test', sink });

    log.debug('ignored');
    log.info('kept');

    expect(records.map((r) => r.level)).toEqual(['info']);
  });

  it('namespaces child scopes', () => {
    const { records, sink } = collect();
    createLogger({ scope: 'desktop', sink }).child('main').info('ready');

    expect(records[0]?.scope).toBe('desktop:main');
  });

  it('stamps an ISO-8601 timestamp', () => {
    const { records, sink } = collect();
    createLogger({ scope: 'test', sink }).info('x');

    expect(records[0]?.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
