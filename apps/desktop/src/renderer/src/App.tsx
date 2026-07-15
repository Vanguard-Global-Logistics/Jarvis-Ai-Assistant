import type { JSX } from 'react';

/**
 * Foundation shell.
 *
 * Deliberately unstyled and featureless. Visual work is deferred, and the
 * approved design (docs/VISUAL-DESIGN-TARGET.md) must be implemented against
 * @jarvis/ui when that stage begins — not improvised here.
 *
 * This component exists to prove the Electron + Vite + React pipeline renders.
 * It states what is true and nothing more. It must not be dressed up to look
 * like a working Jarvis (CLAUDE.md §8).
 */
export function App(): JSX.Element {
  return (
    <main>
      <h1>Jarvis</h1>
      <p>Phase 1 foundation. No application features are implemented.</p>
      <ul>
        <li>AEGIS: NOT IMPLEMENTED — nothing here is protected by it.</li>
        <li>Jarvis orchestrator: NOT IMPLEMENTED.</li>
        <li>Forge: NOT IMPLEMENTED.</li>
        <li>Ledger: NOT IMPLEMENTED.</li>
        <li>Memory, Voice, Vision, Drive Mode: NOT IMPLEMENTED.</li>
        <li>IPC bridge: no channels exposed.</li>
      </ul>
    </main>
  );
}
