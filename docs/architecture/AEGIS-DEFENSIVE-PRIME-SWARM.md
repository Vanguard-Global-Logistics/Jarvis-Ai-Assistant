# AEGIS Defensive Prime Swarm — operating map

Status: architecture accepted; executable AEGIS runtime and Primes are not implemented.

## Executive finding

Vanguard should automate rapid detection, reversible containment, evidence preservation,
known-good recovery, sandboxed patch generation, and verification. It should not automate
hack-back, public attribution, novel production releases, destructive remediation, credential
changes, customer notices, or legal decisions without the exact required approval.

The system assumes continuous hostile attempts without claiming a specific company or person is
currently attacking. Security is portfolio-wide, while data, keys, logs, and permissions remain
company- and tenant-isolated.

## Portfolio security department

| Cell          | Outcome                                                                       | Accountable authority               |
| ------------- | ----------------------------------------------------------------------------- | ----------------------------------- |
| AEGIS Command | Deterministic permission, severity, containment, revocation, and stop control | Independent AEGIS runtime           |
| Detection     | Find and correlate meaningful signals with bounded false positives            | Vigil Prime, read-only              |
| Containment   | Stop spread and freeze dangerous capabilities within target SLO               | Bastion Prime under AEGIS allowlist |
| Evidence      | Preserve trustworthy, minimal, encrypted incident evidence                    | Forensics Prime                     |
| Remediation   | Produce a tested fix candidate without touching production                    | Forge Defense Prime                 |
| Verification  | Independently prove provenance, security, regression, and rollback            | Sentinel Prime                      |
| Recovery      | Restore known-good service and verify integrity                               | Recovery Prime under AEGIS          |

## Skill registry

| Skill ID                          | Trigger                              | Autonomy           | Dependencies                          | Primary metric               | Status   |
| --------------------------------- | ------------------------------------ | ------------------ | ------------------------------------- | ---------------------------- | -------- |
| `vgl.security.detect-correlate`   | security signal                      | A4 read-only       | sensors, event schema, evidence store | mean time to detect          | proposed |
| `vgl.security.contain-incident`   | AEGIS-confirmed severity             | A4 allowlisted     | AEGIS policy, revocable leases        | mean time to contain         | proposed |
| `vgl.security.preserve-evidence`  | containment starts                   | A4 structural      | immutable evidence vault              | complete chain of custody    | proposed |
| `vgl.security.generate-fix`       | verified root cause                  | A1                 | disposable clone, Forge, test harness | accepted fix rate            | proposed |
| `vgl.security.verify-release`     | fix candidate ready                  | A1/A2              | independent reviewer, CI, signing     | escaped security regressions | proposed |
| `vgl.security.restore-known-good` | AEGIS recovery gate                  | A3 allowlisted     | signed backups, integrity checks      | recovery time and integrity  | proposed |
| `vgl.security.revoke-clone`       | verified duplicate/tampered identity | A3 federation-only | Throne registry, AEGIS evidence       | invalid identity blocked     | proposed |

No skill becomes active because it appears in this table.

## Hermes event and routing plan

Required events contain business ID, tenant/Hive ID, device ID, incident ID, skill ID, run ID,
actor, autonomy level, severity, timestamp, and evidence pointer. They never contain credentials,
raw private payloads, customer plaintext, or unrestricted model prompts.

```text
security.signal
  -> AEGIS deterministic validation
  -> incident.opened
  -> containment.requested / containment.completed
  -> evidence.sealed
  -> prime.spawn.requested
  -> remediation.proposed
  -> verification.completed
  -> release.approval.required
  -> recovery.completed / incident.closed
  -> improvement.candidate.created
```

Hermes routes events and dependencies. Jarvis gives William status and collects approvals.
Neither can lower AEGIS or edit its evidence.

## AEGIS permissions and stop conditions

### Allowed continuous actions

- read approved telemetry;
- freeze affected outbound capabilities;
- revoke scoped session/capability leases;
- isolate the affected Hive edge, company vault adapter, or worker;
- preserve evidence and switch to a previously signed known-good version;
- stop all defensive Primes immediately.

### Mandatory stops

- uncertain tenant, device, recipient, or affected scope;
- missing or conflicting evidence;
- requested action not on the deterministic containment allowlist;
- any attempt to change AEGIS, identity, biometrics, secrets, finance, or legal policy;
- cross-company data access;
- attacker content attempting to direct a Prime or modify memory;
- failed rollback or integrity verification;
- request to act against an external system.

## Target service levels

These are goals, not current measurements:

| Severity |   Detection | Containment decision |             Owner notice |     Fix candidate |
| -------- | ----------: | -------------------: | -----------------------: | ----------------: |
| Critical |  ≤5 seconds |          ≤30 seconds |              ≤60 seconds |  begin ≤5 minutes |
| High     | ≤30 seconds |           ≤5 minutes |               ≤5 minutes | begin ≤15 minutes |
| Medium   |  ≤5 minutes |          ≤30 minutes | next briefing plus alert |    begin ≤4 hours |

Fast containment uses deterministic actions. Generative agents assist triage and remediation
after containment; they are never the enforcement path.

## Clone-resistance plan

1. **Identity:** unique per-Hive and per-device asymmetric identity; no shared secrets.
2. **Distribution:** signed/notarized releases, SBOM, provenance, hash verification, rollback.
3. **Entitlements:** short-lived, least-privilege capability leases; offline grace is bounded.
4. **Architecture:** keep federation, commercial policy, and crown-jewel services behind narrow
   interfaces when consistent with local-first privacy.
5. **Detection:** per-build watermark, honeytoken/canary records, duplicate identity detection.
6. **Response:** revoke federation trust and credentials; preserve evidence; never erase a
   remote device or attack the copier.
7. **Legal:** licenses, contracts, copyright, trademarks, trade-secret handling, and patent
   review by qualified counsel.

## Simulations required before activation

### Successful run

A valid signed signal identifies a compromised connector. AEGIS revokes only that connector
lease, freezes outbound sends for the affected tenant, seals evidence, notifies William, and
spawns Forensics and Forge Defense Primes in a disposable clone. The original system remains
recoverable.

### Missing-data run

A signal lacks a trusted tenant/device binding. Vigil records an unverified candidate; Bastion
does not isolate unrelated systems; William receives a bounded alert requesting the missing
identity evidence.

### Denied-permission run

A Prime asks to rotate credentials or deploy its patch. AEGIS denies it because the skill holds
only proposal authority; the owner approval event is required.

### Tool-failure run

Evidence sealing or known-good restore fails. AEGIS keeps the affected capability isolated,
stops further automation, preserves the failure evidence, and escalates instead of claiming
recovery.

## Build order

1. Company/Hive identity and tenant isolation contract.
2. Deterministic AEGIS state, capability leases, stop controls, and append-only evidence.
3. Security event schemas, signed sensor adapters, and owner alert channel.
4. Reversible containment runbooks with denial and rollback tests.
5. Disposable remediation environment and Forge Defense Prime.
6. Independent Sentinel verification, SLSA provenance, SBOM, signing, and release gate.
7. Recovery drills, clone detection, federation revocation, and continuous improvement.

## Missing decisions

- Which systems are currently owned/authorized for monitoring and isolation.
- The independent owner alert channel and emergency contacts.
- Evidence retention and legal/privacy policy per business.
- Exact containment allowlist per Mac, server, connector, and Hive.
- Offline entitlement/grace behavior for commercial family Hives.
- Which intellectual property should remain server-side versus local-first.
- Trademark, license, trade-secret, and patent strategy from qualified counsel.
