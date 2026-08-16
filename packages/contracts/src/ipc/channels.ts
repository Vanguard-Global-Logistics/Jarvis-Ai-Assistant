/**
 * The IPC channel allowlist.
 *
 * Deliberately dependency-free — no Zod, no imports. The preload runs sandboxed
 * and should carry the smallest possible payload; keeping the channel names in
 * their own module means the bridge can name a channel without dragging the
 * whole validation layer across the boundary with it.
 *
 * A channel that is not in this object does not exist. Adding one here is the
 * deliberate act of widening the trust boundary (ADR 0002), and must be
 * accompanied by a request/response contract in ./contracts.ts.
 */
export const CHANNELS = {
  /** Static host facts: versions, platform, packaged state. Read-only. */
  appGetInfo: 'app:get-info',

  /**
   * One conversation turn: a transcript in, one model reply out. The reply
   * names its own provider so the UI can label mock output as mock
   * (SECURITY-BOUNDARIES.md; CLAUDE.md §8). Grants no authority beyond calling
   * the main-process model provider — no filesystem, shell, env, or AEGIS.
   */
  jarvisChat: 'jarvis:chat',

  /**
   * Thought Amplifier v1 (ADR 0006): a rough idea in, the five validated
   * fields out. Same authority envelope as `jarvis:chat` — a model call and
   * nothing more.
   */
  jarvisAmplify: 'jarvis:amplify',

  /** Persist one named transcript only after the owner explicitly saves it. */
  historySave: 'history:save',

  /** List bounded metadata for explicitly saved sessions. */
  historyList: 'history:list',

  /** Open one explicitly saved session by opaque id. */
  historyGet: 'history:get',

  /** Delete one explicitly saved session by opaque id. */
  historyDelete: 'history:delete',

  /**
   * Return a bounded, policy-filtered view of the active profile's durable
   * memories. The renderer cannot choose a profile or query raw persistence.
   */
  memoryInspect: 'memory:inspect',

  /**
   * Delete one memory already visible to the active profile. Main supplies the
   * actor identity and policy context; the renderer supplies only an opaque id.
   */
  memoryDelete: 'memory:delete',
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

/** Every registered channel name, for exhaustiveness checks and tests. */
export const ALL_CHANNELS: readonly ChannelName[] = Object.values(CHANNELS);
