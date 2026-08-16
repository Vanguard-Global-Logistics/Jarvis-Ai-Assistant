# Jarvis Pro — Memory Delete Milestone

Status: **AWAITING CI**

This slice extends the verified owner-visible Memory v1 inspection surface with one bounded delete operation.

Security boundaries:

- renderer may submit only the opaque id of a memory it was shown;
- active profile identity is supplied by trusted Electron main;
- shared-write and restricted-write approval remain disabled;
- deletion uses the existing governed `MemoryService.delete` path and `user-delete` receipt semantics;
- the UI requires explicit owner confirmation before calling the delete bridge;
- no raw SQLite, profile selector, path, reason-code selector, or generic IPC method is exposed;
- the runtime probe's exact bridge allowlist includes `deleteMemory`.

Do not mark the master punch-list deletion item complete until format, lint, typecheck, tests, build, archived-handoff integrity, and the real Electron runtime probe pass on the final head.
