# Stage 1A Checkpoint 1 — Contracts & jarvis-core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Daily Companion's brain — model contracts, a deterministic mock provider, the Anthropic adapter, and Thought Amplifier v1 logic — fully unit-tested, running in `services/jarvis-core`, touching no Electron code yet.

**Architecture:** Contracts live in `packages/contracts` (Zod, client-agnostic — no Electron types, per ADR 0006's shared-contracts rule). `services/jarvis-core` implements a `JarvisModelProvider` interface twice: `MockProvider` (deterministic, default, $0) and `AnthropicProvider` (official SDK, key from env via `@jarvis/config`, main-process-only when wired in Checkpoint 2). The Amplifier is a provider method returning a schema-validated five-field result — the Anthropic adapter uses structured outputs (`messages.parse` + `zodOutputFormat`), so malformed JSON is impossible by construction.

**Tech Stack:** TypeScript strict · Zod (existing) · `@anthropic-ai/sdk` (new dependency, jarvis-core only) · Vitest (root runner picks up colocated `*.test.ts`).

## Global Constraints

- Model ID `claude-opus-4-8` exactly (verified against the claude-api skill 2026-07-17; CLAUDE.md §5). Adaptive thinking (`thinking: {type: "adaptive"}`), `max_tokens: 16000`, no `temperature`/`top_p` (rejected on this model).
- The API key is read only from the validated env (`ANTHROPIC_API_KEY`, already in `EnvSchema` as optional). It is never logged, never thrown in an error message, never exported from any module.
- Mock provider is the default; everything must pass offline with no key set (ADR 0006).
- No IPC, no Electron, no renderer, no SQLite in this checkpoint.
- Every schema is `.strict()`. Both directions of every future boundary validate (existing repo rule).
- `npm run verify` green before every commit. Stage 1A exclusions (ADR 0006) are binding; new ideas go to `docs/BACKLOG.md`.

---

### Task 1: Model contracts in `@jarvis/contracts`

**Files:**
- Create: `packages/contracts/src/model/contracts.ts`
- Test: `packages/contracts/src/model/contracts.test.ts`
- Modify: `packages/contracts/src/index.ts` (barrel exports; update the status header comment from "model-provider contracts are NOT defined" to name this module)

**Interfaces:**
- Consumes: `zod` (existing dependency).
- Produces: `ChatMessageSchema`, `ChatRequestSchema`, `ChatReplySchema`, `AmplifierResultSchema`, `PROVIDER_IDS`, and inferred types `ChatMessage`, `ChatRequest`, `ChatReply`, `AmplifierResult`, `ProviderId`. Later tasks and Checkpoint 2's IPC contracts import exactly these names.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/contracts/src/model/contracts.test.ts
import { describe, expect, it } from 'vitest';
import {
  AmplifierResultSchema,
  ChatReplySchema,
  ChatRequestSchema,
} from './contracts.js';

describe('ChatRequestSchema', () => {
  it('accepts a minimal valid request', () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Hello, Jarvis.' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty message list', () => {
    expect(ChatRequestSchema.safeParse({ messages: [] }).success).toBe(false);
  });

  it('rejects unknown roles and extra fields', () => {
    expect(
      ChatRequestSchema.safeParse({
        messages: [{ role: 'system', content: 'x' }],
      }).success,
    ).toBe(false);
    expect(
      ChatRequestSchema.safeParse({
        messages: [{ role: 'user', content: 'x', extra: true }],
      }).success,
    ).toBe(false);
  });
});

describe('ChatReplySchema', () => {
  it('requires a provider id from the closed set', () => {
    expect(
      ChatReplySchema.safeParse({ text: 'hi', provider: 'mock' }).success,
    ).toBe(true);
    expect(
      ChatReplySchema.safeParse({ text: 'hi', provider: 'openai' }).success,
    ).toBe(false);
  });
});

describe('AmplifierResultSchema', () => {
  const valid = {
    clarifiedIntent: 'Build X to achieve Y.',
    missingQuestions: ['What is the budget?'],
    improvedConcept: 'A stronger version of X.',
    recommendedNextStep: 'Draft the one-page spec.',
    buildReadyPrompt: 'You are building X...',
  };

  it('accepts all five fields', () => {
    expect(AmplifierResultSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a missing field and an empty questions list', () => {
    const { buildReadyPrompt: _omitted, ...missing } = valid;
    expect(AmplifierResultSchema.safeParse(missing).success).toBe(false);
    expect(
      AmplifierResultSchema.safeParse({ ...valid, missingQuestions: [] }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/contracts/src/model/contracts.test.ts`
Expected: FAIL — `Cannot find module './contracts.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// packages/contracts/src/model/contracts.ts
import { z } from 'zod';

/**
 * Model contracts — the shapes that cross between the UI, the IPC boundary
 * (Checkpoint 2), and the jarvis-core providers.
 *
 * Client-agnostic by requirement (ADR 0006): no Electron types, ever. Every
 * future client (browser, mobile, watch) consumes these same schemas.
 */

/** The providers that exist. A closed set — adding one is a deliberate act. */
export const PROVIDER_IDS = ['mock', 'anthropic'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const ChatMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1),
  })
  .strict();

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z
  .object({
    messages: z.array(ChatMessageSchema).min(1),
  })
  .strict();

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/**
 * `provider` is part of the reply on purpose: the UI must label mock output
 * as mock (CLAUDE.md §8 — nothing may look more real than it is).
 */
export const ChatReplySchema = z
  .object({
    text: z.string().min(1),
    provider: z.enum(PROVIDER_IDS),
  })
  .strict();

export type ChatReply = z.infer<typeof ChatReplySchema>;

/** Thought Amplifier v1 — the five outputs, exactly (ADR 0006). */
export const AmplifierResultSchema = z
  .object({
    clarifiedIntent: z.string().min(1),
    missingQuestions: z.array(z.string().min(1)).min(1),
    improvedConcept: z.string().min(1),
    recommendedNextStep: z.string().min(1),
    buildReadyPrompt: z.string().min(1),
  })
  .strict();

export type AmplifierResult = z.infer<typeof AmplifierResultSchema>;
```

- [ ] **Step 4: Add barrel exports**

In `packages/contracts/src/index.ts`, append:

```typescript
export {
  AmplifierResultSchema,
  ChatMessageSchema,
  ChatReplySchema,
  ChatRequestSchema,
  PROVIDER_IDS,
} from './model/contracts.js';
export type {
  AmplifierResult,
  ChatMessage,
  ChatReply,
  ChatRequest,
  ProviderId,
} from './model/contracts.js';
```

and update the header comment: the model contracts are now PARTIAL (chat + amplifier defined; AEGIS, permission, and database contracts remain NOT defined).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run packages/contracts` — Expected: PASS, including the pre-existing IPC contract tests.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts && git commit -m "feat(contracts): define the chat and amplifier model contracts"
```

---

### Task 2: `JarvisModelProvider` interface + deterministic mock provider

**Files:**
- Create: `services/jarvis-core/src/model/provider.ts`
- Create: `services/jarvis-core/src/model/mock-provider.ts`
- Test: `services/jarvis-core/src/model/mock-provider.test.ts`

**Interfaces:**
- Consumes: `ChatRequest`, `ChatReply`, `AmplifierResult`, `ProviderId` from `@jarvis/contracts` (Task 1).
- Produces: `interface JarvisModelProvider { readonly id: ProviderId; chat(request: ChatRequest): Promise<ChatReply>; amplify(idea: string): Promise<AmplifierResult>; }` and `class MockProvider implements JarvisModelProvider`. Tasks 4–5 implement/select against this exact interface.

- [ ] **Step 1: Write the failing test**

```typescript
// services/jarvis-core/src/model/mock-provider.test.ts
import { describe, expect, it } from 'vitest';
import { AmplifierResultSchema, ChatReplySchema } from '@jarvis/contracts';
import { MockProvider } from './mock-provider.js';

describe('MockProvider', () => {
  const provider = new MockProvider();

  it('identifies itself as mock in every reply', async () => {
    const reply = await provider.chat({
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(reply.provider).toBe('mock');
    expect(ChatReplySchema.safeParse(reply).success).toBe(true);
  });

  it('is deterministic: same input, same output', async () => {
    const request = {
      messages: [{ role: 'user' as const, content: 'What should I build?' }],
    };
    expect(await provider.chat(request)).toEqual(await provider.chat(request));
  });

  it('reflects the latest user message so conversations feel coherent', async () => {
    const reply = await provider.chat({
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'ok' },
        { role: 'user', content: 'a coffee-shop loyalty app' },
      ],
    });
    expect(reply.text).toContain('a coffee-shop loyalty app');
  });

  it('amplify returns a schema-valid five-field result built from the idea', async () => {
    const result = await provider.amplify('a coffee-shop loyalty app');
    expect(AmplifierResultSchema.safeParse(result).success).toBe(true);
    expect(result.clarifiedIntent).toContain('a coffee-shop loyalty app');
    expect(await provider.amplify('a coffee-shop loyalty app')).toEqual(result);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/jarvis-core` — Expected: FAIL — `Cannot find module './mock-provider.js'`

- [ ] **Step 3: Write the interface**

```typescript
// services/jarvis-core/src/model/provider.ts
import type { AmplifierResult, ChatReply, ChatRequest, ProviderId } from '@jarvis/contracts';

/**
 * The provider-neutral model abstraction (CLAUDE.md §5): adding a model means
 * adding an adapter and a config entry — never editing call sites. Runs in the
 * main process only; no provider, key, or SDK object ever crosses to the
 * renderer.
 */
export interface JarvisModelProvider {
  readonly id: ProviderId;
  chat(request: ChatRequest): Promise<ChatReply>;
  /** Thought Amplifier v1: a rough idea in, five validated fields out. */
  amplify(idea: string): Promise<AmplifierResult>;
}
```

- [ ] **Step 4: Write the mock provider**

```typescript
// services/jarvis-core/src/model/mock-provider.ts
import type { AmplifierResult, ChatReply, ChatRequest } from '@jarvis/contracts';
import type { JarvisModelProvider } from './provider.js';

/**
 * The default provider (ADR 0006): deterministic, offline, $0. Not a fake —
 * every reply names itself as mock, and the UI labels it (CLAUDE.md §8: a
 * control that appears more real than it is, is the cardinal sin).
 */
export class MockProvider implements JarvisModelProvider {
  public readonly id = 'mock' as const;

  public chat(request: ChatRequest): Promise<ChatReply> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === 'user');
    const subject = lastUser?.content ?? 'your message';
    return Promise.resolve({
      provider: this.id,
      text:
        `[MOCK PROVIDER] I received: "${subject}". ` +
        `No API key is configured, so this is the deterministic offline reply. ` +
        `Add ANTHROPIC_API_KEY to your local .env to talk to a real model.`,
    });
  }

  public amplify(idea: string): Promise<AmplifierResult> {
    return Promise.resolve({
      clarifiedIntent: `[MOCK] You want to explore: ${idea}. A real model would restate the deeper goal here.`,
      missingQuestions: [
        `[MOCK] Who is "${idea}" for, and what must it do on day one?`,
        '[MOCK] What does success look like in 90 days?',
      ],
      improvedConcept: `[MOCK] A sharper framing of "${idea}" would appear here.`,
      recommendedNextStep: '[MOCK] Write the one-paragraph problem statement.',
      buildReadyPrompt: `[MOCK] Build the smallest useful version of: ${idea}. (Deterministic placeholder — configure a key for a real prompt.)`,
    });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run services/jarvis-core` — Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add services/jarvis-core && git commit -m "feat(jarvis-core): provider interface and the deterministic mock provider"
```

---

### Task 3: Amplifier prompt builder

**Files:**
- Create: `services/jarvis-core/src/amplifier/prompt.ts`
- Test: `services/jarvis-core/src/amplifier/prompt.test.ts`

**Interfaces:**
- Consumes: nothing beyond the standard library.
- Produces: `AMPLIFIER_SYSTEM_PROMPT: string` and `buildAmplifierUserMessage(idea: string): string`. Task 4's Anthropic adapter imports both.

- [ ] **Step 1: Write the failing test**

```typescript
// services/jarvis-core/src/amplifier/prompt.test.ts
import { describe, expect, it } from 'vitest';
import { AMPLIFIER_SYSTEM_PROMPT, buildAmplifierUserMessage } from './prompt.js';

describe('amplifier prompt', () => {
  it('the system prompt teaches all five output fields', () => {
    for (const field of [
      'clarifiedIntent',
      'missingQuestions',
      'improvedConcept',
      'recommendedNextStep',
      'buildReadyPrompt',
    ]) {
      expect(AMPLIFIER_SYSTEM_PROMPT).toContain(field);
    }
  });

  it('the user message carries the idea verbatim', () => {
    const idea = 'a governed backlog for my coffee business';
    expect(buildAmplifierUserMessage(idea)).toContain(idea);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/jarvis-core/src/amplifier` — Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// services/jarvis-core/src/amplifier/prompt.ts
/**
 * Thought Amplifier v1 (ADR 0006; docs/foundation/03 when drafted).
 * The five fields are the contract — AmplifierResultSchema enforces them at
 * the boundary; this prompt teaches the model what belongs in each.
 */
export const AMPLIFIER_SYSTEM_PROMPT = [
  'You are the Thought Amplifier inside Jarvis, William Lavold\'s executive',
  'partner. William gives you a rough, incomplete idea. Your job is not to',
  'answer it — it is to help him discover the best version of his own thinking.',
  '',
  'Respond with exactly these five fields:',
  '- clarifiedIntent: what William is actually trying to accomplish — the goal',
  '  behind the words, in two or three sentences.',
  '- missingQuestions: the questions that must be answered before building.',
  '  Fewest, highest-leverage; one decision per question.',
  '- improvedConcept: a stronger version of the idea. Sharper scope, bigger',
  '  leverage, or radically simpler — say which and why.',
  '- recommendedNextStep: ONE concrete action he can take today.',
  '- buildReadyPrompt: a complete, self-contained prompt he can paste into a',
  '  build session to start the work — context, goal, constraints, done-when.',
  '',
  'Be direct and specific. Never pad. Never invent facts he did not give you;',
  'when you assume, say so inside the relevant field.',
].join('\n');

export function buildAmplifierUserMessage(idea: string): string {
  return `Amplify this idea:\n\n${idea}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run services/jarvis-core` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/jarvis-core/src/amplifier && git commit -m "feat(jarvis-core): amplifier v1 prompt builder"
```

---

### Task 4: Anthropic provider adapter

**Files:**
- Modify: `services/jarvis-core/package.json` (add `"@anthropic-ai/sdk"` to dependencies; run `npm install` at the repo root so the workspace lockfile updates)
- Create: `services/jarvis-core/src/model/anthropic-provider.ts`
- Test: `services/jarvis-core/src/model/anthropic-provider.test.ts`

**Interfaces:**
- Consumes: `JarvisModelProvider` (Task 2), `AMPLIFIER_SYSTEM_PROMPT` / `buildAmplifierUserMessage` (Task 3), contracts (Task 1).
- Produces: `class AnthropicProvider implements JarvisModelProvider`, constructor `new AnthropicProvider({ apiKey: string, model?: string, client?: AnthropicLikeClient })` — the injectable `client` exists so tests never touch the network. `DEFAULT_MODEL = 'claude-opus-4-8'` is exported for the factory and future config.

- [ ] **Step 1: Install the SDK**

Run at repo root: `npm install --workspace @jarvis/jarvis-core @anthropic-ai/sdk`
Expected: lockfile updated; `npm run verify` still green before writing code.

- [ ] **Step 2: Write the failing test**

```typescript
// services/jarvis-core/src/model/anthropic-provider.test.ts
import { describe, expect, it, vi } from 'vitest';
import { AmplifierResultSchema } from '@jarvis/contracts';
import { AnthropicProvider, DEFAULT_MODEL, ModelRefusalError } from './anthropic-provider.js';

function fakeClient(overrides: { create?: unknown; parse?: unknown } = {}) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue(
        overrides.create ?? {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Hello William.' }],
        },
      ),
      parse: vi.fn().mockResolvedValue(
        overrides.parse ?? {
          stop_reason: 'end_turn',
          parsed_output: {
            clarifiedIntent: 'intent',
            missingQuestions: ['q1'],
            improvedConcept: 'concept',
            recommendedNextStep: 'step',
            buildReadyPrompt: 'prompt',
          },
        },
      ),
    },
  };
}

describe('AnthropicProvider', () => {
  it('maps a chat request onto the Messages API and back', async () => {
    const client = fakeClient();
    const provider = new AnthropicProvider({ apiKey: 'k', client });
    const reply = await provider.chat({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(reply).toEqual({ text: 'Hello William.', provider: 'anthropic' });
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_MODEL,
        thinking: { type: 'adaptive' },
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    );
  });

  it('surfaces a refusal as a typed error, never as empty text', async () => {
    const provider = new AnthropicProvider({
      apiKey: 'k',
      client: fakeClient({ create: { stop_reason: 'refusal', content: [] } }),
    });
    await expect(
      provider.chat({ messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toBeInstanceOf(ModelRefusalError);
  });

  it('amplify returns the parsed structured output, schema-valid', async () => {
    const provider = new AnthropicProvider({ apiKey: 'k', client: fakeClient() });
    const result = await provider.amplify('an idea');
    expect(AmplifierResultSchema.safeParse(result).success).toBe(true);
  });

  it('amplify throws when parsing failed rather than returning garbage', async () => {
    const provider = new AnthropicProvider({
      apiKey: 'k',
      client: fakeClient({ parse: { stop_reason: 'end_turn', parsed_output: null } }),
    });
    await expect(provider.amplify('an idea')).rejects.toThrow(/amplifier/i);
  });

  it('never leaks the key: errors carry no key material', async () => {
    const provider = new AnthropicProvider({
      apiKey: 'sk-secret-value',
      client: fakeClient({ create: { stop_reason: 'refusal', content: [] } }),
    });
    const error = await provider
      .chat({ messages: [{ role: 'user', content: 'x' }] })
      .catch((e: Error) => e);
    expect(String(error)).not.toContain('sk-secret-value');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run services/jarvis-core/src/model/anthropic-provider.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

```typescript
// services/jarvis-core/src/model/anthropic-provider.ts
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { AmplifierResult, ChatReply, ChatRequest } from '@jarvis/contracts';
import { AmplifierResultSchema } from '@jarvis/contracts';
import { AMPLIFIER_SYSTEM_PROMPT, buildAmplifierUserMessage } from '../amplifier/prompt.js';
import type { JarvisModelProvider } from './provider.js';

/** Verified against the claude-api skill, 2026-07-17 (CLAUDE.md §5). */
export const DEFAULT_MODEL = 'claude-opus-4-8';

const MAX_TOKENS = 16000;

/** The model declined. Carries no request or key material by construction. */
export class ModelRefusalError extends Error {
  public override readonly name = 'ModelRefusalError';
  public constructor() {
    super('The model declined this request.');
  }
}

/**
 * The narrow slice of the SDK surface this adapter uses — injectable so tests
 * run with a fake and never touch the network.
 */
export interface AnthropicLikeClient {
  messages: {
    create(params: unknown): Promise<{
      stop_reason: string | null;
      content: ReadonlyArray<{ type: string; text?: string }>;
    }>;
    parse(params: unknown): Promise<{
      stop_reason: string | null;
      parsed_output: unknown;
    }>;
  };
}

export class AnthropicProvider implements JarvisModelProvider {
  public readonly id = 'anthropic' as const;
  private readonly client: AnthropicLikeClient;
  private readonly model: string;

  public constructor(options: {
    apiKey: string;
    model?: string;
    client?: AnthropicLikeClient;
  }) {
    // The key goes into the SDK client and nowhere else — not a field, not a
    // log, not an error. Main process only (enforced at wiring in Checkpoint 2).
    this.client =
      options.client ?? (new Anthropic({ apiKey: options.apiKey }) as AnthropicLikeClient);
    this.model = options.model ?? DEFAULT_MODEL;
  }

  public async chat(request: ChatRequest): Promise<ChatReply> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    if (response.stop_reason === 'refusal') {
      throw new ModelRefusalError();
    }

    const text = response.content
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (text.length === 0) {
      throw new Error('The model returned no text.');
    }

    return { text, provider: this.id };
  }

  public async amplify(idea: string): Promise<AmplifierResult> {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      system: AMPLIFIER_SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(AmplifierResultSchema) },
      messages: [{ role: 'user', content: buildAmplifierUserMessage(idea) }],
    });

    if (response.stop_reason === 'refusal') {
      throw new ModelRefusalError();
    }

    // parse() validated against the schema; safeParse again because both
    // directions of every boundary validate in this repository.
    const result = AmplifierResultSchema.safeParse(response.parsed_output);
    if (!result.success) {
      throw new Error('The amplifier response did not match its contract.');
    }
    return result.data;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run services/jarvis-core` — Expected: PASS (all tasks' tests).

- [ ] **Step 6: Commit**

```bash
git add services/jarvis-core package-lock.json && git commit -m "feat(jarvis-core): anthropic adapter with structured amplifier output"
```

---

### Task 5: Provider factory + package barrel

**Files:**
- Create: `services/jarvis-core/src/model/create-provider.ts`
- Test: `services/jarvis-core/src/model/create-provider.test.ts`
- Modify: `services/jarvis-core/src/index.ts` (replace the empty-package placeholder with real exports; rewrite the status comment honestly: PARTIAL — provider abstraction + amplifier exist; orchestration, personality, memory do not)

**Interfaces:**
- Consumes: `Env` and `createLogger` from `@jarvis/config`; Tasks 2 and 4.
- Produces: `createProvider(env: Env): JarvisModelProvider`. Checkpoint 2's main-process wiring calls exactly this. Barrel exports: `createProvider`, `MockProvider`, `AnthropicProvider`, `ModelRefusalError`, `DEFAULT_MODEL`, `AMPLIFIER_SYSTEM_PROMPT`, `buildAmplifierUserMessage`, and the `JarvisModelProvider` type.

- [ ] **Step 1: Write the failing test**

```typescript
// services/jarvis-core/src/model/create-provider.test.ts
import { describe, expect, it } from 'vitest';
import { parseEnv } from '@jarvis/config';
import { createProvider } from './create-provider.js';

describe('createProvider', () => {
  it('defaults to the mock provider when no key is set', () => {
    const env = parseEnv({ NODE_ENV: 'test' });
    expect(createProvider(env).id).toBe('mock');
  });

  it('selects the anthropic provider when a key is present', () => {
    const env = parseEnv({ NODE_ENV: 'test', ANTHROPIC_API_KEY: 'sk-test' });
    expect(createProvider(env).id).toBe('anthropic');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/jarvis-core/src/model/create-provider.test.ts` — Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// services/jarvis-core/src/model/create-provider.ts
import type { Env } from '@jarvis/config';
import { createLogger } from '@jarvis/config';
import { AnthropicProvider } from './anthropic-provider.js';
import { MockProvider } from './mock-provider.js';
import type { JarvisModelProvider } from './provider.js';

const log = createLogger({ scope: 'jarvis-core:model' });

/**
 * Mock by default; Anthropic only when a key is present (ADR 0006 — no key is
 * required to run or verify Stage 1A). Logs which provider was selected and
 * never the reason's value.
 */
export function createProvider(env: Env): JarvisModelProvider {
  if (env.ANTHROPIC_API_KEY !== undefined && env.ANTHROPIC_API_KEY !== '') {
    log.info('model provider selected', { provider: 'anthropic' });
    return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY });
  }
  log.info('model provider selected', { provider: 'mock' });
  return new MockProvider();
}
```

- [ ] **Step 4: Rewrite `services/jarvis-core/src/index.ts`**

Replace the placeholder file with real exports, keeping (and updating) the honest status header: status becomes `PARTIAL — model provider abstraction and Thought Amplifier v1 logic implemented; orchestration, personality, memory, and sub-agent coordination NOT IMPLEMENTED`. Keep the two binding rules (never unlimited permissions; may request stricter AEGIS level only) verbatim. Exports:

```typescript
export { AMPLIFIER_SYSTEM_PROMPT, buildAmplifierUserMessage } from './amplifier/prompt.js';
export { AnthropicProvider, DEFAULT_MODEL, ModelRefusalError } from './model/anthropic-provider.js';
export { createProvider } from './model/create-provider.js';
export { MockProvider } from './model/mock-provider.js';
export type { JarvisModelProvider } from './model/provider.js';
```

- [ ] **Step 5: Run the full suite and verify**

Run: `npm run verify` — Expected: format, lint (including the boundary rules — jarvis-core imports no AEGIS internals, no Electron), typecheck, and all tests green.

- [ ] **Step 6: Commit**

```bash
git add services/jarvis-core && git commit -m "feat(jarvis-core): provider factory; the package is no longer empty"
```

---

### Task 6: Documentation truth pass

**Files:**
- Modify: `docs/KNOWN-LIMITATIONS.md` §6 — the provider abstraction now exists in jarvis-core with a deterministic mock default; it is NOT wired to the desktop app (that is Checkpoint 2); no key is required.
- Modify: `CLAUDE.md` structure table — `services/jarvis-core` row: `NOT IMPLEMENTED — empty` → `PARTIAL — model provider + amplifier logic, not wired to the app`.
- Modify: `docs/BACKLOG.md` NOW entry — status note: Checkpoint 1 of 4 complete.

- [ ] **Step 1: Make the three edits** (each is a one-to-three-line change matching the language above)
- [ ] **Step 2: Run `npm run verify`** — Expected: green (docs don't affect it, but this is the pre-commit rule)
- [ ] **Step 3: Commit**

```bash
git add docs/KNOWN-LIMITATIONS.md CLAUDE.md docs/BACKLOG.md && git commit -m "docs: record checkpoint 1 truthfully — jarvis-core is PARTIAL, not wired"
```

---

## The remaining checkpoints (planned in detail after Checkpoint 1 lands)

Each gets its own plan file, grounded in the code the previous checkpoint actually produced:

- **Checkpoint 2 — The boundary and the conversation (first William-testable milestone).** IPC channels `jarvis:chat` and `jarvis:amplify` following the existing pattern exactly (CHANNELS entry → contract → `handleContract` → named preload function → IPC-SURFACE.md entry, one commit per channel per ADR 0002); minimal conversation UI + amplifier card in the renderer; probe extended to the new bridge surface and key-material assertion. **Exit test: William converses with labeled mock output offline, flips on his key, and amplifies one real idea.**
- **Checkpoint 3 — Persistence.** First migrations (`sessions`, `messages`); `@electron/rebuild` wiring; `history:save/list/get/delete` channels; history panel; explicit-save semantics (quit-without-save leaves nothing).
- **Checkpoint 4 — Acceptance.** All eight ADR 0006 acceptance tests; Windows dev-runtime gate re-run by William; docs truth pass; his real-task acceptance — the *accepted* rung of the evidence ladder.
