import { z } from 'zod';

/**
 * Model contracts — the shapes that cross between the UI, the IPC boundary
 * (Checkpoint 2), and the jarvis-core providers.
 *
 * Client-agnostic by requirement (ADR 0006): no Electron types, ever. Every
 * future client (browser, mobile, watch) consumes these same schemas.
 */

/**
 * The providers that exist. A closed set — adding one is a deliberate act.
 *
 * `local` is a model running on the user's own hardware (ADR 0015). `grok` is
 * xAI's hosted model (ADR 0020). `gemini` is Google's (ADR 0023) — the only
 * capable remote option with a genuinely free tier, which is why it earns a slot
 * despite being a fourth vendor. Both are labeled distinctly in the UI for the
 * same reason `mock` is: the user is entitled to know which brain answered,
 * because they differ in capability, in cost, and in whether the conversation
 * left the machine at all.
 */
export const PROVIDER_IDS = ['mock', 'anthropic', 'local', 'grok', 'gemini'] as const;
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

/**
 * Thought Amplifier v1 input — a single rough idea.
 *
 * A one-field object rather than a bare string on purpose: it is `.strict()`,
 * so a caller that tries to smuggle extra fields across the boundary is
 * rejected, and a later addition (e.g. a mode flag) extends the object without
 * changing the channel's shape from "string" to "object".
 */
export const AmplifyRequestSchema = z
  .object({
    idea: z.string().min(1),
  })
  .strict();

export type AmplifyRequest = z.infer<typeof AmplifyRequestSchema>;

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

// --- automation planning (ADR 0024) ----------------------------------------

/**
 * "Automate this for me" — the outcome, in William's words.
 *
 * One field, `.strict()`, same reasoning as `AmplifyRequestSchema`: room to grow
 * without changing the channel's shape.
 */
export const AutomationPlanRequestSchema = z
  .object({
    /** What "done" looks like. Not the steps — the outcome. */
    outcome: z.string().min(1),
  })
  .strict();

export type AutomationPlanRequest = z.infer<typeof AutomationPlanRequestSchema>;

/**
 * A plan for an automation. **A document, not an action.**
 *
 * Jarvis cannot see a screen and cannot drive a mouse — Vision and computer
 * control are exactly what AEGIS YELLOW exists to switch off, and AEGIS does not
 * exist yet (`services/aegis` is empty by choice). So this channel plans and
 * nothing else, and the schema is built so it cannot quietly grow into more.
 *
 * Two fields are REQUIRED and carry the honesty:
 *
 *   - `cannotDoYet` — the part Jarvis cannot perform itself, and why. A required
 *     non-empty string, so a model that produces a confident plan implying it
 *     will execute fails validation at the boundary instead of reaching the UI.
 *     Today it is always true: nothing here executes anything.
 *   - `doThisNow` — how to get the outcome by hand today. A plan for a thing
 *     that cannot run yet is worth much less than a plan plus a way through.
 *
 * `credentialsNeeded` NAMES logins the automation would touch — "your Chase
 * login", "the BCI VPN". It must never carry a value, and nothing in this
 * system asks for one: credentials belong in the OS keychain, referenced and
 * never read into a prompt (ADR 0024). The renderer renders these as labels.
 */
export const AutomationPlanSchema = z
  .object({
    /** The outcome restated precisely, so a misunderstanding is visible early. */
    outcome: z.string().min(1),
    /** Concrete, ordered, each one a thing a person could actually do. */
    steps: z.array(z.string().min(1)).min(1).max(20),
    /** Apps, accounts, files, or access the automation would require. */
    needs: z.array(z.string().min(1)).max(20),
    /** Logins it would touch, BY NAME. Never a value. */
    credentialsNeeded: z.array(z.string().min(1)).max(20),
    /** What could go wrong — especially anything touching money or data. */
    risks: z.array(z.string().min(1)).max(20),
    /** The part Jarvis cannot do itself, and why. Required. */
    cannotDoYet: z.string().min(1),
    /** How to reach the outcome by hand today. Required. */
    doThisNow: z.string().min(1),
  })
  .strict();

export type AutomationPlan = z.infer<typeof AutomationPlanSchema>;
