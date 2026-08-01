#!/usr/bin/env python3
"""Hard daily dollar cap on everything Jarvis does.

The brain router already caps *consults*. This caps the rest — ordinary
conversation, tool loops, subagents, cron jobs, anything that burns tokens.
Without it, a runaway loop at 3am is discovered on a bill.

It runs as a `pre_tool_call` shell hook, so it fires before every single tool
Jarvis reaches for. When the day's spend is over the cap it returns
{"action": "block"} and Jarvis is told, in his own context, that he is out of
budget and must stop and tell William.

Where the numbers come from
---------------------------
Hermes already records real per-session token usage and a costed total in
~/.hermes/state.db (table `session_model_usage`, column `estimated_cost_usd`).
Spot-checked against Anthropic's published Sonnet 5 rates on 2026-08-01: a
645,208-cache-read / 67,257-cache-write / 3,379-output session came to
$0.33102 by hand and $0.33103 in the table. Close enough to bet money on.

Brain-router consults are added from ~/.hermes/brain-ledger.jsonl, because those
are billed outside a Hermes session and would otherwise be invisible here.

Design notes
------------
* Fails OPEN, deliberately. If the database is missing or unreadable this hook
  allows the call rather than bricking Jarvis. A guard that breaks the assistant
  when it malfunctions is worse than the problem it solves. The tradeoff is
  stated out loud rather than hidden.
* Reads the database read-only through a URI connection, so it can never
  corrupt Hermes' own state or block on a writer.
* "Today" is local midnight, because that is what a human means by today.
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

HERMES_HOME = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
STATE_DB = HERMES_HOME / "state.db"
LEDGER = HERMES_HOME / "brain-ledger.jsonl"
WARN_STAMP = HERMES_HOME / ".spend-warned"

DAILY_CAP_USD = float(os.environ.get("JARVIS_DAILY_TOTAL_CAP", "3.00"))
WARN_AT = 0.80  # tell Jarvis he is running low at 80% so he can wrap up


def _local_midnight_epoch() -> float:
    now = datetime.now()
    return time.mktime(now.replace(hour=0, minute=0, second=0, microsecond=0).timetuple())


def _session_spend_today() -> float:
    if not STATE_DB.exists():
        return 0.0
    con = sqlite3.connect(f"file:{STATE_DB}?mode=ro", uri=True, timeout=2.0)
    try:
        row = con.execute(
            "SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM session_model_usage "
            "WHERE last_seen >= ?",
            (_local_midnight_epoch(),),
        ).fetchone()
        return float(row[0] or 0.0)
    finally:
        con.close()


def _consult_spend_today() -> float:
    if not LEDGER.exists():
        return 0.0
    today = datetime.now().astimezone().strftime("%Y-%m-%d")
    total = 0.0
    for line in LEDGER.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if str(row.get("at", "")).startswith(today):
            total += float(row.get("cost_usd", 0) or 0)
    return total


def main() -> None:
    # Drain stdin so Hermes never blocks writing the payload to us.
    try:
        sys.stdin.read()
    except Exception:
        pass

    try:
        spent = _session_spend_today() + _consult_spend_today()
    except Exception:
        # Fail open — see module docstring.
        return

    if spent >= DAILY_CAP_USD:
        print(json.dumps({
            "action": "block",
            "message": (
                f"DAILY SPEND CAP REACHED — ${spent:.2f} of ${DAILY_CAP_USD:.2f} used today. "
                "No more tool calls will run. Stop what you are doing, tell William "
                "plainly that you have hit the cap, say what you were working on and "
                "what remains, and let him decide whether to raise it. Do not try to "
                "work around this."
            ),
        }))
        return

    if spent >= DAILY_CAP_USD * WARN_AT and not _already_warned_today():
        # The 80% nudge fires exactly ONCE per day. `block` is the only channel a
        # pre_tool_call hook has for speaking to Jarvis, so the warning costs him
        # one blocked call — he retries and continues. Without the once-a-day
        # stamp this would blockade him at 80% and become the real cap.
        _mark_warned()
        print(json.dumps({
            "action": "block",
            "message": (
                f"BUDGET WARNING — ${spent:.2f} of ${DAILY_CAP_USD:.2f} used today "
                f"({spent / DAILY_CAP_USD:.0%}). Nothing is broken and this is the only "
                "warning you get. Mention the number to William, favour the cheaper "
                "brain from here, and retry the call — it will go through."
            ),
        }))
        return


def _mark_warned() -> None:
    try:
        WARN_STAMP.write_text(datetime.now().strftime("%Y-%m-%d"))
    except Exception:
        pass


def _already_warned_today() -> bool:
    try:
        return WARN_STAMP.read_text().strip() == datetime.now().strftime("%Y-%m-%d")
    except Exception:
        return False


if __name__ == "__main__":
    main()
