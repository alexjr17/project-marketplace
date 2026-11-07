import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Decal, Environment, Lightformer, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { PrintSource } from './printTexture';
import { DEFAULT_LAYOUT, FITS, MANNEQUIN_COLOR, ZONES, type Fit, type FitModel, type PrintLayout, type Zone } from './shirtConfig';

export type Prints = Partial<Record<Zone, PrintSource | null>>;

interface Shirt3DProps {
  fit: Fit;
  color: string;
  /** Diseño de cada zona (frente, espalda, mangas). */
  prints: Prints;
  /** Posición y tamaño del diseño de cada zona (dentro de sus límites). */
  layouts: Partial<Record<Zone, PrintLayout>>;
  /** Posición en vivo mientras se arrastra (se lee en cada cuadro, sin re-render). */
  layoutRef?: { current: Partial<Record<Zone, PrintLayout>> };
  /** Modo mover diseño: la prenda queda quieta mirando la zona elegida. */
  locked?: boolean;
  /** Zona elegida: la prenda gira para mostrarla. */
  focus: Zone;
  /** Zona cuya rasqueta vuelve a pasar cuando cambia `printKey`. */
  animZone: Zone;
  /** Cambia para volver a pasar la rasqueta (nuevo diseño, color o corte). */
  printKey: number;
  /** Menos movimiento: sin balanceo, el diseño aparece de una. */
  still: boolean;
  /** Pausa el render cuando la prenda no está en pantalla. */
  active: boolean;
  /** Avisa cuando el modelo ya cargó (para quitar la foto fija). */
  onReady?: () => void;
}

/** Alto del maniquí en la escena (unidades). */
const HEIGHT = 2.4;
const TEX_W = 800;
const PASS_SECONDS = 1.1;

/** Avisa a Three.js que algo cambió (se sube de nuevo a la GPU). */
function touch(obj: { needsUpdate: boolean }) {
  obj.needsUpdate = true;
}

const sizeOf = (s: PrintSource) =>
  s instanceof HTMLImageElement ? { w: s.naturalWidth, h: s.naturalHeight } : { w: s.width, h: s.height };

/**
 * Pinta el diseño (completo, sin recortar) en la textura de la calcomanía, con su tamaño y posición
 * dentro de la zona, hasta donde va la rasqueta. El lienzo ES la zona: el diseño no puede salir.
 */
function paintPrint(ctx: CanvasRenderingContext2D, print: PrintSource | null, progress: number, layout: PrintLayout) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!print || progress <= 0) return;
  const { w, h } = sizeOf(print);
  if (!w || !h) return;
  const s = Math.min(W / w, H / h) * layout.scale;
  const dw = w * s, dh = h * s;
  const dx = ((W - dw) / 2) * (1 + layout.x);
  const dy = ((H - dh) / 2) * (1 + layout.y);
  const edge = dx + dw * Math.min(1, progress);
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, edge - dx, dh);
  ctx.clip();
  ctx.drawImage(print, dx, dy, dw, dh);
  ctx.restore();
  if (progress < 1) {
    ctx.fillStyle = 'rgba(20,20,24,0.55)';
    ctx.fillRect(edge - 6, dy, 12, dh);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(edge - 6, dy, 4, dh);
  }
}

/**
 * Maniquí con su camiseta: geometría centrada y al alto de la escena, sin la base original
 * (piernas o palo: se reemplaza por una base igual para todos los cortes), y un material que
 * pinta cada píxel como tela o maniquí según la máscara proyectada de frente.
 */
