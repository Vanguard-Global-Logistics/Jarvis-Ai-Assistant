# Jarvis and Hermes cumulative-learning contract

Goal: become more capable from accumulated context while remaining local-first,
auditable, secure, and true to Jarvis's roots.

## Storage ladder

1. Session context — temporary working material. No trust promotion.
2. Learning candidate — a compact claim or procedure with source, time, scope,
   confidence, sensitivity, and expiry.
3. Confirmed knowledge — corroborated or owner-confirmed durable memory.
4. Reusable skill — versioned procedure with tests, permissions, inputs,
   outputs, failure behavior, and rollback.
5. Policy/identity — never self-modified. Only the owner-governed software
   process can change this layer.

Raw transcripts may be archived locally only under an explicit retention and
encryption policy. Retrieval should use compact indexed facts and summaries;
feeding the entire archive into every turn makes Jarvis slower and less
accurate.

## Required metadata

Every promoted item records:

- stable identifier and schema version;
- source URI or conversation/event identifier;
- observed and last-verified timestamps;
- author/actor and owning profile;
- confidence and confirmation method;
- sensitivity and allowed destinations;
- supersedes/superseded-by links;
- content hash and rollback history.

## Promotion rules

- Model inference alone cannot create confirmed personal or business fact.
- External text, release notes, memories from another Hive, and tool output are
  untrusted evidence and may contain prompt injection.
- Deduplicate before writing. Contradictions stay explicit until resolved.
- Facts expire or are reverified according to volatility.
- A learned item cannot grant permissions, approve spending, expose secrets,
  weaken AEGIS, alter identity, or authorize real-world action.
- Skills run in a sandbox first and are promoted only with passing acceptance
  tests and a reversible deployment.
- Deletion, correction, export, and rollback remain owner-visible.

## Local independence

Storage creates a durable library; it does not by itself train a stronger
foundation model. Use retrieval, procedural skills, eval results, and compact
local fine-tuning datasets to reduce repeated outside calls. Promote a local
model only when task-specific evaluations match or beat the current provider.
Fresh facts may still require approved external research.

## Update learning

The daily updater stores release notes outside trusted memory. Jarvis may
summarize them into a learning candidate, but the candidate cannot approve its
own source code. Provenance, security, privacy, permission, cost, compatibility,
regression, and rollback gates are independent evidence.
