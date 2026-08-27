# Mac Project Zero acceptance

Status: **programmed; physical Mac acceptance pending.**

This acceptance test proves the isolated Hermes/Jarvis Project Zero workflow. It does not grant the
separate R13.3 voice runtime general tool authority and it does not create, rename, archive, or delete
ChatGPT conversations.

## Preconditions

- Repository branch: `agent/jarvis-project-zero-chat-consolidation-2026-08-21`.
- Node 22 or newer.
- Existing audited Hermes v0.20/Jarvis installation.
- A local ChatGPT export containing `conversations.json`.
- Private owner context, if approved, at `~/.jarvis/WILLIAM-BRAIN.md`.
- `OPENAI_API_KEY` configured only in a local protected environment file or process environment.
  Never paste the key into a Jarvis/ChatGPT conversation or commit it to Git.

## Gate A — install and doctor

From the repository root on William's Mac:

```bash
bash runtime/macos/project-zero/INSTALL-PROJECT-ZERO.command
```

Required result:

- network-free Project Zero self-test passes before installation;
- Hermes Project Zero skill is installed;
- `~/.hermes/bin/jarvis-project-zero` is executable;
- Project Zero doctor reports **0 failures**;
- no R13.3 files or locked voice profile are modified.

## Gate B — direct one-shot proof

Place the export at `~/Downloads/conversations.json` or pass its exact local path:

```bash
~/.hermes/bin/jarvis-project-zero "$HOME/Downloads/conversations.json"
```

Required result:

- one timestamped run appears under `~/.jarvis/project-zero/runs/`;
- `~/.jarvis/project-zero/LATEST` points to that run;
- exactly 12 project directories exist;
- each project contains `BRAIN.md`, `STATUS.md`, `MASTER-PUNCHLIST.md`,
  `SOURCE-TRANSCRIPTS.md`, and `SYNTHESIS-REQUEST.json`;
- generated data stays under owner-private directories;
- `PROJECT-ZERO-REPORT.md` is produced;
- report says destructive cleanup is **NO**;
- no ChatGPT conversation is changed.

Exit code `2` is an expected review result when unclassified chats or unresolved conflicts remain.
Exit code `0` means the local information-migration gates passed; it still does not authorize chat
cleanup.

## Gate C — Jarvis skill proof

Start the tool-capable Hermes/Jarvis lane. Say or type:

> Project Zero

Required behavior:

1. Jarvis resolves the Project Zero skill.
2. Jarvis uses only the configured export path or the exact path William provides; it does not crawl
   the Mac for chat history.
3. Jarvis invokes the installed `jarvis-project-zero` wrapper.
4. Jarvis waits for completion and reads the latest verification report.
5. Jarvis reports the total classified chats, per-project counts, unclassified count, unresolved
   conflict count, information-migration readiness, and next review item.
6. Jarvis does not claim it created the 12 live ChatGPT chats.
7. Jarvis does not open, rename, archive, or delete ChatGPT conversations.

## Gate D — quality spot check

William selects at least five known source chats spanning multiple project lanes. For each sample:

- source chat is routed to the correct project or deliberately marked unclassified;
- important durable decisions appear in the compact brain with the exact source chat ID;
- stale/current contradictions remain conflicts unless a cited later source resolves them;
- credential-like values do not appear in model-bound request material;
- full transcript text remains outside normal `/brain` startup context.

## Acceptance ruling

Project Zero's **information-migration** slice is accepted only when:

- doctor has zero failures;
- the real export completes without structural errors;
- `UNCLASSIFIED = 0` after reviewed routing corrections;
- unresolved conflicts = 0 after authoritative verification;
- five-chat spot check passes;
- William explicitly accepts the behavior.

The later ChatGPT workspace mutation slice remains blocked on accepted Stage 1A, deterministic AEGIS
v1, the governed Tool Bridge, migration-coverage proof, and William's immediate approval before any
destructive cleanup.