function useMannequin(cfg: FitModel) {
  const { scene } = useGLTF(cfg.model);

  return useMemo(() => {
    let src: THREE.BufferGeometry | null = null;
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !src) src = m.geometry.clone().applyMatrix4(m.matrixWorld);
    });
    let g = (src as unknown as THREE.BufferGeometry).toNonIndexed();
    g.computeBoundingBox();
    const size0 = g.boundingBox!.getSize(new THREE.Vector3());
    const center0 = g.boundingBox!.getCenter(new THREE.Vector3());
    g.translate(-center0.x, -center0.y, -center0.z);
    g.scale(HEIGHT / size0.y, HEIGHT / size0.y, HEIGHT / size0.y);
    g.computeBoundingBox();
    const box = g.boundingBox!.clone();
    const size = box.getSize(new THREE.Vector3());

    // Parte baja: la camiseta es la capa de afuera; piernas o palo quedan cerca del eje. Se quita
    // lo de adentro (cerca del eje, en una elipse del tamaño del ruedo) y va la base común.
    const pos = g.attributes.position;
    const lowTop = cfg.hem + 0.12;
    let ax = 0, az = 0;
    for (let i = 0; i < pos.count; i++) {
      const fy = (pos.getY(i) - box.min.y) / size.y;
      if (fy > cfg.hem && fy < cfg.hem + 0.15) { ax = Math.max(ax, Math.abs(pos.getX(i))); az = Math.max(az, Math.abs(pos.getZ(i))); }
    }
    // Radio estrecho: solo el palo o el centro de las piernas, nunca un pliegue de la tela.
    const inner = (i: number) => Math.hypot(pos.getX(i) / (ax || 1), pos.getZ(i) / (az || 1)) < 0.35;
    const keep: number[] = [];
    for (let t = 0; t < pos.count; t += 3) {
      let drop = true;
      for (let k = 0; k < 3 && drop; k++) {
        const i = t + k;
        const fy = (pos.getY(i) - box.min.y) / size.y;
        if (fy > lowTop || !inner(i)) drop = false;
      }
      if (!drop) keep.push(t);
    }
    const out = new Float32Array(keep.length * 9);
    keep.forEach((t, j) => {
      for (let k = 0; k < 3; k++) out.set([pos.getX(t + k), pos.getY(t + k), pos.getZ(t + k)], j * 9 + k * 3);
    });
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(out, 3));
    g.computeVertexNormals();
    g.boundingBox = box;

    // Cuello del maniquí: centro y radio medidos justo encima del cuello de la camiseta. En la zona
    // del cuello, lo que esté más afuera que ese radio es el resorte de la camiseta (tela).
    const ring: { x: number; z: number }[] = [];
    for (let i = 0; i < out.length; i += 3) {
      const fy = (out[i + 1] - box.min.y) / size.y;
      if (fy > cfg.headFrom && fy < cfg.headFrom + 0.02) ring.push({ x: out[i], z: out[i + 2] });
    }
    const cx = ring.reduce((a, p) => a + p.x, 0) / (ring.length || 1);
    const cz = ring.reduce((a, p) => a + p.z, 0) / (ring.length || 1);
    const radii = ring.map((p) => Math.hypot(p.x - cx, p.z - cz)).sort((a, b) => a - b);
    const neckR = radii[Math.floor(radii.length * 0.5)] || size.y * 0.04;

    return { geometry: g, box, size, neck: { cx, cz, r: neckR } };
  }, [scene, cfg.hem, cfg.headFrom]);
}

/**
 * Material: tela mate del color elegido o maniquí satinado (por píxel). Cabeza: maniquí. Cuello:
 * maniquí cerca del eje del cuello, tela (el resorte) más afuera. Debajo del cuello: tela.
 */
