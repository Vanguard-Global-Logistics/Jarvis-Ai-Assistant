import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { AppInfo, OrbState } from '@jarvis/contracts';
import { ORB_STATES } from '@jarvis/contracts';
import { Orb, accent, background, fontFamily, letterSpacing, surface, text } from '@jarvis/ui';

/**
 * The Experience Shell (task E2, closing sub-task): ambient stage + centered
 * Orb. This supersedes the unstyled foundation page behind the E2 screenshot
 * gate (`docs/superpowers/plans/2026-07-17-experience-prototype-plan.md` §2).
 *
 * A calm instrument, not a dashboard: near-black navy stage, faint radial
 * light responding to the Orb's accent, the Orb as the single bright object.
 * The surface router (glass scenes emerging from the depth) arrives with
 * C2/E3 — it is deliberately absent rather than mocked (CLAUDE.md §8: no
 * control that looks functional and does nothing).
 *
 * Honesty surface: the footer states plainly that this is the Phase 1
 * foundation with no application features and no AEGIS. The host facts are
 * REAL values from the one IPC channel (`app:get-info`) — the same
 * trust-boundary proof the foundation page carried, restyled, not removed.
 *
 * The state switcher is a DEV-ONLY tool (stripped from production builds via
 * `import.meta.env.DEV`) and is labeled MOCK: it drives the Orb's visual
 * state locally and proves nothing about any real Jarvis state engine.
 * `aegisLockdown` stays labeled demo-only (KNOWN-LIMITATIONS §1).
 */
export interface ShellProps {
  /** Show the dev-only state switcher. Defaults to the build-mode flag. */
  devStateSwitcher?: boolean;
}

const STAGE_BACKGROUND = [
  // The approved faint radial glows over the deep navy field (CLAUDE.md §6).
  `radial-gradient(1100px 700px at 50% 38%, ${background.radialGlow} 0%, transparent 60%)`,
  `linear-gradient(180deg, ${background.fieldTop} 0%, ${background.fieldBottom} 100%)`,
].join(', ');

export function Shell({ devStateSwitcher = import.meta.env.DEV }: ShellProps): JSX.Element {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // The bridge may be absent: if the preload failed, reaching straight for
    // `.getAppInfo()` would throw synchronously and blank the window. Surface
    // the broken trust boundary instead (same rule as the foundation page).
    const bridge = window.jarvis;
    if (bridge === undefined) {
      setBridgeError('The preload bridge did not load. window.jarvis is undefined.');
      return;
    }

    bridge
      .getAppInfo()
      .then((result) => {
        if (!cancelled) setInfo(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setBridgeError(cause instanceof Error ? cause.message : String(cause));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: STAGE_BACKGROUND,
        color: text.body,
        fontFamily: fontFamily.body,
      }}
    >
      <h1
        style={{
          marginTop: 48,
          marginBottom: 0,
          fontFamily: fontFamily.display,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: letterSpacing.wordmark,
          textTransform: 'uppercase',
          color: text.heading,
        }}
      >
        Jarvis
      </h1>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Orb state={orbState} sizePx={360} />
      </div>

      {devStateSwitcher && (
        <section
          aria-label="Dev-only orb state switcher (mock states)"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            maxWidth: 720,
            padding: 12,
            marginBottom: 16,
            border: `1px solid ${surface.hairline}`,
            borderRadius: surface.radiusMin,
            background: surface.glass,
          }}
        >
          <span
            style={{
              width: '100%',
              textAlign: 'center',
              fontFamily: fontFamily.mono,
              fontSize: 11,
              letterSpacing: letterSpacing.label,
              color: text.faint,
            }}
          >
            DEV · STATE SWITCHER · MOCK — drives the Orb visual only; no real state engine exists
          </span>
          {ORB_STATES.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => {
                setOrbState(state);
              }}
              aria-pressed={state === orbState}
              style={{
                minHeight: 44,
                padding: '8px 14px',
                fontFamily: fontFamily.mono,
                fontSize: 12,
                letterSpacing: letterSpacing.label,
                color: state === orbState ? background.fieldTop : text.secondary,
                background: state === orbState ? accent.jarvisBlue : 'transparent',
                border: `1px solid ${state === orbState ? accent.jarvisBlue : surface.hairline}`,
                borderRadius: surface.radiusMin,
                cursor: 'pointer',
              }}
            >
              {state === 'aegisLockdown' ? 'aegisLockdown (demo-only)' : state}
            </button>
          ))}
        </section>
      )}

      <footer
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '14px 24px 18px',
          borderTop: `1px solid ${surface.hairline}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          alignItems: 'center',
          fontFamily: fontFamily.mono,
          fontSize: 11,
          letterSpacing: letterSpacing.label,
          color: text.faint,
          textAlign: 'center',
        }}
      >
        <span>
          PHASE 1 FOUNDATION · NO APPLICATION FEATURES · AEGIS NOT IMPLEMENTED — NOTHING HERE IS
          PROTECTED BY IT
        </span>
        {bridgeError !== null && (
          <span role="alert" style={{ color: accent.danger }}>
            Failed to read host info: {bridgeError}
          </span>
        )}
        {bridgeError === null && info === null && <span>Reading host info…</span>}
        {info !== null && (
          <span>
            HOST (REAL, via app:get-info): app {info.appVersion} · electron {info.electronVersion} ·
            chrome {info.chromeVersion} · node {info.nodeVersion} · {info.platform} ({info.arch}) ·
            packaged {String(info.isPackaged)}
          </span>
        )}
      </footer>
    </main>
  );
}
