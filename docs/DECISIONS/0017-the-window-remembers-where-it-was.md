# ADR 0017 — The window remembers where it was

- **Status:** Accepted, implemented, and **IMPLEMENTED AND VERIFIED** on the Linux
  runtime probe.
- **Date:** 2026-08-11
- **Deciders:** William Lavold (standing direction to work the punch list);
  build by Claude.
- **Builds on:** ADR 0008 (main owns SQLite), ADR 0013 (the single-row table
  precedent), ADR 0016 (Jarvis is now an app you double-click, so it gets opened
  the way apps do).

## Context

Jarvis opened at 1440×900 in the middle of the screen every single launch. On a
machine it is opened on every day — the MacBook is the head node of the Hive and
never turns off (ADR 0012) — that is the kind of small daily friction that makes
software feel like a dev build rather than something you live with. ADR 0016
made it double-clickable; this makes it behave like the other things in the Dock.

## Decision

Store the window's bounds and maximized state, and restore them.

**No new IPC.** Main owns the window and main owns the database, so the entire
feature lives on the trusted side of the boundary. The renderer never reports its
size and never asks to be moved. The bridge stays at eleven functions — ADR 0002
requires every channel to be argued for individually, and this one would have
been an unnecessary widening for something the trusted process can already see.

**Migration 4, one row**, following the `profile` precedent: an installation has
one main window, so a table that could hold two would model something that does
not exist.

**`maximized` is stored separately from the bounds, not inferred.** A maximized
window reports the display's full size, so inferring would make "I maximized it"
and "I dragged it to fill the screen" indistinguishable — genuinely different
states on macOS. The bounds saved alongside are the **un-maximized** ones, read
via `getNormalBounds()`, so un-maximizing lands the window back where it was
rather than at a default.

**A saved position is not trusted.** This is the part worth reading twice. If
William undocks the MacBook, or a monitor Jarvis was on is gone, the saved
coordinates point into empty space — the window opens somewhere invisible, and
"it didn't start" becomes indistinguishable from "it started off-screen". So
`chooseWindowBounds` keeps the saved **size** (clamped to the usable minimum and
to the largest display, since a window bigger than the monitor is its own kind of
lost) but keeps the saved **position** only if a meaningful part of the window —
120×120px, not one pixel — would land on some display. Otherwise it returns no
position and lets the platform centre it.

That function is pure and takes the display list as an argument, so every case
that actually breaks window restore is unit-tested without an Electron window or
a second monitor.

**Writes are debounced (400ms).** `resize` and `move` fire continuously while
dragging; writing on each would mean hundreds of SQLite writes to move a window
across the screen. `close` flushes synchronously, because quitting cancels the
pending timer and closing right after a drag would otherwise lose the move.

**A failed write is logged and swallowed.** Losing the window position is
cosmetic and must never take down a running app.

## Consequences

**Verified against the real app, after the first version of the check proved
nothing.** The probe launches twice against one userData directory: the first run
is killed with SIGKILL so `close` never fires — deliberately exercising the
_debounced_ save rather than the one on quit — and must leave a row behind.

The first version then simply compared the two runs' window sizes. It passed
**with window restore disabled**: Xvfb clamps the window to the virtual screen,
so both runs reported the same size no matter what the app did. That is exactly
the green-check-proving-nothing failure this project has been bitten by twice
(`docs/KNOWN-LIMITATIONS.md` §7). The check now writes a distinctive size
(1024×700, nothing else would produce it) into the row between the launches and
asserts the second window comes up at it — and was verified red-green, failing
when restore is disabled and passing when it is not.

**Position is not asserted at runtime, only size.** There is no window manager
under Xvfb, so placement is not meaningful there. The off-screen logic is covered
by unit tests instead, and the size round-trip proves the migration, the store,
and the restore path are connected end to end.

**Rejected: a JSON file in userData.** Simpler, and it would have avoided a
migration — but it would put a second write path outside the database that ADR
0008 made main the single owner of, for no gain.

**Rejected: restoring the position unconditionally.** It is what most naive
implementations do and it is how apps end up invisible on a laptop that was
undocked.
