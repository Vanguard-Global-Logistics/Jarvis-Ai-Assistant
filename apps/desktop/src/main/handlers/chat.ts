import type { ChatReply } from '@jarvis/contracts';
import { jarvisChatContract } from '@jarvis/contracts';
import type { JarvisModelProvider } from '@jarvis/jarvis-core';
import type { JarvisFacingAegis } from '@jarvis/aegis';
import { handleContract } from '../ipc.js';
import { toSafeModelError } from './model-error.js';
import { assertSendingAllowed } from './sending-guard.js';

/**
 * `jarvis:chat` — one conversation turn against the main-process model provider.
 *
 * The provider is READ per turn, not captured: `getProvider` returns whichever
 * one is active right now, because ADR 0022 lets a human switch brains without
 * restarting. Capturing the value instead would pin this handler to whatever
 * existed at boot, and switching would appear to work while nothing changed.
 * It is still constructed in main — the Anthropic client, and the API key inside
 * it, live in exactly one place in the trusted process. The key never crosses to the renderer; the renderer
 * only ever sees `ChatReply` (text + provider id).
 *
 * `handleContract` has already parsed the request against `ChatRequestSchema`
 * before this runs (the boundary validates in both directions), so `request`
 * here is a well-formed transcript — the "parse before invoking a provider"
 * review finding is satisfied structurally, not by a check in this function.
 *
 * Provider failures are sanitised into a safe category before they propagate,
 * so nothing an SDK error carries can reach a log line or the renderer.
 */
export function registerChatHandler(
  getProvider: () => JarvisModelProvider,
  aegis: JarvisFacingAegis,
): void {
  handleContract(jarvisChatContract, async (request): Promise<ChatReply> => {
    try {
      const provider = getProvider();
      // BEFORE the call, never after: a refusal that arrives once the words have
      // already reached a vendor is not a refusal (ADR 0026).
      assertSendingAllowed(aegis, provider.id);
      return await provider.chat(request);
    } catch (cause) {
      throw toSafeModelError(cause);
    }
  });
}
