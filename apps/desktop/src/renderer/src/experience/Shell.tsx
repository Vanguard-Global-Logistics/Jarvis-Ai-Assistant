import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import type { CSSProperties } from 'react';
import type {
  AegisLevel,
  AegisStatus,
  AppInfo,
  OrbState,
  Profile,
  ProfileAccentId,
} from '@jarvis/contracts';
import {
  DEFAULT_PROFILE,
  ORB_STATES,
  levelRank,
  PROFILE_ACCENTS,
  profileAccentColor,
} from '@jarvis/contracts';
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
import { Conversation } from './Conversation.js';
import type { ConversationBridge } from './Conversation.js';

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
 * any real state engine. The two states nothing real can drive —
 * `aegisLockdown` (AEGIS does not exist, KNOWN-LIMITATIONS §1) and `executing`
 * (Jarvis has no tools or actions) — stay labeled demo-only even here, because
 * this switcher is the one place a human sees them and the label is what
 * distinguishes a preview from a claim. Wake is a transition state
 * (`loops: false`): after
 * the choreography completes, the Shell settles the Orb into idle breathing.
 */
export interface ShellProps {
  /** Show the dev-only state switcher. Defaults to the build-mode flag. */
  devStateSwitcher?: boolean;
}

/**
 * Orb states no real subsystem can drive, so the switcher names them as
 * previews rather than letting them read as status.
 *
 * Kept as data rather than an inline `state === 'aegisLockdown'` check: there
 * are two of them now, and the next one must be an obvious one-line addition
 * here rather than a condition someone forgets to widen.
 */
