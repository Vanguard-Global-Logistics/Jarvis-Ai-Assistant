import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import * as THREE from 'three';
import type { OrbState } from '@jarvis/contracts';
import { orbStateMotion } from '../tokens/motion.js';
import { accent } from '../tokens/colors.js';
import { StateAnnouncer } from '../a11y/StateAnnouncer.js';
import { useReducedMotion } from '../a11y/use-reduced-motion.js';
import { orbTiming, orbVisualConfig } from '../orb/orb-visuals.js';
import { mulberry32 } from '../orb/particles.js';
import { Orb } from '../orb/Orb.js';

/**
 * ORB RENDERER V2 — CONCEPT STUDY (task E2 renderer reset, William's
 * instruction). Status: DEV-FLAGGED STUDY, NOT the production renderer. The
 * legacy pseudo-3D Orb (`../orb/Orb.tsx`) remains the live E2 renderer and
 * the recoverable implementation; nothing here replaces it until William's
 * visual decision at the rapid concept gate.
 *
 * Concept: Jarvis as an asymmetric, contained field of intelligence — a
 * changing concentration of light (never a ball/pupil/planet), irregular
 * nested energy membranes (partial translucent shells, never a ring),
 * luminous filaments, displaced containment fragments passing in front of
 * and behind the field, suspended particles at many depths, environmental
 * light that answers the core. One energy system: core energy propagates to
 * membranes → filaments → particles → environment with lag and inertia, so
 * nothing reads as synchronized loops.
 *
 * Discipline: three.js only (no drei/postprocessing/physics), one canvas,
 * typed `OrbState` input, `orbVisualConfig` as the single state authority,
 * all randomness from `mulberry32` (deterministic — same seed, same field),
 * no business logic, no IPC, no remote assets. Honest fallback: when WebGL
 * is unavailable or `prefers-reduced-motion` is set, the legacy Orb renders
 * instead (its reduced-motion path is a first-class static composition) —
 * never a fake operational renderer.
 *
 * `aegisLockdown` remains a demo-only visual state: AEGIS is NOT IMPLEMENTED
 * (`docs/KNOWN-LIMITATIONS.md` §1).
 */
export interface OrbStudyV2Props {
  state: OrbState;
  /** Pre-wake dormancy: near-black environment, one faint asymmetric spark. */
  dormant?: boolean;
  /** Square edge length in px. */
  sizePx?: number;
  announce?: boolean;
}

const SEED = 20260717;

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
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** Per-state physical targets for the energy system, derived from the contract. */
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
  desaturate: boolean;
}

function targetsFor(state: OrbState, dormant: boolean): EnergyTargets {
  const config = orbVisualConfig(state, false);
  if (dormant) {
    return {
      core: 0.05,
      containment: 1,
      fragmentOpacity: 0.04,
      particleMode: 'still',
      pulse: 'none',
      vibration: false,
      breathPeriodMs: orbTiming.idleBreathMs,
      breathing: false,
      drift: 0.1,
      desaturate: false,
    };
  }
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
    desaturate: config.desaturate,
  };
}

