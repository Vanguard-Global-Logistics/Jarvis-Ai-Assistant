import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { AppInfo, OrbState } from '@jarvis/contracts';
import { ORB_STATES } from '@jarvis/contracts';
import {
  Orb,
  OrbStudyV2,
  accent,
  background,
  fontFamily,
  letterSpacing,
  orbTiming,
  surface,
  text,
} from '@jarvis/ui';

/**
 * The Experience Shell (task E2, visual correction pass): cinematic ambient
 * stage + the Orb as the unmistakable primary subject.
 *
 * Stage depth (benchmark §5/§8, restrained): a volumetric halo behind the
 * Orb, a deep vignette, faint foreground haze — all static gradients (zero
 * blur surfaces, zero loops beyond the Orb and ambient light). No HUD, no
 * data columns, no business universe — those are E3+ surfaces and are
 * deliberately absent rather than mocked (CLAUDE.md §8).
 *
 * Honesty surface: the footer states plainly that this is the Phase 1
 * foundation with no application features and no AEGIS. Host facts are REAL
 * values from the one IPC channel (`app:get-info`). When the preload bridge
 * is absent (a plain-browser preview of the Vite page), the Shell says so
 * neutrally and logs diagnostics to the console — it never fakes a bridge
 * and never wears a red runtime error as part of the composition. A real
 * bridge failure inside Electron is still surfaced (visibly, compactly) and
 * logged.
 *
 * The state switcher is a DEV-ONLY tool (stripped from production builds via
 * `import.meta.env.DEV`), docked bottom-right, collapsed by default, labeled
 * MOCK. It drives the Orb's visual state locally and proves nothing about
 * any real state engine. `aegisLockdown` stays labeled demo-only
 * (KNOWN-LIMITATIONS §1). Wake is a transition state (`loops: false`): after
 * the choreography completes, the Shell settles the Orb into idle breathing.
 */
export interface ShellProps {
  /** Show the dev-only state switcher. Defaults to the build-mode flag. */
  devStateSwitcher?: boolean;
}

/** How the host-facts line reads, depending on what the environment provides. */
type HostFacts =
  | { kind: 'loading' }
  | { kind: 'real'; info: AppInfo }
  | { kind: 'noBridge' }
  | { kind: 'bridgeError' };

const STAGE_BACKGROUND = [
  // Volumetric halo behind the Orb, then the approved faint radial glow,
  // over the deep navy field (CLAUDE.md §6; benchmark §12).
  `radial-gradient(620px 620px at 50% 44%, rgba(90,209,255,0.05) 0%, transparent 70%)`,
  `radial-gradient(1100px 700px at 50% 38%, ${background.radialGlow} 0%, transparent 60%)`,
  `linear-gradient(180deg, ${background.fieldTop} 0%, ${background.fieldBottom} 100%)`,
].join(', ');

/** Deep vignette + faint floor haze — static depth cues, pointer-transparent. */
const VIGNETTE = `radial-gradient(120% 90% at 50% 42%, transparent 55%, rgba(0,0,0,0.5) 100%)`;
const HAZE = `linear-gradient(180deg, transparent 78%, rgba(5,7,10,0.55) 100%)`;

