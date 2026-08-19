import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { CSSProperties } from 'react';
import type {
  AegisLevel,
  AegisStatus,
  AppInfo,
  Memory,
  MemorySensitivity,
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
import { MemoryPanel } from './MemoryPanel.js';
import { ForgePanel } from './ForgePanel.js';
import { bridgeMember } from './bridge.js';

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

// `JarvisBridge` and `bridgeMember` live in `./bridge.js` — shared with
// `ForgePanel`, which needs the identical guard. See that module for why the
// guard exists, what it defends against at each call-site shape, and why it
// must be applied to every bridge access without exception.

export function Shell({ devStateSwitcher = import.meta.env.DEV }: ShellProps): JSX.Element {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [host, setHost] = useState<HostFacts>({ kind: 'loading' });
  const [switcherOpen, setSwitcherOpen] = useState(false);
  /**
   * Whose orb this is (ADR 0013). Starts at DEFAULT_PROFILE — plain Jarvis in
   * Jarvis blue — so an unconfigured machine never claims to belong to anyone.
   */
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);

  /**
   * The bridge handed to `Conversation`, ASSEMBLED from checked members.
   *
   * It used to be `window.jarvis ?? null` — the raw object, cast to the narrow
   * `ConversationBridge`, with only a `=== null` check. That made
   * `bridgeMember`'s claim to cover "every bridge access in this file" false:
   * eleven members went out unchecked, and `Conversation` then re-implemented
   * the same degradation rule inline for exactly one of them
   * (`typeof bridge.describeModels !== 'function'`), in a second file, in a
   * second shape. One rule, two spellings, nine uncovered members.
   *
   * Building it member by member means an incomplete preload yields `null` —
   * which `Conversation` already handles by disabling the composer and saying
   * so — rather than a bridge that looks whole and throws on the first call.
   */
  const bridge = useMemo<ConversationBridge | null>(() => {
    const members = {
      sendChat: bridgeMember('sendChat'),
      amplify: bridgeMember('amplify'),
      planAutomation: bridgeMember('planAutomation'),
      saveConversation: bridgeMember('saveConversation'),
      listConversations: bridgeMember('listConversations'),
      getConversation: bridgeMember('getConversation'),
      deleteConversation: bridgeMember('deleteConversation'),
      exportHistory: bridgeMember('exportHistory'),
      importHistory: bridgeMember('importHistory'),
      describeModels: bridgeMember('describeModels'),
      selectModel: bridgeMember('selectModel'),
    };
    return Object.values(members).every((member) => member !== null)
      ? (members as ConversationBridge)
      : null;
  }, []);
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
   * What Jarvis durably knows (ADR 0029).
   *
   * Held here rather than inside `MemoryPanel` so that adding or forgetting a
   * fact re-reads the store, and the list on screen is always what main
   * actually holds — never an optimistic local guess. Memory is replayed into
   * every future prompt, so a UI that showed a memory the store did not have
   * (or hid one it did) would be lying about what Jarvis will say next.
   */
  const [memories, setMemories] = useState<readonly Memory[]>([]);
  const [memoryOpen, setMemoryOpen] = useState(false);

  /**
   * Forge v1 (`docs/architecture/forge-architecture.md`) — the five-fact
   * build/dev watchtower. Unlike Memory, `ForgePanel` owns its own IPC reads
   * and writes: Forge's contents are not replayed into a prompt, so there is
   * no correctness reason for Shell to hold the list, only a toggle for
   * whether the panel is open.
   */
  const [forgeOpen, setForgeOpen] = useState(false);

  /**
   * Set when `memory:list` could not be read.
   *
   * Without this, a failed read left `memories` at its previous value and said
   * nothing — so the panel showed a store state that was not the store's, on the
   * one surface constitution §8 requires to be truthful about what is stored.
   * The failure mode is worse than a stale list looks: a fact stored a moment
   * ago is already being read into every prompt by `withRecall`, so an invisible
   * memory is a memory that is live and cannot be deleted.
   *
   * Same rule as the AEGIS strip four fields up — a surface that cannot read its
   * source says so, rather than rendering the last reassuring thing it saw.
   */
  const [memoryError, setMemoryError] = useState<string | null>(null);
  /** Sequence token for `refreshMemories` — see the comment there. */
  const memoryReadSeq = useRef(0);

  /**
   * Re-read the store. Returns the promise — it is not fire-and-forget.
   *
   * `void` was the wrong return type and it produced a lie: `forgetFact` called
   * this, did not await it, and then told the person "the list has been
   * refreshed" at an instant when the read had provably not settled and might
   * never settle. A message that describes a state transition must be written
   * after that transition has been awaited.
   */
  const refreshMemories = useCallback(async (): Promise<boolean> => {
    // A monotonic token, for the same reason the host/AEGIS effect four fields
    // up carries a `cancelled` flag: an async result must prove it is still the
    // current one before it writes state. Without it, the mount read still in
    // flight during a cold SQLite open can resolve AFTER an add's read and
    // overwrite the list with the pre-insert version — the just-stored fact
    // disappears from the panel while `withRecall` keeps feeding it to every
    // prompt. Invisible and undeletable is the §8 violation this whole surface
    // exists to prevent. Returning `Promise<void>` made ONE caller ordered; it
    // did nothing about concurrent ones.
    const mine = (memoryReadSeq.current += 1);
    const isCurrent = (): boolean => mine === memoryReadSeq.current;

    const listMemories = bridgeMember('listMemories');
    if (listMemories === null) {
      // A DIFFERENT message from the read-failure below, deliberately. "The
      // store could not be read" and "this build has no memory channel" are
      // different facts about the world and lead to different actions — one is
      // a database problem, the other is a stale preload that needs the app
      // reinstalled. Distinct text is also what makes this branch falsifiable:
      // delete the `typeof bridge[key] === 'function'` check in `bridgeMember` and the call below throws
      // into the `catch`, producing the other message, and the test that names
      // this one goes red.
      //
      // `window.jarvis === undefined` (a plain-browser preview) reaches here
      // too, and says the same true thing.
      if (isCurrent()) {
        setMemoryError('Memory is unavailable in this build — the preload does not provide it.');
      }
      return false;
    }
    try {
      const listed = await listMemories();
      if (!isCurrent()) return true;
      setMemories(listed);
      setMemoryError(null);
      return true;
    } catch (cause: unknown) {
      console.error('[shell] memory:list failed:', cause);
      if (isCurrent()) {
        setMemoryError('Jarvis could not read what it knows. The list below may be out of date.');
      }
      return false;
    }
  }, []);

  useEffect(() => {
    void refreshMemories();
  }, [refreshMemories]);

  /**
   * Store a fact, then re-read.
   *
   * Deliberately does NOT catch: `MemoryPanel` awaits this and renders the
   * refusal message itself. Swallowing the rejection here would leave a panel
   * that looked like it had saved a credential it actually refused — the exact
   * "no UI control that looks functional but does nothing" failure CLAUDE.md §8
   * rule 1 forbids.
   */
  const rememberFact = useCallback(
    async (fact: string, sensitivity: MemorySensitivity): Promise<void> => {
      const remember = bridgeMember('remember');
      if (remember === null) throw new Error('No Jarvis bridge in this context.');
      await remember({ fact, sensitivity });
      await refreshMemories();
    },
    [refreshMemories],
  );

  const forgetFact = useCallback(
    async (id: string): Promise<void> => {
      const forget = bridgeMember('forget');
      if (forget === null) throw new Error('No Jarvis bridge in this context.');
      // The `{ forgotten }` flag exists so that "deleted" in the UI always
      // corresponds to a deletion that happened — and it was being discarded,
      // which made `false` and `true` look identical to a person. Now a delete
      // that matched nothing says so, through the panel's own alert.
      const { forgotten } = await forget(id);
      // AWAITED, and the RESULT is read. Awaiting alone was not enough: the
      // first version awaited a function deliberately made non-throwing, so the
      // sentence "the list has been refreshed" was still assertable while the
      // read had failed and the panel was simultaneously showing "could not read
      // what it knows". Only the read SUCCEEDING makes that claim true, so the
      // message branches on it. Claiming work that did not happen is the same
      // defect class as discarding `forgotten` in the first place.
      const refreshed = await refreshMemories();
      if (!forgotten) {
        throw new Error(
          refreshed
            ? 'That memory was already gone — the list has been refreshed.'
            : 'That memory was already gone, and the list could not be re-read.',
        );
      }
    },
    [refreshMemories],
  );

  /**
   * Ask AEGIS for a stricter level, and adopt whatever it says came back.
   *
   * The response carries the authoritative status, so the UI never computes the
   * new level itself — a refused request leaves the strip showing the level that
   * is genuinely active rather than the one that was clicked.
   */
  const requestAegis = useCallback(
    (level: AegisLevel, reason: string, confirmation?: string): void => {
      const requestRestriction = bridgeMember('aegisRequestRestriction');
      if (requestRestriction === null) return;
      requestRestriction(level, reason, confirmation)
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

    const getAppInfo = bridgeMember('getAppInfo');
    if (getAppInfo === null) {
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

    getAppInfo()
      .then((result) => {
        if (!cancelled) setHost({ kind: 'real', info: result });
      })
      .catch((cause: unknown) => {
        // A present-but-failing bridge is a real defect: keep it visible
        // (compactly) and put the detail where a developer will read it.
        console.error('[shell] app:get-info failed across the IPC boundary:', cause);
        if (!cancelled) setHost({ kind: 'bridgeError' });
      });

    // Guarded through the SAME helper the memory effect uses, so there is one
    // answer in this file rather than two. A bridge without this function is a
    // browser preview or an older preload, and the honest response is
    // "unavailable" rather than taking the whole shell down — or, worse,
    // defaulting the indicator to GREEN.
    const aegisStatus = bridgeMember('aegisStatus');
    if (aegisStatus === null) {
      setAegis(null);
      return () => {
        cancelled = true;
      };
    }

    aegisStatus()
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
    const getProfile = bridgeMember('getProfile');
    if (getProfile === null) return;

    getProfile()
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
            bridgeMember('setProfile')?.(next)
              .then(setProfile)
              .catch((cause: unknown) => {
                console.error('[shell] profile:set failed:', cause);
                bridgeMember('getProfile')?.()
                  .then(setProfile)
                  .catch(() => undefined);
              });
          }}
        />
      )}

      {!cinematic && (
        <section
          aria-label="Memory"
          style={{
            position: 'absolute',
            right: 14,
            bottom: 54,
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            alignItems: 'flex-end',
          }}
        >
          {memoryOpen && (
            <div
              style={{
                maxHeight: '60vh',
                overflowY: 'auto',
                padding: 10,
                border: `1px solid ${surface.hairline}`,
                borderRadius: surface.radiusMin,
                background: 'rgba(5,7,10,0.92)',
              }}
            >
              <MemoryPanel
                memories={memories}
                listError={memoryError}
                onRemember={rememberFact}
                onForget={forgetFact}
              />
            </div>
          )}
          <button
            type="button"
            aria-expanded={memoryOpen}
            title={memoryError ?? undefined}
            onClick={() => {
              setMemoryOpen((value) => !value);
            }}
            style={{
              minHeight: 30,
              padding: '5px 10px',
              fontFamily: fontFamily.mono,
              fontSize: 10,
              letterSpacing: letterSpacing.label,
              color: text.faint,
              background: 'transparent',
              border: `1px solid ${surface.hairline}`,
              borderRadius: surface.radiusMin,
              cursor: 'pointer',
            }}
          >
            {/* `—`, never `0`, when the store could not be read. This chip is
                the DEFAULT surface — the panel is collapsed until someone opens
                it — so `MEMORY · 0` from an unread store is the same lie the
                panel's own alert exists to refuse, published more prominently.
                Both of the first tests for that alert opened the panel before
                asserting anything, so neither could ever see this. */}
            MEMORY · {memoryError !== null ? '—' : memories.length} {memoryOpen ? '▾' : '▸'}
          </button>
        </section>
      )}

      {!cinematic && (
        <section
          aria-label="Forge"
          style={{
            position: 'absolute',
            right: 14,
            bottom: 96,
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            alignItems: 'flex-end',
          }}
        >
          {forgeOpen && (
            <div
              style={{
                maxHeight: '60vh',
                overflowY: 'auto',
                padding: 10,
                border: `1px solid ${surface.hairline}`,
                borderRadius: surface.radiusMin,
                background: 'rgba(5,7,10,0.92)',
              }}
            >
              <ForgePanel />
            </div>
          )}
          <button
            type="button"
            aria-expanded={forgeOpen}
            onClick={() => {
              setForgeOpen((value) => !value);
            }}
            style={{
              minHeight: 30,
              padding: '5px 10px',
              fontFamily: fontFamily.mono,
              fontSize: 10,
              letterSpacing: letterSpacing.label,
              color: text.faint,
              background: 'transparent',
              border: `1px solid ${surface.hairline}`,
              borderRadius: surface.radiusMin,
              cursor: 'pointer',
            }}
          >
            FORGE {forgeOpen ? '▾' : '▸'}
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
