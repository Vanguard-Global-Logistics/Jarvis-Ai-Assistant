# ADR 0018 — Three keyboard shortcuts, and no more

- **Status:** Accepted and implemented. Unit-tested (verified red-green); the
  chords are renderer-only, so the runtime probe is unchanged.
- **Date:** 2026-08-11
- **Deciders:** William Lavold (standing direction to work the punch list);
  build by Claude.
- **Builds on:** ADR 0008 (explicit save — the reason ⌘S matters), ADR 0016 and
  0017 (Jarvis is now an installed app that keeps its window; it should also
  answer the keys an installed app answers).

## Context

Saving is explicit and unsaved sessions are discarded on close. That is the
right design — no autosave means no surprise persistence — but it puts the whole
cost of forgetting on the user, and the only way to save was to move the mouse
to a button. On the machine Jarvis is used on every day, that is the wrong ratio.

## Decision

Add exactly three, on `document` rather than on a focused element, because they
have to work while the caret is in the composer — which is where it always is.

| Chord           | Does                                                               |
| --------------- | ------------------------------------------------------------------ |
| `⌘S` / `Ctrl+S` | Save Session                                                       |
| `⌘F` / `Ctrl+F` | Open History and put the caret in the filter                       |
| `Esc`           | Leave the saved session, then close the panel — one step per press |

**Three, and the shortness of the list is the decision.** Every shortcut is a key
taken away from the user and from the platform, so each has to earn it: Save is
the action with a real cost if forgotten, Find is the one people reach for
reflexively, and Escape is the way out of a mode. Nothing else in this UI
qualifies yet, and a shortcut for every button would be a worse app, not a
better one.

**⌘S is always prevented, even when saving is impossible.** Otherwise the
browser's own Save dialog opens inside Jarvis, which is worse than the chord
doing nothing. When there is nothing to save the chord is inert, mirroring the
greyed button, and the existing always-visible hint already explains why.

**Escape unwinds one level per press, most-nested first.** A saved session is a
mode on top of the panel, so Escape leaves the session before closing the panel.
Collapsing both at once would make it impossible to get back to the list.

**The modifier is named per platform, not assumed.** Tooltips render `⌘S` on a
Mac and `Ctrl+S` elsewhere, feature-detected from the user agent
(`navigator.platform` is deprecated) and defaulting to `Ctrl` — an unfamiliar
word is easier to recover from than an unfamiliar symbol. The handler accepts
`metaKey` **or** `ctrlKey` regardless of what the tooltip says, so a Windows
machine is never silently unshortcutted; a test asserts that specifically.

**Discoverable, or they do not exist.** A shortcut nobody knows about is dead
code with a maintenance cost. The chords appear in the Save and History
tooltips and in the always-visible empty-state hint.

## Consequences

**No IPC, no menu, no boundary change.** Everything is renderer-side keyboard
handling. A native application menu would be the more conventional way to expose
these on macOS, and it is deliberately not done here: menu items live in main
and would need a **main → renderer** message to trigger a renderer action, which
this application has never had. That is a real widening of the trust boundary
(ADR 0002 — every channel argued for individually) and it should be its own
decision, taken for a menu worth having, not smuggled in for three chords that
work without it.

**Tested, and verified red-green.** Five tests cover: save via the chord, the
chord being inert with nothing to save, `Ctrl` working as well as `Cmd`,
`preventDefault` firing even when the action does not, focus landing in the
filter, and Escape unwinding in the right order. Removing the listener fails all
five.

**Known gap:** ⌘F focuses the filter box, which only renders once there are more
than three saved sessions. Below that the panel simply opens. That is the
existing behaviour of the filter, not a new rule, but it means ⌘F does
noticeably less on a fresh install.
