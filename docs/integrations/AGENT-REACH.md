# Agent Reach integration

Jarvis uses Agent Reach as an optional local-runtime capability layer for internet-facing tools such as GitHub, YouTube, Reddit, Twitter/X, RSS, and supported search/connectors.

## Security posture

- Agent Reach is installed into the Jarvis runtime, not vendored into this repository.
- The installer is pinned to upstream commit `06c202b03400a7d31886bf4399213706da1a0324` from `Panniantong/Agent-Reach`.
- Safe mode is the default. It does not permit Agent Reach to auto-install system packages.
- Full upstream dependency installation is an explicit operator action.
- No Agent Reach install command runs automatically at Jarvis startup.
- Credentials, cookies, tokens, and Agent Reach configuration must remain outside the repository.

## Jarvis commands

Preview only:

```bash
npm run agent-reach:install:dry-run
```

Recommended first install:

```bash
npm run agent-reach:install
```

Health check:

```bash
npm run agent-reach:doctor
```

Explicit full dependency setup:

```bash
npm run agent-reach:install:full
```

The full command should only be used after reviewing the Agent Reach `doctor` output and deciding which upstream system tools are appropriate for the machine.

## Prerequisite

The Jarvis macOS/Linux runtime must have `pipx` available. On the Mac development machine:

```bash
brew install pipx
pipx ensurepath
```

Then open a fresh shell before running the Jarvis Agent Reach install command if `pipx` changed the PATH.

## Updating Agent Reach

Do not float production Jarvis installs on upstream `main`. Review an upstream revision first, then update `AGENT_REACH_REF` in `scripts/install-agent-reach.sh` in a dedicated branch and run the dry-run/doctor checks before merging.
