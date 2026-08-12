import type { AmplifierResult } from '@jarvis/contracts';
import { jarvisAmplifyContract } from '@jarvis/contracts';
import type { JarvisModelProvider } from '@jarvis/jarvis-core';
import { handleContract } from '../ipc.js';
import { toSafeModelError } from './model-error.js';

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
export function registerAmplifyHandler(getProvider: () => JarvisModelProvider): void {
  handleContract(jarvisAmplifyContract, async (request): Promise<AmplifierResult> => {
    try {
      return await getProvider().amplify(request.idea);
    } catch (cause) {
      throw toSafeModelError(cause);
    }
  });
}
