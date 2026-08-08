# Throne and Hive Federation Threat Model

- Status: Governing design; federation implementation blocked by the release gates below
- Owner: William Lavold
- Security authority: AEGIS
- Last reviewed: 2026-08-08
- Related decision: [ADR 0010](../DECISIONS/0010-throne-aegis-hive-federation.md)

## Security position

The design assumes every Hive, model, operator, skill, tool result, update, dependency, message, and marketplace participant can be malicious or compromised. A valid certificate identifies an actor; it does not make that actor trustworthy.

The system must remain safe when one participant lies, when several participants collude, when Throne is partially compromised, and when an approved model changes behavior. Safety may not depend on a model obeying prose.

## Assets to protect

1. Owner identity, consent, keys, private memory, family data, business data, and intellectual property.
2. Local devices, files, accounts, money, physical systems, and reputation.
3. AEGIS policy, enforcement code, audit evidence, and recovery keys.
4. Marketplace integrity, contract settlement, verified reviews, and fair discovery.
5. Throne's release, certification, revocation, and transparency infrastructure.
6. The public from fraud, unsafe automation, political manipulation, and coordinated abuse.

## Non-negotiable invariants

- Deny by default. No identity, network position, certificate, reputation, or prior success creates ambient authority.
- AEGIS is outside the model's control path and mediates every privileged transition.
- Every session uses fresh identities, nonces, short expiry, channel binding, and one canonical signed task contract.
- Policy composition is intersection, never union. Any required denial ends the session.
- Only minimum-necessary projections enter a sandbox; raw memory and reusable secrets do not.
- All model text, retrieved content, tool output, code, and peer messages remain untrusted.
- Approval binds to an artifact hash, purpose, destination, and time. A changed artifact needs new approval.
- Human approval is mandatory for high-impact action and cannot be inferred from silence.
- No unlisted delegation, no recursive authority, and no capability may outlive its task.
- Throne can isolate federation risk without bricking or taking ownership of a customer's local system.
- Logs are evidence, not a secret dumping ground. Sensitive payloads never appear in routine logs.
- Federation stays off until every release gate has machine-verifiable evidence.

## Trust boundaries and responsibilities

| Component         | May do                                                                        | Must never do                                                                        |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Local Jarvis      | Help its owner within local grants                                            | Change AEGIS, mint authority, or export private memory by itself                     |
| Local AEGIS       | Admit, restrict, inspect, veto, quarantine, and sign evidence                 | Delegate its veto or accept another Hive's policy as its own                         |
| Federation broker | Relay canonical messages and evidence                                         | Read plaintext unnecessarily, broaden grants, or decide policy                       |
| Task sandbox      | Execute one bounded contract                                                  | Inherit host credentials, ambient network, persistent memory, or sibling access      |
| Throne            | Sign releases, certify versions, revoke federation access, govern marketplace | Read customer memory, commandeer compute, wipe devices, or silently change contracts |
| Human owner       | Give informed, scoped approval                                                | Be represented by a model or dark-pattern consent flow                               |
| Marketplace       | Settle a verified contract and bind review eligibility                        | Sell certification, reviews, political influence, or hidden ranking preference       |

## Required task-contract fields

The canonical serialization must be versioned and deterministic. Unknown fields fail validation.

| Field group | Required contents                                                                |
| ----------- | -------------------------------------------------------------------------------- |
| Identity    | Hive IDs, worker IDs, owner role, key IDs, software and AEGIS versions           |
| Intent      | Exact purpose, allowed inputs, expected output schema, forbidden uses            |
| Data        | Classification, field-level projections, retention, residency, deletion deadline |
| Capability  | Tools, paths, hosts, methods, secret handles, device actions                     |
| Economics   | Price, escrow, settlement condition, dispute rule, refund state                  |
| Budgets     | CPU, memory, accelerator, storage, network, tokens, energy, money, wall time     |
| Delegation  | Allowed delegates, purpose, depth, and budget subdivision                        |
| Governance  | Required AEGIS signatures, required humans, legal/policy version                 |
| Freshness   | Nonce, issue time, expiry, transcript hash, channel binding                      |
| Output      | Schema, provenance, destination, ownership, license, review eligibility          |

