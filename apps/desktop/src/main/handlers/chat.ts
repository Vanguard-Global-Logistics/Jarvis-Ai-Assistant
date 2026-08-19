import type { ChatReply } from '@jarvis/contracts';
import { EFFORT_RANK, chooseRouting, jarvisChatContract } from '@jarvis/contracts';
import type { JarvisModelProvider } from '@jarvis/jarvis-core';
import type { JarvisFacingAegis } from '@jarvis/aegis';
import type { SqliteDatabase } from '@jarvis/database';
import { handleContract } from '../ipc.js';
import { withRecall } from '../memory/recall.js';
import { listMemories } from '../memory/store.js';
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
  db: SqliteDatabase,
): void {
  handleContract(jarvisChatContract, async (request): Promise<ChatReply> => {
    try {
      const provider = getProvider();
      // BEFORE the call, never after: a refusal that arrives once the words have
      // already reached a vendor is not a refusal (ADR 0026).
      assertSendingAllowed(aegis, provider.id);

      // Recall (ADR 0029). Read fresh per turn rather than cached at startup,
      // for the same reason the provider is: a memory added or deleted a moment
      // ago must take effect on the very next message, or "Jarvis, forget that"
      // becomes a lie until restart.
      //
      // The provider id is passed in so `withRecall` can enforce constitution
      // §3 — a `private` memory is never ASSEMBLED into a prompt bound for a
      // brain that leaves the machine. Filtering here rather than inside the
      // provider is deliberate: the text must not exist in a form that could be
      // sent, rather than existing and being redacted on the way out.
      const messages = withRecall(request.messages, listMemories(db), provider.id);

      // Per-turn routing (ADR 0036). DETERMINISTIC — rules over the text, never
      // a model call, for the same reason AEGIS forbids generative AI in its
      // enforcement path and the Cost Governor is arithmetic rather than
      // judgment: a classifier that decides spending would cost the very call
      // it is trying to save, and would drift upward without explaining itself.
      //
      // It chooses TIER and EFFORT only, never a PROVIDER. The provider is the
      // person's choice, and AEGIS's refusal above is untouched — this runs
      // after `assertSendingAllowed` precisely so it can never be mistaken for
      // a way around it.
      //
      // `request.effort` is a human PIN and wins outright; the rules only run
      // when nobody has chosen.
      const userTurns = request.messages.filter((m) => m.role === 'user');
      const routing = chooseRouting({
        prompt: userTurns.at(-1)?.content ?? '',
        // USER turns, not messages. `messages.length` counts both sides, so
        // `turnCount >= 12` fired at roughly the sixth thing a person said, and
        // the small-talk gate (`turnCount <= 2`) could only ever be satisfied on
        // the very first message — meaning "thanks" was billed at balanced
        // forever after. A swarm critic found it by mutating the field to a
        // constant and watching every test stay green.
        turnCount: userTurns.length,
      });

      // A renderer-supplied `effort` may only LOWER the routed decision, never
      // raise it.
      //
      // The comment here used to call this "a human pin", but main cannot tell
      // "a person chose" from "the renderer sent a field" — and today no UI
      // produces it at all, so every value in it is machine-supplied by
      // definition. An unclamped pin let a renderer bug or a compromised page
      // set `max` on every turn against the dearest model, with the Cost
      // Governor still unwired. Main is the side that must not trust the
      // caller, the same posture `withRecall` takes: filter here rather than
      // trust the request.
      const requested = request.effort;
      const effort =
        requested !== undefined && EFFORT_RANK[requested] < EFFORT_RANK[routing.effort]
          ? requested
          : routing.effort;
      const decision = { ...routing, effort };

      const reply = await provider.chat({ messages, effort, tier: routing.tier });
      // The decision travels back with the reply so it can be shown. Computing
      // a `why` and discarding it is what made the accountability claim false.
      return { ...reply, routing: decision };
    } catch (cause) {
      throw toSafeModelError(cause);
    }
  });
}
