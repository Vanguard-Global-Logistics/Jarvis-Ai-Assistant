import type { SqliteDatabase } from '@jarvis/database';

/**
 * Remember where the window was (ADR 0017).
 *
 * Jarvis is opened every day on the same machine. Reopening at the default
 * 1440×900 in the middle of the screen every single time is the kind of small
 * daily friction that makes an app feel like a dev build rather than something
 * you live with.
 *
 * **No IPC.** Main owns the window and main owns the database, so the whole
 * feature lives on the trusted side. The renderer neither reports its size nor
 * asks to be moved, and the bridge stays at eleven functions (ADR 0002 — every
 * channel must be argued for individually, and this one would have been an
 * unnecessary widening of the boundary).
 *
 * The logic that decides whether saved bounds are still usable is a pure
 * function, `chooseWindowBounds`, so the interesting cases are unit-tested
 * without an Electron window or a real monitor.
 */

/** A rectangle in screen coordinates. Matches Electron's `Rectangle`. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  readonly bounds: Bounds;
  readonly maximized: boolean;
}

/** What the app opens at when it has never been opened before. */
export const DEFAULT_WINDOW_SIZE = { width: 1440, height: 900 } as const;
export const MIN_WINDOW_SIZE = { width: 940, height: 600 } as const;

/**
 * How much of the window has to be on a monitor for the position to be kept.
 *
 * Not "any overlap": a window one pixel onto the screen is functionally lost.
 * Not "fully contained" either — a window deliberately nudged off the right
 * edge is a normal thing to do and should survive a restart.
 */
const MIN_VISIBLE_PX = 120;

interface WindowStateRow {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: number;
}

/** The saved state, or `null` when the app has never been positioned. */
export function loadWindowState(db: SqliteDatabase): WindowState | null {
  const row = db
    .prepare('SELECT x, y, width, height, maximized FROM window_state WHERE id = 1')
    .get() as WindowStateRow | undefined;
  if (row === undefined) return null;
  return {
    bounds: { x: row.x, y: row.y, width: row.width, height: row.height },
    maximized: row.maximized === 1,
  };
}

/**
 * Record the window's position. Upsert, because there is only ever one row.
 *
 * Coordinates are rounded rather than trusted: Electron can report fractional
 * bounds on a scaled display, and the column is INTEGER.
 */
export function saveWindowState(db: SqliteDatabase, state: WindowState): void {
  db.prepare(
    `INSERT INTO window_state (id, x, y, width, height, maximized)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       x = excluded.x, y = excluded.y,
       width = excluded.width, height = excluded.height,
       maximized = excluded.maximized`,
  ).run(
    Math.round(state.bounds.x),
    Math.round(state.bounds.y),
    Math.max(MIN_WINDOW_SIZE.width, Math.round(state.bounds.width)),
    Math.max(MIN_WINDOW_SIZE.height, Math.round(state.bounds.height)),
    state.maximized ? 1 : 0,
  );
}

/** Area shared by two rectangles, in square pixels. */
function overlapArea(a: Bounds, b: Bounds): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Decide what bounds to actually open at.
 *
 * The case this exists for: William undocks the MacBook, or a monitor he had
 * Jarvis on is gone. The saved coordinates then point into empty space and the
 * window opens somewhere invisible — the app looks broken, and "it didn't
 * start" is indistinguishable from "it started off-screen". Restoring a
 * position is only safe if that position still exists.
 *
 * So: keep the saved SIZE (clamped to the minimum and to the display, since a
 * window larger than the monitor is its own kind of lost), and keep the saved
 * POSITION only if a meaningful part of the window would land on some display.
 * Otherwise return no position and let the platform centre it.
 *
 * @param saved the previously stored bounds, or null on first run
 * @param displays work areas of every connected display, in screen coordinates
 */
export function chooseWindowBounds(
  saved: Bounds | null,
  displays: readonly Bounds[],
): { width: number; height: number; x?: number; y?: number } {
  if (saved === null || displays.length === 0) {
    return { ...DEFAULT_WINDOW_SIZE };
  }

  const largest = displays.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b));
  const width = Math.max(MIN_WINDOW_SIZE.width, Math.min(saved.width, largest.width));
  const height = Math.max(MIN_WINDOW_SIZE.height, Math.min(saved.height, largest.height));

  // Test visibility with the size we are actually going to use, not the saved
  // one — clamping can move the far edge and change the answer.
  const candidate: Bounds = { x: saved.x, y: saved.y, width, height };
  const visible = displays.some(
    (display) => overlapArea(candidate, display) >= MIN_VISIBLE_PX * MIN_VISIBLE_PX,
  );

  return visible ? { x: saved.x, y: saved.y, width, height } : { width, height };
}
