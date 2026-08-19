import type {
  AmplifierResult,
  AutomationPlan,
  ChatReply,
  ChatRequest,
  ProviderId,
} from '@jarvis/contracts';
import { PROVIDER_IDS, providerLeavesMachine } from '@jarvis/contracts';
import type { JarvisModelProvider } from '@jarvis/jarvis-core';
import type { JarvisFacingAegis } from '@jarvis/aegis';
import { migrate, migrations, openDatabase } from '@jarvis/database';
import type { SqliteDatabase } from '@jarvis/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { remember } from '../memory/store.js';
import { registerChatHandler } from './chat.js';

/**
 * `jarvis:chat` — that recall is actually WIRED IN, and that the leak filter is
 * reachable from the handler (ADR 0029).
 *
 * ## Why this file exists
 *
 * The swarm's `tests-are-real` critic found that nothing proved this. The recall
 * unit tests prove `withRecall` is a correct pure function; the runtime probe
 * proved memory could be stored and listed. **Neither proved the handler calls
 * it.** Replacing `withRecall(request.messages, listMemories(db), provider.id)`
 * with `request.messages` left the entire suite and the probe green — so the
 * headline behaviour of the feature had zero coverage, and so did the security
 * filter's reachability.
 *
 * The probe could not close this on its own either: every provider it can
 * actually reach (`mock`, `local`) has `leavesMachine: false`, so `recallFor`
 * takes its early-return branch and **the filtering line never executes there**.
 * That is precisely the ADR 0021 failure — a leak test that is green because the
 * code holding the secret never ran.
 *
 * Here the provider id is injected, so every id in `PROVIDER_IDS` can be
 * exercised including the four that leave the machine.
 *
 * ## The assertion style that matters
 *
 * Every test below asserts on the `ChatRequest` the provider ACTUALLY RECEIVED,
 * captured by the fake — never on a call count and never on the handler's return
 * value. That is the closest this layer gets to the wire.
 */

/** Captures what the provider was handed, which is the whole point. */
function recordingProvider(id: ProviderId): {
  provider: JarvisModelProvider;
  received: ChatRequest[];
} {
  const received: ChatRequest[] = [];
  const provider: JarvisModelProvider = {
    id,
    chat: (request: ChatRequest): Promise<ChatReply> => {
      received.push(request);
      return Promise.resolve({ text: 'ok', provider: id });
    },
    amplify: (): Promise<AmplifierResult> => {
      throw new Error('not used');
    },
    planAutomation: (): Promise<AutomationPlan> => {
      throw new Error('not used');
    },
  };
  return { provider, received };
}

/** AEGIS at GREEN — this file is about recall, not about the sending guard. */
const permissive: JarvisFacingAegis = {
  status: () => ({
    level: 'GREEN',
    capabilities: {},
    chainVerified: true,
  }),
  allows: () => true,
  requestRestriction: () => {
    throw new Error('not used');
  },
} as unknown as JarvisFacingAegis;

/**
 * `handleContract` registers against Electron's `ipcMain`, which does not exist
 * here — so the module is mocked and the registered implementation captured.
 * Invoking that captured function is invoking the real handler body.
 */
const handlers = new Map<string, (request: unknown) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, impl: (event: unknown, request: unknown) => unknown) => {
      handlers.set(channel, (request: unknown) => impl(null, request));
    },
  },
}));

let db: SqliteDatabase;

beforeEach(() => {
  handlers.clear();
  db = openDatabase({ location: ':memory:' });
  migrate(db, migrations);
});

const OPEN_FACT = 'OPEN-FACT the company is Vanguard Global Logistics LLC.';
const PRIVATE_FACT = 'PRIVATE-CANARY this must never leave the machine.';

function seedMemories(): void {
  remember(db, { fact: OPEN_FACT, sensitivity: 'open' });
  remember(db, { fact: PRIVATE_FACT, sensitivity: 'private' });
}

async function chatWith(id: ProviderId): Promise<ChatRequest[]> {
  const { provider, received } = recordingProvider(id);
  registerChatHandler(() => provider, permissive, db);
  const handler = handlers.get('jarvis:chat');
  expect(handler, 'the chat handler registered itself').toBeDefined();
  await handler?.({ messages: [{ role: 'user', content: 'what do you know?' }] });
  return received;
}

describe('jarvis:chat is actually wired to memory', () => {
  it('sends the stored fact to the provider', async () => {
    // The mutation this kills: replacing `withRecall(...)` with
    // `request.messages`. Nothing else in the repo detected that.
    seedMemories();
    const received = await chatWith('local');

    expect(received).toHaveLength(1);
    expect(JSON.stringify(received[0])).toContain('OPEN-FACT');
  });

  it('sends the original message through unchanged alongside recall', async () => {
    seedMemories();
    const received = await chatWith('local');

    const contents = received[0]?.messages.map((m) => m.content) ?? [];
    expect(contents.some((c) => c.includes('what do you know?'))).toBe(true);
  });

  it('sends nothing extra when there is nothing remembered', async () => {
    // A fresh installation must not pay for an empty "here is what you know"
    // block on every turn.
    const received = await chatWith('local');

    expect(received[0]?.messages).toHaveLength(1);
    expect(received[0]?.messages[0]?.content).toBe('what do you know?');
  });
});