## Session state and irreversible transitions

| State     | Admission evidence                             | Allowed next state              |
| --------- | ---------------------------------------------- | ------------------------------- |
| PROPOSED  | Complete canonical contract                    | ATTESTED or ABORTED             |
| ATTESTED  | Fresh mutual identity and version evidence     | ADMITTED or ABORTED             |
| ADMITTED  | Every AEGIS signs the same contract hash       | EXECUTING or ABORTED            |
| EXECUTING | Sandbox and live budgets remain valid          | REVIEWING or ABORTED            |
| REVIEWING | Output frozen and hashed; provenance complete  | APPROVED or ABORTED             |
| APPROVED  | All required AEGIS and humans sign output hash | EXPORTED or ABORTED             |
| EXPORTED  | Destination receipt matches approved hash      | Terminal                        |
| ABORTED   | Denial, timeout, change, revocation, or fault  | Terminal; new contract required |

## Threat matrix

"Closed" below means the design has a mandatory control and a required test. It does not mean the control exists in production yet.

| ID  | Exploit or failure                                       | Fail-closed control                                                                                                                                 | Evidence required before federation                                                 |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| T01 | Sybil Hives, cloned identity, or certificate sharing     | Per-install hardware-backed key where available; separate owner and worker identities; certificate transparency; rate and relationship graph limits | Clone, duplicate-key, and mass-enrollment tests are rejected or quarantined         |
| T02 | Key theft, recovery takeover, or stolen backup           | Short-lived leaf credentials; threshold recovery; owner-visible key rotation; old-key revocation; no reusable bearer tokens                         | Lost-device and malicious-recovery drills cannot regain prior grants                |
| T03 | A valid, certified Hive becomes compromised              | Treat certification as eligibility only; per-task least privilege; continuous policy checks; rapid quarantine                                       | A compromised certified peer cannot read memory or invoke an unlisted tool          |
| T04 | Jarvis disables, downgrades, imitates, or bypasses AEGIS | Separate process and keys; signed measured version; anti-rollback; enforcement at broker, sandbox, and host boundaries                              | Kill, downgrade, shim, and fake-AEGIS tests abort before admission                  |
| T05 | Attestation replay, stale approval, or clock rollback    | Nonces, short expiry, monotonic counters, trusted time evidence, session and channel binding                                                        | Captured attestations and approvals fail in a later session                         |
| T06 | Parser disagreement or policy-negotiation confusion      | One canonical encoding and schema version; sign bytes, not interpreted prose; reject unknown fields; policy intersection                            | Differential parser corpus produces identical hashes or rejection                   |
| T07 | Task replay, double execution, or double settlement      | Idempotency key, single-use capability, nonce ledger, atomic settlement state                                                                       | Replayed requests cannot rerun tools, move money, or create a second review         |
| T08 | Confused deputy or capability escalation                 | Purpose-bound capabilities; explicit subject, object, action, destination, and budget; no ambient credentials                                       | A valid token fails when any purpose, resource, destination, or actor changes       |
| T09 | Direct or indirect prompt injection                      | Treat peer and retrieved text as data; separate instructions from content; deterministic tool policy; output taint and human gate                   | Injection corpus cannot alter contract, AEGIS policy, tools, or destinations        |
| T10 | Memory poisoning or cross-Hive persistence               | No raw-memory exchange; typed projections; provenance and trust labels; quarantine; owner-confirmed promotion to long-term memory                   | Peer text never becomes durable trusted memory without an explicit promotion event  |
| T11 | Malicious skill, tool, dependency, model, or update      | Signed manifests, pinned hashes, SBOM, reproducible build target, scoped capabilities, staged rollout, rollback and revocation                      | Tampered artifacts, unsigned updates, and dependency confusion fail installation    |
| T12 | Sandbox escape or host pivot                             | Disposable microVM or equivalently isolated runtime; no host mounts; syscall/device denial; brokered egress; patched base image                     | Escape suite cannot reach host, sibling task, device, credential, or control socket |

