import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import * as THREE from 'three';
import type { OrbState } from '@jarvis/contracts';
import { orbStateMotion } from '../tokens/motion.js';
import { accent, text } from '../tokens/colors.js';
import { StateAnnouncer } from '../a11y/StateAnnouncer.js';
import { useReducedMotion } from '../a11y/use-reduced-motion.js';
import { orbTiming, orbVisualConfig } from '../orb/orb-visuals.js';
import { mulberry32 } from '../orb/particles.js';
import { Orb } from '../orb/Orb.js';

/**
 * ORB RENDERER V2 — CONCEPT STUDY, milestone V2-M1 (still-frame studies).
 * Status: DEV-FLAGGED STUDY, NOT the production renderer, NOT visually
 * approved. The legacy Orb (`../orb/Orb.tsx`) remains the live E2 renderer.
 *
 * Direction authority: `docs/design/JARVIS-V2-DIRECTION.md` (the approved
 * benchmark MP4 + the complete original generation prompt). The prompt's
 * CORE VISUAL elements are implemented as real 3D structure: a graphite
 * occluding core body with an off-center emissive cluster, transparent
 * rotating internal ring-races with distinct speeds/directions/purposes, a
 * tilted double-edged luminous torus set INTO the assembly, a circular
 * reactive waveform (listening/speaking), filaments, depth-separated dust,
 * a bounded architectural grid discovered during awakening (owner grid
 * ruling), floor reflection, fog, and an integrated spatial `JARVIS`
 * identity that emerges with awakening (owner identity ruling) — never a
 * page title.
 *
 * Determinism: all placement from `mulberry32(20260717)`; study phases
 * freeze the clock so each still is exactly reproducible. State input is
 * `orbVisualConfig` — the contract, not this component, decides state.
 * Honest fallback: no WebGL or reduced motion → the legacy renderer, and
 * `onRendererResolved` reports which renderer is ACTUALLY live so the dev
 * inspector can never silently show legacy as V2.
 *
 * `aegisLockdown` remains a demo-only visual state (AEGIS NOT IMPLEMENTED,
 * KNOWN-LIMITATIONS §1).
 */
export type StudyPhase = 'dormant' | 'gathering' | 'ignition';

export interface OrbStudyV2Props {
  state: OrbState;
  /** Freeze the scene at a wake-assembly study phase (deterministic still). */
  studyPhase?: StudyPhase | null;
  /** Square edge length in px. */
  sizePx?: number;
  announce?: boolean;
  /** Reports the renderer actually live: 'v2-study' or 'legacy-fallback'. */
  onRendererResolved?: (name: 'v2-study' | 'legacy-fallback') => void;
}

const SEED = 20260717;
const WARM_WHITE = '#f6f4ef';

function webglAvailable(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Procedural soft-glow sprite texture (no remote assets). */
function makeGlowTexture(inner: string, outer: string): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * Bounded architectural grid texture (owner grid ruling): low-contrast lines
 * with a radial alpha falloff so the lattice is partial, interrupted, and
 * never reads as graph paper or HUD.
 */
function makeGridTexture(): THREE.Texture {
  const size = 512;
  const cell = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.strokeStyle = 'rgba(120,150,180,0.35)';
    ctx.lineWidth = 1;
    for (let p = 0; p <= size; p += cell) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
    // interruption: radial mask keeps only patches of the lattice visible
    const mask = ctx.createRadialGradient(
      size * 0.4,
      size * 0.45,
      size * 0.05,
      size * 0.4,
      size * 0.45,
      size * 0.75,
    );
    mask.addColorStop(0, 'rgba(0,0,0,0)');
    mask.addColorStop(0.55, 'rgba(0,0,0,0.35)');
    mask.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  return texture;
}

/** Integrated spatial identity texture — stable, readable, never a page title. */
function makeWordmarkTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = text.heading;
    ctx.font = '700 118px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // manual tracking for the wordmark's generous letter-spacing
    const word = 'JARVIS';
    const spacing = 26;
    const letters = Array.from(word);
    const widths = letters.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (word.length - 1);
    let x = (canvas.width - total) / 2;
    letters.forEach((ch, i) => {
      const w = widths[i] ?? 0;
      ctx.fillText(ch, x + w / 2, canvas.height / 2);
      x += w + spacing;
    });
  }
  return new THREE.CanvasTexture(canvas);
}

