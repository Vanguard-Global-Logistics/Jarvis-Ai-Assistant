import { beforeEach, describe, expect, it } from 'vitest';
import type { SqliteDatabase } from '@jarvis/database';
import { migrate, migrations, openDatabase } from '@jarvis/database';
import {
  DEFAULT_WINDOW_SIZE,
  MIN_WINDOW_SIZE,
  chooseWindowBounds,
  loadWindowState,
  saveWindowState,
} from './window-state.js';
import type { Bounds } from './window-state.js';

/**
 * The store runs against a real in-memory SQLite with the real migrations, and
 * the placement logic is pure — so the cases that actually break window
 * restore (an unplugged monitor, a display that shrank) are tested here rather
 * than discovered by a window opening somewhere invisible.
 */

let db: SqliteDatabase;

beforeEach(() => {
  db = openDatabase({ location: ':memory:' });
  migrate(db, migrations);
});

const LAPTOP: Bounds = { x: 0, y: 0, width: 1512, height: 945 };
/** A second monitor to the right, as a docked MacBook would see it. */
const EXTERNAL: Bounds = { x: 1512, y: 0, width: 2560, height: 1440 };

describe('the window-state store', () => {
  it('reports nothing before the window has ever been placed', () => {
    // Not a zeroed rectangle: "never opened" and "opened at 0,0" are different
    // facts, and only the first may fall back to the default position.
    expect(loadWindowState(db)).toBeNull();
  });

  it('round-trips bounds and the maximized flag', () => {
    const state = { bounds: { x: 120, y: 64, width: 1600, height: 1000 }, maximized: false };
    saveWindowState(db, state);
    expect(loadWindowState(db)).toEqual(state);
  });

  it('keeps exactly one row — the second save replaces the first', () => {
    saveWindowState(db, { bounds: { x: 0, y: 0, width: 1000, height: 700 }, maximized: false });
    saveWindowState(db, { bounds: { x: 50, y: 60, width: 1200, height: 800 }, maximized: true });
    const rows = db.prepare('SELECT COUNT(*) AS n FROM window_state').get() as { n: number };
    expect(rows.n).toBe(1);
    expect(loadWindowState(db)).toEqual({
      bounds: { x: 50, y: 60, width: 1200, height: 800 },
      maximized: true,
    });
  });

  it('rounds fractional bounds rather than letting the INTEGER column reject them', () => {
    // Electron reports fractional bounds on a scaled display; an unrounded
    // write would throw against a STRICT table.
    saveWindowState(db, {
      bounds: { x: 10.4, y: 20.6, width: 1400.5, height: 900.2 },
      maximized: false,
    });
    expect(loadWindowState(db)?.bounds).toEqual({ x: 10, y: 21, width: 1401, height: 900 });
  });

  it('never stores a window smaller than the app can be used at', () => {
    saveWindowState(db, { bounds: { x: 0, y: 0, width: 200, height: 150 }, maximized: false });
    const bounds = loadWindowState(db)?.bounds;
    expect(bounds?.width).toBe(MIN_WINDOW_SIZE.width);
    expect(bounds?.height).toBe(MIN_WINDOW_SIZE.height);
  });

  it('survives a negative x — a window on a monitor to the LEFT is normal', () => {
    saveWindowState(db, {
      bounds: { x: -1200, y: 40, width: 1100, height: 800 },
      maximized: false,
    });
    expect(loadWindowState(db)?.bounds.x).toBe(-1200);
  });
});

describe('chooseWindowBounds', () => {
  it('uses the default size on first run', () => {
    expect(chooseWindowBounds(null, [LAPTOP])).toEqual({ ...DEFAULT_WINDOW_SIZE });
  });

  it('restores a position that is still on a display', () => {
    const saved = { x: 200, y: 100, width: 1200, height: 800 };
    expect(chooseWindowBounds(saved, [LAPTOP])).toEqual(saved);
  });

  it('restores a position on a second monitor while that monitor is attached', () => {
    const saved = { x: 2000, y: 200, width: 1400, height: 900 };
    expect(chooseWindowBounds(saved, [LAPTOP, EXTERNAL])).toEqual(saved);
  });

  it('DROPS the position when that monitor is gone, keeping the size', () => {
    // The case this whole function exists for: undock the MacBook and the
    // saved coordinates point into empty space. A window opening there is
    // invisible, and "it did not start" is indistinguishable from "it started
    // off-screen". Returning no position lets the platform centre it.
    const saved = { x: 2000, y: 200, width: 1400, height: 900 };
    const chosen = chooseWindowBounds(saved, [LAPTOP]);
    expect(chosen).toEqual({ width: 1400, height: 900 });
    expect(chosen).not.toHaveProperty('x');
  });

  it('keeps a window nudged partly off the right edge — that is deliberate', () => {
    const saved = { x: 1200, y: 100, width: 1000, height: 700 };
    expect(chooseWindowBounds(saved, [LAPTOP])).toEqual(saved);
  });

  it('drops a position that leaves only a sliver on screen', () => {
    // One pixel of overlap is not "visible" in any useful sense.
    const saved = { x: LAPTOP.width - 3, y: 100, width: 1000, height: 700 };
    expect(chooseWindowBounds(saved, [LAPTOP])).not.toHaveProperty('x');
  });

  it('shrinks a window that no longer fits the largest display', () => {
    // Saved on the 2560px monitor, reopened on the laptop alone.
    const saved = { x: 0, y: 0, width: 2400, height: 1300 };
    expect(chooseWindowBounds(saved, [LAPTOP])).toEqual({
      x: 0,
      y: 0,
      width: LAPTOP.width,
      height: LAPTOP.height,
    });
  });

  it('never returns a window below the usable minimum', () => {
    const chosen = chooseWindowBounds({ x: 0, y: 0, width: 10, height: 10 }, [LAPTOP]);
    expect(chosen.width).toBe(MIN_WINDOW_SIZE.width);
    expect(chosen.height).toBe(MIN_WINDOW_SIZE.height);
  });

  it('falls back to the default when the platform reports no displays at all', () => {
    // Defensive: an empty display list would otherwise crash the reduce, at
    // startup, before any window exists to show the error in.
    expect(chooseWindowBounds({ x: 10, y: 10, width: 1200, height: 800 }, [])).toEqual({
      ...DEFAULT_WINDOW_SIZE,
    });
  });
});
