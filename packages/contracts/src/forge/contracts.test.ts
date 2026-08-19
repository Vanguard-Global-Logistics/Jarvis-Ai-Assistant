import { describe, expect, it } from 'vitest';
import {
  ApproveForgeItemRequestSchema,
  CreateForgeItemRequestSchema,
  FORGE_DETAIL_MAX_LENGTH,
  FORGE_TITLE_MAX_LENGTH,
  ForgeItemSchema,
  RecordEvidenceRequestSchema,
} from './contracts.js';

const validItem = {
  id: '00000000-0000-4000-8000-000000000000',
  title: 'Ship the punchlist',
  claimedAt: null,
  claimedDetail: null,
  committedAt: null,
  committedRef: null,
  testsPassedAt: null,
  testsDetail: null,
  previewedAt: null,
  previewUrl: null,
  approvedAt: null,
  approvedBy: null,
  createdAt: '2026-08-18T00:00:00.000Z',
  updatedAt: '2026-08-18T00:00:00.000Z',
};

describe('ForgeItemSchema', () => {
  it('accepts a well-formed item with every fact unset', () => {
    expect(ForgeItemSchema.parse(validItem)).toEqual(validItem);
  });

  it('rejects a title over the length cap', () => {
    const result = ForgeItemSchema.safeParse({
      ...validItem,
      title: 'x'.repeat(FORGE_TITLE_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown field', () => {
    const result = ForgeItemSchema.safeParse({ ...validItem, extra: 'nope' });
    expect(result.success).toBe(false);
  });

  it('accepts committedRef at the FULL evidence-detail length a "committed" record-evidence call can send', () => {
    // Regression for a blocking finding: committedRef was once capped at a
    // literal 200 while RecordEvidenceRequestSchema.detail (written straight
    // into committedRef by the store) allowed up to FORGE_DETAIL_MAX_LENGTH —
    // a committed evidence call between 201 and 2000 chars wrote a row this
    // schema then rejected on every subsequent read, bricking forge:list for
    // every item, not just the offending one. The two bounds must agree.
    const result = ForgeItemSchema.safeParse({
      ...validItem,
      committedRef: 'x'.repeat(FORGE_DETAIL_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });
});

describe('CreateForgeItemRequestSchema', () => {
  it('accepts a title only', () => {
    const result = CreateForgeItemRequestSchema.safeParse({ title: 'A new item' });
    expect(result.success).toBe(true);
  });

  it('has no field for any of the five facts — a renderer cannot smuggle one in', () => {
    const result = CreateForgeItemRequestSchema.safeParse({
      title: 'A new item',
      approvedAt: '2026-08-18T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('RecordEvidenceRequestSchema — the shared four-fact channel', () => {
  it('accepts one of the four automatable-ish facts', () => {
    for (const fact of ['claimed', 'committed', 'testsPassed', 'previewed'] as const) {
      const result = RecordEvidenceRequestSchema.safeParse({
        id: validItem.id,
        fact,
        detail: 'evidence',
      });
      expect(result.success, fact).toBe(true);
    }
  });

  it('has NO way to name "approved" — the boundary this whole module exists to hold', () => {
    const result = RecordEvidenceRequestSchema.safeParse({
      id: validItem.id,
      fact: 'approved',
    });
    expect(result.success).toBe(false);
  });

  it('has no approvedBy field at all', () => {
    const result = RecordEvidenceRequestSchema.safeParse({
      id: validItem.id,
      fact: 'claimed',
      approvedBy: 'William',
    });
    expect(result.success).toBe(false);
  });
});

describe('ApproveForgeItemRequestSchema — the ONLY approval-shaped request', () => {
  it('accepts an id and who approved it', () => {
    const result = ApproveForgeItemRequestSchema.safeParse({
      id: validItem.id,
      approvedBy: 'William',
    });
    expect(result.success).toBe(true);
  });

  it('requires a non-empty approvedBy', () => {
    const result = ApproveForgeItemRequestSchema.safeParse({ id: validItem.id, approvedBy: '' });
    expect(result.success).toBe(false);
  });

  it('cannot also set any of the other four facts', () => {
    const result = ApproveForgeItemRequestSchema.safeParse({
      id: validItem.id,
      approvedBy: 'William',
      testsPassedAt: '2026-08-18T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});
