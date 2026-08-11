import type { Migration } from '../migrator.js';

/**
 * Migration 4 — where the window was last time (ADR 0017).
 *
 * One row, like `profile`, and for the same reason: an installation has one
 * main window, so a table that could hold two would model something that does
 * not exist.
 *
 * `maximized` is stored separately from the bounds rather than inferred from
 * them. A maximized window reports the display's full size, so inferring would
 * make "I maximized it" and "I dragged it to fill the screen" indistinguishable
 * — and restoring the second as the first is wrong on macOS, where maximized
 * and full-size are genuinely different states. The bounds recorded alongside
 * are the *unmaximized* ones, so un-maximizing lands the window back where it
 * was rather than at a default.
 *
 * INTEGER for every coordinate: Electron's bounds are whole pixels, and `REAL`
 * would invite a fractional width that Chromium then rounds differently on
 * different platforms.
 */
export const windowStateMigration: Migration = {
  id: 4,
  name: 'window-state',
  up: (db) => {
    db.exec(`
      CREATE TABLE window_state (
        id         INTEGER PRIMARY KEY CHECK (id = 1),
        x          INTEGER NOT NULL,
        y          INTEGER NOT NULL,
        width      INTEGER NOT NULL CHECK (width > 0),
        height     INTEGER NOT NULL CHECK (height > 0),
        maximized  INTEGER NOT NULL CHECK (maximized IN (0, 1))
      ) STRICT;
    `);
  },
};
