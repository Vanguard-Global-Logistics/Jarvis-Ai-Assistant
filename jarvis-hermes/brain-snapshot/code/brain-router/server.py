#!/usr/bin/env python3
"""Jarvis brain router — an MCP server that lets Jarvis choose his own brain.

Hermes runs one model per session and cannot swap it mid-conversation. So
instead of pretending to hot-swap, this gives Jarvis something better: the
ability to *consult* a stronger brain for one hard question while staying on a
cheap brain for everything else, and to change his standing default when the
evidence says he should.

Four tools:

  brain_status      — the lineup, prices, current default, and spend so far
  consult           — send one hard question to a stronger brain, priced exactly
  set_default_brain — change the standing default for future sessions
  spend_report      — what routing has actually cost, from the ledger

Every consult writes an audit line to ~/.hermes/brain-ledger.jsonl with the real
cost computed from the API's own usage numbers. Nothing is estimated after the
fact, and nothing is hidden.

Spending guards, in order of strictness:

  * Any single consult above SOFT_CAP_USD is refused with the estimate, and
    Jarvis has to come back with require_confirmation=True — which he is
    instructed to only set after William has said yes to the number.
  * Cumulative spend above DAILY_CAP_USD refuses everything until tomorrow.

These exist because William was once billed by a service that spent his money
without asking. The router is built so that cannot happen here.
"""

from __future__ import annotations

import functools
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from brains import BRAINS, LEGACY, TIER_TO_MODEL, price, resolve  # noqa: E402,F401

from mcp.server.fastmcp import FastMCP  # noqa: E402

HERMES_HOME = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
LEDGER = HERMES_HOME / "brain-ledger.jsonl"
CONFIG = HERMES_HOME / "config.yaml"

SOFT_CAP_USD = float(os.environ.get("JARVIS_CONSULT_SOFT_CAP", "0.50"))
DAILY_CAP_USD = float(os.environ.get("JARVIS_DAILY_CAP", "5.00"))

ANTHROPIC = "https://api.anthropic.com/v1"

server = FastMCP(
    "jarvis-brain",
    instructions=(
        "Brain selection for Jarvis. Use brain_status to see the lineup and "
        "prices, consult to borrow a stronger brain for one hard question, "
        "set_default_brain to change the standing default, and spend_report to "
        "audit what routing has cost."
    ),
)


# ---------------------------------------------------------------- utilities


def _api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        # Fall back to the key file the installer writes, so the router still
        # works when Hermes launches it without inheriting the environment.
        keyfile = HERMES_HOME / ".anthropic_key"
        if keyfile.exists():
            key = keyfile.read_text().strip()
    if not key:
        raise RuntimeError("no ANTHROPIC_API_KEY available to the brain router")
    return key


