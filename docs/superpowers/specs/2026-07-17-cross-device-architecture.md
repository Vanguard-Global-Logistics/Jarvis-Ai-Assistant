# Proposal: The Jarvis Cross-Device Architecture

- **Status:** APPROVED 2026-07-17, with William's F15 ruling incorporated (ADR 0005 §5–6).
- **Nature:** conceptual architecture. **Nothing here authorizes building any client,
  any hosting, or any synchronization infrastructure.** Every subsystem named is
  design-status CONCEPTUAL and implementation-status NOT IMPLEMENTED.

## The principle

**Jarvis is an anywhere-accessible, multi-client platform from the beginning.** Four
interfaces — desktop, mobile, watch, browser — are coordinated views of **one governed
Jarvis identity and shared platform**. They are not separate Jarvis systems. This is
permanent product vision (a North Star strategic priority when the North Star is
authored) and it changes the _shape_ of everything built from Stage 1A onward: shared,
client-agnostic contracts first.

## A — Desktop experience (`docs/architecture/desktop-client.md`, CONCEPTUAL)

The full Jarvis command center: deep conversation · Thought Amplifier · Idea Forge ·
project navigation · files and documents · agent supervision · architecture views ·
Living Universe · development and business workflows · detailed approvals and
reporting. The verified Electron shell is its seed.

## B — Mobile experience (`docs/architecture/mobile-client.md`, CONCEPTUAL)

The portable Jarvis: voice conversation · rapid idea capture · alerts and
notifications · approvals · project and business status · camera and document capture ·
calendar, email, and task interactions · session continuation from desktop · Drive
Mode · secure access away from the computer.

## C — Watch experience (`docs/architecture/watch-companion.md`, CONCEPTUAL)

A rapid-response, glanceable companion: quick voice capture · one-tap approvals ·
urgent notifications · AEGIS security alerts · reminders · Drive Mode controls · short
status summaries · business and project health indicators · continue-on-phone and
continue-on-desktop handoff. **The watch must not attempt to duplicate the full desktop
interface.**

## D — Browser experience (`docs/architecture/browser-client.md`, CONCEPTUAL)

For managed work computers where installation is prohibited (the managed HP): no local
installation; operates within browser and company-policy limitations; **no assumed
access** to local files, credentials, microphone, camera, email, calendar, or work
systems — anything beyond rendering requires explicit permission; displays its current
trust level and capability limits; keeps personal Jarvis data separated from BCI
information unless separately authorized; supports session revocation; produces
auditable security events. The empty `apps/pwa` workspace is its eventual home and
stays empty until this milestone is approved.

## E — Continuity Fabric (`docs/architecture/continuity-fabric.md`, CONCEPTUAL)

Begin an interaction on one device; continue naturally on another. Eventually governs:
shared Jarvis identity · synchronized conversation and project context ·
device-to-device session handoff · pending approvals · notification routing · offline
action queues · conflict resolution · device capability awareness · device-specific
security posture · continue-on-phone, continue-on-desktop, and continue-on-watch
behavior. **Conceptual only — this approval authorizes no cloud infrastructure, no
synchronization services, and no implementation** (ADR 0005 recorded ruling 2).

## F — Device trust (`docs/architecture/device-trust-model.md`, CONCEPTUAL)

Each device has a different trust level. Recorded examples: the personal Dell may run
the full desktop client; the managed HP work computer uses browser access only; mobile
and watch clients receive only the permissions their workflows require. Secrets are
never copied casually between devices — the immutable handoff already forbids secrets
in mobile/watch clients, localStorage, and HTML, and this document is built by pointer
on it (`07-SECURITY-REFERENCE.md`). Work data and personal data remain separated unless
explicitly approved. **AEGIS may restrict access based on device, location, network,
account, or requested action** — recorded here as intent for the future AEGIS design,
which still requires its own approval (ADR 0004).

## G — Cost and completion control: the staged sequence (F15 ruling)

Clients are never built simultaneously. William's ruling, 2026-07-17: **AEGIS v1 must
precede Stage 2 browser-client implementation** — the browser client introduces remote
access, account identity, session management, device trust, network exposure,
cross-device synchronization, and possible access from the managed HP; those
capabilities must not be implemented before a minimum enforceable security boundary
exists.

| Stage  | Content                                                                                                                                                                                                                                                                                                                                                                   | Gate to enter                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **1A** | Daily-Use Desktop MVP on the personal Dell (ADR 0006): conversation · Thought Amplifier v1 · explicit local saving. Dev-only safeguards clearly labeled; never claims AEGIS. Shared client-agnostic contracts.                                                                                                                                                            | Explicit implementation approval (pending)            |
| **1B** | AEGIS v1 — minimum deterministic foundation: authenticated identity · device registration · device trust classification · permission scopes · session expiration and revocation · approval requirements · audit events · work/personal context separation · denial by default · emergency restriction. Independent from Jarvis; Jarvis may request stricter, never lower. | Stage 1A **accepted**; own definition ADR             |
| **2**  | Responsive browser client per §D.                                                                                                                                                                                                                                                                                                                                         | Stage 1B implemented, tested, **explicitly accepted** |
| **3**  | Mobile-responsive experience + Continuity Fabric v1.                                                                                                                                                                                                                                                                                                                      | Stage 2 accepted                                      |
| **4**  | Native mobile capabilities only where browser capabilities are insufficient.                                                                                                                                                                                                                                                                                              | Stage 3 accepted; per-capability justification        |
| **5**  | Watch companion.                                                                                                                                                                                                                                                                                                                                                          | Mobile workflows stable                               |

The mobile and watch vision is preserved by this document **without expanding the
current MVP scope** — Stage 1A's exclusions (ADR 0006) are binding.

## H — Documentation placement

No fifth layer. The vision statement is Layer 1 (North Star strategic priority). The
seven client documents named above are **Layer 3**, created in `docs/architecture/`
only when drafted, each passing the Chief Architect gate before any Layer 4 work.
`client-architecture.md` is the umbrella (one identity, coordinated interfaces); trust
rules stay canonical in the handoff via `07-SECURITY-REFERENCE.md`.

## Recorded rulings (ADR 0005 §6)

1. Browser hosting architecture deferred — no self-hosted/cloud choice made.
2. Continuity Fabric conceptual — no sync infrastructure authorized.
3. Mobile and watch: permanent product commitments, outside the current MVP.
4. Four-layer architecture unchanged.
5. The Completion Doctrine governs: finish and accept the Daily-Use MVP before
   expanding implementation.
6. The desktop, mobile, and watch design direction is preserved as product-vision
   reference: `docs/VISUAL-DESIGN-TARGET.md` (which records the approved
   desktop-dashboard, iphone-home, and watch-faces mockups in prose) and the handoff
   design tokens remain the visual authority for every client.