function useGarmentMaterial(box: THREE.Box3, size: THREE.Vector3, cfg: FitModel, neck: { cx: number; cz: number; r: number }) {
  const material = useMemo(() => {
    const uniforms = {
      uNeckC: { value: new THREE.Vector2(neck.cx, neck.cz) },
      uNeckR: { value: neck.r },
      uCollarFront: { value: cfg.collarFront },
      uCut: { value: cfg.cut },
      uCollarBack: { value: cfg.collarBack },
      uMin: { value: new THREE.Vector2(box.min.x, box.min.y) },
      uSize: { value: new THREE.Vector2(size.x, size.y) },
      uHeadFrom: { value: cfg.headFrom },
      uBodyTop: { value: cfg.bodyTop },
      uHem: { value: cfg.hem },
      uShirt: { value: new THREE.Color('#ffffff') },
      uDummy: { value: new THREE.Color(MANNEQUIN_COLOR) },
    };
    const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vObj;\nuniform vec2 uNeckC;\nuniform float uNeckR;\nuniform float uCut;\nuniform float uCollarFront;\nuniform float uCollarBack;\nuniform vec2 uMin;\nuniform vec2 uSize;\nuniform float uHeadFrom;\nuniform float uBodyTop;\nuniform float uHem;\nuniform vec3 uShirt;\nuniform vec3 uDummy;',
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec2 muv = (vObj.xy - uMin) / uSize;
          // Corte limpio bajo el ruedo (piernas del modelo original).
          if (muv.y < uCut) discard;
          vec2 d = vObj.xz - uNeckC;
          float rn = length(d);
          // 1 adelante, 0 atrás: el escote baja hacia adelante.
          float front = clamp(d.y / max(rn, 1e-4) * 0.5 + 0.5, 0.0, 1.0);
          float line = mix(uCollarBack, uCollarFront, front);
          float below = 1.0 - smoothstep(line - 0.002, line + 0.002, muv.y);
          // Hombros y lo que queda lejos del cuello: tela.
          float far = smoothstep(uNeckR * 1.45, uNeckR * 1.7, rn);
          float cloth = max(below, far);
          // Debajo del cuello todo es tela (piernas y palo originales ya se quitaron).
          if (muv.y < uBodyTop) cloth = 1.0;
          if (muv.y > uHeadFrom) cloth = 0.0;
          diffuseColor.rgb = mix(uDummy, uShirt, cloth);`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.35, 0.92, cloth);',
        );
    };
    m.userData.uniforms = uniforms;
    return m;
  }, [box, size, cfg, neck]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

/** Primer punto de la prenda que encuentra un rayo (para apoyar cada estampado en la tela). */
function hitPoint(geometry: THREE.BufferGeometry, origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 | null {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const hit = new THREE.Raycaster(origin, dir).intersectObject(mesh, false)[0];
  return hit ? hit.point : null;
}

/**
 * Estampado de manga: se apoya en la cara de afuera de la manga. Busca el centro de la manga a esa
 * altura (los puntos más alejados del torso), lanza un rayo hacia él desde afuera y orienta la
 * calcomanía con la normal de la tela en ese punto, con la imagen derecha (arriba = arriba).
 */
function sleevePlacement(geometry: THREE.BufferGeometry, box: THREE.Box3, size: THREE.Vector3, y: number, side: 1 | -1, sl: number) {
  const pos = geometry.attributes.position;
  const band = size.y * 0.05;
  let maxX = 0;
  for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) - y) < band && pos.getX(i) * side > maxX) maxX = pos.getX(i) * side;
  // Manga: lo que está en el 35 % más externo a esa altura.
  const c = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * side;
    if (Math.abs(pos.getY(i) - y) < band && x > maxX * 0.65) { c.x += pos.getX(i); c.y += pos.getY(i); c.z += pos.getZ(i); n++; }
  }
  if (n) c.divideScalar(n); else c.set(side * maxX, y, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const origin = new THREE.Vector3(side * (Math.abs(box.max.x) + Math.abs(box.min.x) + 1), c.y, c.z);
  const hit = new THREE.Raycaster(origin, new THREE.Vector3(-side, 0, 0)).intersectObject(mesh, false)[0];
  const point = hit ? hit.point : new THREE.Vector3(side * maxX, c.y, c.z);
  // Normal de la tela (hacia afuera), suavizada hacia el lado para que no quede de frente o de espalda.
  const normal = (hit?.face?.normal.clone() ?? new THREE.Vector3(side, 0, 0));
  if (normal.x * side < 0) normal.negate();
  normal.lerp(new THREE.Vector3(side, 0, 0), 0.35).normalize();
  // Orientación: z de la calcomanía = normal; y de la calcomanía = arriba del mundo proyectado.
  const up = new THREE.Vector3(0, 1, 0).projectOnPlane(normal).normalize();
  const xAxis = new THREE.Vector3().crossVectors(up, normal).normalize();
  const m = new THREE.Matrix4().makeBasis(xAxis, up, normal);
  const e = new THREE.Euler().setFromRotationMatrix(m);
  return {
    position: [point.x, point.y, point.z] as [number, number, number],
    rotation: [e.x, e.y, e.z] as [number, number, number],
    // Profundidad corta: se apoya en la cara de afuera sin envolver todo el tubo.
    scale: [sl, sl, sl * 1.3] as [number, number, number],
    aspect: 1,
  };
}

/** Giro de la prenda para mostrar cada zona de frente a la cámara. */
const FOCUS_ANGLE: Record<Zone, number> = { front: 0, back: Math.PI, rightSleeve: Math.PI / 2, leftSleeve: -Math.PI / 2 };

interface ZonePlacement {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  /** Proporción ancho / alto de la textura. */
  aspect: number;
}

/** Dónde va cada estampado: frente y espalda en el pecho; mangas en su cara de afuera. */
function placeZones(geometry: THREE.BufferGeometry, box: THREE.Box3, size: THREE.Vector3, cfg: FitModel): Record<Zone, ZonePlacement> {
  const h = size.y;
  const thick = box.max.z - box.min.z;
  const chestY = box.min.y + h * cfg.print.centerY;
  const backY = box.min.y + h * (cfg.print.centerY + 0.03);
  const sleeveY = box.min.y + h * cfg.sleeve.centerY;
  const front = hitPoint(geometry, new THREE.Vector3(0, chestY, box.max.z + 1), new THREE.Vector3(0, 0, -1));
  const back = hitPoint(geometry, new THREE.Vector3(0, backY, box.min.z - 1), new THREE.Vector3(0, 0, 1));
  const pw = h * cfg.print.w, ph = h * cfg.print.h, sl = h * cfg.sleeve.size;
  // Profundidad: alcanza la curva de la tela sin llegar al otro lado.
  return {
    front: { position: [0, chestY, front?.z ?? box.max.z], rotation: [0, 0, 0], scale: [pw, ph, thick * 0.8], aspect: pw / ph },
    back: { position: [0, backY, back?.z ?? box.min.z], rotation: [0, Math.PI, 0], scale: [pw, ph, thick * 0.8], aspect: pw / ph },
    rightSleeve: sleevePlacement(geometry, box, size, sleeveY, -1, sl),
    leftSleeve: sleevePlacement(geometry, box, size, sleeveY, 1, sl),
  };
}

/** Base igual para todos los cortes: palo y disco, satinados como el maniquí. */
function Stand({ box, size, hem }: { box: THREE.Box3; size: THREE.Vector3; hem: number }) {
  const top = box.min.y + size.y * (hem + 0.08);
  const bottom = box.min.y;
  const poleH = top - bottom;
  return (
    <group>
      <mesh position={[0, bottom + poleH / 2, 0]}>
        <cylinderGeometry args={[0.035, 0.035, poleH, 24]} />
        <meshStandardMaterial color={MANNEQUIN_COLOR} roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[0, bottom + 0.02, 0]}>
        <cylinderGeometry args={[0.32, 0.34, 0.04, 48]} />
        <meshStandardMaterial color={MANNEQUIN_COLOR} roughness={0.35} metalness={0.15} />
      </mesh>
    </group>
  );
}

function Garment({ fit, color, prints, layouts, layoutRef, locked = false, focus, animZone, printKey, still, onReady }: Omit<Shirt3DProps, 'active'>) {
  const cfg = FITS[fit];
  const group = useRef<THREE.Group>(null);
  const drag = useRef({ down: false, x: 0, offset: 0 });
  const { geometry, box, size, neck } = useMannequin(cfg);
  const material = useGarmentMaterial(box, size, cfg, neck);
  useEffect(() => { onReady?.(); }, [onReady]);

  useEffect(() => {
    (material.userData.uniforms.uShirt.value as THREE.Color).set(color);
  }, [material, color]);

  const places = useMemo(() => placeZones(geometry, box, size, cfg), [geometry, box, size, cfg]);

  // Una textura por zona (canvas). El avance de la rasqueta de cada zona va aparte, en una ref.
  const decals = useMemo(() => {
    const out = {} as Record<Zone, { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture }>;
    for (const { id } of ZONES) {
      const c = document.createElement('canvas');
      c.width = TEX_W;
      c.height = Math.round(TEX_W / places[id].aspect);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      out[id] = { canvas: c, tex: t };
    }
    return out;
  }, [places]);
  useEffect(() => () => { Object.values(decals).forEach((d) => d.tex.dispose()); }, [decals]);

  const pass = useRef(Object.fromEntries(ZONES.map(({ id }) => [id, { progress: 1, dirty: true }])) as Record<Zone, { progress: number; dirty: boolean }>);

  // Cambia un diseño: esa zona pasa la rasqueta; las demás se repintan completas.
  useEffect(() => {
    for (const { id } of ZONES) {
      pass.current[id].dirty = true;
      if (id === animZone) pass.current[id].progress = still ? 1 : 0;
    }
  }, [printKey, prints, still, decals, animZone]);

  // Posición que se muestra de cada zona: sigue a la elegida con un suavizado corto.
  const shown = useRef(Object.fromEntries(ZONES.map(({ id }) => [id, { ...DEFAULT_LAYOUT }])) as Record<Zone, PrintLayout>);

  // Al elegir zona, la prenda gira para mostrarla (el arrastre se suma encima).
  useEffect(() => { drag.current.offset = 0; }, [focus, locked]);

  useFrame((frame, delta) => {
    const ease = 1 - Math.exp(-delta * 22);
    for (const { id } of ZONES) {
      const st = pass.current[id];
      const p = prints[id] ?? null;
      const target = layoutRef?.current[id] ?? layouts[id] ?? DEFAULT_LAYOUT;
      const sh = shown.current[id];
      const gap = Math.abs(target.x - sh.x) + Math.abs(target.y - sh.y) + Math.abs(target.scale - sh.scale);
      if (gap > 0.0005) {
        sh.x += (target.x - sh.x) * ease;
        sh.y += (target.y - sh.y) * ease;
        sh.scale += (target.scale - sh.scale) * ease;
        st.dirty = true;
      }
      if (st.dirty || (p && st.progress < 1)) {
        if (p && st.progress < 1) st.progress = Math.min(1, st.progress + delta / PASS_SECONDS);
        paintPrint(decals[id].canvas.getContext('2d')!, p, p ? st.progress : 0, sh);
        touch(decals[id].tex);
        st.dirty = false;
      }
    }
    const g = group.current;
    if (g) {
      const t = frame.clock.elapsedTime;
      const idle = still || locked || drag.current.down ? 0 : Math.sin(t * 0.45) * 0.3;
      const target = FOCUS_ANGLE[focus] + drag.current.offset + idle;
      // Gira por el camino corto.
      let diff = target - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, delta * 3.5);
    }
  });

  return (
    <>
      <group
        ref={group}
        onPointerDown={(e) => {
          if (locked) return;
          e.stopPropagation();
          (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
          drag.current.down = true;
          drag.current.x = e.clientX;
        }}
        onPointerMove={(e) => {
          if (!drag.current.down) return;
          drag.current.offset += (e.clientX - drag.current.x) * 0.012;
          drag.current.x = e.clientX;
        }}
        onPointerUp={() => { drag.current.down = false; }}
        onPointerLeave={() => { drag.current.down = false; }}
      >
        <mesh geometry={geometry} material={material}>
          {ZONES.map(({ id }) => (
            <Decal key={id} position={places[id].position} rotation={places[id].rotation} scale={places[id].scale}>
              <meshStandardMaterial map={decals[id].tex} transparent roughness={0.95} polygonOffset polygonOffsetFactor={-10} depthWrite={false} />
            </Decal>
          ))}
        </mesh>
        <Stand box={box} size={size} hem={cfg.hem} />
      </group>
      <ContactShadows position={[0, box.min.y + 0.001, 0]} opacity={0.35} scale={3} blur={2.6} far={1.2} resolution={512} />
    </>
  );
}

useGLTF.preload(FITS.basica.model);
useGLTF.preload(FITS.oversize.model);

/** Escena del maniquí con la camiseta (Three.js). Se carga aparte; ver shirtConfig.ts. */
export default function Shirt3D({ active, ...props }: Shirt3DProps) {
  const [ready, setReady] = useState(false);
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 2]}
      camera={{ position: [0, 0.15, 4.3], fov: 35 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onCreated={() => setReady(true)}
      style={{ touchAction: 'pan-y', cursor: 'grab', opacity: ready ? 1 : 0, transition: 'opacity .4s' }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[2.5, 4, 3.5]} intensity={1.6} />
      {/* Luz de estudio armada en la escena (sin descargar mapas de entorno). */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.2} position={[0, 2.5, 3]} scale={[4, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-3, 1, 1]} rotation-y={Math.PI / 2} scale={[3, 2, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[3, 1, -1]} rotation-y={-Math.PI / 2} scale={[3, 2, 1]} />
        <Lightformer form="rect" intensity={0.6} position={[0, -2, 2]} rotation-x={-Math.PI / 2} scale={[4, 4, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <Garment key={props.fit} {...props} />
      </Suspense>
    </Canvas>
  );
}