def _post(path: str, payload: dict, timeout: int = 300) -> dict:
    req = urllib.request.Request(
        f"{ANTHROPIC}{path}",
        data=json.dumps(payload).encode(),
        headers={
            "x-api-key": _api_key(),
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:500]
        raise RuntimeError(f"Anthropic returned HTTP {e.code}: {detail}") from None


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _ledger_rows() -> list[dict]:
    if not LEDGER.exists():
        return []
    rows = []
    for line in LEDGER.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def _spent(day: str | None = None) -> float:
    rows = _ledger_rows()
    if day:
        rows = [r for r in rows if str(r.get("at", "")).startswith(day)]
    return sum(float(r.get("cost_usd", 0) or 0) for r in rows)


def _log(entry: dict) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    entry["at"] = datetime.now(timezone.utc).isoformat()
    with LEDGER.open("a") as fh:
        fh.write(json.dumps(entry) + "\n")


def _current_default() -> str:
    """Read the standing brain out of Hermes' config without needing PyYAML."""
    if not CONFIG.exists():
        return "(unset)"
    in_model = False
    for raw in CONFIG.read_text().splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if not raw.startswith((" ", "\t")):
            in_model = raw.split(":", 1)[0].strip() == "model"
            continue
        if in_model:
            key, _, val = raw.strip().partition(":")
            if key.strip() in {"default", "model"}:
                return val.strip().strip("'\"") or "(unset)"
    return "(unset)"


def _estimate(brain, question: str, context: str, max_tokens: int) -> float:
    """Worst-case cost of a consult, used for the guard.

    Deliberately pessimistic: assume the model spends its entire output budget.
    Better to over-warn than to under-warn about someone else's money.
    """
    approx_in = (len(question) + len(context)) / 3.5
    return (
        approx_in * brain.input_per_mtok + max_tokens * brain.output_per_mtok
    ) / 1_000_000.0


def _money(x: float) -> str:
    return f"${x:.4f}" if x < 0.01 else f"${x:.2f}"


# -------------------------------------------------------------------- tools


def _status_text() -> str:
    lines = ["JARVIS BRAIN LINEUP", ""]
    for tier, model in TIER_TO_MODEL.items():
        b = BRAINS[model]
        lines.append(
            f"  {tier:<8} {b.model:<20} "
            f"${b.input_per_mtok:g} in / ${b.output_per_mtok:g} out per Mtok "
            f"(cached input ${b.cache_read_per_mtok:g})"
        )
        lines.append(f"           {b.use_for}")
        lines.append("")

    today = _spent(_today())
    lines += [
        f"Standing default brain : {_current_default()}",
        f"Spent on consults today: {_money(today)} of {_money(DAILY_CAP_USD)} cap",
        f"Spent on consults total: {_money(_spent())}",
        f"Single-consult ceiling  : {_money(SOFT_CAP_USD)} before William must approve",
        "",
        "Note: the standing default is what YOU run on. 'consult' does not "
        "change it — it borrows a stronger brain for one question.",
    ]
    return "\n".join(lines)


def _guard(fn):
    """Never let a router failure crash Jarvis' turn — report it as text.

    functools.wraps matters here beyond cosmetics: FastMCP builds each tool's
    input schema from the function signature, and only follows through to the
    real one via __wrapped__. Without it every tool advertises (*a, **kw) and
    Jarvis cannot call any of them correctly.
    """

    @functools.wraps(fn)
    def wrapped(*a, **kw):
        try:
            return fn(*a, **kw)
        except Exception as e:
            return f"brain router error: {e}"

    return wrapped


@server.tool(name="brain_status")
@_guard
def brain_status() -> str:
    """Show the brain lineup, what each costs per million tokens, what each is
    best for, which brain is the current standing default, and how much routing
    has spent today.

    Call this when William asks about models or cost, or when you are unsure
    which brain a task deserves.
    """
    return _status_text()


@server.tool(name="consult")
@_guard
def consult(
    tier: str,
    question: str,
    why: str,
    context: str = "",
    max_tokens: int = 2000,
    require_confirmation: bool = False,
) -> str:
    """Ask a STRONGER brain one hard question and get its answer back, without
    changing the brain you are running on.

    Tiers: quick (Haiku 4.5, cheapest), default (Sonnet 5), deep (Opus 5),
    max (Fable 5, ten times the price of quick).

    Use this when a problem is genuinely beyond your current brain: subtle
    architecture decisions, hard debugging, high-stakes judgment, or anything
    where being wrong is expensive to undo. Do NOT use it for ordinary questions
    you can already answer — it costs William real money every time.

    The question must be fully self-contained; the consulted brain cannot see
    your conversation. Returns the answer plus the exact dollar cost, which you
    should report to William.

    Args:
        tier: Which brain to consult — quick, default, deep, or max.
        question: The self-contained question to ask.
        why: One sentence on why this needs a stronger brain. Recorded in the
            spend ledger so William can audit whether the escalation was worth it.
        context: Everything the consulted brain needs — code, error text,
            constraints, what you already tried.
        max_tokens: Answer length cap.
        require_confirmation: Set true ONLY after William has seen the estimated
            cost and said yes. Setting this without asking him violates your
            standing rule about his money.
    """
    return _consult(
        {
            "tier": tier,
            "question": question,
            "why": why,
            "context": context,
            "max_tokens": max_tokens,
            "require_confirmation": require_confirmation,
        }
    )


@server.tool(name="set_default_brain")
@_guard
def set_default_brain(brain: str, reason: str) -> str:
    """Change which brain runs by default in future sessions.

    Takes effect next session, not this one. Use when the balance of work has
    clearly shifted — heavy build work justifies a stronger default, routine
    chat justifies a cheaper one. Tell William the cost difference when you do.

    Args:
        brain: Tier name (quick/default/deep/max) or a model id.
        reason: Why the change is warranted.
    """
    return _set_default({"brain": brain, "reason": reason})


@server.tool(name="spend_report")
@_guard
def spend_report(limit: int = 20) -> str:
    """What brain routing has actually cost, read from the audit ledger — every
    consult, its brain, its justification, and its exact price.

    Use this to answer "what has this cost me".

    Args:
        limit: How many recent entries to show.
    """
    return _spend_report({"limit": limit})


def _consult(args: dict) -> str:
    tier = str(args.get("tier", "deep"))
    question = str(args.get("question", "")).strip()
    context = str(args.get("context", "") or "").strip()
    why = str(args.get("why", "")).strip()
    max_tokens = int(args.get("max_tokens") or 2000)
    confirmed = bool(args.get("require_confirmation"))

    if not question:
        return "consult needs a question."

    brain = resolve(tier)
    if brain is None:
        return f"unknown brain '{tier}'. Valid tiers: {', '.join(TIER_TO_MODEL)}"

    # Guard 1: the daily ceiling.
    today = _spent(_today())
    if today >= DAILY_CAP_USD:
        return (
            f"REFUSED. Consults have already cost {_money(today)} today, which "
            f"is at the {_money(DAILY_CAP_USD)} daily cap. Tell William the cap "
            "was hit and let him decide whether to raise it. Answer from your "
            "own brain in the meantime."
        )

    # Guard 2: the per-call ceiling.
    est = _estimate(brain, question, context, max_tokens)
    if est > SOFT_CAP_USD and not confirmed:
        return (
            f"NOT SENT — this needs William's approval first.\n\n"
            f"Brain    : {brain.model} ({brain.tier})\n"
            f"Estimate : up to {_money(est)} for this one question\n"
            f"Ceiling  : {_money(SOFT_CAP_USD)} without approval\n"
            f"Reason   : {why}\n\n"
            "Quote him that number, and only call this again with "
            "require_confirmation=true once he has said yes."
        )

    data = _post(
        "/messages",
        {
            "model": brain.model,
            "max_tokens": max_tokens,
            "system": (
                "You are being consulted by Jarvis, another AI assistant, on "
                "behalf of William Lavold. You are the stronger brain he "
                "escalated to, so this question is hard and the answer costs "
                "real money. Be rigorous and specific. State your reasoning "
                "where it matters and flag your genuine uncertainty rather than "
                "papering over it. No preamble."
            ),
            "messages": [
                {
                    "role": "user",
                    "content": (
                        f"{question}\n\n--- CONTEXT ---\n{context}"
                        if context
                        else question
                    ),
                }
            ],
        },
    )

    answer = "\n".join(
        b.get("text", "")
        for b in data.get("content", [])
        if b.get("type") == "text"
    ).strip()

    usage = data.get("usage", {}) or {}
    cost = price(brain, usage)

    _log(
        {
            "kind": "consult",
            "brain": brain.model,
            "tier": brain.tier,
            "why": why,
            "cost_usd": round(cost, 6),
            "input_tokens": usage.get("input_tokens", 0),
            "output_tokens": usage.get("output_tokens", 0),
            "question_preview": question[:200],
        }
    )

    return (
        f"[consulted {brain.model} — cost {_money(cost)}; "
        f"{_money(_spent(_today()))} spent today]\n\n{answer}"
    )


def _set_default(args: dict) -> str:
    brain = resolve(str(args.get("brain", "")))
    reason = str(args.get("reason", "")).strip()
    if brain is None:
        return f"unknown brain. Valid tiers: {', '.join(TIER_TO_MODEL)}"

    previous = _current_default()
    target = f"anthropic/{brain.model}"

    try:
        import yaml  # Hermes ships PyYAML; only needed on this path.

        cfg = {}
        if CONFIG.exists():
            cfg = yaml.safe_load(CONFIG.read_text()) or {}
        cfg.setdefault("model", {})
        cfg["model"]["default"] = target
        cfg["model"]["provider"] = "anthropic"
        CONFIG.parent.mkdir(parents=True, exist_ok=True)
        CONFIG.write_text(yaml.safe_dump(cfg, sort_keys=False, allow_unicode=True))
    except Exception as e:
        return f"could not write config: {e}"

    _log({"kind": "set_default", "from": previous, "to": target, "why": reason})

    return (
        f"Default brain changed: {previous} -> {target}\n"
        f"Reason: {reason}\n"
        f"Price: ${brain.input_per_mtok:g} in / ${brain.output_per_mtok:g} out per Mtok.\n"
        "This takes effect in the NEXT session, not this one."
    )


def _spend_report(args: dict) -> str:
    limit = int(args.get("limit") or 20)
    rows = _ledger_rows()
    if not rows:
        return "No routing spend recorded yet. The ledger is empty."

    out = [
        f"Total recorded: {_money(_spent())}   Today: {_money(_spent(_today()))}",
        "",
    ]
    for r in rows[-limit:]:
        if r.get("kind") == "set_default":
            out.append(
                f"  {r.get('at','')[:19]}  default {r.get('from')} -> {r.get('to')}"
            )
            continue
        out.append(
            f"  {r.get('at','')[:19]}  {r.get('brain','?'):<20} "
            f"{_money(float(r.get('cost_usd', 0) or 0)):>9}  {r.get('why','')[:70]}"
        )
    return "\n".join(out)


if __name__ == "__main__":
    # mcp 1.28.1 (the version Hermes pins): FastMCP owns the loop and stdio.
    server.run()
