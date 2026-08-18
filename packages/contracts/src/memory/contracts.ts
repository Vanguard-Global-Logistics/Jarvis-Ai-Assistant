import { z } from 'zod';

/**
 * Memory v1 — the durable facts Jarvis knows about the person whose account it
 * runs in (ADR 0029; `docs/foundation/06-MEMORY-CONSTITUTION.md`).
 *
 * ## Why this file is shaped the way it is
 *
 * Memory has one property nothing else in this repository has: **it is replayed
 * into every future prompt.** A saved conversation is read when someone opens
 * it. A memory is read every time Jarvis thinks. So a mistake here is not a
 * mistake that happened once — it is a mistake that happens forever, silently,
 * in every future answer.
 *
 * Every schema below exists to make one of the constitution's rules structural
 * rather than advisory:
 *
 * - **§1 facts, not documents** — `MEMORY_MAX_LENGTH` is enforced by the schema,
 *   so an essay cannot be stored as a memory even by a caller that wants to.
 * - **§2 CONFIRMED or absent** — `learnedFrom` and `learnedAt` are REQUIRED.
 *   There is no way to construct a valid memory without saying how it was
 *   learned. A fact with no provenance is a rumour with a timestamp.
 * - **§3 sensitivity decides travel** — `MemorySensitivitySchema` is a closed
 *   enum and `sensitivityAllowsSending` is the single predicate the recall path
 *   uses. One rule, one place (CLAUDE.md §3).
 * - **§8 visible and deletable** — every field here is shown in the UI. There is
 *   deliberately no `hidden`, `internal`, or `system` flag, because a memory a
 *   person cannot see is a memory they cannot correct.
 *
 * Note what is NOT here: no `ownerId`, no `userId`, no scope column.
 * Constitution §6 and ADR 0012 make data separation the OS user account —
 * separate databases, not a filtered table. A shared table with a filter fails
 * open when the filter is wrong; separate stores fail closed by construction.
 */

/**
 * One sentence, not one page.
 *
 * The cap is a feature three times over: it keeps recall small enough to stay
 * honest, it keeps every memory readable at a glance in the UI, and — per
 * constitution §7 — it is a small budget for an injected payload.
 */
export const MEMORY_MAX_LENGTH = 280;

/**
 * How far a fact is allowed to travel. NOT who may read it — one person owns the
 * whole store (§6) — but whether it may leave the machine.
 */
export const MEMORY_SENSITIVITIES = {
  /** Ordinary working context. May be sent to any provider. */
  open: {
    label: 'Open',
    description: 'Fine for any brain to see, including ones that leave the machine.',
    leavesMachine: true,
  },
  /** True, useful, nobody else's business. Local models only. */
  private: {
    label: 'Private',
    description: 'Only brains that run on this machine ever see this.',
    leavesMachine: false,
  },
  /**
   * Recorded so Jarvis behaves correctly; must never leave, ever.
   *
   * `leavesMachine: false` here is **belt, not braces** — see
   * `sensitivityAllowsSending`, which denies this tier before it ever reads this
   * table. The field is present so the shape stays uniform and so a reader of
   * this table is not told something false; it is not what enforces the tier.
   *
   * **`description` is rendered to the person**, as the tier's meaning and as
   * the picker button's `title`. It briefly read "No future exception can be
   * carved for it" — a promise about this project's future governance, in a
   * tooltip, describing something no running build can deliver. It says what the
   * code does instead. The governance claim is a rule for developers and lives
   * in `sensitivityAllowsSending` and the constitution, where developers read.
   */
  'never-send': {
    label: 'Never send',
    description: 'Never leaves this machine, and is never put in a prompt that could.',
    leavesMachine: false,
  },
} as const;

export type MemorySensitivity = keyof typeof MEMORY_SENSITIVITIES;

export const MemorySensitivitySchema = z.enum(
  Object.keys(MEMORY_SENSITIVITIES) as [MemorySensitivity, ...MemorySensitivity[]],
);

