import type { JarvisApi } from './index.js';

/**
 * The renderer's view of the preload bridge.
 *
 * Derived from the bridge's own type — never hand-written a second time
 * (CLAUDE.md §3: no duplicated logic). If a channel is removed from the bridge,
 * the renderer stops compiling, which is the point.
 *
 * `jarvis` is optional, and that is not defensive noise — it is the honest type.
 * A preload can fail to load (a bare `require` of something the sandbox cannot
 * resolve is the classic cause), and when it does, `contextBridge` never runs
 * and `window.jarvis` is genuinely `undefined`. Typing it as always-present
 * would make the compiler assert something false about the one failure mode this
 * boundary most needs to surface, and the renderer would die on a synchronous
 * TypeError that no `.catch()` can intercept — a blank window instead of a
 * stated error (CLAUDE.md §8).
 */
declare global {
  interface Window {
    readonly jarvis?: JarvisApi;
  }
}

export {};
