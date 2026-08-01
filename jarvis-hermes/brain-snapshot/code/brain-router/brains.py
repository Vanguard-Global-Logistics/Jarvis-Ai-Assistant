"""The Jarvis brain lineup: what each model costs and what it is for.

Prices are dollars per million tokens, taken from Anthropic's published pricing
page. They are stated here explicitly rather than guessed, because every routing
decision Jarvis makes is a spending decision and William has to be able to audit
the number.

Source: https://platform.claude.com/docs/en/about-claude/pricing
Verified: 2026-08-01
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional


@dataclass(frozen=True)
class Brain:
    model: str
    tier: str
    input_per_mtok: float
    output_per_mtok: float
    cache_read_per_mtok: float
    cache_write_per_mtok: float
    use_for: str
    # Rough relative cost of one typical turn, normalized to the cheapest brain.
    # Used for the "is this worth escalating?" explanation, not for billing.
    relative_cost: float


# Ordered cheapest -> most expensive. Order matters: escalation walks up.
BRAINS: Dict[str, Brain] = {
    "claude-haiku-4-5": Brain(
        model="claude-haiku-4-5",
        tier="quick",
        input_per_mtok=1.00,
        output_per_mtok=5.00,
        cache_read_per_mtok=0.10,
        cache_write_per_mtok=1.25,
        use_for=(
            "High volume and low stakes. Classification, extraction, formatting, "
            "yes/no checks, short lookups, reading a file to answer one factual "
            "question, tidying text. Anything where being wrong is cheap to catch."
        ),
        relative_cost=1.0,
    ),
    "claude-sonnet-5": Brain(
        model="claude-sonnet-5",
        tier="default",
        input_per_mtok=2.00,
        output_per_mtok=10.00,
        cache_read_per_mtok=0.20,
        cache_write_per_mtok=2.50,
        use_for=(
            "The default brain — everyday work, writing, ordinary tool use, "
            "most conversation, most code edits. If there is no clear reason to "
            "go cheaper or stronger, this is the answer."
        ),
        relative_cost=2.0,
    ),
    "claude-opus-5": Brain(
        model="claude-opus-5",
        tier="deep",
        input_per_mtok=5.00,
        output_per_mtok=25.00,
        cache_read_per_mtok=0.50,
        cache_write_per_mtok=6.25,
        use_for=(
            "Complex projects, agentic multi-step work, and hard coding. Reach "
            "here when a task has real branching, when a wrong answer is "
            "expensive to undo, when designing architecture, or when the cheaper "
            "brain has already tried and produced something unconvincing."
        ),
        relative_cost=5.0,
    ),
    "claude-fable-5": Brain(
        model="claude-fable-5",
        tier="max",
        input_per_mtok=10.00,
        output_per_mtok=50.00,
        cache_read_per_mtok=1.00,
        cache_write_per_mtok=10.00,
        use_for=(
            "The heaviest brain. Deep research, genuinely novel problems, and "
            "work that spans days. Ten times the price of the quick brain — "
            "justify it out loud before using it, every time."
        ),
        relative_cost=10.0,
    ),
}

# Older models still available on the account. Kept so a stale config or an
# explicit request still prices correctly rather than silently costing $0.
LEGACY: Dict[str, Brain] = {
    "claude-opus-4-8": Brain(
        model="claude-opus-4-8", tier="deep", input_per_mtok=5.00,
        output_per_mtok=25.00, cache_read_per_mtok=0.50,
        cache_write_per_mtok=6.25,
        use_for="Previous-generation deep brain. Prefer claude-opus-5.",
        relative_cost=5.0,
    ),
    "claude-sonnet-4-6": Brain(
        model="claude-sonnet-4-6", tier="default", input_per_mtok=3.00,
        output_per_mtok=15.00, cache_read_per_mtok=0.30,
        cache_write_per_mtok=3.75,
        use_for=(
            "Previous-generation default. Strictly worse value than "
            "claude-sonnet-5, which is newer AND cheaper. Do not choose this."
        ),
        relative_cost=3.0,
    ),
}

TIER_TO_MODEL = {
    "quick": "claude-haiku-4-5",
    "default": "claude-sonnet-5",
    "deep": "claude-opus-5",
    "max": "claude-fable-5",
}


def resolve(name: str) -> Optional[Brain]:
    """Accept a tier name ('deep'), a bare model id, or a vendor-prefixed id."""
    if not name:
        return None
    key = name.strip().lower()
    if key in TIER_TO_MODEL:
        key = TIER_TO_MODEL[key]
    if "/" in key:
        key = key.rsplit("/", 1)[-1]
    return BRAINS.get(key) or LEGACY.get(key)


def price(brain: Brain, usage: dict) -> float:
    """Exact dollar cost of one API call, from the usage block Anthropic returns.

    Cached reads are billed at roughly a tenth of base input, which is why the
    router cares about them: a long-running session that keeps its prompt warm
    costs far less than the raw token count suggests.
    """
    inp = usage.get("input_tokens", 0) or 0
    out = usage.get("output_tokens", 0) or 0
    cread = usage.get("cache_read_input_tokens", 0) or 0
    cwrite = usage.get("cache_creation_input_tokens", 0) or 0
    return (
        inp * brain.input_per_mtok
        + out * brain.output_per_mtok
        + cread * brain.cache_read_per_mtok
        + cwrite * brain.cache_write_per_mtok
    ) / 1_000_000.0