/**
 * The safe default, and it is deliberately the RESTRICTIVE one.
 *
 * A person adding a fact in a hurry must land on the tier that cannot leak.
 * Widening to `open` is then a deliberate act with a visible control, rather
 * than something that happens by not thinking about it.
 */
export const DEFAULT_SENSITIVITY: MemorySensitivity = 'private';

/**
 * The tier that is denied by NAME rather than by configuration.
 *
 * Exported so the difference between the two restrictive tiers is a value the
 * tests and the UI can both point at, instead of a paragraph everyone has to
 * remember.
 */
export const NEVER_SEND = 'never-send' as const;

/**
 * May a memory at this tier be included in a prompt for a provider that leaves
 * the machine?
 *
 * THE single predicate for constitution §3. The recall path calls this and
 * nothing else decides; a second copy of this rule anywhere would be exactly the
 * drift CLAUDE.md §3 forbids. Total over the closed enum, so a new tier added
 * later cannot silently default to "yes".
 *
 * ## Why `never-send` is answered BEFORE the table is read
 *
 * `private` and `never-send` shipped behaviourally identical — both stayed on
 * the machine, and nothing distinguished them. That is a real problem in a
 * security control, not an untidy one: a person who deliberately picks the
 * stronger-sounding option and receives the weaker guarantee has been told
 * something false by the interface.
 *
 * The constitution's own table already says what the difference is. `private` is
 * **"No — local models only"**: a policy, and policies can later admit an
 * exception (a vetted provider, an enterprise endpoint with a no-training
 * agreement, a self-hosted remote box). `never-send` is **"No, ever"**: an
 * absolute, and an absolute that a one-line data edit can flip was never an
 * absolute.
 *
 * So the tiers differ in WHERE their answer comes from. `private` is decided by
 * `MEMORY_SENSITIVITIES` — configuration, deliberately changeable in one place
 * if that exception is ever argued and approved. `never-send` is decided by this
 * `if`, above the lookup, and no change to that table can reach it.
 *
 * `packages/contracts/src/memory/contracts.test.ts` proves it the only way this
 * kind of claim can honestly be proven: it MUTATES the table at runtime to the
 * exact bad value, and asserts `private` changes answer while `never-send` does
 * not. Without that negative control the test would be two constants agreeing.
 *
 * ## What this did NOT change, stated plainly
 *
 * **A person using this build gets the same behaviour from both tiers today.**
 * `recallFor` filters both out of every prompt bound for a provider that leaves
 * the machine, and includes both for one that does not. Nothing observable
 * differs. What changed is where the answer comes from, which is resistance to a
 * future edit — a developer-facing property, not a user-facing one.
 *
 * Saying otherwise would be the exact overstatement the tier split was meant to
 * end. It was briefly said otherwise, in the user-facing `description` above.
 */
export function sensitivityAllowsSending(sensitivity: MemorySensitivity): boolean {
  if (sensitivity === NEVER_SEND) return false;
  return MEMORY_SENSITIVITIES[sensitivity].leavesMachine;
}

/**
 * May a memory at this tier be written into a PORTABLE BACKUP FILE? (ADR 0031)
 *
 * THE single predicate for the backup travel rule, for the same reason
 * `sensitivityAllowsSending` is the single predicate for the prompt travel
 * rule: the first version wrote `sensitivity !== 'never-send'` as a bare
 * string comparison in two packages, and a bare comparison fails OPEN — a
 * future tier (say `work-only`, `leavesMachine: false`) would be exported into
 * a plaintext file by default, in both copies, with nothing forcing anyone to
 * decide.
 *
 * The exhaustive switch is the fail-closed mechanism: adding a tier to
 * `MEMORY_SENSITIVITIES` makes this function fail to COMPILE until a human
 * writes the new tier's backup answer down. `never-send` is answered above the
 * switch, by name, for the same reason it is in `sensitivityAllowsSending`.
 */
