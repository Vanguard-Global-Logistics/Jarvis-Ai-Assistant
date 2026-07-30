import { describe, expect, it } from 'vitest';
import { ModelRefusalError } from '@jarvis/jarvis-core';
import { toSafeModelError } from './model-error.js';

/**
 * The sanitiser is a security control, not a convenience: it stands between a
 * raw SDK error (which can carry a URL, headers, or a slice of the outbound
 * payload) and the main-process log line. These tests assert the one property
 * that matters — the returned message is a fixed category and never contains
 * anything from the original error.
 */
describe('toSafeModelError', () => {
  it('maps a model refusal to a named, non-incident category', () => {
    const safe = toSafeModelError(new ModelRefusalError());
    expect(safe.message).toBe('model declined the request');
  });

  it('collapses every other failure to one opaque category', () => {
    const safe = toSafeModelError(new Error('boom'));
    expect(safe.message).toBe('model call failed');
  });

  it('never interpolates the original message — even a sensitive one', () => {
    // A deliberately sensitive-looking SDK error. None of it may survive into
    // the message that gets logged.
    const leaky = new Error(
      '401 from https://api.anthropic.com/v1/messages — x-api-key sk-ant-SECRET was rejected',
    );
    const safe = toSafeModelError(leaky);

    expect(safe.message).toBe('model call failed');
    expect(safe.message).not.toContain('anthropic.com');
    expect(safe.message).not.toContain('sk-ant');
    expect(safe.message).not.toContain('401');
  });

  it('preserves the original as `cause` for a local debugger, off the message', () => {
    const original = new Error('internal detail that must not be logged');
    const safe = toSafeModelError(original);
    expect(safe.cause).toBe(original);
  });

  it('handles a non-Error throw without leaking it', () => {
    const safe = toSafeModelError('a bare string with secrets: sk-ant-XYZ');
    expect(safe.message).toBe('model call failed');
    expect(safe.message).not.toContain('sk-ant');
  });
});