const DEMO_ONLY_ORB_STATES: ReadonlySet<OrbState> = new Set<OrbState>([
  'aegisLockdown',
  'executing',
]);

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
  /**
   * Whose orb this is (ADR 0013). Starts at DEFAULT_PROFILE — plain Jarvis in
   * Jarvis blue — so an unconfigured machine never claims to belong to anyone.
   */
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);

  // The preload bridge, read once. `window.jarvis` is stable after the preload
  // runs; it is `undefined` only in a plain-browser preview of the Vite page,
  // where the conversation composer disables itself and says so. Passing the
  // whole api is safe — it structurally satisfies the narrow ConversationBridge
  // (sendChat + amplify), and the extra getAppInfo is simply unused here.
  const bridge = useMemo<ConversationBridge | null>(() => window.jarvis ?? null, []);
  // DEV-ONLY renderer study (E2 renderer reset): when on, the V2 three.js
  // study renders instead of the legacy Orb, and the frame goes cinematic
  // (wordmark/footer move into the dev diagnostics drawer). Unreachable in
  // production builds — it lives behind the dev switcher flag.
  /**
   * The REAL AEGIS level (ADR 0025).
   *
   * CLAUDE.md §6 draws one exception to the "everything live-looking is mocked
   * and labeled" rule, and this is it: AEGIS status must reflect the enforced
   * engine. `null` means not-yet-read or no bridge — rendered as unknown, never
   * as GREEN, because a reassuring default is the single worst thing this
   * particular indicator could do.
   */
  const [aegis, setAegis] = useState<AegisStatus | null>(null);
  const [rendererV2, setRendererV2] = useState(false);

  /**
   * Ask AEGIS for a stricter level, and adopt whatever it says came back.
   *
   * The response carries the authoritative status, so the UI never computes the
   * new level itself — a refused request leaves the strip showing the level that
   * is genuinely active rather than the one that was clicked.
   */
  const requestAegis = useCallback(
    (level: AegisLevel, reason: string, confirmation?: string): void => {
      const bridge = window.jarvis;
      if (bridge === undefined) return;
      bridge
        .aegisRequestRestriction(level, reason, confirmation)
        .then((result) => {
          setAegis(result.status);
        })
        .catch((cause: unknown) => {
          console.error('[shell] aegis:request-restriction failed:', cause);
        });
    },
    [],
  );
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

    // Guarded: a bridge without this function is a browser preview or an older
    // preload, and the honest response is "unavailable" rather than taking the
    // whole shell down — or, worse, defaulting the indicator to GREEN.
    if (typeof bridge.aegisStatus !== 'function') {
      setAegis(null);
      return () => {
        cancelled = true;
      };
    }

    bridge
      .aegisStatus()
      .then((status) => {
        if (!cancelled) setAegis(status);
      })
      .catch((cause: unknown) => {
        // Leave it unknown rather than guessing. An indicator that shows GREEN
        // because the call failed is worse than one that admits it does not know.
        console.error('[shell] aegis:status failed across the IPC boundary:', cause);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Load whose orb this is. A failure is not worth surfacing in the
  // composition — the default profile is a correct, honest fallback (plain
  // Jarvis), so this logs and moves on rather than showing an error for a
  // cosmetic setting.
  useEffect(() => {
    let cancelled = false;
    const jarvis = window.jarvis;
    if (jarvis === undefined) return;

    jarvis
      .getProfile()
      .then((loaded) => {
        if (!cancelled) setProfile(loaded);
      })
      .catch((cause: unknown) => {
        console.error('[shell] profile:get failed; using the default profile:', cause);
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
        height: '100vh',
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
        // The wordmark is ALWAYS "Jarvis" — one assistant, answering to one
        // name for everyone (ADR 0013). What is personal is the badge beneath
        // it and the orb's accent. The probe asserts this h1, and the family
        // asked for exactly this: their orb, still called Jarvis.
        <div
          style={{
            marginTop: 22,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            zIndex: 1,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: fontFamily.display,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: letterSpacing.wordmark,
              textTransform: 'uppercase',
              color: text.heading,
            }}
          >
            Jarvis
          </h1>
          {profile.displayName !== DEFAULT_PROFILE.displayName && (
            <span
              data-profile-name={profile.displayName}
              style={{
                fontFamily: fontFamily.mono,
                fontSize: 9,
                letterSpacing: letterSpacing.label,
                textTransform: 'uppercase',
                color: profileAccentColor(profile.accent),
                border: `1px solid ${profileAccentColor(profile.accent)}`,
                borderRadius: 4,
                padding: '2px 8px',
              }}
            >
              {profile.displayName}
            </span>
          )}
        </div>
      )}

      {cinematic ? (
        // The dev-only V2 renderer study keeps the full-bleed cinematic stage.
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <OrbStudyV2
            state={orbState}
            studyPhase={studyPhase}
            sizePx={460}
            onRendererResolved={setActiveRenderer}
          />
        </div>
      ) : (
        // Stage 1A live surface: the Orb is a compact ambient presence that now
        // reflects REAL conversation state (thinking/speaking/reasoning), driven
        // by the Conversation below — not the dev switcher. The switcher remains
        // a dev-only manual override.
        <>
          <div style={{ marginTop: 6, marginBottom: 2, zIndex: 1 }}>
            <Orb
              state={orbState}
              sizePx={132}
              identityAccent={profileAccentColor(profile.accent)}
            />
          </div>
          <Conversation bridge={bridge} onOrbStateChange={setOrbState} />
        </>
      )}

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
                  {DEMO_ONLY_ORB_STATES.has(state) ? `${state} (demo-only)` : state}
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
        <ProfilePicker
          profile={profile}
          onChange={(next) => {
            // Optimistic: the orb recolours immediately, then main confirms
            // what was actually stored. On failure the stored value wins, so
            // the UI can never show a preference that was not saved.
            setProfile(next);
            window.jarvis
              ?.setProfile(next)
              .then(setProfile)
              .catch((cause: unknown) => {
                console.error('[shell] profile:set failed:', cause);
                window.jarvis
                  ?.getProfile()
                  .then(setProfile)
                  .catch(() => undefined);
              });
          }}
        />
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
            PHASE 1 FOUNDATION · NO APPLICATION FEATURES · AEGIS ENFORCES 1 OF 11 CAPABILITIES
            (SENDING) — THE OTHER TEN GOVERN THINGS THAT DO NOT EXIST YET
          </span>
          <AegisStrip status={aegis} onRequest={requestAegis} />
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

/**
 * Whose orb this is (ADR 0013).
 *
 * Appearance only. Choosing "Jayden" changes the name on the orb and its
 * accent — it grants nothing, unlocks nothing, and is not a login. Data
 * separation comes from each person having their own OS user account
 * (ADR 0012), which is why the copy says "this Mac account" rather than
 * anything resembling "sign in as".
 */
function ProfilePicker({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const accents = Object.keys(PROFILE_ACCENTS) as ProfileAccentId[];

  const label = (id: ProfileAccentId): string =>
    id === 'jarvis' ? 'Jarvis' : id.charAt(0).toUpperCase() + id.slice(1);

  return (
    <section
      aria-label="Orb appearance"
      style={{
        position: 'absolute',
        left: 14,
        bottom: 54,
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {open && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: 8,
            border: `1px solid ${surface.hairline}`,
            borderRadius: surface.radiusMin,
            background: 'rgba(5,7,10,0.88)',
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
            WHOSE ORB IS THIS? Appearance only — it is still Jarvis, and it grants nothing. Your
            sessions are separate because this is your Mac account.
          </span>
          {accents.map((id) => {
            const selected = profile.accent === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onChange({ displayName: label(id), accent: id });
                }}
                aria-pressed={selected}
                style={{
                  minHeight: 30,
                  padding: '5px 10px',
                  textAlign: 'left',
                  fontFamily: fontFamily.mono,
                  fontSize: 11,
                  letterSpacing: letterSpacing.label,
                  color: selected ? background.fieldTop : profileAccentColor(id),
                  background: selected ? profileAccentColor(id) : 'transparent',
                  border: `1px solid ${profileAccentColor(id)}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                {label(id)}
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
        }}
        style={{
          minHeight: 32,
          padding: '6px 10px',
          fontFamily: fontFamily.mono,
          fontSize: 10,
          letterSpacing: letterSpacing.label,
          color: profileAccentColor(profile.accent),
          background: 'rgba(5,7,10,0.7)',
          border: `1px solid ${surface.hairline}`,
          borderRadius: surface.radiusMin,
          cursor: 'pointer',
        }}
      >
        ORB · {profile.displayName.toUpperCase()} {open ? '▾' : '▸'}
      </button>
    </section>
  );
}

/**
 * The AEGIS status strip (ADR 0025).
 *
 * The ONE indicator in this app that must be backed by a real engine rather than
 * sample data (CLAUDE.md §6). Three rules shape how it renders:
 *
 *   1. **Unknown is shown as unknown.** A failed or pending `aegis:status` call
 *      renders "READING…" or "UNAVAILABLE" — never GREEN. A security indicator
 *      that defaults to reassuring is worse than none, because it is trusted.
 *   2. **A broken audit chain is shouted, not footnoted.** If the chain did not
 *      verify, the record of how the system reached this level cannot be
 *      trusted, and the strip says so in the danger colour.
 *   3. **It states that nothing enforces it yet.** The engine is real; no Jarvis
 *      capability currently asks it for permission, because none of the governed
 *      capabilities exists. Saying "AEGIS: GREEN" without that would imply
 *      protection that does not exist — the cardinal sin (CLAUDE.md §8 rule 1).
 */
function AegisStrip({
  status,
  onRequest,
}: {
  status: AegisStatus | null;
  onRequest: (level: AegisLevel, reason: string, confirmation?: string) => void;
}): JSX.Element {
  const [arming, setArming] = useState<AegisLevel | null>(null);
  const [typed, setTyped] = useState('');

  if (status === null) {
    return <span>AEGIS · READING…</span>;
  }

  // Straight from the design language: blue normal, amber restricted, red
  // isolated, and blackout as the collapsed locked core.
  const colour =
    status.level === 'GREEN'
      ? accent.success
      : status.level === 'YELLOW'
        ? accent.warning
        : accent.danger;

  const revoked = Object.values(status.capabilities).filter((allowed) => !allowed).length;
  const total = Object.values(status.capabilities).length;

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ color: colour }}>AEGIS · {status.level}</span>
      <span>
        {revoked === 0
          ? `all ${String(total)} capabilities permitted`
          : `${String(revoked)}/${String(total)} capabilities revoked`}
      </span>
      {!status.integrityVerified && (
        <span style={{ color: accent.danger }}>
          ⚠ AUDIT CHAIN FAILED VERIFICATION — HOLDING AT LEAST RED
        </span>
      )}

      {/*
        RAISE ONLY. Every control here increases severity, because that is the
        only direction this surface can express (ADR 0025). Lowering is on the
        native AEGIS menu — a surface main builds and main handles, which a
        compromised renderer cannot click.
      */}
      {status.level !== 'BLACK' && (
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {(['YELLOW', 'RED'] as const)
            .filter((level) => levelRank(level) > levelRank(status.level))
            .map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => {
                  onRequest(level, `Raised by a human to ${level}.`);
                }}
                style={aegisButton(level === 'YELLOW' ? accent.warning : accent.danger)}
              >
                {level === 'YELLOW' ? 'Restrict' : 'Isolate'}
              </button>
            ))}

          {arming === 'BLACK' ? (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <input
                autoFocus
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value);
                }}
                placeholder="type BLACKOUT"
                aria-label="Type BLACKOUT to confirm"
                style={{
                  background: 'transparent',
                  border: `1px solid ${accent.danger}`,
                  borderRadius: 6,
                  color: text.body,
                  fontFamily: fontFamily.mono,
                  fontSize: 10,
                  letterSpacing: letterSpacing.label,
                  padding: '3px 6px',
                  width: 120,
                }}
              />
              <button
                type="button"
                disabled={typed !== 'BLACKOUT'}
                onClick={() => {
                  onRequest('BLACK', 'Blackout entered by a human.', typed);
                  setArming(null);
                  setTyped('');
                }}
                style={aegisButton(typed === 'BLACKOUT' ? accent.danger : text.faint)}
              >
                Confirm blackout
              </button>
              <button
                type="button"
                onClick={() => {
                  setArming(null);
                  setTyped('');
                }}
                style={aegisButton(text.faint)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setArming('BLACK');
              }}
              style={aegisButton(accent.danger)}
            >
              Blackout…
            </button>
          )}
        </span>
      )}

      {status.level === 'BLACK' && (
        <span style={{ color: accent.danger }}>
          BLACKOUT — recovery is not available from this window (AEGIS menu)
        </span>
      )}
    </span>
  );
}

/** One small mono control, coloured by severity. */
function aegisButton(colour: string): CSSProperties {
  return {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: letterSpacing.label,
    color: colour,
    background: 'transparent',
    border: `1px solid ${colour}`,
    borderRadius: 6,
    padding: '3px 8px',
    cursor: 'pointer',
  };
}
