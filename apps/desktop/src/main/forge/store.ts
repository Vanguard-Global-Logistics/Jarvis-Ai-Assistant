import { randomUUID } from 'node:crypto';
import type {
  ApproveForgeItemRequest,
  CreateForgeItemRequest,
  ForgeFact,
  ForgeItem,
  RecordEvidenceRequest,
} from '@jarvis/contracts';
import type { SqliteDatabase } from '@jarvis/database';
import { UserFacingError } from '../user-facing-error.js';

/**
 * The Forge store (`docs/architecture/forge-architecture.md`).
 *
 * The only write path to `forge_items`, in the only process that may open the
 * database — the same single-writer rule every other store in this app
 * follows (CLAUDE.md §3). `recordEvidence` and `approve` are separate
 * exported functions, never one function with a mode flag, because the
 * architecture doc's whole point is that approval must never be reachable
 * from the same call that sets the other four facts.
 */

interface ForgeItemRow {
  id: string;
  title: string;
  claimed_at: string | null;
  claimed_detail: string | null;
  committed_at: string | null;
  committed_ref: string | null;
  tests_passed_at: string | null;
  tests_detail: string | null;
  previewed_at: string | null;
  preview_url: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

const toForgeItem = (row: ForgeItemRow): ForgeItem => ({
  id: row.id,
  title: row.title,
  claimedAt: row.claimed_at,
  claimedDetail: row.claimed_detail,
  committedAt: row.committed_at,
  committedRef: row.committed_ref,
  testsPassedAt: row.tests_passed_at,
  testsDetail: row.tests_detail,
  previewedAt: row.previewed_at,
  previewUrl: row.preview_url,
  approvedAt: row.approved_at,
  approvedBy: row.approved_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Thrown when an id names no `ForgeItem`. `handleContract` shows the message as-is. */
export class ForgeItemNotFoundError extends UserFacingError {
  public constructor() {
    super('That item is no longer tracked.');
    this.name = 'ForgeItemNotFoundError';
  }
}

const SELECT_COLUMNS = `id, title, claimed_at, claimed_detail, committed_at, committed_ref,
       tests_passed_at, tests_detail, previewed_at, preview_url,
       approved_at, approved_by, created_at, updated_at`;

/** Every tracked item, newest-created first — Forge is a flat list in v1. */
export function listForgeItems(db: SqliteDatabase): ForgeItem[] {
  const rows = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM forge_items ORDER BY created_at DESC, rowid DESC`)
    .all() as unknown as ForgeItemRow[];
  return rows.map(toForgeItem);
}

/** One item by id, or `null` — a stale id is a normal outcome, not an error. */
export function getForgeItem(db: SqliteDatabase, id: string): ForgeItem | null {
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM forge_items WHERE id = ?`).get(id) as
    ForgeItemRow | undefined;
  return row === undefined ? null : toForgeItem(row);
}

/** Start tracking a new item. Title only — every fact starts unset. */
export function createForgeItem(db: SqliteDatabase, request: CreateForgeItemRequest): ForgeItem {
  const now = new Date().toISOString();
  const item: ForgeItem = {
    id: randomUUID(),
    title: request.title,
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
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(
    `INSERT INTO forge_items (id, title, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  ).run(item.id, item.title, item.createdAt, item.updatedAt);

  return item;
}

/**
 * Which columns each fact writes. A lookup table rather than a `switch`
 * because the write shape (two columns: an `_at` timestamp and a detail
 * field) is identical for all four — the exhaustiveness that matters here is
 * `ForgeFact`'s closed union, checked by `Record<ForgeFact, …>` below.
 */
const FACT_COLUMNS: Record<ForgeFact, { at: string; detail: string }> = {
  claimed: { at: 'claimed_at', detail: 'claimed_detail' },
  committed: { at: 'committed_at', detail: 'committed_ref' },
  testsPassed: { at: 'tests_passed_at', detail: 'tests_detail' },
  previewed: { at: 'previewed_at', detail: 'preview_url' },
};

/**
 * Record one of claimed/committed/testsPassed/previewed. The timestamp is
 * minted HERE, never accepted from the caller — the same reasoning that keeps
 * `learnedAt` server-minted in memory: a renderer that could choose a
 * timestamp could backdate a claim.
 */
export function recordEvidence(db: SqliteDatabase, request: RecordEvidenceRequest): ForgeItem {
  const existing = getForgeItem(db, request.id);
  if (existing === null) throw new ForgeItemNotFoundError();

  const columns = FACT_COLUMNS[request.fact];
  const now = new Date().toISOString();
  const detail = request.detail ?? null;

  db.prepare(
    `UPDATE forge_items SET ${columns.at} = ?, ${columns.detail} = ?, updated_at = ? WHERE id = ?`,
  ).run(now, detail, now, request.id);

  const updated = getForgeItem(db, request.id);
  if (updated === null) throw new ForgeItemNotFoundError();
  return updated;
}

/**
 * The ONLY function that may write `approved_at`/`approved_by`. Kept apart
 * from `recordEvidence` at the function level, not merely at the schema
 * level, so a future edit adding a fifth entry to `FACT_COLUMNS` still could
 * not reach approval through this module's shared helper.
 */
export function approveForgeItem(db: SqliteDatabase, request: ApproveForgeItemRequest): ForgeItem {
  const existing = getForgeItem(db, request.id);
  if (existing === null) throw new ForgeItemNotFoundError();

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE forge_items SET approved_at = ?, approved_by = ?, updated_at = ? WHERE id = ?`,
  ).run(now, request.approvedBy, now, request.id);

  const updated = getForgeItem(db, request.id);
  if (updated === null) throw new ForgeItemNotFoundError();
  return updated;
}
