#!/usr/bin/env bash
# Bring Jarvis back from the dead, on a bare machine, in one command.
#
# Run this from inside the unzipped snapshot directory:
#     cd jarvis-brain-snapshot && ./scripts/install.sh
#
# What it does, in order: system packages, uv, Hermes at a PINNED version, the
# venv, ~/.hermes restored from this snapshot, the three hard-coded /tmp paths
# rewritten to wherever things actually live, a fresh API key, hook
# re-registration, and then a verification pass that must go green.
#
# It is safe to re-run. It backs up an existing ~/.hermes before touching it.

set -uo pipefail
# This historical snapshot installer is intentionally retired: it targeted Hermes 0.19.1.
echo "STOPPED: use jarvis-hermes/install.sh for audited Hermes v0.20; it preserves existing memory." >&2
exit 1
