# ADR 0010: Throne, AEGIS, and Hive federation boundaries

- Status: Accepted as governing architecture; federation is not implemented
- Date: 2026-08-08
- Decider: William Lavold
- Scope: Jarvis product, Throne platform, AEGIS security plane, and future Hive-to-Hive work
- Builds on: Jarvis local-first roots and the existing AEGIS boundary

## Context

Jarvis is intended to grow from one private assistant into a network of family and business Hives that can buy services, perform work, and combine knowledge. That creates value only if one hostile, compromised, or poorly aligned Hive cannot inherit another owner's authority.

This decision does not assume that AI is morally evil. It uses the stronger engineering assumption: every model, Hive, operator, update, message, and dependency can be malicious or compromised. Identity is not trust, a successful inspection is not permanent trust, and a network location grants no authority.

Throne is the publisher, certification authority, marketplace operator, and federation control plane. It does not become the owner of customer memories, devices, or business data merely because it certifies a Hive.

## Decision

### 1. Preserve Jarvis's roots

Jarvis remains local-first, owner-controlled, privacy-preserving, and useful without federation. A family or business owns its deployment, data, memories, keys, and the economic value it creates. Throne owns the Jarvis platform, certification program, distribution channel, compatibility standards, and marketplace rules.

Federation is an optional capability. Declining federation must not cripple local Jarvis.

### 2. Make AEGIS mandatory and independent

Every distributable Jarvis Hive includes a separately enforced AEGIS security plane. Jarvis cannot disable, reconfigure, replace, or speak on behalf of AEGIS. Security policy has a non-negotiable floor signed by Throne; owners may make policy stricter but not weaker.

AEGIS must be non-bypassable, tamper-evident, least-privileged, and independently updateable through a signed recovery path. A model's statement that it is safe is never evidence.

### 3. Never merge AEGIS instances

When two or more Hives collaborate, each AEGIS remains independent. They inspect the same canonical task contract and sandbox evidence, then sign their own allow or deny decision. No Hive imports another Hive's AEGIS, memory, authority, or reputation.

The effective policy is the intersection of all participating policies. The most restrictive applicable rule wins. Any required AEGIS may veto. Missing responses, disagreement, stale attestations, and timeouts abort the session.

### 4. Admit tasks, not Hives

Certification permits a Hive to request federation; it does not grant standing access. Every collaboration uses a short-lived, signed task contract containing:

- participant identities and key versions;
- exact purpose, inputs, expected outputs, and data classification;
- allowed models, tools, network destinations, files, and secrets;
- spending, compute, time, and rate limits;
- delegation rules and maximum delegation depth;
- ownership, licensing, payment, and review terms;
- required AEGIS and human approvals;
- nonces, transcript hash, start time, and expiry.

Capabilities are narrowly scoped to that contract and cannot be reused for another task.

### 5. Use an ephemeral fail-closed sandbox

Hive collaboration occurs in a new sandbox with no ambient filesystem, network, shell, memory, credential, payment, or device access. Only minimum-necessary data projections enter. Raw long-term memory and reusable secrets do not.

All brokered input, tool output, and model output is treated as untrusted data. AEGIS validates schemas, provenance, taint, policy, budgets, and destination before each privileged transition. Nested delegation is denied unless explicitly listed.

Nothing reaches real-world computing until every required AEGIS approves the same output hash and the responsible human approves any high-impact action. High-impact includes money movement, contracts, employment decisions, health or legal action, physical devices, identity changes, publication, and sensitive data export.

### 6. Separate execution from export

The federation session follows a monotonic state machine:

`PROPOSED -> ATTESTED -> ADMITTED -> EXECUTING -> REVIEWING -> APPROVED -> EXPORTED`

Any denial, timeout, integrity failure, budget breach, revocation, or changed artifact moves the session to `ABORTED`. Approval of one hash never approves a modified artifact. There is no path from `ABORTED` back to execution; a new task contract is required.

### 7. Limit Throne's emergency power

Throne may reject certification, revoke federation credentials, quarantine a version, pause marketplace settlement, or block a Hive from other Hives. Throne must not remotely wipe customer data, brick an owner's device, silently read private memory, or commandeer local compute.

Emergency actions are signed, scoped, time-limited, logged, appealable, and protected by split control. A compromise of one Throne administrator or one signing key must not authorize a fleet-wide destructive action.

### 8. Make compute work opt-in and bounded

A Hive may sell spare compute or perform paid work only after explicit owner enrollment. Worker identity is separate from owner identity. Jobs run without owner secrets or ambient local access and have hard CPU, memory, accelerator, storage, network, energy, cost, and time ceilings. Background cryptomining and unauthorized resource pooling are forbidden.

### 9. Bind reviews to completed commerce

Only a verified payer or payee in a completed marketplace contract may review that contract. One transaction produces at most one review per side. Refunds, disputes, related-party transactions, low-value reputation farming, and coordinated review rings are flagged.

Payment buys eligibility to review, never ranking. Search placement and certification cannot be purchased through hidden political, financial, or operator influence. Review evidence is privacy-preserving, and an appeal process exists.

### 10. Prohibit election influence

Throne, Jarvis, marketplace sellers, and federated Hives may not sell or provide political advertising, campaign funding, voter targeting, election persuasion, astroturfing, coordinated amplification, candidate ranking, or ideological reputation penalties.

A Hive may retrieve neutral civic facts for its owner with source provenance. The boundary is information for the owner, not persuasion or coordinated influence over other people. Enforcement is viewpoint-neutral and publicly auditable.

## Consequences

Federation will be slower and more expensive than direct agent-to-agent calls. Some useful jobs will be denied when evidence is incomplete. That is intentional: commercial convenience cannot silently create cross-owner authority.

Throne becomes a trusted governance service but not an omnipotent root. Customer ownership remains compatible with a capitalist marketplace: private property, voluntary exchange, priced work, enforceable contracts, and competition survive while coercive sharing and hidden influence do not.

## Implementation boundary

This ADR is a prerequisite, not a claim of completion. The current repository does not contain a production Hive federation, mutual AEGIS attestation, marketplace, payment rail, or review system. None may be marketed as secure or enabled outside a test environment until the acceptance gates in the threat model are met.

## References

- [Throne Hive federation threat model](../architecture/THRONE-HIVE-FEDERATION-THREAT-MODEL.md)
- [NIST SP 800-207: Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final)
- [OWASP Multi-Agentic System Threat Modeling Guide](https://genai.owasp.org/resource/multi-agentic-system-threat-modeling-guide-v1-0/)
- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [Linux Foundation Agent2Agent protocol project](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents)