export function Shell({ devStateSwitcher = import.meta.env.DEV }: ShellProps): JSX.Element {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [host, setHost] = useState<HostFacts>({ kind: 'loading' });
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // DEV-ONLY renderer study (E2 renderer reset): when on, the V2 three.js
  // study renders instead of the legacy Orb, and the frame goes cinematic
  // (wordmark/footer move into the dev diagnostics drawer). Unreachable in
  // production builds — it lives behind the dev switcher flag.
  const [rendererV2, setRendererV2] = useState(false);
  const [studyPhase, setStudyPhase] = useState<'dormant' | 'gathering' | 'ignition' | null>(null);
  // The renderer ACTUALLY live, reported by the V2 component itself — the
  // inspector must never show "V2" while the honest fallback is rendering.
  const [activeRenderer, setActiveRenderer] = useState<string>('legacy');
  const cinematic = devStateSwitcher && rendererV2;

  useEffect(() => {
    let cancelled = false;

    const bridge = window.jarvis;
    if (bridge === undefined) {
      // Expected in a plain-browser preview of the Vite page: no preload, no
      // bridge. Say so neutrally; diagnostics belong in the console, not in
      // the composition. Never fabricate a bridge (CLAUDE.md §8).
      console.info(
        '[shell] window.jarvis is undefined — no Electron preload bridge in this context. ' +
          'Host facts require the Electron runtime (npm run dev:desktop).',
      );
      setHost({ kind: 'noBridge' });
      return;
    }

    bridge
      .getAppInfo()
      .then((result) => {
        if (!cancelled) setHost({ kind: 'real', info: result });
      })
      .catch((cause: unknown) => {
        // A present-but-failing bridge is a real defect: keep it visible
        // (compactly) and put the detail where a developer will read it.
        console.error('[shell] app:get-info failed across the IPC boundary:', cause);
        if (!cancelled) setHost({ kind: 'bridgeError' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Wake is a transition, not a resting state: settle into idle breathing
  // after the choreography completes (benchmark §21 — awakening → idle).
  useEffect(() => {
    if (orbState !== 'wake') {
      return;
    }
    const timer = window.setTimeout(() => {
      setOrbState('idle');
    }, orbTiming.wakeSequenceMs + 400);
    return () => {
      window.clearTimeout(timer);
    };
  }, [orbState]);

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: STAGE_BACKGROUND,
        color: text.body,
        fontFamily: fontFamily.body,
        overflow: 'hidden',
      }}
    >
      {!cinematic && (
        <h1
          style={{
            marginTop: 44,
            marginBottom: 0,
            fontFamily: fontFamily.display,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: letterSpacing.wordmark,
            textTransform: 'uppercase',
            color: text.heading,
            zIndex: 1,
          }}
        >
          Jarvis
        </h1>
      )}

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        {cinematic ? (
          <OrbStudyV2
            state={orbState}
            studyPhase={studyPhase}
            sizePx={460}
            onRendererResolved={setActiveRenderer}
          />
        ) : (
          <Orb state={orbState} sizePx={420} />
        )}
      </div>

      {/* static depth cues over the stage, under nothing interactive */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, background: VIGNETTE, pointerEvents: 'none' }}
      />
      <div
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, background: HAZE, pointerEvents: 'none' }}
      />

      {devStateSwitcher && (
        <section
          aria-label="Dev-only orb state switcher (mock states)"
          style={{
            position: 'absolute',
            right: 14,
            bottom: 54,
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 6,
          }}
        >
          {switcherOpen && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: 8,
                border: `1px solid ${surface.hairline}`,
                borderRadius: surface.radiusMin,
                background: 'rgba(5,7,10,0.88)',
                maxHeight: '60vh',
                overflowY: 'auto',
              }}
            >
              <span
                style={{
                  fontFamily: fontFamily.mono,
                  fontSize: 9,
                  letterSpacing: letterSpacing.label,
                  color: text.faint,
                  padding: '2px 6px 6px',
                  maxWidth: 220,
                }}
              >
                MOCK — drives the Orb visual only; no real state engine exists
              </span>
              <button
                type="button"
                data-dev-v2="true"
                onClick={() => {
                  setRendererV2((on) => !on);
                }}
                aria-pressed={rendererV2}
                style={{
                  minHeight: 30,
                  padding: '5px 10px',
                  textAlign: 'right',
                  fontFamily: fontFamily.mono,
                  fontSize: 11,
                  letterSpacing: letterSpacing.label,
                  color: rendererV2 ? background.fieldTop : accent.claudePurple,
                  background: rendererV2 ? accent.claudePurple : 'transparent',
                  border: `1px solid ${accent.claudePurple}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                renderer V2 study {rendererV2 ? 'ON' : 'off'}
              </button>
              <span
                style={{
                  fontFamily: fontFamily.mono,
                  fontSize: 9,
                  letterSpacing: letterSpacing.label,
                  color: accent.claudePurple,
                  padding: '2px 6px',
                  textAlign: 'right',
                }}
              >
                ACTIVE RENDERER: {rendererV2 ? activeRenderer : 'legacy'}
              </span>
              {rendererV2 &&
                (['dormant', 'gathering', 'ignition'] as const).map((phase) => (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => {
                      setStudyPhase((current) => (current === phase ? null : phase));
                    }}
                    aria-pressed={studyPhase === phase}
                    style={{
                      minHeight: 30,
                      padding: '5px 10px',
                      textAlign: 'right',
                      fontFamily: fontFamily.mono,
                      fontSize: 11,
                      letterSpacing: letterSpacing.label,
                      color: studyPhase === phase ? background.fieldTop : text.secondaryDim,
                      background: studyPhase === phase ? accent.jarvisBlue : 'transparent',
                      border: '1px solid transparent',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    study: {phase}
                  </button>
                ))}
              {cinematic && (
                <span
                  style={{
                    fontFamily: fontFamily.mono,
                    fontSize: 9,
                    letterSpacing: letterSpacing.label,
                    color: text.faint,
                    padding: '4px 6px',
                    maxWidth: 220,
                    borderTop: `1px solid ${surface.hairline}`,
                  }}
                >
                  DIAGNOSTICS · PHASE 1 FOUNDATION · NO APPLICATION FEATURES · AEGIS NOT IMPLEMENTED
                  ·{' '}
                  {host.kind === 'real'
                    ? `HOST: electron ${host.info.electronVersion} · ${host.info.platform}`
                    : host.kind === 'noBridge'
                      ? 'BROWSER PREVIEW — NO PRELOAD BRIDGE'
                      : host.kind === 'bridgeError'
                        ? 'BRIDGE FAILED — SEE CONSOLE'
                        : 'READING HOST…'}
                </span>
              )}
              {ORB_STATES.map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => {
                    setOrbState(state);
                    setStudyPhase(null);
                  }}
                  aria-pressed={state === orbState}
                  style={{
                    minHeight: 30,
                    padding: '5px 10px',
                    textAlign: 'right',
                    fontFamily: fontFamily.mono,
                    fontSize: 11,
                    letterSpacing: letterSpacing.label,
                    color: state === orbState ? background.fieldTop : text.secondaryDim,
                    background: state === orbState ? accent.jarvisBlue : 'transparent',
                    border: '1px solid transparent',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  {state === 'aegisLockdown' ? 'aegisLockdown (demo-only)' : state}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            data-dev-switcher="true"
            aria-expanded={switcherOpen}
            onClick={() => {
              setSwitcherOpen((open) => !open);
            }}
            style={{
              minHeight: 32,
              padding: '6px 10px',
              fontFamily: fontFamily.mono,
              fontSize: 10,
              letterSpacing: letterSpacing.label,
              color: text.faint,
              background: 'rgba(5,7,10,0.7)',
              border: `1px solid ${surface.hairline}`,
              borderRadius: surface.radiusMin,
              cursor: 'pointer',
            }}
          >
            DEV · STATES {switcherOpen ? '▾' : '▸'}
          </button>
        </section>
      )}

      {!cinematic && (
        <footer
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px 24px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            alignItems: 'center',
            fontFamily: fontFamily.mono,
            fontSize: 10,
            letterSpacing: letterSpacing.label,
            color: text.faint,
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          <span>
            PHASE 1 FOUNDATION · NO APPLICATION FEATURES · AEGIS NOT IMPLEMENTED — NOTHING HERE IS
            PROTECTED BY IT
          </span>
          {host.kind === 'loading' && <span>Reading host info…</span>}
          {host.kind === 'real' && (
            <span>
              HOST (REAL, via app:get-info): app {host.info.appVersion} · electron{' '}
              {host.info.electronVersion} · chrome {host.info.chromeVersion} · node{' '}
              {host.info.nodeVersion} · {host.info.platform} ({host.info.arch}) · packaged{' '}
              {String(host.info.isPackaged)}
            </span>
          )}
          {host.kind === 'noBridge' && (
            <span>
              BROWSER PREVIEW · PRELOAD BRIDGE UNAVAILABLE — HOST FACTS REQUIRE THE ELECTRON RUNTIME
              (SEE CONSOLE)
            </span>
          )}
          {host.kind === 'bridgeError' && (
            <span role="alert" style={{ color: accent.warning }}>
              HOST FACTS UNAVAILABLE — THE PRELOAD BRIDGE FAILED; SEE CONSOLE DIAGNOSTICS
            </span>
          )}
        </footer>
      )}
    </main>
  );
}
