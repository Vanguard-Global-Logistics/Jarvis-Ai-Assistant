# OpenJarvis adoption matrix — 2026-08-08

Reference reviewed: `open-jarvis/OpenJarvis` commit
`95a9857984705d755a5f9a4c4d5edabddc18e1b3` (Apache-2.0).

The rule is evidence before replacement. A proven upstream pattern is adapted
when it improves Jarvis and passes this repository's gates. Existing Jarvis code
stays when it is safer, more private, or more complete. This work independently
implements the patterns in TypeScript; it does not copy upstream source.

| Capability                              | Decision   | Jarvis status                                                                           |
| --------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| Heuristic model routing                 | Adopt      | Implemented for optional fast, balanced, and reasoning local models                     |
| Install/runtime doctor                  | Adopt      | Implemented for Node, dependencies, Electron, SQLite ABI, hardware, and local inference |
| Apple Silicon detection                 | Adopt      | Doctor identifies the MLX-capable path                                                  |
| Trace telemetry (latency, TTFT, tokens) | Adapt next | Must exclude prompt and memory content by default                                       |
| Streaming responses                     | Adapt next | Requires incremental AEGIS scanning before renderer delivery                            |
| Deterministic pipeline skills           | Adapt next | Must use explicit permissions and approval gates                                        |
| Trace-driven skill discovery            | Evaluate   | Only from redacted traces with user approval                                            |
| MLX and Ollama installers               | Adapt next | Must be idempotent, signed/checksummed, and Mac-tested                                  |
| OpenAI-compatible local API             | Keep ours  | Existing adapter is loopback-only and contract-validated                                |
| Local-only no-cloud fallback            | Keep ours  | Prevents surprise paid-token use                                                        |
| AEGIS/Throne Hive governance            | Keep ours  | Stronger independent mandatory security boundary                                        |
| Automatic JSONL fact memory             | Reject     | We retain typed policy, sensitivity, provenance, and durable SQLite                     |
| Automatic skill imports/updates         | Reject     | Unacceptable supply-chain and authority expansion without approval                      |
| Bind local server to `0.0.0.0`          | Reject     | Personal AI remains loopback-only by default                                            |
| Optional security composition           | Reject     | AEGIS cannot be bypassed or lowered by Jarvis                                           |

## Routing contract

- Short ordinary prompts use `HIVE_LOCAL_AI_FAST_MODEL` when configured.
- Code, math, architecture, debugging, security, and long prompts use
  `HIVE_LOCAL_AI_REASONING_MODEL` when configured.
- All other prompts use `HIVE_LOCAL_AI_MODEL` or the discovered default.
- If specialist models are unset, behavior is unchanged.
- Every lane uses the same loopback-only provider. Routing never enables cloud
  fallback.

## Next measured slice

1. Record total latency and time-to-first-token without storing message text.
2. Add secured streaming with AEGIS checks before each renderer-visible chunk.
3. Add an idempotent Apple Silicon installer for the selected local runtime.
4. Add deterministic skill pipelines with per-step authority and audit records.
5. Use the measurements to tune routing; do not claim a speedup until a Mac
   benchmark proves it.
