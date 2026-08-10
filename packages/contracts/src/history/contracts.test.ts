import { describe, expect, it } from 'vitest';
import {
  DeleteSessionResultSchema,
  SaveSessionRequestSchema,
  SavedSessionSummarySchema,
  SessionIdRequestSchema,
} from './contracts.js';

const valid = {
  id: 'session-1',
  name: 'First work session',
  createdAt: '2026-08-10T05:00:00.000Z',
  updatedAt: '2026-08-10T05:00:00.000Z',
  messages: [
    { role: 'user' as const, content: 'Help me plan the work.' },
    {
      role: 'assistant' as const,
      content: 'Here is the plan.',
      provider: 'mock' as const,
    },
  ],
};

describe('SaveSessionRequestSchema', () => {
  it('accepts a bounded, explicitly named transcript', () => {
    expect(SaveSessionRequestSchema.parse(valid)).toEqual(valid);
  });

  it('rejects empty history, malformed timestamps, and extra authority fields', () => {
    expect(SaveSessionRequestSchema.safeParse({ ...valid, messages: [] }).success).toBe(false);
    expect(SaveSessionRequestSchema.safeParse({ ...valid, createdAt: 'today' }).success).toBe(
      false,
    );
    expect(
      SaveSessionRequestSchema.safeParse({ ...valid, path: '/tmp/session.json' }).success,
    ).toBe(false);
  });

  it('requires every assistant message to name a supported provider', () => {
    expect(
      SaveSessionRequestSchema.safeParse({
        ...valid,
        messages: [{ role: 'assistant', content: 'Unlabeled output.' }],
      }).success,
    ).toBe(false);
    expect(
      SaveSessionRequestSchema.safeParse({
        ...valid,
        messages: [{ role: 'assistant', content: 'Unknown output.', provider: 'unknown' }],
      }).success,
    ).toBe(false);
  });
});

describe('history result schemas', () => {
  it('bounds summaries and exact id requests', () => {
    expect(
      SavedSessionSummarySchema.safeParse({
        id: valid.id,
        name: valid.name,
        createdAt: valid.createdAt,
        updatedAt: valid.updatedAt,
        messageCount: 2,
      }).success,
    ).toBe(true);
    expect(SessionIdRequestSchema.safeParse({ id: valid.id, extra: true }).success).toBe(false);
  });

  it('returns only a deletion result, never a filesystem path or raw database error', () => {
    expect(DeleteSessionResultSchema.parse({ deleted: true })).toEqual({ deleted: true });
    expect(
      DeleteSessionResultSchema.safeParse({ deleted: true, path: '/private/db' }).success,
    ).toBe(false);
  });
});
