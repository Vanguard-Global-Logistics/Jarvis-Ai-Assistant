# Jarvis Orb Renderer V2 — Corrected Direction (E2)

**Status:** APPROVED DIRECTION FOR STUDY WORK (V2-M1). The V2 visual concept
itself is **NOT APPROVED** until William reviews the resulting frames. The
legacy renderer (`packages/ui/src/orb/`) remains the live E2 renderer and the
recoverable implementation.

**Authority order for visual truth (William's ruling, 2026-07-21):**

1. `reference/design/approved-motion/jarvis-approved-motion-benchmark-v1.mp4`
2. `reference/design/approved-motion/jarvis-approved-generation-prompt-v1.md`
   (complete original generation prompt, preserved verbatim)
3. `reference/design/approved-motion/extracted/` (frames)
4. `docs/design/JARVIS-MOTION-BENCHMARK.md` (written analysis)
5. Current implementation (no authority over direction)

Forensic facts (measured): 8.057 s, 193 frames, 24 fps, 1920×1080, one
continuous shot, zero scene cuts; luminance arc 17 → 79 (peak at the panel
constellation, 5.0–5.5 s) → 45 (hero). The prompt asked for 10 s / 4K-look;
the generator delivered 8.057 s / 1080p, and misspelled the surname
("LAVOLLT'S") — the prompt's spelling **LAVOLD** is correct and the video's
misspelling is never reproduced.

## Owner rulings recorded

- **Grid ruling (APPROVED, bounded):** a subtle architectural grid is
  authorized (it is in the original prompt) strictly as a distant
  environmental depth cue — restrained, low-contrast, partially visible,
  depth-separated, atmosphere-softened, occluded, illumination-responsive,
  secondary to the Orb, near-invisible in the darkest dormant moment,
  discovered gradually during awakening. Never: graph-paper background,
  cockpit, targeting, HUD, telemetry, prominent line lattices, or a
  substitute for real depth.
- **Identity ruling:** no conventional permanent page title. The `JARVIS`
  wordmark emerges subtly during awakening (per the prompt), may remain
  after stabilization only as a restrained spatial identity treatment, and
  must be stable, readable, temporally consistent.
- **Circular geometry rehabilitated:** the prompt explicitly requires a
  luminous central core, transparent rotating internal geometry, and
  concentric rings at different depths. Curved/concentric structures are
  permitted when each demonstrates at least two of: depth separation,
  partial occlusion, material response, independent purpose, state response,
  phased assembly, camera reveal, environmental interaction. Prohibited
  collapses: one sphere in one ring; iris+pupil; circular progress
  indicator; complete orbital ellipses; atom diagram; identical synchronized
  rotation; static logo on a dark page.

## Why the legacy renderer failed (against the prompt's own tests)

Flat complete outlines at one depth; synchronized rotation (the prompt
demands per-layer directions/speeds/purposes); no staged assembly ("rings
materialize one layer at a time"); no camera ("true camera depth, layered
parallax"); no environment ("deep spatial layers, fog, reflections"); no
physical presence; identity as a floating page heading instead of
typography "integrated into the scene." The circles were never the failure —
the missing depth, occlusion, staging, materials, camera, and environment
were.

## Phase split

- **E2 (Orb + ambient Shell):** dormant, awakening assembly, breathing idle,
  listening (perimeter gather + circular reactive waveform + 10–15° orbital
  camera), reasoning (neural pathways flare→evaluate→collapse), speaking
  (measured outward emission), warning/critical strain, offline drain,
  aegisLockdown visual demo (labeled; AEGIS NOT IMPLEMENTED); environment =
  fog, falloff, floor reflection, bounded grid; camera = close start, push,
  settle, subtle orbit; integrated identity timing; reduced-motion composed
  static; dev inspector outside the composition showing the ACTIVE renderer.
- **E3:** transcript line, spatial BCI panels with the prompt's readable
  mock content (existing `mission-control.ts` contracts), dependency lines,
  risk-depth sorting.
- **E4:** command transformation; six-system universe (FORGE, LEDGER, AEGIS,
  VANGUARD PERFORMANCE LABS, PEPTASTIC, SOPHISTICATED SIPS) with distinct
  motion signatures; streams; synchronized pulse; hero lockup + tagline +
  closing line — demo-only, mocked, labeled.
- **LATER:** sound design; anything operational.
- **REFERENCE-ONLY:** 4K film finish, audio bed, the misspelling (never).

AEGIS color semantics from the prompt (normal green · caution amber ·
critical deep red · blackout = visual silence, protected core only) are
consistent with the existing accent tokens and the aegisLockdown collapse —
adopted as the state-color confirmation. All AEGIS presentations remain
demo-only visuals until AEGIS exists.

## V2 scene graph (target)

`Scene(FogExp2 #05070a)` → `CameraRig` (close dormant discovery → slow push
→ settle at ¾ home; listening +10–15° orbit; reasoning slight push; no
shaking/zooming) → `Environment` [far architectural grid planes (bounded per
ruling, opacity chases awakening), rear gradient, floor reflection,
environmental light chasing core energy] → `RearDust` (seeded 3D motes) →
`OuterRingRaces` (independent rates/directions) → `IntelligenceCore`
[graphite occluding body + off-center emissive cluster + partial inner
shell] → `InternalGeometry` (nested races, opposing rotations, distinct
purposes) → `LuminousTorus` (double-edged, tilted, set into the assembly) →
`WaveformRing` (circular reactive waveform — listening/speaking) →
`Filaments/NeuralPathways` → `ForeDust` → `ForegroundHaze`. State input:
`orbVisualConfig` (unchanged contract); energy propagates core → membranes →
filaments → particles → environment with lag and inertia; deterministic
seed 20260717; ≤700 particles; ≤12 draw groups; no postprocessing; pixel
ratio ≤2; fallback = legacy renderer, honestly labeled, never silent.

## V2-M1 acceptance criteria (rapid failure test)

Fails if a first-glance read is: legacy Orb, eye, pupil, atom, planet,
gyroscope, loading spinner, glowing logo. Must show: ≥5 depth bands (far
environment / rear particles+geometry / central construction / front
filaments+containment / foreground haze), staged-assembly viability, no two
rings at identical speed+direction, front/rear occlusion, environmental
response, per-state structural (not only color) differences, integrated
identity, measured performance, composed reduced-motion state.
