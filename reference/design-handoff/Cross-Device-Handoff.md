# Cross-Device Handoff

Status: visual blueprint (Jarvis Cross Device.dc.html). Native functionality is conceptual.

## Windows desktop
Floating always-on-top orb (see Jarvis Ambient.dc.html for live behavior), tray icon, global hotkey (Ctrl+Shift+J), conversation panel, and full surfaces for Forge/Ledger/AEGIS. Suggested shell evaluation criteria (from earlier spec): global hotkeys, process separation, secure updates, screen-capture permissions, memory, code signing, sandboxing — decide via ADR in Claude Code, not by popularity.

## iPhone 15 Pro Max
Siri/Action Button opens Jarvis into a voice session; "Goodbye Jarvis"/"End session" ends it. Lock Screen + Home Screen widgets (decisions waiting, Forge health, Ledger Safe-to-Spend). Push notifications deep-link into Forge Approval Inbox / project detail. App Intents + Shortcuts for: open app, open project, open preview, create note, prepare message. Permission states: Open app / Read approved data / Prepare action / Confirm action / Unsupported.

## Apple Watch Ultra
Simplified core only (single pulse, battery-conscious). Faces: listening state + AEGIS shield; alert card (e.g., Vercel failure) with actions: Open on iPhone, Restrict Jarvis (raise-only), Start voice note. Project-status complication. Never render dashboards on watch.

## Shared state colors
Blue normal · cyan pulse listening · counter-rotation thinking · reactive glow speaking · lens screen-vision · amber restricted · red isolated · collapsed locked core blackout.