/** Per-phase frozen study parameters: clock, energies, camera. Deterministic. */
const STUDY_FREEZE: Record<
  StudyPhase,
  {
    t: number;
    core: number;
    membrane: number;
    filament: number;
    env: number;
    converge: number;
    grid: number;
    ignitionFlash: number;
    wordmark: number;
    cam: [number, number, number];
  }
> = {
  dormant: {
    t: 1.7,
    core: 0.1,
    membrane: 0.008,
    filament: 0,
    env: 0.015,
    converge: 0,
    grid: 0.02,
    ignitionFlash: 0,
    wordmark: 0,
    cam: [0.18, 0.09, 2.5],
  },
  gathering: {
    t: 3.4,
    core: 0.34,
    membrane: 0.16,
    filament: 0.3,
    env: 0.12,
    converge: 0.85,
    grid: 0.16,
    ignitionFlash: 0,
    wordmark: 0.06,
    cam: [0.5, 0.2, 4.4],
  },
  ignition: {
    t: 5.1,
    core: 1.55,
    membrane: 0.75,
    filament: 0.4,
    env: 0.85,
    converge: 0.35,
    grid: 0.5,
    ignitionFlash: 0.8,
    wordmark: 0.3,
    cam: [0.72, 0.3, 5.9],
  },
};

interface EnergyTargets {
  core: number;
  containment: number;
  fragmentOpacity: number;
  particleMode: 'halo' | 'converge' | 'emit' | 'still' | 'off';
  pulse: 'none' | 'rhythmic' | 'reactive' | 'alarm';
  vibration: boolean;
  breathPeriodMs: number;
  breathing: boolean;
  drift: number;
}

function targetsFor(state: OrbState): EnergyTargets {
  const config = orbVisualConfig(state, false);
  return {
    core: config.nucleusIntensity,
    containment: config.containmentScale,
    fragmentOpacity: config.ringOpacity,
    particleMode: config.particleMode,
    pulse: config.pulse,
    vibration: config.vibration,
    breathPeriodMs: config.breathPeriodMs > 0 ? config.breathPeriodMs : orbTiming.idleBreathMs,
    breathing: config.breathScale > 1,
    drift: Number.isFinite(config.ringSpinPeriodMs) ? 24000 / config.ringSpinPeriodMs : 0,
  };
}