export function sensitivityAllowsBackup(sensitivity: MemorySensitivity): boolean {
  if (sensitivity === NEVER_SEND) return false;
  switch (sensitivity) {
    case 'open':
      return true;
    case 'private':
      // The person's next machine is still their machine — `private` restricts
      // which BRAINS see a fact, not which disks hold it.
      return true;
  }
}

/**
 * How a fact came to be known. Constitution §2 — provenance is required, so
 * this is not optional and has no "unknown" member.
 */
export const MEMORY_SOURCES = {
  /** A person typed it into the memory panel. The only source in v1. */
  told: 'Told to Jarvis',
  /**
   * A person confirmed a proposal Jarvis made during a conversation.
   *
   * Present in the schema from day one because it is the shape the confirm-flow
   * will use, and a migration that adds an enum member later is a migration
   * that has to rewrite rows. It is NOT autonomous writing: a proposal is inert
   * until a human presses the button (§4).
   */
  confirmed: 'Confirmed by you',
} as const;

export type MemorySource = keyof typeof MEMORY_SOURCES;

export const MemorySourceSchema = z.enum(
  Object.keys(MEMORY_SOURCES) as [MemorySource, ...MemorySource[]],
);

/** A memory as it is stored and as the UI receives it. */
export const MemorySchema = z
  .object({
    /** UUID minted in main, never supplied by the renderer (ADR 0008's rule). */
    id: z.uuid(),
    /**
     * The fact itself, as a plain statement about the world.
     *
     * Trimmed and non-empty: whitespace is not a memory. The recall path frames
     * these under a heading that says they are facts to consider and never
     * instructions to follow (§7) — the framing lives in the prompt builder, not
     * in this string.
     */
    fact: z.string().trim().min(1).max(MEMORY_MAX_LENGTH),
    sensitivity: MemorySensitivitySchema,
    learnedFrom: MemorySourceSchema,
    /** ISO-8601, set by main. §2: a fact records when it was learned. */
    learnedAt: z.iso.datetime(),
  })
  .strict();

export type Memory = z.infer<typeof MemorySchema>;

/**
 * What the renderer may send to create a memory.
 *
 * `id`, `learnedAt` AND `learnedFrom` are absent by construction — main mints
 * all three. A renderer that could choose an id could overwrite an existing
 * memory by guessing one, and a renderer that could choose a timestamp could
 * forge when a fact was learned.
 *
 * **`learnedFrom` is here for the same reason, and it was the sharpest of the
 * three.** Provenance IS `learnedFrom` (§2), so leaving it renderer-supplied
 * meant a compromised renderer could stamp `confirmed` on a fact nobody
 * confirmed — while `channels.ts` claimed in prose that main minted it. The
 * swarm found the contradiction between the docstring and the schema. The
 * schema now matches the promise rather than the promise being aspirational.
 *
 * When the confirm-flow lands it adds its own request field or its own channel;
 * it does not re-open this one.
 */
export const RememberRequestSchema = z
  .object({
    fact: z.string().trim().min(1).max(MEMORY_MAX_LENGTH),
    sensitivity: MemorySensitivitySchema,
  })
  .strict();

export type RememberRequest = z.infer<typeof RememberRequestSchema>;

/** Delete one memory by id. Real deletion, per §8 — the row is gone. */
export const ForgetRequestSchema = z.object({ id: z.uuid() }).strict();

export type ForgetRequest = z.infer<typeof ForgetRequestSchema>;

/**
 * Everything Jarvis knows, newest first.
 *
 * The whole store, never a page. §8 requires every memory to be visible, and a
 * paginated view is a view with something below the fold — which is exactly
 * where a poisoned memory would like to live. The size cap that makes this
 * affordable is `MEMORY_MAX_LENGTH` plus the fact that memory is facts, not
 * transcripts.
 */
export const MemoryListSchema = z.array(MemorySchema);

export type MemoryList = z.infer<typeof MemoryListSchema>;
