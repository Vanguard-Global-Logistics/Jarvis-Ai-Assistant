# Jarvis governed continual-improvement loop

Decision owner: William Lavold. Status: first executable proposal-generation slice.

Jarvis adopts the useful ideas behind Prime Intellect's Prime Agent Continual Harness:
durable observations, recursive specialist review, reusable skills, evidence-backed
refinement, background continuity, and rollback. Prime Agent is research input, not the
owner of Jarvis identity, memory, permissions, voice, AEGIS, or production code.

## Daily loop

1. Observe bounded structural evidence from approved Jarvis interactions. Do not archive
   raw microphone audio, full transcripts, credentials, secrets, or unrelated household
   speech as learning evidence.
2. Compare the previous seven days for repeated tasks, corrections, failures, and latency.
3. Create a compact improvement candidate after three repetitions, two corrections, two
   failures, or three measured latency observations.
4. Attach source references and measurable acceptance criteria.
5. Show William an owner-visible proposal. Jarvis may run sandbox tests and independent
   reviews, but it cannot approve its own change.
6. Promote only a reviewed, reversible improvement with passing evidence.
7. Monitor the result. Roll back when the measured outcome worsens or a boundary is crossed.

## What can improve automatically

- Retrieval ranking and context-pack selection within existing permissions.
- Local caches and non-authoritative performance tuning with rollback.
- Detection of recurring tasks and generation of draft skill specifications.
- Test/evaluation generation and comparison reports.
- Local summaries that remain learning candidates until approved.

## What never self-promotes

- Jarvis identity, SOUL, Constitution, policy, or owner objectives.
- AEGIS code, state, rules, logs, permissions, or recovery.
- Biometrics, Cipher, credentials, secrets, provider authentication, or spending.
- Production code, executable skills, downloads, deployments, external messages, email,
  calendar changes, purchases, financial actions, or employer-system access.
- A claim inferred by a model without owner or deterministic-tool confirmation.

The daily job writes only local proposal reports under
`~/.jarvis/continual-learning/`. It does not rewrite Jarvis, Hermes, R13.3, skills,
policy, or memory. The first slice needs an approved observation adapter before daily use
can generate meaningful proposals. Until that adapter exists, an empty daily report is
the correct and honest result.

## Prime Agent evaluation boundary

Prime Agent's persistent IPython and recursive agents may be tested later inside a
disposable clone or restricted worker. They must not run with unrestricted access to the
live Jarvis repository, private memory, biometric profile, employer systems, or normal
Mac user permissions. Any later adapter must enter through the Jarvis Tool Bridge and a
real approval boundary.