| T13 | Data exfiltration through output, DNS, timing, logs, or steganography | Destination allowlist; content and size schemas; fixed-rate broker where needed; secret scanning; DLP; no direct DNS; redact logs | Canary secrets and covert-channel tests do not cross the sandbox boundary |
| T14 | Unauthorized delegation or authority laundering through another Hive | Delegation denied by default; explicit delegate identity and purpose; depth and budget decrease monotonically; original AEGIS sees the whole chain | Hidden, recursive, substitute, and over-budget delegates are rejected |
| T15 | Collusion, Byzantine voting, or mutually approving malicious Hives | AEGIS veto is not majority vote; independent policy checks; redundant deterministic validators for critical results; related-party analysis | Several colluding Hives cannot override one required denial or forge independent evidence |
| T16 | Resource theft, denial of service, cryptomining, or cost explosion | Owner opt-in; hard resource cgroups/quotas; cost preauthorization; rate limits; circuit breakers; immediate local kill | Adversarial jobs stop at each CPU, memory, token, network, energy, cost, and time limit |
| T17 | Poisoned computation, false work, or model extraction | Reproducible job spec; input/output commitments; sampling or redundant execution; result validators; query and output budgets | Known-wrong workers are detected, settlement is withheld, and extraction probes are rate-limited |
| T18 | Deadlock, approval fatigue, or griefing | Bounded protocol rounds; timeouts deny; no payment for incomplete state; consent batching without blanket grants; peer penalty for repeated abuse | Non-responsive peers release resources and cannot turn silence into approval or payment |
| T19 | Fake purchases, review rings, refunds after review, or reputation laundering | Escrowed proof of service; one review per side per contract; refund/dispute linkage; related-party and anomaly detection; appeals | Circular, self-funded, duplicated, refunded, and low-value farming patterns lose ranking weight |
| T20 | Bought ranking, political targeting, astroturfing, or election influence | No political ads or funding; no pay-to-rank; viewpoint-neutral rules; provenance and transparency reports; coordinated-behavior controls | Political targeting and covert amplification simulations are blocked and create audit alerts |
| T21 | Throne admin, build system, or root-key compromise | Split duties and threshold signing; offline recovery root; hermetic build; transparency log; staged rollout; regional and local kill switches | One admin, CI job, or online key cannot ship or enforce a fleet-wide destructive action |
| T22 | Revocation failure, offline use, freeze attack, or rollback | Short-lived credentials; stapled revocation status; maximum offline lease; monotonic version counters; secure recovery mode | Revoked or rolled-back nodes cannot federate after the bounded offline window |
| T23 | Audit deletion, fork, repudiation, or secret leakage in logs | Hash-chained signed receipts; cross-party checkpoints; external transparency anchoring; payload minimization and redaction | Deleted/forked events are detectable, signatures verify, and secret canaries never enter logs |
| T24 | Privacy harm, family surveillance, or unsafe handling of minors' data | Data minimization; purpose and retention limits; guardian policy where lawful; age-appropriate defaults; no behavioral ads; deletion proof | Export, retention, and recommender tests enforce the strictest applicable family policy |
| T25 | Real-world action laundering through a low-risk-looking subtask | End-to-end purpose lineage; cumulative risk scoring; action-class gate at the final actuator; responsible human approval | Splitting money, identity, employment, health, legal, publication, or device actions cannot bypass the high-impact gate |

## Loopholes that require architectural closure

### A certificate can become a master key

A common mistake is to certify a Hive once and then trust every later request. Certification must only enable discovery and protocol negotiation. Authority comes from the current short-lived task capability after fresh AEGIS decisions.

### Two AEGIS systems can collude or share the same bug

Agreement is necessary but not sufficient. Critical output also needs deterministic validators, provenance checks, and a responsible human. Security-sensitive AEGIS releases use staged deployment so every participant is not forced onto one untested version at once.

### The sandbox can be safe while its output is dangerous

Isolation protects hosts during execution; it does not make an answer, file, command, contract, recommendation, or payment safe. Export is a separate privileged action with a frozen hash, destination policy, malware/content checks, provenance, and approvals.

