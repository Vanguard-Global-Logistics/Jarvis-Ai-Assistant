import type { Env } from '@jarvis/config';
import { createLogger } from '@jarvis/config';
import { modelDescribeContract, modelSelectContract } from '@jarvis/contracts';
import type { ProviderId, ProviderOption } from '@jarvis/contracts';
import { buildProviderById, describeProviders } from '@jarvis/jarvis-core';
import type { JarvisModelProvider } from '@jarvis/jarvis-core';
import { handleContract } from '../ipc.js';

/**
 * `model:describe` / `model:select` — which brain answers, changeable live
 * (ADR 0022).
 *
 * Before this, the provider was fixed at startup from the environment, so
 * "use Claude for this one" meant editing a file and relaunching. These two
 * channels make it a click, without giving the renderer anything it did not
 * already have.
 *
 * WHAT THE RENDERER CAN AND CANNOT DO. It can ask which providers exist and
 * pick one by IDENTIFIER from a closed enum. It cannot supply an endpoint, a
 * model name, or a credential — every provider is still constructed in main
 * from the trusted environment. That distinction is the whole security design:
 * a renderer that could name a URL could name a REMOTE one and have it labeled
 * `local`, which is precisely what ADR 0015 exists to prevent. Selecting is
 * choosing among things main already built; it is not configuring.
 *
 * A refusal is a described outcome, not a thrown error. At startup an
 * unhonourable choice kills the app (ADR 0020) because continuing would use a
 * different brain than the one configured, silently. Here a human is standing
 * at the picker, so "you have not set an API key" is something to show them, and
 * the previous provider stays active. Same rule — never substitute silently —
 * in the form each moment can act on.
 */

const log = createLogger({ scope: 'desktop:model' });

/**
 * Holds the provider the chat and amplify handlers use.
 *
 * A mutable holder rather than a value, because those handlers are registered
 * once at startup and must see the CURRENT provider on every turn — capturing
 * the provider directly would pin them to whichever one existed at boot, and
 * switching would appear to work while nothing changed.
 */
export interface ProviderHolder {
  current: () => JarvisModelProvider;
  activeId: () => ProviderId;
}

export interface MutableProviderHolder extends ProviderHolder {
  replace: (id: ProviderId, provider: JarvisModelProvider) => void;
}

export function createProviderHolder(
  initial: JarvisModelProvider,
  initialId: ProviderId,
): MutableProviderHolder {
  let provider = initial;
  let id = initialId;
  return {
    current: () => provider,
    activeId: () => id,
    replace: (nextId, nextProvider) => {
      provider = nextProvider;
      id = nextId;
    },
  };
}

/** Availability as the contract shapes it — identifiers and reasons only. */
function options(env: Env): ProviderOption[] {
  return describeProviders(env).map((p) =>
    p.available
      ? { id: p.id, available: true }
      : {
          id: p.id,
          available: false,
          // The schema caps this at 200; slicing here keeps a long sentence from
          // failing validation and turning a helpful refusal into a fault.
          unavailableReason: (p.unavailableReason ?? 'Not configured.').slice(0, 200),
        },
  );
}

export function registerModelHandlers(env: Env, holder: MutableProviderHolder): void {
  handleContract(modelDescribeContract, () => ({
    active: holder.activeId(),
    providers: options(env),
  }));

  handleContract(modelSelectContract, ({ id }) => {
    // Selecting the active provider is a no-op rather than a rebuild: a picker
    // that silently drops a conversation's provider on a stray click would be
    // worse than one that does nothing.
    if (id === holder.activeId()) {
      return { selected: true, active: id, providers: options(env) };
    }

    const result = buildProviderById(env, id);
    if (!result.ok) {
      log.info('model provider selection refused', { requested: id, active: holder.activeId() });
      return {
        selected: false,
        active: holder.activeId(),
        reason: result.reason.slice(0, 200),
        providers: options(env),
      };
    }

    holder.replace(id, result.provider);
    log.info('model provider switched', { provider: id });
    return { selected: true, active: id, providers: options(env) };
  });
}
