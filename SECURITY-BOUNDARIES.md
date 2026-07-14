# SECURITY BOUNDARIES (prototype + future rule set)

All enforcement in the browser prototype is SIMULATED UI state. These rules are the design contract for the real build.

## Trust boundaries
Jarvis runtime ≠ AEGIS runtime ≠ Trusted Build Vault. Separate processes, storage, credentials. Communication only via a narrow authenticated schema-validated contract (health, status, review requests, incidents, lockdown notices). Reject: code, shell, prompts, config patches, secrets, arbitrary paths. Rate-limit, size-cap, audit-log with correlation IDs.

## Security levels
GREEN normal · YELLOW restricted (no computer control, downloads, sending, connectors, screen vision, autonomous tools) · RED isolated (additionally no voice, delegation, external actions, memory writes, scheduled tasks; local status only) · BLACK blackout (Jarvis offline, state persisted outside Jarvis-writable storage, recovery via separate authenticated human workflow; dev-only recovery clearly marked).

## Hard rules
- Jarvis can never lower an AEGIS level; restart does not bypass lockdown; Escape cannot bypass Blackout; Blackout cannot be hidden.
- Voice ("AEGIS, Blackout Protocol") may RAISE severity; recovery never relies on voice alone.
- Ledger/Forge read AEGIS state only.
- No secrets in HTML, localStorage, mobile/watch clients, GitHub, prompts, screenshots, or logs — server-side secret management only. OpenAI key server-side only; restricted key; spend limits enforced.
- Model separation: builder ≠ sole approver; Opus fresh-context review for security/finance/release work.

## Software review (AEGIS)
All future downloads/installs (apps, installers, extensions, scripts, packages, MCP servers, models, Docker images, APIs, updates) require AEGIS review: publisher, version, source, signature, hash, permissions, vulnerabilities, sandbox, network, persistence → verdict (Approved / Approved with restrictions / Unknown / High risk / Confirmed malicious).