### Reviews can be bought through tiny real transactions

Verified payment prevents anonymous drive-by reviews but does not prevent review farming. Ranking must consider service value, refund/dispute state, related parties, velocity, diversity, and anomaly evidence. The algorithm cannot accept payment or political preference as a positive feature.

### Throne can become the largest single point of failure

Mandatory central control without limits would let a stolen key or insider attack every family and business. Throne therefore controls federation admission, not local ownership. Split signing, transparency, staged releases, bounded leases, local kill switches, and independent customer recovery are required.

### Human approval can become meaningless

Repeated prompts, vague scopes, urgency, and preselected choices can manufacture consent. Approval UI must show actor, action, data, destination, cost, reversibility, and expiry in plain language. Reject is always available; silence and timeout mean deny.

## Release gates

No production federation, marketplace federation badge, or claim of secure Hive collaboration is allowed until every gate is green.

| Gate                        | Required implementation and proof                                                                                                     | Current state                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| G0 Local Jarvis boundary    | Privileged desktop IPC validates its sender before parsing or executing; navigation, permissions, and preload surface are locked down | Implemented; eight security tests, full verification, build, Linux runtime probe, and audit are green. macOS package test remains open |
| G1 Canonical protocol       | Versioned task schema, deterministic serialization, transcript hashing, nonces, expiry, idempotency, and fail-closed state machine    | Not implemented                                                                                                                        |
| G2 Identity and freshness   | Per-Hive and per-worker keys, mutual authentication, key rotation, revocation, recovery, anti-replay, and bounded offline leases      | Not implemented                                                                                                                        |
| G3 AEGIS reference monitor  | Separate enforcement process, signed measured version, anti-rollback, independent veto, and policy-intersection engine                | Not implemented                                                                                                                        |
| G4 Task isolation           | Disposable sandbox, no ambient host access, brokered tools and egress, hard resource budgets, and escape test suite                   | Not implemented                                                                                                                        |
| G5 Data and memory          | Typed minimum-data projections, provenance and taint, secret scanning, retention enforcement, and explicit memory promotion           | Not implemented                                                                                                                        |
| G6 Output and human control | Frozen output hash, validator chain, destination binding, high-impact classification, and informed human approval                     | Not implemented                                                                                                                        |
| G7 Commerce and reviews     | Escrow, proof of service, atomic settlement, disputes/refunds, verified review eligibility, fraud detection, and appeals              | Not implemented                                                                                                                        |
| G8 Throne resilience        | Threshold release/revocation, transparency log, staged rollout, independent recovery, insider controls, and local kill switch         | Not implemented                                                                                                                        |
| G9 Civic and abuse policy   | Political-influence prohibition, no-pay-to-rank proof, coordinated-abuse detection, due process, and transparency reporting           | Not implemented                                                                                                                        |
| G10 Adversarial validation  | Fuzzing, parser differential tests, sandbox escape tests, supply-chain tests, collusion simulations, red team, and incident drill     | Not implemented                                                                                                                        |

## Current code closure

The current Electron main process previously validated IPC request and response schemas but did not validate the sending frame. A hostile child frame or navigated renderer could therefore attempt a privileged contract.

This branch adds a fail-closed sender validator before every registered privileged IPC contract:

- packaged builds accept only the exact renderer entry URL;
- development accepts only the configured HTTP(S) loopback origin;
- lookalike hosts, other ports or schemes, credentials, malformed URLs, sibling packaged files, and packaged URL query/hash variants are rejected;
- untrusted URLs are not copied into logs;
- five validator tests and three IPC-wrapper tests cover accepted, rejected, and missing sender frames.

The exact packaged `file:` URL is an interim boundary. Before federation work, migrate the packaged renderer to a privileged custom Jarvis protocol with standard URL semantics and keep sender validation in place.

## Methodical implementation punchlist

### P0: protect the Jarvis root before adding federation

