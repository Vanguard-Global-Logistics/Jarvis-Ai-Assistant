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

  /**
   * "Automate this for me" (ADR 0024): an outcome in, a written PLAN out.
   *
   * Same authority envelope as `jarvis:chat` — one model call, nothing more. It
   * does NOT see a screen, drive a mouse, open an app, or touch a credential,
   * and it cannot grow into those without a new channel and a new argument.
   * Screen Vision and computer control are precisely what AEGIS YELLOW exists to
   * revoke, and AEGIS does not exist yet.
   *
   * The response schema REQUIRES `cannotDoYet`, so a plan that implies Jarvis
   * will carry it out fails validation at the boundary rather than misleading
   * someone in the UI.
   */
  jarvisPlanAutomation: 'jarvis:plan-automation',

  /**
   * Stage 1A persistence (ADR 0006, ADR 0008). Four narrow operations against
   * the main-process-owned SQLite database. Saving is EXPLICIT: nothing writes
   * without the renderer invoking `history:save`, and the renderer never names
   * a path, a table, or a query — main owns the file, the schema, and every
   * statement. No channel accepts SQL or a filesystem path.
   */
  historySave: 'history:save',

  /** List saved conversations — metadata only, never full transcripts. */
  historyList: 'history:list',

  /** Open one saved conversation by id, read-only. */
  historyGet: 'history:get',

  /** Delete one saved conversation by id. The UI confirms before invoking. */
  historyDelete: 'history:delete',

  /**
   * Back up every saved conversation to a file the USER picks (ADR 0011).
   *
   * The renderer never names a path and never receives one: main opens the
   * native save dialog, so the only writable location is the one a human chose
   * in an OS dialog this turn. Read-only against the database; the sole
   * filesystem write in the application, and it cannot be aimed by the
   * renderer.
   */
  historyExport: 'history:export',

  /**
   * Restore conversations from a backup file the USER picks (ADR 0014).
   *
   * The mirror of `history:export`: main opens the native OPEN dialog, so the
   * only readable file is one a human chose this turn. The renderer names no
   * path and learns none. Restoring MERGES — saved conversations are immutable
   * and UUID-keyed, so an id already present is skipped, never overwritten.
   */
  historyImport: 'history:import',

  /**
   * Read this installation's profile — the name and accent shown on the orb
   * (ADR 0013). Appearance only: a profile grants no capability, and is not a
   * login. Data separation comes from OS user accounts (ADR 0012).
   */
  /**
   * Which brain is answering, and change it without restarting (ADR 0022).
   *
   * `model:describe` is READ-ONLY and returns provider IDENTIFIERS plus whether
   * each is configured — never a key, a URL, or any part of one. `model:select`
   * names one of the same closed set.
   *
   * Deliberately NOT a way to supply configuration. The renderer cannot set an
   * endpoint, a model name, or a credential; it can only pick among providers
   * main already built from the trusted environment. That keeps ADR 0015's
   * loopback rule where it belongs — a renderer that could name a URL could
   * name a remote one and call it local.
   */
  modelDescribe: 'model:describe',

  /** Switch the active provider. Refuses, with a reason, if not configured. */
  modelSelect: 'model:select',

  /**
   * AEGIS status — READ-ONLY (ADR 0025).
   *
   * The one surface in this app where the UI must reflect a REAL engine rather
   * than sample data (CLAUDE.md §6). Returns the level, the capability map, and
   * whether the audit chain verified. Carries no handle and no identifier that
   * could be used to act on AEGIS: reading the status is never a step toward
   * changing it.
   */
  aegisStatus: 'aegis:status',

  /**
   * Ask AEGIS for a STRICTER level — the panic button (ADR 0025).
   *
   * Raise-only, and that is the entire safety argument for exposing it to an
   * untrusted renderer: increasing severity is always permitted, from Jarvis or
   * from anyone. There is deliberately NO channel that lowers a level, enters
   * blackout recovery, or edits the audit log. Those live on the admin surface
   * in main, which the renderer cannot reach by any channel.
   */
  aegisRequestRestriction: 'aegis:request-restriction',

  profileGet: 'profile:get',

  /** Set the profile. The only write, and it changes nothing but presentation. */
  profileSet: 'profile:set',
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

/** Every registered channel name, for exhaustiveness checks and tests. */
export const ALL_CHANNELS: readonly ChannelName[] = Object.values(CHANNELS);