describe('the leak filter is reachable from the handler', () => {
  const leaving = PROVIDER_IDS.filter((id) => providerLeavesMachine(id));
  const staying = PROVIDER_IDS.filter((id) => !providerLeavesMachine(id));

  it('has providers on both sides, or these tests prove nothing', () => {
    expect(leaving.length).toBeGreaterThan(0);
    expect(staying.length).toBeGreaterThan(0);
  });

  it.each(leaving)('%s never receives the private canary', async (id) => {
    seedMemories();
    const received = await chatWith(id);

    const wire = JSON.stringify(received);
    expect(wire).not.toContain('PRIVATE-CANARY');
    // The negative control: a filter that returned `[]` unconditionally would
    // pass the line above and fail this one.
    expect(wire).toContain('OPEN-FACT');
  });

  it.each(staying)('%s does receive it, because it never leaves the machine', async (id) => {
    seedMemories();
    const received = await chatWith(id);

    expect(JSON.stringify(received)).toContain('PRIVATE-CANARY');
  });

  it('a never-send fact reaches no provider at all except a local one', async () => {
    remember(db, {
      fact: 'NEVER-CANARY stays home under all circumstances.',
      sensitivity: 'never-send',
    });

    for (const id of leaving) {
      const received = await chatWith(id);
      expect(JSON.stringify(received), `${id} received a never-send fact`).not.toContain(
        'NEVER-CANARY',
      );
    }
  });

  it('reflects a memory deleted a moment ago on the very next turn', async () => {
    // Recall is read per turn, not cached at startup. Otherwise "Jarvis, forget
    // that" is a lie until the app restarts.
    seedMemories();
    const before = await chatWith('local');
    expect(JSON.stringify(before)).toContain('OPEN-FACT');

    const rows = db.prepare('SELECT id FROM memory').all() as unknown as { id: string }[];
    for (const row of rows) db.prepare('DELETE FROM memory WHERE id = ?').run(row.id);

    const after = await chatWith('local');
    expect(JSON.stringify(after)).not.toContain('OPEN-FACT');
  });
});

describe('per-turn routing is WIRED IN, not merely written (ADR 0036)', () => {
  /** Drive the handler with an arbitrary request and return what the provider got. */
  async function routeWith(
    id: ProviderId,
    request: unknown,
    aegis: JarvisFacingAegis = permissive,
  ): Promise<ChatRequest[]> {
    const { provider, received } = recordingProvider(id);
    registerChatHandler(() => provider, aegis, db);
    const handler = handlers.get('jarvis:chat');
    expect(handler, 'the chat handler registered itself').toBeDefined();
    await handler?.(request);
    return received;
  }

  it('sends an EFFORT to the provider — deleting the routing call is caught here', async () => {
    // Without this, removing `effort: routing.effort` from the handler leaves
    // the whole suite green: `chooseRouting` has excellent unit tests and none
    // of them prove anything calls it. That is the exact gap the memory recall
    // tests were written to close, and the gap Ledger's write channels shipped
    // with.
    const received = await routeWith('mock', {
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(received).toHaveLength(1);
    expect(received[0]?.effort).toBeDefined();
  });

  it('routes a code question to HIGH effort and small talk to LOW', async () => {
    const code = await routeWith('mock', {
      messages: [{ role: 'user', content: '```ts\nconst a: number = "no";\n```' }],
    });
    expect(code[0]?.effort).toBe('high');

    const chat = await routeWith('mock', {
      messages: [{ role: 'user', content: 'thanks' }],
    });
    expect(chat[0]?.effort).toBe('low');
  });

  it('reads the LAST user turn, not the first', async () => {
    // A router that judged the opening message would price every turn of a long
    // conversation off "hi".
    const received = await routeWith('mock', {
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'Hello.' },
        { role: 'user', content: 'walk me through the security architecture' },
      ],
    });
    expect(received[0]?.effort).toBe('high');
  });

  it('honours a human PIN over the rules', async () => {
    // `effort` on the request is a person's explicit choice. Jarvis never
    // overrides it — the same warn-don't-block principle Ledger holds.
    const received = await routeWith('mock', {
      messages: [{ role: 'user', content: '```ts\nconst a = 1;\n```' }],
      effort: 'low',
    });
    expect(received[0]?.effort).toBe('low');
  });

  it('does not escalate when AEGIS has revoked sending on a REMOTE provider', async () => {
    // The provider call is refused by `assertSendingAllowed` before this runs,
    // so what is asserted here is that the router asked AEGIS at all — a router
    // that ignored it would be the shape that could later route around a
    // restriction.
    const revoked = {
      status: () => ({ level: 'YELLOW', capabilities: {}, chainVerified: true }),
      allows: () => false,
      requestRestriction: () => {
        throw new Error('not used');
      },
    } as unknown as JarvisFacingAegis;

    // The guard REFUSES rather than substituting a local model, so the provider
    // is never reached at all. Asserting the rejection AND the empty capture
    // together is the point: a refusal that let the call through and merely
    // reported an error afterwards would satisfy neither half.
    const { provider, received } = recordingProvider('anthropic');
    registerChatHandler(() => provider, revoked, db);
    const handler = handlers.get('jarvis:chat');
    await expect(
      handler?.({
        messages: [{ role: 'user', content: 'walk me through the security architecture' }],
      }),
    ).rejects.toThrow();
    expect(received, 'the words never reached the vendor').toStrictEqual([]);
  });

  it('still routes normally on a LOCAL provider while sending is revoked', async () => {
    // `local` never leaves the machine, so a revoked `sending` capability must
    // not disable routing for it — the restriction is about egress, not about
    // thinking hard.
    const revoked = {
      status: () => ({ level: 'YELLOW', capabilities: {}, chainVerified: true }),
      allows: () => false,
      requestRestriction: () => {
        throw new Error('not used');
      },
    } as unknown as JarvisFacingAegis;

    const received = await routeWith(
      'local',
      { messages: [{ role: 'user', content: '```ts\nconst a = 1;\n```' }] },
      revoked,
    );
    expect(received).toHaveLength(1);
    expect(received[0]?.effort).toBe('high');
  });
});