export function OrbStudyV2({
  state,
  dormant = false,
  sizePx = 460,
  announce = true,
}: OrbStudyV2Props): JSX.Element {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetsRef = useRef<EnergyTargets>(targetsFor(state, dormant));
  const accentRef = useRef<string>(orbStateMotion[state].accentColor);
  const wakeStartRef = useRef<number | null>(null);
  const stateRef = useRef<OrbState>(state);

  const useFallback = reducedMotion || (typeof document !== 'undefined' && !webglAvailable());

  useEffect(() => {
    targetsRef.current = targetsFor(state, dormant);
    accentRef.current = orbStateMotion[state].accentColor;
    if (state === 'wake' && stateRef.current !== 'wake') {
      wakeStartRef.current = null; // armed: the loop stamps its own clock time
    }
    stateRef.current = state;
  }, [state, dormant]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (useFallback || !canvas) {
      return;
    }

    // ---- scene setup (once per mount; state flows via refs) ----------------
    const rand = mulberry32(SEED);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(sizePx, sizePx, false);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070a, 0.045);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    const CAM_HOME = new THREE.Vector3(0.9, 0.32, 7.4);
    camera.position.copy(CAM_HOME);

    const accentColor = new THREE.Color(accent.jarvisBlue);
    const warmWhite = new THREE.Color('#f6f4ef');
    const coreTexture = makeGlowTexture('rgba(246,244,239,1)', 'rgba(122,215,255,0.55)');
    const accentTexture = makeGlowTexture('rgba(122,215,255,0.9)', 'rgba(90,140,255,0.35)');

    const disposables: { dispose(): void }[] = [renderer, coreTexture, accentTexture];

    // ---- core: an asymmetric concentration of light, not a ball ------------
    const coreGroup = new THREE.Group();
    interface CoreLight {
      sprite: THREE.Sprite;
      base: THREE.Vector3;
      scale: number;
      freq: number;
      phase: number;
      weight: number;
    }
    const coreLights: CoreLight[] = [];
    const CORE_COUNT = 6;
    for (let i = 0; i < CORE_COUNT; i += 1) {
      const material = new THREE.SpriteMaterial({
        map: i % 2 === 0 ? coreTexture : accentTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(material);
      const base = new THREE.Vector3(
        (rand() - 0.5) * 0.55,
        (rand() - 0.5) * 0.45,
        (rand() - 0.5) * 0.5,
      );
      sprite.position.copy(base);
      const scale = 0.5 + rand() * 1.1;
      sprite.scale.setScalar(scale);
      coreLights.push({
        sprite,
        base,
        scale,
        freq: 0.35 + rand() * 0.5,
        phase: rand() * Math.PI * 2,
        weight: 0.45 + rand() * 0.55,
      });
      coreGroup.add(sprite);
      disposables.push(material);
    }
    // one broad inner volume — light scattering inside the field
    const volumeMaterial = new THREE.SpriteMaterial({
      map: accentTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    });
    const volumeSprite = new THREE.Sprite(volumeMaterial);
    volumeSprite.scale.setScalar(3.1);
    coreGroup.add(volumeSprite);
    disposables.push(volumeMaterial);
    scene.add(coreGroup);

    // ---- membranes: irregular partial shells at different depths -----------
    interface Membrane {
      mesh: THREE.Mesh;
      material: THREE.MeshBasicMaterial;
      axis: THREE.Vector3;
      speed: number;
      baseOpacity: number;
      lag: number;
      energy: number;
    }
    const membranes: Membrane[] = [];
    const MEMBRANE_SPECS = [
      { radius: 1.05, phi: 3.4, theta: 1.9, opacity: 0.09 },
      { radius: 1.45, phi: 2.3, theta: 2.3, opacity: 0.07 },
      { radius: 1.85, phi: 2.9, theta: 1.5, opacity: 0.05 },
    ];
    for (const spec of MEMBRANE_SPECS) {
      const geometry = new THREE.SphereGeometry(
        spec.radius,
        48,
        32,
        rand() * Math.PI * 2,
        spec.phi,
        rand() * 0.9,
        spec.theta,
      );
      const material = new THREE.MeshBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
      membranes.push({
        mesh,
        material,
        axis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        speed: (0.02 + rand() * 0.035) * (rand() < 0.5 ? -1 : 1),
        baseOpacity: spec.opacity,
        lag: 0.06 + rand() * 0.05,
        energy: 0,
      });
      scene.add(mesh);
      disposables.push(geometry, material);
    }

    // ---- filaments: brief luminous threads inside the field ----------------
    interface Filament {
      material: THREE.MeshBasicMaterial;
      freq: number;
      phase: number;
      energy: number;
    }
    const filaments: Filament[] = [];
    const FILAMENT_COUNT = 8;
    for (let i = 0; i < FILAMENT_COUNT; i += 1) {
      const points: THREE.Vector3[] = [];
      const arm = 0.35 + rand() * 1.1;
      for (let p = 0; p < 5; p += 1) {
        const r = 0.15 + (p / 4) * arm + (rand() - 0.5) * 0.18;
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
      const curve = new THREE.CatmullRomCurve3(points);
      const geometry = new THREE.TubeGeometry(curve, 24, 0.006, 4, false);
      const material = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? warmWhite : accentColor,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      scene.add(new THREE.Mesh(geometry, material));
      filaments.push({
        material,
        freq: 0.15 + rand() * 0.35,
        phase: rand() * Math.PI * 2,
        energy: 0,
      });
      disposables.push(geometry, material);
    }

    // ---- containment fragments: displaced arcs, front and behind -----------
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
    const FRAGMENT_COUNT = 5;
    for (let i = 0; i < FRAGMENT_COUNT; i += 1) {
      const radius = 1.7 + rand() * 0.55;
      const arc = 0.5 + rand() * 1.1;
      const geometry = new THREE.TorusGeometry(radius, 0.006 + rand() * 0.009, 8, 72, arc);
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? warmWhite : accentColor,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geometry, material);
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
        baseOpacity: 0.2 + rand() * 0.35,
      });
      scene.add(group);
      disposables.push(geometry, material);
    }

    // ---- particles: suspended dust at many depths --------------------------
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
        r: 0.6 + rand() * 2.6,
        theta: rand() * Math.PI * 2,
        phi: Math.acos(2 * rand() - 1),
        phase: rand(),
        speed: 0.5 + rand(),
        depthWeight: rand(),
      });
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      map: accentTexture,
      color: 0xbfe9ff,
      size: 0.045,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(particleGeometry, particleMaterial));
    disposables.push(particleGeometry, particleMaterial);

    // ---- environment: a light the intelligence casts -----------------------
    const envMaterial = new THREE.SpriteMaterial({
      map: accentTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    });
    const envSprite = new THREE.Sprite(envMaterial);
    envSprite.position.set(0.4, -0.3, -3.2);
    envSprite.scale.setScalar(11);
    scene.add(envSprite);
    disposables.push(envMaterial);

    // ---- the energy system: lagged propagation, inertia, settling ----------
    let coreEnergy = 0;
    let membraneEnergy = 0;
    let filamentEnergy = 0;
    let envEnergy = 0;
    let convergeAmount = 0;
    let emitAmount = 0;
    const tmpColor = new THREE.Color();

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
      if (disposed) {
        return;
      }
      const now = performance.now();
      const t = (now - start) / 1000;
      const targets = targetsRef.current;

      // Wake timeline: 0..1 across the choreography, else null.
      let wakeT: number | null = null;
      if (stateRef.current === 'wake') {
        wakeStartRef.current ??= now;
        wakeT = Math.min(1, (now - wakeStartRef.current) / orbTiming.wakeSequenceMs);
      } else {
        wakeStartRef.current = null;
      }

      // Core drives everything; each downstream layer chases the one above it
      // with its own lag — propagation, inertia, settling, no shared loop.
      const breathe = targets.breathing
        ? 1 + 0.06 * Math.sin((t * 2 * Math.PI * 1000) / targets.breathPeriodMs)
        : 1;
      let coreTarget = targets.core * pulseFactor(t, targets.pulse) * breathe;
      let fragmentAlign = 1;
      let envBoost = 0;
      if (wakeT !== null) {
        // spark → gathering → filaments collapse → ignition → membranes/fragments → settle
        if (wakeT < 0.18) coreTarget = 0.06 + 0.06 * Math.sin(t * 9);
        else if (wakeT < 0.45) coreTarget = 0.1 + 0.5 * ((wakeT - 0.18) / 0.27);
        else if (wakeT < 0.62) coreTarget = 0.55;
        else if (wakeT < 0.75) {
          coreTarget = 1.6; // ignition
          envBoost = 0.8;
        } else coreTarget = 1.05;
        fragmentAlign = wakeT < 0.45 ? 0 : wakeT < 0.75 ? (wakeT - 0.45) / 0.3 : 1;
      }
      coreEnergy += (coreTarget - coreEnergy) * 0.055;
      membraneEnergy += (coreEnergy - membraneEnergy) * 0.04;
      filamentEnergy += (membraneEnergy - filamentEnergy) * 0.045;
      envEnergy += (membraneEnergy * 0.5 + envBoost - envEnergy) * 0.03;

      const convergeTarget =
        targets.particleMode === 'converge' || (wakeT !== null && wakeT < 0.62) ? 1 : 0;
      const emitTarget = targets.particleMode === 'emit' ? 1 : 0;
      convergeAmount += (convergeTarget - convergeAmount) * 0.03;
      emitAmount += (emitTarget - emitAmount) * 0.03;

      tmpColor.set(accentRef.current);

      // core lights: independent phases, shared energy
      for (const light of coreLights) {
        const wobble =
          1 + 0.16 * Math.sin(t * light.freq * 2 * Math.PI + light.phase) * light.weight;
        light.sprite.scale.setScalar(light.scale * (0.55 + coreEnergy * 0.75) * wobble);
        light.sprite.material.opacity = Math.min(1, coreEnergy * light.weight * 1.1);
        light.sprite.position.set(
          light.base.x + 0.06 * Math.sin(t * 0.21 + light.phase),
          light.base.y + 0.05 * Math.sin(t * 0.17 + light.phase * 2),
          light.base.z + 0.05 * Math.sin(t * 0.13 + light.phase * 3),
        );
        if (light.sprite.material.map === accentTexture) {
          light.sprite.material.color.copy(tmpColor).lerp(new THREE.Color('#ffffff'), 0.2);
        }
      }
      volumeMaterial.opacity = 0.1 + 0.2 * coreEnergy;
      volumeMaterial.color.copy(tmpColor);

      // membranes: lit by the core, drifting on their own axes
      for (const membrane of membranes) {
        membrane.energy += (membraneEnergy - membrane.energy) * membrane.lag;
        membrane.material.opacity =
          membrane.baseOpacity * (0.25 + membrane.energy) * (wakeT !== null ? fragmentAlign : 1);
        membrane.material.color.copy(tmpColor);
        membrane.mesh.rotateOnAxis(membrane.axis, membrane.speed * 0.016 * (0.5 + targets.drift));
      }

      // filaments: brief, phase-offset threads; collapse inward before ignition
      for (const filament of filaments) {
        filament.energy += (filamentEnergy - filament.energy) * 0.08;
        const flicker = Math.max(
          0,
          Math.sin(t * filament.freq * 2 * Math.PI + filament.phase) - 0.45,
        );
        let opacity = filament.energy * flicker * 0.9;
        if (wakeT !== null && wakeT >= 0.3 && wakeT < 0.62) {
          opacity = 0.5 * Math.sin(((wakeT - 0.3) / 0.32) * Math.PI);
        }
        filament.material.opacity = opacity;
      }

      // containment fragments: correction toward home, wobble, drift; they
      // strain (wobble grows) as vibration/instability rises
      const strain = targets.vibration ? 2.6 : 1;
      for (const fragment of fragments) {
        const wobble =
          0.05 * strain * Math.sin(t * fragment.wobbleFreq * 2 * Math.PI + fragment.wobblePhase);
        const align = wakeT !== null ? fragmentAlign : 1;
        fragment.group.rotation.set(
          fragment.scattered.x + (fragment.home.x - fragment.scattered.x) * align + wobble,
          fragment.scattered.y + (fragment.home.y - fragment.scattered.y) * align + wobble * 0.7,
          fragment.group.rotation.z + fragment.driftSpeed * 0.016 * (0.5 + targets.drift),
        );
        fragment.material.opacity =
          fragment.baseOpacity * targets.fragmentOpacity * (0.4 + membraneEnergy * 0.6) * align;
        fragment.group.scale.setScalar(targets.containment);
      }

      // particles: halo drift / staggered convergence / outward emission
      const positionAttr = particleGeometry.getAttribute('position');
      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        const mote = dust[i];
        if (!mote) continue;
        const theta = mote.theta + t * 0.014 * mote.speed * (0.5 + targets.drift);
        let r = mote.r;
        if (convergeAmount > 0.01) {
          const pull = Math.min(1, convergeAmount * (0.6 + 0.55 * mote.depthWeight));
          r = mote.r + (0.5 - mote.r) * pull;
        }
        if (emitAmount > 0.01) {
          const cycle = (t / (5.2 * (0.7 + 0.6 * mote.depthWeight)) + mote.phase) % 1;
          r = r * (1 - emitAmount) + (0.45 + (mote.r - 0.45) * cycle) * emitAmount;
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
        targets.particleMode === 'off' ? 0 : 0.25 + 0.55 * Math.min(1, membraneEnergy);
      particleMaterial.color.copy(tmpColor).lerp(new THREE.Color('#ffffff'), 0.5);

      // environment answers the field
      envMaterial.opacity = 0.05 + 0.22 * Math.min(1, envEnergy);
      envMaterial.color.copy(tmpColor);

      // camera: very slow parallax drift; settles late in wake
      const drift = wakeT !== null ? 0.35 + 0.65 * wakeT : 1;
      camera.position.set(
        CAM_HOME.x + 0.16 * Math.sin(t * 0.11) * drift,
        CAM_HOME.y + 0.11 * Math.sin(t * 0.073 + 1.7) * drift,
        CAM_HOME.z + (wakeT !== null ? (1 - wakeT) * 0.9 : 0),
      );
      camera.lookAt(0.12, 0.04, 0);

      renderer.render(scene, camera);
    });

    return (): void => {
      disposed = true;
      renderer.setAnimationLoop(null);
      for (const item of disposables) {
        item.dispose();
      }
    };
    // The scene is built once per mount/size; state flows through refs.
  }, [sizePx, useFallback]);

  const motionEntry = orbStateMotion[state];
  const ariaLabel = `Jarvis orb: ${
    reducedMotion ? motionEntry.reducedMotion.description : motionEntry.description
  }`;

  if (useFallback) {
    // Honest fallback: the legacy renderer, whose reduced-motion path is a
    // deliberately composed static presentation — not a frozen frame and not
    // a pretend-WebGL surface.
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
      data-orb-dormant={dormant}
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