- [x] Validate the sender of every current privileged Electron IPC contract.
- [x] Add a test that invokes the IPC wrapper with mocked trusted and hostile `senderFrame` values.
- [ ] Replace the packaged `file:` renderer with a privileged custom protocol.
- [ ] Add code signing, notarization, signed update metadata, anti-rollback, and a documented offline recovery path.
- [ ] Put AEGIS in a separately enforced process with its own signing identity and a deliberately tiny API.
- [ ] Add secret-safe, hash-chained security event receipts and owner-visible quarantine state.

### P1: build a non-networked federation simulator

- [ ] Define canonical task-contract types and deterministic hashing.
- [ ] Implement the monotonic session state machine and property-test every invalid transition.
- [ ] Implement policy intersection and prove that adding a participant can never broaden authority.
- [ ] Implement single-use purpose-bound capabilities, nonces, expiry, delegation depth, and budget monotonicity.
- [ ] Run two independent mock AEGIS instances against hostile protocol fixtures with no real tools or data.

### P2: isolate bounded work

- [ ] Add the disposable task sandbox and brokered tool facade.
- [ ] Deny host mounts, direct network, host credentials, device access, and sibling communication.
- [ ] Enforce compute, token, money, network, storage, energy, and wall-time budgets outside the model.
- [ ] Add typed memory projections, provenance/taint tracking, and explicit owner-controlled memory promotion.
- [ ] Add frozen-output review and human approval bound to exact hash and destination.

### P3: add commerce only after security evidence

- [ ] Implement escrow, proof of service, idempotent settlement, refunds, disputes, and economic abuse limits.
- [ ] Make review eligibility a consequence of a completed contract, never a purchasable ranking signal.
- [ ] Detect related-party rings, circular payments, Sybil enrollment, and coordinated amplification.
- [ ] Publish marketplace ranking inputs, political-influence prohibition, enforcement statistics, and appeals.
- [ ] Commission an independent penetration test and multi-Hive red-team exercise before public launch.

## Verification strategy

Automated tests must include unit, property, integration, fuzz, differential-parser, chaos, and adversarial scenario suites. Every security invariant needs a negative test that attempts to violate it. Tests run with hostile models and hostile peers; a cooperative model is not a security test.

Required prelaunch drills include stolen keys, AEGIS downgrade, malicious signed update, replayed approval, sandbox escape, DNS and timing exfiltration, memory poisoning, recursive delegation, colluding Hives, cost exhaustion, double settlement, review ring, political amplification, Throne insider, transparency-log fork, and offline revocation.

Security-critical releases use a canary cohort, automatic rollback, and an owner-visible local stop control. Red-team findings block the relevant gate until a regression test exists.

## Incident response

1. Freeze new federation admission for the affected version or credential class.
2. Preserve signed evidence without collecting unrelated customer content.
3. Revoke the smallest affected scope and distribute fresh status through independent channels.
4. Notify affected owners with impact, evidence, containment, and safe local steps.
5. Recover through clean signed builds and owner-controlled key rotation; never remote-wipe as containment.
6. Validate the fix with the original exploit and a permanent regression test.
7. Publish a transparency entry and permit appeal when a Hive or seller was quarantined incorrectly.

## Residual risk and honest claims

No design can guarantee that every AI output is true, that every sandbox is unbreakable, or that all collusion is detected. The defensible promise is narrower: authority is explicit and minimal, boundaries are independently enforced, failures default to no action, evidence is tamper-evident, owners retain control, and new exploits become regression tests.

Until G0 through G10 are green, describe Hive federation as a design and test program, not a deployed security capability.

## Standards checked

- [Electron security: validate the sender of all IPC messages](https://www.electronjs.org/docs/latest/tutorial/security)
- [NIST SP 800-207: Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final)
- [NIST SP 800-207A: cloud-native access-control model](https://csrc.nist.gov/pubs/sp/800/207/a/final)
- [OWASP Agentic AI: Threats and Mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/)
- [OWASP Multi-Agentic System Threat Modeling Guide](https://genai.owasp.org/resource/multi-agentic-system-threat-modeling-guide-v1-0/)
- [OWASP Agentic Skills Top 10](https://owasp.org/www-project-agentic-skills-top-10/)
- [Linux Foundation Agent2Agent protocol project](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents)
