import type { JSX } from 'react';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/ibm-plex-mono/400.css';
import { Shell } from './experience/Shell.js';

/**
 * The live page is the Experience Shell (E2) — ambient stage + centered Orb,
 * superseding the unstyled foundation page behind the E2 screenshot gate.
 * The trust-boundary proof (real host facts via `app:get-info`) lives on in
 * the Shell's footer; the archived renderer exploration under `components/`
 * and `styles/` remains archived and unreferenced.
 *
 * Fonts are bundled locally via @fontsource (strict CSP — no CDNs): Space
 * Grotesk 700 for the wordmark, Inter 400 for body, IBM Plex Mono 400 for
 * labels/metrics, per the approved typography tokens.
 */
export function App(): JSX.Element {
  return <Shell />;
}