export function OrbStudyV2({
  state,
  studyPhase = null,
  sizePx = 460,
  announce = true,
  onRendererResolved,
}: OrbStudyV2Props): JSX.Element {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetsRef = useRef<EnergyTargets>(targetsFor(state));
  const accentRef = useRef<string>(orbStateMotion[state].accentColor);
  const stateRef = useRef<OrbState>(state);
  const phaseRef = useRef<StudyPhase | null>(studyPhase);

  const useFallback = reducedMotion || (typeof document !== 'undefined' && !webglAvailable());

  useEffect(() => {
    onRendererResolved?.(useFallback ? 'legacy-fallback' : 'v2-study');
  }, [useFallback, onRendererResolved]);

  useEffect(() => {
    targetsRef.current = targetsFor(state);
    accentRef.current = orbStateMotion[state].accentColor;
    stateRef.current = state;
    phaseRef.current = studyPhase;
  }, [state, studyPhase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (useFallback || !canvas) {
      return;
    }

    // ---- scene -------------------------------------------------------------
    const rand = mulberry32(SEED);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(sizePx, sizePx, false);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070a, 0.055);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    const CAM_HOME = new THREE.Vector3(0.9, 0.32, 7.4);
    camera.position.copy(CAM_HOME);

    const coreTexture = makeGlowTexture('rgba(246,244,239,1)', 'rgba(122,215,255,0.55)');
    const accentTexture = makeGlowTexture('rgba(122,215,255,0.9)', 'rgba(90,140,255,0.35)');
    const gridTexture = makeGridTexture();
    const wordmarkTexture = makeWordmarkTexture();
    const disposables: { dispose(): void }[] = [
      renderer,
      coreTexture,
      accentTexture,
      gridTexture,
      wordmarkTexture,
    ];
    const track = <T extends { dispose(): void }>(d: T): T => {
      disposables.push(d);
      return d;
    };

    // ---- band 1: far environment — bounded grid, discovered on awakening ---
    const gridMaterial = track(
      new THREE.MeshBasicMaterial({
        map: gridTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        color: 0x33475a,
      }),
    );
    const wallGrid = new THREE.Mesh(track(new THREE.PlaneGeometry(46, 22)), gridMaterial);
    wallGrid.position.set(0, 1.5, -11);
    scene.add(wallGrid);
    const floorGrid = new THREE.Mesh(track(new THREE.PlaneGeometry(46, 26)), gridMaterial);
    floorGrid.rotation.x = -Math.PI / 2;
    floorGrid.position.set(0, -2.6, -4);
    scene.add(floorGrid);

    const envMaterial = track(
      new THREE.SpriteMaterial({
        map: accentTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      }),
    );
    const envSprite = new THREE.Sprite(envMaterial);
    envSprite.position.set(0.4, -0.2, -6);
    envSprite.scale.setScalar(8);
    scene.add(envSprite);

    // floor reflection: the orb's light caught by the ground plane
    const reflectMaterial = track(
      new THREE.SpriteMaterial({
        map: accentTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      }),
    );
    const reflectSprite = new THREE.Sprite(reflectMaterial);
    reflectSprite.position.set(0, -2.3, -0.5);
    reflectSprite.scale.set(5.2, 1.1, 1);
    scene.add(reflectSprite);

    // ---- band 2/5: depth-separated dust (single seeded 3D field; the core
    // body's depth buffer occludes rear motes — real occlusion, not layers) --
    interface Dust {
      r: number;
      theta: number;
      phi: number;
      phase: number;
      speed: number;
      depthWeight: number;
    }
    const PARTICLE_COUNT = 650;
    const dust: Dust[] = [];
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      dust.push({
        r: 0.7 + rand() * 2.9,
        theta: rand() * Math.PI * 2,
        phi: Math.acos(2 * rand() - 1),
        phase: rand(),
        speed: 0.5 + rand(),
        depthWeight: rand(),
      });
    }
    const particleGeometry = track(new THREE.BufferGeometry());
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = track(
      new THREE.PointsMaterial({
        map: accentTexture,
        color: 0xbfe9ff,
        size: 0.05,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    scene.add(new THREE.Points(particleGeometry, particleMaterial));

    // ---- band 3: the intelligence construction -----------------------------
    // graphite occluding body — writes depth, so everything behind it hides
    const coreBody = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.34, 48, 32)),
      track(new THREE.MeshBasicMaterial({ color: 0x0b1119 })),
    );
    coreBody.scale.set(1, 0.94, 1.06); // asymmetric mass, not a polished ball
    scene.add(coreBody);
    const rimMaterial = track(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(accent.jarvisBlue),
        transparent: true,
        opacity: 0,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    scene.add(new THREE.Mesh(track(new THREE.SphereGeometry(0.385, 48, 32)), rimMaterial));

    // off-center emissive cluster — the changing concentration of light
    interface CoreLight {
      sprite: THREE.Sprite;
      base: THREE.Vector3;
      scale: number;
      freq: number;
      phase: number;
      weight: number;
    }
    const coreLights: CoreLight[] = [];
    for (let i = 0; i < 6; i += 1) {
      const material = track(
        new THREE.SpriteMaterial({
          map: i % 2 === 0 ? coreTexture : accentTexture,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 0,
        }),
      );
      const sprite = new THREE.Sprite(material);
      const base = new THREE.Vector3(
        (rand() - 0.5) * 0.5 + 0.08,
        (rand() - 0.5) * 0.4 + 0.05,
        (rand() - 0.5) * 0.45 + 0.18,
      );
      sprite.position.copy(base);
      const scale = 0.4 + rand() * 0.9;
      coreLights.push({
        sprite,
        base,
        scale,
        freq: 0.35 + rand() * 0.5,
        phase: rand() * Math.PI * 2,
        weight: 0.45 + rand() * 0.55,
      });
      scene.add(sprite);
    }

    // internal ring-races: transparent rotating geometry, DISTINCT purposes —
    // race A carries hardware lugs (mechanical), race B is a fine data race.
    const raceGroupA = new THREE.Group();
    const raceA = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.64, 0.014, 8, 96)),
      track(
        new THREE.MeshBasicMaterial({
          color: 0x9fc4e0,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );
    raceGroupA.add(raceA);
    const lugMaterial = track(
      new THREE.MeshBasicMaterial({
        color: 0xc8dcec,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const lugGeometry = track(new THREE.SphereGeometry(0.028, 8, 8));
    for (let i = 0; i < 6; i += 1) {
      const lug = new THREE.Mesh(lugGeometry, lugMaterial);
      const a = (i / 6) * Math.PI * 2;
      lug.position.set(Math.cos(a) * 0.64, Math.sin(a) * 0.64, 0);
      raceGroupA.add(lug);
    }
    raceGroupA.rotation.set(0.9, 0.4, 0.2);
    scene.add(raceGroupA);

    const raceGroupB = new THREE.Group();
    raceGroupB.add(
      new THREE.Mesh(
        track(new THREE.TorusGeometry(0.8, 0.008, 8, 96)),
        track(
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(accent.jarvisBlue),
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        ),
      ),
    );
    raceGroupB.rotation.set(-0.7, 0.9, -0.3);
    scene.add(raceGroupB);

    // luminous torus: double-edged, tilted INTO the assembly (the machine's
    // bright element, set at an angle so it is never a frontal complete ring)
    const lumMaterialMain = track(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(WARM_WHITE),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const lumMaterialEdge = track(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(WARM_WHITE),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const lumGroup = new THREE.Group();
    lumGroup.add(
      new THREE.Mesh(track(new THREE.TorusGeometry(0.98, 0.016, 12, 96, 4.7)), lumMaterialMain),
    );
    lumGroup.add(
      new THREE.Mesh(track(new THREE.TorusGeometry(0.915, 0.007, 8, 96, 3.6)), lumMaterialEdge),
    );
    lumGroup.rotation.set(1.34, 0.28, 0.55);
    scene.add(lumGroup);

    // membranes: irregular partial shells at different depths
    interface Membrane {
      mesh: THREE.Mesh;
      material: THREE.MeshBasicMaterial;
      axis: THREE.Vector3;
      speed: number;
      baseOpacity: number;
      energy: number;
      lag: number;
    }
    const membranes: Membrane[] = [];
    for (const spec of [
      { radius: 1.18, phi: 3.2, theta: 1.9, opacity: 0.08 },
      { radius: 1.55, phi: 2.4, theta: 2.2, opacity: 0.06 },
    ]) {
      const material = track(
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(accent.jarvisBlue),
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const mesh = new THREE.Mesh(
        track(
          new THREE.SphereGeometry(
            spec.radius,
            40,
            28,
            rand() * Math.PI * 2,
            spec.phi,
            rand() * 0.8,
            spec.theta,
          ),
        ),
        material,
      );
      mesh.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
      membranes.push({
        mesh,
        material,
        axis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        speed: (0.02 + rand() * 0.03) * (rand() < 0.5 ? -1 : 1),
        baseOpacity: spec.opacity,
        energy: 0,
        lag: 0.05 + rand() * 0.05,
      });
      scene.add(mesh);
    }

    // ---- band 4: front structures — filaments, fragments, waveform ---------
    interface Filament {
      material: THREE.MeshBasicMaterial;
      freq: number;
      phase: number;
      energy: number;
    }
    const filaments: Filament[] = [];
    for (let i = 0; i < 8; i += 1) {
      const points: THREE.Vector3[] = [];
      const arm = 0.35 + rand() * 1.05;
      for (let p = 0; p < 5; p += 1) {
        const r = 0.2 + (p / 4) * arm + (rand() - 0.5) * 0.16;
        const theta = rand() * Math.PI * 2;
        const phi = Math.acos(2 * rand() - 1);
        points.push(
          new THREE.Vector3(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi),
          ),
        );
      }
      const material = track(
        new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? new THREE.Color(WARM_WHITE) : new THREE.Color(accent.jarvisBlue),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      scene.add(
        new THREE.Mesh(
          track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.006, 4, false)),
          material,
        ),
      );
      filaments.push({
        material,
        freq: 0.15 + rand() * 0.35,
        phase: rand() * Math.PI * 2,
        energy: 0,
      });
    }

    interface Fragment {
      group: THREE.Group;
      material: THREE.MeshBasicMaterial;
      home: THREE.Euler;
      scattered: THREE.Euler;
      wobbleFreq: number;
      wobblePhase: number;
      driftSpeed: number;
      baseOpacity: number;
    }
    const fragments: Fragment[] = [];
    for (let i = 0; i < 5; i += 1) {
      const radius = 1.6 + rand() * 0.6;
      const arc = 0.5 + rand() * 1.1;
      const material = track(
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? new THREE.Color(WARM_WHITE) : new THREE.Color(accent.jarvisBlue),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const mesh = new THREE.Mesh(
        track(new THREE.TorusGeometry(radius, 0.006 + rand() * 0.008, 8, 72, arc)),
        material,
      );
      mesh.rotation.z = rand() * Math.PI * 2;
      const group = new THREE.Group();
      group.add(mesh);
      const home = new THREE.Euler(
        (rand() - 0.5) * 1.6,
        (rand() - 0.5) * 1.6,
        (rand() - 0.5) * 1.2,
      );
      const scattered = new THREE.Euler(
        home.x + (rand() - 0.5) * 2.4,
        home.y + (rand() - 0.5) * 2.4,
        home.z + (rand() - 0.5) * 2,
      );
      group.rotation.copy(home);
      fragments.push({
        group,
        material,
        home,
        scattered,
        wobbleFreq: 0.05 + rand() * 0.09,
        wobblePhase: rand() * Math.PI * 2,
        driftSpeed: (0.01 + rand() * 0.02) * (rand() < 0.5 ? -1 : 1),
        baseOpacity: 0.2 + rand() * 0.3,
      });
      scene.add(group);
    }

    // circular reactive waveform — listening/speaking only (the prompt's
    // "sophisticated circular waveform"), radial displacement, deterministic
    const WAVE_POINTS = 160;
    const waveGeometry = track(new THREE.BufferGeometry());
    waveGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(WAVE_POINTS * 3), 3),
    );
    const waveMaterial = track(
      new THREE.LineBasicMaterial({
        color: new THREE.Color(accent.jarvisBlue),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      }),
    );
    const waveRing = new THREE.LineLoop(waveGeometry, waveMaterial);
    waveRing.rotation.x = 1.2;
    scene.add(waveRing);

    // ignition flash + integrated identity
    const flashMaterial = track(
      new THREE.SpriteMaterial({
        map: coreTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      }),
    );
    const flashSprite = new THREE.Sprite(flashMaterial);
    flashSprite.scale.setScalar(3.4);
    scene.add(flashSprite);

    const wordmarkMaterial = track(
      new THREE.SpriteMaterial({
        map: wordmarkTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    const wordmarkSprite = new THREE.Sprite(wordmarkMaterial);
    wordmarkSprite.position.set(0, 1.62, -0.8);
    wordmarkSprite.scale.set(2.3, 0.58, 1);
    scene.add(wordmarkSprite);

    // ---- energy system: lagged propagation ---------------------------------
    let coreEnergy = 0;
    let membraneEnergy = 0;
    let filamentEnergy = 0;
    let envEnergy = 0;
    let convergeAmount = 0;
    let emitAmount = 0;
    let wordmarkOpacity = 0;
    const tmpColor = new THREE.Color();
    const camTarget = new THREE.Vector3().copy(CAM_HOME);
    const start = performance.now();
    let disposed = false;

    function pulseFactor(tSec: number, pulse: EnergyTargets['pulse']): number {
      switch (pulse) {
        case 'rhythmic':
          return 0.85 + 0.15 * Math.sin((tSec * 2 * Math.PI * 1000) / orbTiming.rhythmicPulseMs);
        case 'reactive':
          return 0.7 + 0.3 * Math.abs(Math.sin(tSec * 3.1) * Math.sin(tSec * 1.7));
        case 'alarm':
          return 0.7 + 0.3 * Math.sin((tSec * 2 * Math.PI * 1000) / orbTiming.alarmPulseMs);
        case 'none':
          return 1;
      }
    }

    renderer.setAnimationLoop(() => {
      if (disposed) return;
      const phase = phaseRef.current;
      const frozen = phase ? STUDY_FREEZE[phase] : null;
      const t = frozen ? frozen.t : (performance.now() - start) / 1000;
      const targets = targetsRef.current;

      // energies: frozen studies pin them; live states chase targets with lag
      if (frozen) {
        coreEnergy = frozen.core;
        membraneEnergy = frozen.membrane;
        filamentEnergy = frozen.filament;
        envEnergy = frozen.env;
        convergeAmount = frozen.converge;
        emitAmount = 0;
        wordmarkOpacity = frozen.wordmark;
      } else {
        const breathe = targets.breathing
          ? 1 + 0.06 * Math.sin((t * 2 * Math.PI * 1000) / targets.breathPeriodMs)
          : 1;
        const coreTarget = targets.core * pulseFactor(t, targets.pulse) * breathe;
        coreEnergy += (coreTarget - coreEnergy) * 0.055;
        membraneEnergy += (coreEnergy - membraneEnergy) * 0.04;
        filamentEnergy += (membraneEnergy - filamentEnergy) * 0.045;
        envEnergy += (membraneEnergy * 0.55 - envEnergy) * 0.03;
        convergeAmount += ((targets.particleMode === 'converge' ? 1 : 0) - convergeAmount) * 0.03;
        emitAmount += ((targets.particleMode === 'emit' ? 1 : 0) - emitAmount) * 0.03;
        // identity: restrained spatial treatment after stabilization only
        const wordmarkTarget =
          stateRef.current === 'idle' ||
          stateRef.current === 'listening' ||
          stateRef.current === 'thinking' ||
          stateRef.current === 'reasoning' ||
          stateRef.current === 'speaking' ||
          stateRef.current === 'success'
            ? 0.32
            : 0;
        wordmarkOpacity += (wordmarkTarget - wordmarkOpacity) * 0.02;
      }

      tmpColor.set(accentRef.current);

      // core cluster
      for (const light of coreLights) {
        const wobble = frozen
          ? 1
          : 1 + 0.16 * Math.sin(t * light.freq * 2 * Math.PI + light.phase) * light.weight;
        light.sprite.scale.setScalar(light.scale * (0.5 + coreEnergy * 0.8) * wobble);
        light.sprite.material.opacity = Math.min(1, coreEnergy * light.weight * 1.05);
        light.sprite.position.set(
          light.base.x + (frozen ? 0 : 0.05 * Math.sin(t * 0.21 + light.phase)),
          light.base.y + (frozen ? 0 : 0.04 * Math.sin(t * 0.17 + light.phase * 2)),
          light.base.z + (frozen ? 0 : 0.04 * Math.sin(t * 0.13 + light.phase * 3)),
        );
        if (light.sprite.material.map === accentTexture) {
          light.sprite.material.color.copy(tmpColor).lerp(new THREE.Color('#ffffff'), 0.25);
        }
      }
      rimMaterial.opacity = 0.05 + 0.14 * coreEnergy;
      rimMaterial.color.copy(tmpColor);

      // internal races: distinct speeds, directions, purposes
      raceGroupA.rotation.z = 0.2 + t * 0.11 * (0.4 + targets.drift);
      raceGroupA.rotation.x = 0.9 + (frozen ? 0 : 0.05 * Math.sin(t * 0.09));
      raceGroupB.rotation.z = -0.3 - t * 0.07 * (0.4 + targets.drift);
      const raceVisible = frozen ? frozen.membrane * 3 : membraneEnergy;
      raceGroupA.children.forEach((child) => {
        const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        m.opacity = Math.min(0.5, 0.55 * raceVisible * (m === lugMaterial ? 1.3 : 1));
      });
      ((raceGroupB.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
        Math.min(0.35, 0.42 * raceVisible);

      // luminous torus: state-lit, tilted; drifts slowly, never synchronized
      lumGroup.rotation.z = 0.1 + t * 0.045;
      const lum = targets.fragmentOpacity * pulseFactor(t, targets.pulse);
      lumMaterialMain.opacity = (frozen ? frozen.core * 0.38 : 0.45 * lum) * 0.9;
      lumMaterialEdge.opacity = lumMaterialMain.opacity * 0.55;

      // membranes
      for (const membrane of membranes) {
        membrane.energy += (membraneEnergy - membrane.energy) * membrane.lag;
        membrane.material.opacity = membrane.baseOpacity * (0.2 + membrane.energy);
        membrane.material.color.copy(tmpColor);
        if (!frozen) {
          membrane.mesh.rotateOnAxis(membrane.axis, membrane.speed * 0.016 * (0.5 + targets.drift));
        }
      }

      // filaments / neural pathways
      for (const filament of filaments) {
        filament.energy += (filamentEnergy - filament.energy) * 0.08;
        const flicker = frozen
          ? 0.8
          : Math.max(0, Math.sin(t * filament.freq * 2 * Math.PI + filament.phase) - 0.45);
        filament.material.opacity = Math.min(0.8, filament.energy * flicker * 1.1);
      }

      // containment fragments: correction toward home + strain wobble
      const strain = targets.vibration ? 2.6 : 1;
      const align = frozen ? (phase === 'ignition' ? 0.75 : phase === 'gathering' ? 0.2 : 0) : 1;
      for (const fragment of fragments) {
        const wobble = frozen
          ? 0
          : 0.05 * strain * Math.sin(t * fragment.wobbleFreq * 2 * Math.PI + fragment.wobblePhase);
        fragment.group.rotation.set(
          fragment.scattered.x + (fragment.home.x - fragment.scattered.x) * align + wobble,
          fragment.scattered.y + (fragment.home.y - fragment.scattered.y) * align + wobble * 0.7,
          frozen
            ? fragment.scattered.z + (fragment.home.z - fragment.scattered.z) * align
            : fragment.group.rotation.z + fragment.driftSpeed * 0.016 * (0.5 + targets.drift),
        );
        fragment.material.opacity =
          fragment.baseOpacity * targets.fragmentOpacity * (0.35 + membraneEnergy * 0.65) * align;
        fragment.group.scale.setScalar(targets.containment);
      }

      // dust: halo / staggered convergence / outward emission
      const positionAttr = particleGeometry.getAttribute('position');
      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        const mote = dust[i];
        if (!mote) continue;
        const theta = mote.theta + t * 0.014 * mote.speed * (0.5 + targets.drift);
        let r = mote.r;
        if (convergeAmount > 0.01) {
          const pull = Math.min(1, convergeAmount * (0.6 + 0.55 * mote.depthWeight));
          r = mote.r + (0.55 - mote.r) * pull;
        }
        if (emitAmount > 0.01) {
          const cycle = (t / (5.2 * (0.7 + 0.6 * mote.depthWeight)) + mote.phase) % 1;
          r = r * (1 - emitAmount) + (0.5 + (mote.r - 0.5) * cycle) * emitAmount;
        }
        positionAttr.setXYZ(
          i,
          r * Math.sin(mote.phi) * Math.cos(theta),
          r * Math.sin(mote.phi) * Math.sin(theta) * 0.92,
          r * Math.cos(mote.phi),
        );
      }
      positionAttr.needsUpdate = true;
      particleMaterial.opacity =
        targets.particleMode === 'off' ? 0 : 0.2 + 0.55 * Math.min(1, 0.15 + membraneEnergy);
      particleMaterial.color.copy(tmpColor).lerp(new THREE.Color('#ffffff'), 0.5);

      // waveform ring (listening/speaking)
      const waveActive = targets.pulse === 'rhythmic' || targets.pulse === 'reactive' ? 1 : 0;
      const wavePos = waveGeometry.getAttribute('position');
      for (let i = 0; i < WAVE_POINTS; i += 1) {
        const a = (i / WAVE_POINTS) * Math.PI * 2;
        const amp =
          targets.pulse === 'reactive'
            ? 0.09 * Math.abs(Math.sin(a * 7 + t * 3.1) * Math.sin(a * 3 + t * 1.7))
            : 0.05 * Math.sin(a * 12 + t * ((2 * Math.PI * 1000) / orbTiming.rhythmicPulseMs));
        const r = 1.3 + amp * waveActive;
        wavePos.setXYZ(i, Math.cos(a) * r, Math.sin(a) * r, 0);
      }
      wavePos.needsUpdate = true;
      waveMaterial.opacity = waveActive * 0.35 * Math.min(1, coreEnergy + 0.2);
      waveMaterial.color.copy(tmpColor);

      // environment answers the field; grid is discovered, never a backdrop
      envMaterial.opacity = 0.04 + 0.2 * Math.min(1, envEnergy);
      envMaterial.color.copy(tmpColor);
      reflectMaterial.opacity = 0.03 + 0.09 * Math.min(1, coreEnergy);
      reflectMaterial.color.copy(tmpColor);
      gridMaterial.opacity = frozen ? frozen.grid * 0.14 : Math.min(0.09, 0.01 + 0.11 * envEnergy);
      flashMaterial.opacity = frozen ? frozen.ignitionFlash : 0;
      wordmarkMaterial.opacity = wordmarkOpacity;

      // camera: study freeze / state moves / parallax
      if (frozen) {
        camera.position.set(frozen.cam[0], frozen.cam[1], frozen.cam[2]);
      } else {
        camTarget.copy(CAM_HOME);
        if (stateRef.current === 'listening') {
          // subtle 10–15° orbital move (prompt camera direction)
          const angle = 0.22;
          camTarget.set(
            CAM_HOME.x * Math.cos(angle) + CAM_HOME.z * Math.sin(angle),
            CAM_HOME.y + 0.1,
            CAM_HOME.z * Math.cos(angle) - CAM_HOME.x * Math.sin(angle),
          );
        } else if (stateRef.current === 'reasoning') {
          camTarget.set(CAM_HOME.x * 0.9, CAM_HOME.y, CAM_HOME.z - 0.7);
        }
        camera.position.lerp(camTarget, 0.02);
        camera.position.x += 0.14 * Math.sin(t * 0.11) * 0.05;
        camera.position.y += 0.1 * Math.sin(t * 0.073 + 1.7) * 0.05;
      }
      camera.lookAt(0.1, 0.05, 0);

      renderer.render(scene, camera);
    });

    return (): void => {
      disposed = true;
      renderer.setAnimationLoop(null);
      for (const item of disposables) item.dispose();
    };
  }, [sizePx, useFallback]);

  const motionEntry = orbStateMotion[state];
  const ariaLabel = `Jarvis orb: ${
    reducedMotion ? motionEntry.reducedMotion.description : motionEntry.description
  }`;

  if (useFallback) {
    // Honest fallback: the legacy renderer (its reduced-motion path is a
    // deliberately composed static presentation). Reported via
    // onRendererResolved — never silently presented as V2.
    return (
      <div data-orb-renderer="legacy-fallback" style={{ position: 'relative' }}>
        <Orb state={state} sizePx={sizePx} announce={announce} />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      data-orb-state={state}
      data-orb-renderer="v2-study"
      data-orb-study-phase={studyPhase ?? undefined}
      style={{ position: 'relative', width: sizePx, height: sizePx }}
    >
      <canvas
        ref={canvasRef}
        width={sizePx}
        height={sizePx}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: sizePx, height: sizePx }}
      />
      {announce && <StateAnnouncer state={state} />}
    </div>
  );
}
