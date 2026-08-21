import { describe, expect, it } from 'vitest';

import { MAX_OWNER_BRAIN_BYTES, validateOwnerBrain } from './project-zero-owner-brain.mjs';

describe('Project Zero owner brain', () => {
  it('accepts compact UTF-8 owner context', () => {
    expect(validateOwnerBrain('# WILLIAM BRAIN\r\n\r\nKeep project lanes separate.\r\n')).toBe(
      '# WILLIAM BRAIN\n\nKeep project lanes separate.',
    );
  });

  it('rejects empty owner context', () => {
    expect(() => validateOwnerBrain('')).toThrow('WILLIAM-BRAIN input is empty.');
  });

  it('rejects an owner brain that would defeat the compact startup budget', () => {
    expect(() => validateOwnerBrain('x'.repeat(MAX_OWNER_BRAIN_BYTES + 1))).toThrow(
      'WILLIAM-BRAIN exceeds',
    );
  });
});
