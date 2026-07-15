# @jarvis/pwa

**STATUS: NOT IMPLEMENTED.** No source, no build, no dependencies.

## Why the workspace exists at all

`CURRENT-STATE-AUDIT.md` §16 places a PWA shell in the target architecture, and §11
records that Phase 1 substitutes a PWA for the mobile surfaces because native iOS and
watchOS are explicitly a later phase.

The directory is claimed now so the workspace layout is settled and the name is not
argued about later. It contains nothing else. Scaffolding a Vite app, a service worker,
and a manifest here would produce an installable shell that renders nothing — which
reads as progress on mobile while delivering none, exactly what CLAUDE.md §8 forbids.

## What it will be

An installable PWA approximating the Forge and Ledger mobile surfaces
(`docs/VISUAL-DESIGN-TARGET.md`, Surface 2). It is an approximation, not the target:
native iPhone (Siri, Action Button, widgets, App Intents) and Apple Watch remain
deferred, per `reference/design-handoff/Cross-Device-Handoff.md`.

## Before building it

Phase 1 scope is **Windows desktop only** (`CURRENT-STATE-AUDIT.md` §14). Do not start
this without William's approval — it is out of scope, not merely unstarted.
