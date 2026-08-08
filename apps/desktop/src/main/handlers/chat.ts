import type { ChatReply } from '@jarvis/contracts';
import { jarvisChatContract } from '@jarvis/contracts';
import type { JarvisModelProvider } from '@jarvis/jarvis-core';
import { handleContract } from '../ipc.js';
import type { IpcSenderValidator } from '../ipc-sender.js';
import { toSafeModelError } from './model-error.js';

/**
 * `jarvis:chat` — one conversation turn against the main-process model provider.
 *
 * The provider is injected, not constructed here: it is created once at startup
 * (`createProvider(env)` in `main/index.ts`) so the Anthropic client — and the
 * API key inside it — lives in exactly one place in the trusted process and is
 * never rebuilt per request. The key never crosses to the renderer; the renderer
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
  provider: JarvisModelProvider,
  validateSender: IpcSenderValidator,
): void {
  handleContract(
    jarvisChatContract,
    async (request): Promise<ChatReply> => {
      try {
        return await provider.chat(request);
      } catch (cause) {
        throw toSafeModelError(cause);
      }
    },
    validateSender,
  );
}
