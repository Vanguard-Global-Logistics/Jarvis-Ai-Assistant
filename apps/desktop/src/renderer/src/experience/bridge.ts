/** The preload bridge as the renderer sees it. Optional, per `preload/index.d.ts`. */
export type JarvisBridge = NonNullable<Window['jarvis']>;

/**
 * THE answer to "what does this app do with an incomplete bridge?" — and it
 * must be used by every bridge access in the renderer, without exception.
 *
 * Extracted from `Shell.tsx` (where it originated) into its own module so a
 * second component (`ForgePanel`) could use it without re-deriving it from
 * scratch — a swarm finding on ADR 0034 caught `ForgePanel` doing exactly
 * that: a second, independently-typed copy of this function, which resets
 * every lesson below to zero for any future fix that only touches one copy.
 *
 * ## What it is defending, and where — the two are not the same
 *
 * A missing bridge function throws a SYNCHRONOUS `TypeError`. That matters
 * differently at different call sites, and saying so precisely is the point:
 *
 * - **In a `.then()`/`.catch()` effect** — the host-facts and AEGIS effects in
 *   `Shell.tsx` — the throw happens BEFORE any promise exists, so no
 *   `.catch()` can intercept it and the whole Shell unmounts. Here the guard
 *   is the only thing standing between a stale preload and a blank window
 *   with the security indicator gone. An indicator that vanishes is not
 *   better than one showing GREEN wrongly; it is the same failure with no
 *   message attached.
 * - **Inside an `async` function** — `refreshMemories`, `ForgePanel`'s own
 *   `refresh` — the throw becomes a rejected promise that the function's own
 *   `try`/`catch` already handles. The guard is NOT what prevents a crash
 *   there. What it does there is produce a DIFFERENT and more accurate
 *   message: "this build has no memory/forge channel" rather than "the store
 *   could not be read". Those need different actions from whoever is holding
 *   the machine — a reinstall versus a database problem.
 *
 * That distinction was found by red-green: a mutation meant to prove the
 * guard on the memory path stayed GREEN, because the try/catch was doing the
 * work the comment credited to the guard. Crediting the wrong mechanism is
 * how a reviewer comes to trust a control that is not working.
 *
 * `Window['jarvis']` being typed does not settle this. The type constrains
 * the TEST FAKE and the compile of this repository; it says nothing about
 * the preload actually loaded at runtime by a packaged app, which is the
 * only situation the check exists for — a stale `app.asar`, a preload that
 * failed partway, a renderer newer than the shell around it.
 *
 * ## Why it returns the MEMBER and not the bridge
 *
 * Returning the whole bridge would let the key a caller validates and the
 * method it then invokes be two independent strings nothing keeps in
 * agreement: `bridgeMember('remember')` followed by `jarvis.forget(id)`
 * would compile, type-check, and crash with no test able to see it.
 * Returning the member means the name is written once per call site and the
 * compiler enforces the pairing.
 *
 * ## And why it must be applied EVERYWHERE
 *
 * A partially-applied guard is worse than none: `Shell.tsx`'s own history
 * records `getAppInfo` sitting unguarded in the same effect ABOVE the AEGIS
 * guard, so the guard was unreachable and the crash it described as fixed
 * was still live — and a `ConversationBridge` assembled from the raw
 * `window.jarvis` behind a bare `=== null` check, sending eleven more
 * members out unchecked. A false claim about a control is more expensive
 * than no control, because it stops people looking.
 */
export function bridgeMember<K extends keyof JarvisBridge>(key: K): JarvisBridge[K] | null {
  const bridge = window.jarvis;
  if (bridge === undefined) return null;
  const member = bridge[key];
  if (typeof member !== 'function') return null;
  // Bound so a call site can hold the function alone. The preload's members are
  // arrow functions closing over `ipcRenderer` and do not use `this`, so this is
  // belt rather than braces — but a member that later did would break silently
  // without it.
  return (member as (...args: never[]) => unknown).bind(bridge) as JarvisBridge[K];
}
