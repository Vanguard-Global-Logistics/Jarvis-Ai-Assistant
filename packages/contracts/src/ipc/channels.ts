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
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

/** Every registered channel name, for exhaustiveness checks and tests. */
export const ALL_CHANNELS: readonly ChannelName[] = Object.values(CHANNELS);
