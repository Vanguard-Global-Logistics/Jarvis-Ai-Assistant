import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { AppInfo } from '@jarvis/contracts';

/**
 * Foundation shell.
 *
 * Deliberately unstyled. The approved design (docs/VISUAL-DESIGN-TARGET.md) is
 * implemented against @jarvis/ui when the visual stage begins — not improvised
 * here.
 *
 * What this proves, end to end: the renderer reaches the main process through
 * the preload bridge, main validates the request, produces a real response from
 * Electron's own metadata, validates it against the contract, and returns it.
 * The values below are read from the live host — none are mocked.
 */
export function App(): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // The bridge itself may be absent. If the preload failed to load,
    // `contextBridge` never ran, and reaching straight for `.getAppInfo()`
    // would throw a synchronous TypeError that the `.catch()` below cannot
    // intercept — React would unmount and the window would go blank, which
    // reads as "nothing happened" rather than "the trust boundary is broken".
    const bridge = window.jarvis;
    if (bridge === undefined) {
      setError('The preload bridge did not load. window.jarvis is undefined.');
      return;
    }

    bridge
      .getAppInfo()
      .then((result) => {
        if (!cancelled) setInfo(result);
      })
      .catch((cause: unknown) => {
        // Surface the failure rather than rendering a plausible-looking blank.
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <h1>Jarvis</h1>
      <p>Phase 1 foundation. No application features are implemented.</p>

      <h2>Host</h2>
      {error !== null && <p role="alert">Failed to read host info: {error}</p>}
      {error === null && info === null && <p>Reading host info…</p>}
      {info !== null && (
        <ul>
          <li>App version: {info.appVersion}</li>
          <li>Electron: {info.electronVersion}</li>
          <li>Chrome: {info.chromeVersion}</li>
          <li>Node: {info.nodeVersion}</li>
          <li>
            Platform: {info.platform} ({info.arch})
          </li>
          <li>Packaged: {String(info.isPackaged)}</li>
        </ul>
      )}

      <h2>Not implemented</h2>
      <ul>
        <li>AEGIS — nothing here is protected by it.</li>
        <li>Jarvis orchestrator, Forge, Ledger.</li>
        <li>Memory, Voice, Vision, Drive Mode.</li>
      </ul>
    </main>
  );
}
