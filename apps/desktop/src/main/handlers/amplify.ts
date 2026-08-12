import type { AmplifierResult } from '@jarvis/contracts';
import { jarvisAmplifyContract } from '@jarvis/contracts';
import type { JarvisModelProvider } from '@jarvis/jarvis-core';
import type { JarvisFacingAegis } from '@jarvis/aegis';
import { handleContract } from '../ipc.js';
import { toSafeModelError } from './model-error.js';
import { assertSendingAllowed } from './sending-guard.js';

/**
 * `jarvis:amplify` — Thought Amplifier v1 (ADR 0006): one rough idea in, the
 * five validated fields out.
 *
 * Same shape of wiring as `jarvis:chat`: the request (`{ idea }`) is already
 * validated by `handleContract`, the provider is the shared main-process
 * instance, and the response is re-validated against `AmplifierResultSchema`
 * before it leaves main — a provider that returns a malformed card fails at the
 * boundary rather than reaching the amplifier UI.
 */
export function registerAmplifyHandler(
  getProvider: () => JarvisModelProvider,
  aegis: JarvisFacingAegis,
): void {
  handleContract(jarvisAmplifyContract, async (request): Promise<AmplifierResult> => {
    try {
      const provider = getProvider();
      // BEFORE the call, never after: a refusal that arrives once the words have
      // already reached a vendor is not a refusal (ADR 0026).
      assertSendingAllowed(aegis, provider.id);
      return await provider.amplify(request.idea);
    } catch (cause) {
      throw toSafeModelError(cause);
    }
  });
}
