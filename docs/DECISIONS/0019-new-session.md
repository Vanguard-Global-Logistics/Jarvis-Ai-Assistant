# ADR 0019 — New session, and a confirmation that means something

- **Status:** Accepted and implemented. Unit-tested, verified red-green.
  Renderer-only, so the runtime probe is unchanged.
- **Date:** 2026-08-11
- **Deciders:** William Lavold (standing direction to work the punch list);
  build by Claude.
- **Builds on:** ADR 0008 (explicit save), ADR 0010 (Continue forks rather than
  mutates).

## Context

This is a defect, not a nicety, and it had been sitting in plain sight since the
conversation surface shipped: **there was no way to put a topic down.**

The live transcript grew for the entire life of the window. Save Session, History,
Continue and Delete all existed; nothing cleared. So after saving a conversation
about one thing and starting another in the same window:

- every later `jarvis:chat` carried the earlier topic as context, and
- every later Save stored the earlier topic **again**, under a new id.

The second one is the real problem. Nothing warned about it and nothing looked
wrong — History just quietly accumulated conversations that each contained all
the previous ones. That is the "plausible-looking half-working state" CLAUDE.md
§8 is about.

## Decision

Add a **New session** toolbar button that clears the live transcript, the draft,
and any open saved-session view.

**Two clicks when there is unsaved work, one when there is not.** This reuses the
arm-then-confirm pattern Delete already uses, so the interaction is not a new
idea to learn. The button relabels itself to `Discard N unsaved?` when armed and
turns danger-red, because a confirmation styled like the thing it replaces reads
as a no-op.

**The confirmation is skipped when nothing would be lost, and that is the point
of the design.** A prompt that always appears is a prompt people learn to click
through, and then it protects nothing on the day it matters. So the component
tracks `persistedCount` — how many savable entries are known to be on disk — and
only asks when the transcript has grown past it:

- a successful Save sets it to the current count;
- **Continue** sets it to the loaded count, because continuing forks a stored
  record (ADR 0010) and everything loaded still exists under its own id, so
  discarding the fork loses nothing;
- anything typed afterwards makes the difference non-zero, and it asks again.

**The armed state disarms as soon as the transcript changes.** "Discard 3
unsaved?" is a question about a specific transcript; if a reply lands while it is
armed, the user would be answering a question that no longer matches what they
were shown.

**No keyboard shortcut.** ADR 0018 was written an hour before this one and its
central claim is that three shortcuts is the right number and each has to earn
its key. Adding ⌘N immediately afterwards would make that claim untrue. If New
session turns out to be reached for constantly in daily use, that is evidence for
a fourth chord and it can be argued for then — with evidence rather than
enthusiasm.

**The same guard covers Continue.** Looking for other instances of this defect
turned one up immediately: **Continue** (ADR 0010) replaces the live transcript
wholesale, so it could destroy unsaved work exactly the way New session could —
the same bug in a different doorway, and equally silent. It now arms and confirms
on the same rule, relabelling to `Discard N unsaved and continue?` in danger-red,
and continuing straight through when the live session is empty.

**The "already saved" claim is tied to a record, not just a count.** A count alone
can stop being true without the transcript changing: continue a session, delete
it from History, and the live work is backed by nothing while the count still
says it is safe — one click from gone. So the component also tracks _which_
saved conversation the claim refers to, and deleting that record resets it, so
the next discard asks. Found by walking the state model rather than by hitting
it, and covered by its own test.

## Consequences

**A gap in the model closes.** Saving no longer implies the conversation
continues forever. The three states are now distinct and reachable: live and
unsaved, live and saved, and a fresh start.

**`persistedCount` is a UI-side approximation, and is honest about it.** It
counts entries, not content, so it cannot tell that an entry was edited — nothing
in this app edits entries, so the approximation holds today. If editing is ever
added, this needs to become a real dirty flag rather than a count comparison.
Recorded here so that is a decision rather than a surprise.

**Tested, and verified red-green.** Nine tests. Six on New session: inert with nothing to clear, the
two-click discard, the one-click clear once saved, re-arming when new work lands
on top of a save, no prompt after Continue, and — the one that pins the actual
defect — that a save after New session contains only the new topic and does not
mention the old one. Two more cover Continue: it arms and then replaces on the
second click, and it continues immediately when there is nothing to lose.
Removing either confirmation guard fails the corresponding tests.

**Not covered by the runtime probe.** This is renderer state with no IPC, so
there is nothing new crossing the boundary for the probe to assert. The unit
tests are the right level.
