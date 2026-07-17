# Jarvis Motion Benchmark — Analysis of the Approved Reference

**Status of this document:** APPROVED REFERENCE ANALYSIS. The video it describes is the
authoritative visual, motion, and emotional benchmark for the E2 experience work
(William's 2026-07-17 instruction). This document records what the benchmark contains,
what must be preserved, what must not be copied, and how each cinematic moment maps to
real application state. It does not authorize implementation — E2 requires its own
approval.

---

## 1. Provenance and preservation

| Fact             | Value                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path             | `reference/design/approved-motion/jarvis-approved-motion-benchmark-v1.mp4`                                                                                                    |
| SHA-256          | `d73229d9c0bf090feeeeba21daf53d7bfee2a1a7d8198705289ebc6ddfb4f039`                                                                                                            |
| Size             | 25,470,385 bytes (~24.3 MB)                                                                                                                                                   |
| Duration         | 8.057 s — 193 frames                                                                                                                                                          |
| Resolution / fps | 1920 × 1080 · 24 fps                                                                                                                                                          |
| Video codec      | H.264 High, yuv420p, ~25.3 Mbps                                                                                                                                               |
| Audio            | AAC-LC stereo 44.1 kHz ~130 kbps — real content (peak −1.5 dB, RMS −13.1 dB); not transcribed (no local speech-to-text); both spoken lines also appear as burned-in subtitles |

Preservation rules (binding):

- The original MP4 is preserved **unchanged** — never recompress, edit, rename,
  replace, or delete it. The SHA-256 above is the integrity reference.
- The MP4 is a **reference, not an asset**: it must never ship inside the application,
  never play as a looping background, and never substitute for functional UI.
- Upload note (2026-07-17): the file first landed in
  `reference/design-handoff/design/approved-motion/` — inside the immutable archived
  handoff. It was relocated byte-identically (checksums equal before/after) to the
  intended `reference/design/approved-motion/`; the archive directory is untouched.

Extracted references live in `reference/design/approved-motion/extracted/` (~2.5 MB):
one 24-frame contact sheet and ten full-resolution scene frames named
`scene-01…scene-10`. Frame numbers below index the 193 source frames from 0.

## 2. Scene-by-scene analysis

The ten briefed moments all occur, compressed into one continuous 8-second shot with no
cuts — the camera and the Orb do all the work. Subtitles carry the two lines.

| #   | Time (s) | Frame   | Extracted ref          | What happens                                                                                                                                                                                                                                                                                                                           |
| --- | -------- | ------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0.0–0.7  | 0–16    | `scene-01`             | **Dormant spark.** A single small white-blue point of light in a near-black void; a faint elliptical vignette hints at a space, not a flat screen. Nothing else exists.                                                                                                                                                                |
| 2   | 0.7–1.6  | 17–38   | `scene-02`             | **Awakening.** The spark blooms: a fine particle cloud erupts symmetrically, a horizontal anamorphic-style light streak crosses the frame, and the first thin ring becomes visible inside the glow — machinery being born from light.                                                                                                  |
| 3   | 1.6–2.6  | 39–62   | `scene-03`             | **Orb assembly.** The full Orb resolves at center: a bright inner luminous ring around a dark mechanical core, wrapped in translucent engineered shells with hardware-like lugs. The `JARVIS — PERSONAL AI OPERATING SYSTEM` wordmark locks over it. The environment reveals a dark graphite grid hall with faint columns of dim data. |
| 4   | 2.6–3.6  | 63–86   | `scene-04`             | **Energy radiation.** Concentric cyan energy rings expand outward from the Orb through the room; thin bright beam lines shoot radially past the camera. The room responds to the Orb — the Orb does not decorate the room.                                                                                                             |
| 5   | 3.6–4.6  | 87–110  | `scene-05`             | **Listening / reasoning.** The camera orbits to a three-quarter view, revealing true dimensional depth: the rings are gimbaled shells around a dense internal mechanism. Subtitle: **“Jarvis, prepare me for work.”** The Orb visibly _is_ something that thinks, not a flat icon.                                                     |
| 6   | 4.6–5.4  | 111–130 | `scene-06`             | **BCI Project Command reveal.** Glass panels emerge organically from the Orb's space — a large `BCI PROJECT COMMAND` board (charts, task rows, bar graphs) plus companion panels; a `FORGE` panel and an `AEGIS` panel are legible among them. Beam lines physically connect each panel back to the Orb.                               |
| 7   | 5.4–6.6  | 131–158 | `scene-07`             | **Spatial panels and dependencies.** The workspace settles into a constellation around the Orb at different depths; connection lines express which surface depends on which. Subtitle appears: **“Good morning, William. I prepared everything.”**                                                                                     |
| 8   | 6.6–7.5  | 159–180 | `scene-08`             | **Connected agents and business universe.** The camera pulls back hard: the Orb becomes the nucleus of a much larger space in which satellite spheres — distinct green/blue/white orb-nodes with their own internal ring structures — link by beams to the panel constellation. The dimmed wordmark and tagline hang overhead.         |
| 9   | 7.5–8.06 | 181–192 | `scene-09`, `scene-10` | **Final hero composition.** Crisp lockup: `JARVIS` / `WILLIAM LAVOLLT'S AI OPERATING SYSTEM` _(misspelling — see defects)_ / **`PROTECT. BUILD. MULTIPLY. FREE.`** over the full universe, subtitle line held. Calm, total, prepared.                                                                                                  |

(The briefed items "layered internal geometry" and "listening or reasoning state" are
both carried by moment 5; "spatial panels" and the second subtitle line by moment 7.)

## 3. Approved emotional qualities

- **Dormant intelligence spark** — Jarvis exists before the interface does; the system
  is an intelligence that _wakes_, not an app that _loads_.
- **Cinematic awakening** — power arriving gradually and inevitably; no pop, no bounce.
- **Calm authority** — nothing is hurried; every motion reads as intentional. The film
  earns awe through depth and restraint, not through effect density.
- **“It was already done”** — the emotional standard of the final line: _“Good morning,
  William. I prepared everything.”_ The experience must feel like walking into a room
  where the work is finished, not watching work happen.
- **One intelligence, many limbs** — panels, agents, and businesses all visibly hang
  off the single center. Nothing exists unattached.

## 4. Orb construction and visual layers

From innermost to outermost (visible in `scene-03`, `scene-05`, `scene-06`):

1. **Core** — a dark, dense mechanical heart; barely lit, mostly occluded. The
   brightness lives _around_ it, not in it.
2. **Inner luminous ring** — the brightest element in every shot: a thick soft-white
   ring (slightly warm-white against the cyan world) with a subtle double edge. This is
   the Orb's "eye" and survives every camera angle.
3. **Mechanical ring assembly** — toothed/segmented rings resembling precision bearing
   races immediately around the luminous ring; they carry the "engineered" credibility.
4. **Glass gimbal shells** — two to three translucent spherical shells with visible
   thickness, refraction highlights, and hardware lugs/clamps at their poles and
   equators; they rotate independently and give the three-quarter views their depth.
5. **Outer thin rings** — larger, fainter orbital rings that extend the silhouette and
   catch beam light.
6. **Particle and energy field** — fine particles and expanding energy rings that live
   _outside_ the shells, mediating between Orb and room.
7. **Environment** — the graphite hall (§6).

## 5. Materials and lighting

- **Materials:** clear glass with real refraction and edge highlights; brushed
  dark metal (graphite, near-black) for cores and hardware; emissive white-cyan for
  rings and beams. No plastic, no flat fills, no gradients-as-materials.
- **Lighting:** the Orb is the only light source that matters — the room is lit _by_
  it (radial falloff on the grid floor/walls). Specular highlights on glass move with
  the camera; blooms are soft and wide, never clipping to hard white except at the
  spark and beam cores.
- **Contrast discipline:** deep blacks are allowed to stay black; mids are rare. The
  image is mostly very dark or luminous, with glass edges carrying the in-between.

## 6. Particle behavior

- Awakening: particles erupt from the spark in a spherically symmetric bloom and then
  drift with slow damping — no gravity, no turbulence, no confetti.
- Steady state: a sparse halo of near-static dust motes at varying depths around the
  Orb (parallax carriers); occasional slow drifting motes in the room.
- Energy rings: expanding circular wavefronts, thin, decaying in opacity with radius.
- Beam lines: straight or gently curved rays with bright cores and long soft falloff,
  always radiating from (or converging to) the Orb or its satellites.

## 7. Camera movement

One continuous move across 8 s: static hold on the spark → slow push-in through the
awakening → settle for the wordmark lockup → lateral orbit to the three-quarter
view → gentle drift while panels assemble → decisive pull-back and slight rise to the
universe wide → hold for the hero lockup. No cuts, no shakes, no whip-pans, no zooms
for emphasis. **Application translation:** camera moves become staged scene
transitions (scale/parallax/opacity choreography), never a free camera.

## 8. Dimensional depth

Depth is expressed through: gimbal shells occluding each other; panels placed at
distinct z-depths with size/blur differences; particles at multiple parallax planes;
beam lines passing _behind_ and _in front of_ the Orb; the grid environment receding
to darkness. The composition is legible as a _place_, while remaining monitor-friendly
(single vanishing region, center-weighted).

## 9. Panel emergence

Panels do not slide in from screen edges and do not pop: they **materialize in place**
near the Orb — appearing as faint glass sheets that gain opacity, structure, and then
content, connected by a beam line to the Orb from the first visible moment. Each panel
has: a title bar with a cyan accent strip, a dark translucent body, and content in
white/cyan. Panels tilt slightly toward the camera plane (billboarded, not flat).

## 10. BCI Project Command presentation

The `BCI PROJECT COMMAND` board is the largest and first-resolved panel (moment 6) —
the demo's proof that Jarvis runs William's real work. It reads as: header, a project
status area with line/area charts, task rows with small status glyphs, and a bar-chart
column. Companion panels (`FORGE`, `AEGIS`, additional command boards) join it at
lower visual priority. **The hierarchy — BCI Command first among equals, all tethered
to the Orb — is the approved presentation.** (All chart/text content in the video is
generated filler; only the structure is reference.)

## 11. Agents and business universe presentation

In the pull-back (moment 8), four-plus satellite spheres surround the center at the
corners of the space — each with its own color identity (mint/teal brain-like form,
deep-blue ring system, white-ring node, teal energy sphere) and its own internal
structure, each tethered by beams to the central constellation. This is the approved
visual grammar for **agents and ventures**: same family as the Jarvis Orb (spherical,
ringed, luminous) but smaller, dimmer, and visually subordinate. The center never
competes for primacy.

## 12. Color language

- **Field:** graphite black to near-black blue (`#04070b`–`#0a1018` range in sampled
  frames) — consistent with the approved token `background.fieldTop #05070a`.
- **Structure:** desaturated steel blues and glass whites for machinery and panels.
- **Energy:** restrained cyan for beams/rings (video sits near `#7fe3ff`–`#a5eaff` at
  beam cores; halos fall toward the approved `accent.jarvisBlue #5ad1ff` family).
- **Signal colors:** the satellite nodes introduce mint/teal and deep blue as agent
  identities. Success-green/amber/red state colors do not appear — states in the video
  are carried by motion, not hue. The application keeps its approved state palette.
- **Whites:** two whites exist — warm-white for the Orb's luminous ring, cool-white
  for text. Preserve that separation; it is why the Orb feels alive against the UI.

## 13. Typography behavior

- Wordmark: extended-width geometric caps with generous letter-spacing (the role the
  approved `Space Grotesk` display + `letterSpacing.wordmark` tokens fill), locked to
  center, appearing only at anchor moments (assembly, hero) and dimming when content
  needs primacy (moment 8 shows it faint above the universe).
- Tagline `PROTECT. BUILD. MULTIPLY. FREE.` — same caps voice, wide tracking, high
  contrast, period-separated cadence.
- Subtitles: clean humanist sans, sentence case, bottom-centered — the conversational
  voice (application equivalent: Inter body text).
- Panel titles: small caps with cyan accent underline strip (application equivalent:
  IBM Plex Mono labels + `letterSpacing.sectionLabel`).
- Panel body text in the video is **generated pseudo-text** — unreadable by design of
  the generator, readable-at-arm's-length in the real product (see §15/§16).

## 14. Signature hero moment

Frame ~184 (`scene-09`): the full universe — center Orb, tethered panel
constellation, four satellite spheres — under the crisp lockup `JARVIS / WILLIAM
LAVOLLT'S* AI OPERATING SYSTEM / PROTECT. BUILD. MULTIPLY. FREE.` with the line
_“Good morning, William. I prepared everything.”_ This is the emotional target the
Daily Companion must hit at first open: everything connected, everything calm,
everything already prepared. (*Name misspelled in the video — never reproduce.)

## 15. Qualities that must be preserved vs defects that must not be copied

**Preserve:**

- The dormant→awake arc; the Orb as the only true light source; engineered
  glass-and-metal materiality; one continuous choreography (no cuts/pops); panels
  tethered visibly to the intelligence that made them; the subordinate satellite
  grammar for agents/ventures; the restrained graphite/black/white/blue/cyan palette;
  the two-whites rule; calm authority throughout; the "already prepared" ending.

**Do not copy (generated-video defects):**

- Garbled text everywhere except the wordmark/tagline/subtitles: `BCCT COMMAND`,
  `SROURS CFANT`, `CGSRRR.DERTT`, pseudo-words in every panel body. Real surfaces
  must show real, readable, truthful text only.
- **`WILLIAM LAVOLLT'S`** — William's surname is **Lavold**. Never reproduce the
  misspelling.
- Unstable geometry: ring/lug hardware subtly morphs between frames; panel frames
  warp; chart shapes are non-physical. Real geometry must be stable and consistent.
- Accidental artifacts: duplicated flare streaks, particle clumps, asymmetric ring
  breakups, compression shimmer in dark gradients.
- Generic sci-fi HUD conventions where they exceed purpose: the busy background data
  columns and grid ticks are atmosphere in a film but noise in a tool — the
  application keeps ambient detail at or below the video's _darkest_ ambient level.
- Any Marvel/Iron Man-identifiable element (arc-reactor iconography as such, HUD
  layouts, character references). The benchmark's language — engineered rings, glass
  gimbals, graphite room — is original and sufficient.

## 16. Readability improvements required for the real application

- All text real and legible: minimum body sizes per platform, real project/venture
  names, truthful statuses — every metric labeled `MOCKED` until real (CLAUDE.md §6).
- Panel contrast raised: video panels are ~40–60 % opacity glass over dark; the
  application needs AA contrast for text layers (opaque text plates over glass, or
  higher-opacity body surfaces).
- Beam/connection lines thinned and dimmed behind content surfaces; never through
  text.
- The ambient data columns become optional decoration at very low opacity or are
  omitted; they must never read as information.
- Charts become real (deterministic mock data through typed contracts), with axes
  and labels at readable sizes — not texture.

## 17. Accessibility equivalents

- Every state change announced via the existing `aria-live` StateAnnouncer plan
  (plan §4): wake, listening, thinking, panel arrival, demo start/end.
- All meaning carried by motion also exists as text/state (state label near the Orb;
  panel titles; connection expressed by grouping/order, not only by beams).
- Full keyboard traversal of every surface; focus rings visible against glass;
  touch/click targets ≥ 44 px; subtitles pattern for any spoken/demo narration —
  matching the video's own subtitle convention.
- Contrast: AA minimum for all text over glass panels (see §16).

## 18. Reduced-motion equivalents

Per the approved motion tokens (`prefers-reduced-motion` swaps the entire language):

- Awakening sequence → a single opacity cross-fade from dark field to composed
  scene; no particle bloom, no expanding rings, no camera-analog transitions.
- Orb states → static color/intensity presentations from `orbStateMotion[*].reducedMotion`
  (already defined for all eleven states in `packages/ui/src/tokens/motion.ts`).
- Panel emergence → instant-place with a ≤ `duration.instantMs` fade; no rise, no
  scale.
- Particle field → static gradient halo (plan §4 rule); beams → static hairlines.
- The universe view renders fully composed; depth is conveyed by size/blur, which are
  static properties, so nothing is lost.

## 19. Performance risks

- **Glass stack cost:** layered translucency + blur is the main GPU risk (Electron
  compositing). Budget the shells/panels to a fixed small number of blur surfaces;
  prefer pre-blurred textures/gradients over live `backdrop-filter` where possible.
- **Particle count:** the video implies thousands; the application needs hundreds at
  most on desktop, fewer on low-power targets, zero under reduced motion.
- **Continuous animation:** only the Orb and ambient light may loop (approved
  choreography rule). Everything else animates only on state change — this is also
  the battery/thermal guard.
- **1080p+ canvas redraws:** the Canvas 2D field must dirty-rect or cap at Orb
  bounds; full-screen per-frame redraw at 60 fps will not hold on the watch/phone
  targets and is wasteful on desktop.
- **Beam lines through the scene graph:** cheap as SVG/canvas strokes, expensive as
  filtered/glowing DOM elements; render glows as gradients, not shadow filters.

## 20. Responsive implications

- **Desktop (E2 target):** the full grammar — dimensional Orb, tethered panels,
  pull-back universe — at the video's composition scale.
- **Browser (Stage 2):** identical scene components (`packages/ui` re-hosted); the
  glass/blur budget may need a step down; no Electron-only APIs in any scene code
  (already enforced by the `packages/ui` ESLint boundary).
- **Phone:** one panel of the constellation at a time; the Orb docks to a smaller
  anchor position; connection grammar becomes sequential navigation with the beam
  motif as accent, not layout. Safe-area insets per the approved visual target.
- **Watch:** the Orb alone _is_ the interface (the approved orb-first summon path);
  states via color/intensity; no panels, no particles, reduced-motion language by
  default.
- **Vehicle (Drive Mode, future):** state colors and the luminous ring only; zero
  ornamentation; the §15 restraint rules become absolute.

## 21. Mapping cinematic moments → real application state

| Video moment                                         | Application state (existing contracts)                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dormant spark                                        | `OrbState 'idle'` at app start before wake — minimal presence, ambient only                                                                                   |
| Awakening bloom                                      | `OrbState 'wake'` — "single bloom + ring expansion" (token grammar already matches)                                                                           |
| Assembly + wordmark                                  | First-run / return-home composition of the Shell (E2), wordmark at anchor moments only                                                                        |
| Energy radiation                                     | Transition accent on wake completion / scene entry — one-shot, never looping                                                                                  |
| Three-quarter orbit + “Jarvis, prepare me for work.” | `OrbState 'listening'` (command received) → `'thinking'`/`'reasoning'` while preparing                                                                        |
| BCI Project Command reveal                           | `DemoPanel kind 'projects'`/`'risks'`/`'meetingBrief'`… rendering inside the "Prepare Me For Work" `DemoScript` (E3) — panels tethered to the Orb             |
| Spatial constellation + “I prepared everything.”     | `OrbState 'speaking'` → `'success'` as the prepared workspace settles; Daily Companion home state                                                             |
| Connected universe                                   | Ventures/agents surface: `VentureSchema` nodes (BCI, VPL, Peptastic, Sophisticated Sips — names only) as satellite spheres, `'idle'` grammar at reduced scale |
| Hero lockup                                          | Demo end-state / marketing composition — in-app only inside labeled demos (`mockDisclosure` watermark visible)                                                |

Every mapped surface runs on typed contracts (`@jarvis/contracts` experience schemas)
and deterministic mock data; the AEGIS panel that appears in the video may exist in
the application **only inside a labeled demo** and must truthfully state that AEGIS
is NOT IMPLEMENTED (KNOWN-LIMITATIONS §1).
