# PROTOTYPE LIMITATIONS

Everything in this project is a browser-based design prototype. Simulated (not real):

- Voice recognition, wake word, speech output (except optional Web Speech demo in Jarvis.dc.html)
- Screen Vision / screen capture (visual border only)
- Computer control, app control, Siri, Action Button, Shortcuts, deep links
- AEGIS enforcement, process isolation, malware scanning, signatures, threat intelligence
- GitHub monitoring, Vercel monitoring, tests, deployments, previews
- Claude/ChatGPT orchestration (Task Bridge is manual copy/paste)
- All financial connections, balances, bills, subscriptions (seeded demo data); Ledger cannot move money
- Push notifications, widgets, watchOS, iOS, Windows shells (visual concepts)
- Hardware keys, Face ID, recovery workflows (dev-only representations)

Known technical limitations:
- localStorage namespaces simulate trust boundaries; a real build needs real IPC/process separation.
- Desktop layouts for Forge/Ledger are centered phone columns (mobile-first by design).
- Reduced motion honored via prefers-reduced-motion CSS in ambient/animated files; not user-toggleable in-app.
- Drag persistence uses simple clamping; extreme window resizes may require re-drag.
