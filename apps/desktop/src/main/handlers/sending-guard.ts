import { createLogger } from '@jarvis/config';
import type { ProviderId } from '@jarvis/contracts';
import { providerLeavesMachine } from '@jarvis/contracts';
import type { JarvisFacingAegis } from '@jarvis/aegis';

/**
 * The first capability AEGIS actually enforces (ADR 0026).
 *
 * ## Why this one, and why now
 *
 * ADR 0025 shipped a real state engine that governed nothing, and said so
 * plainly: none of the capabilities in the matrix — computer control, screen
 * vision, voice, scheduling — exists yet, so there was nothing to refuse.
 *
 * That was true of all of them except one. **`sending` exists today.** Choosing
 * Claude, Gemini, or Grok means the conversation leaves the machine, and
 * `SECURITY-BOUNDARIES.md` puts `sending` and `connectors` in the set YELLOW
 * revokes. So AEGIS at YELLOW or above has a concrete, honest job: stop Jarvis
 * shipping conversations to a vendor.
 *
 * This is the moment AEGIS stops being advisory. It is one capability, not
 * eleven, and every description of it must keep saying so.
 *
 * ## Refuse, never substitute
 *
 * When sending is revoked, a request to a remote provider is REFUSED with a
 * message naming the reason. It is not quietly answered by the local model
 * instead.
 *
 * That rule is already load-bearing twice in this codebase — a named provider
 * that cannot be built fails the app rather than silently swapping brains
 * (ADR 0020), and a non-loopback local URL crashes rather than downgrading
 * (ADR 0015). The same logic applies here and matters more: someone who believes
 * they are restricted, and is quietly answered anyway, has been told a
 * comfortable lie by the one subsystem that exists to not tell them.
 *
 * ## What it does NOT do
 *
 * It does not stop the app reaching the network for anything else, because
 * nothing else reaches the network. It is not a firewall, it is a check at the
 * one place a conversation currently leaves.
 */

const log = createLogger({ scope: 'desktop:sending-guard' });

/** Thrown when AEGIS refuses a remote model call. */
export class SendingRevokedError extends Error {
  public override readonly name = 'SendingRevokedError';
  public constructor(
    public readonly level: string,
    public readonly provider: ProviderId,
  ) {
    super(
      `AEGIS is at ${level}, which revokes sending. The "${provider}" provider would send ` +
        `this conversation off your machine, so Jarvis refused. Switch to the local model or ` +
        `mock, or lower the AEGIS level from the AEGIS menu.`,
    );
  }
}

/**
 * Refuse a remote model call while AEGIS has revoked `sending`.
 *
 * Called with the provider that is ABOUT to be used, before the call is made.
 * Local and mock pass unconditionally — they open no socket, so there is nothing
 * for this capability to govern.
 *
 * @throws SendingRevokedError when the provider is remote and sending is revoked.
 */
export function assertSendingAllowed(aegis: JarvisFacingAegis, provider: ProviderId): void {
  if (!providerLeavesMachine(provider)) return;
  if (aegis.allows('sending')) return;

  const { level } = aegis.status();
  // Logged as a REFUSAL, not an error: AEGIS working correctly is a normal
  // outcome, and burying it at error level would train someone to ignore it.
  log.info('aegis refused a remote model call', { provider, level });
  throw new SendingRevokedError(level, provider);
}
