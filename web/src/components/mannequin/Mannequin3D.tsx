/**
 * Maniquí 3D con su camiseta (Three.js). Se usa en la portada, en el editor avanzado (/customize) y
 * en el editor de zonas del admin. Ver models.ts para las coordenadas.
 *
 * Cada vista (frente, espalda, mangas) lleva una calcomanía proyectada de frente a la cámara que
 * cubre el área de sus zonas. Así, un punto en % del escenario cae exactamente donde se ve en el
 * recuadro cuando el maniquí mira esa vista: el editor 2D puede ir encima.
 */
import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA, MANNEQUIN_COLOR, MODELS_3D, VIEW_ANGLE, VIEWS_3D, type Model3D, type ModelConfig, type View3D } from './models';
import { FULL_FRAME, paintArt, type ArtArea, type MannequinArt } from './art';

export interface Mannequin3DHandle {
  /**
   * Foto del maniquí mirando una vista (PNG con fondo transparente, recortada al escenario). Gira
   * al instante, pinta, toma la foto y vuelve a como estaba.
   */
  capture: (view: View3D, opts?: { type?: string; quality?: number; size?: number }) => string | null;
}

export interface Mannequin3DProps {
  model: Model3D;
  color: string;
  /** Diseños de cada vista. Si cambia el objeto de una vista, esa vista se repinta. */
  art: MannequinArt;
  /** Arte "en vivo" (mientras se arrastra): se lee en cada cuadro; súbele `version` al cambiarlo. */
  artRef?: MutableRefObject<{ version: number; art: MannequinArt }>;
  /** Área del escenario que cubre la textura de cada vista (la caja de sus zonas). */
  frames?: Partial<Record<View3D, ArtArea>>;
  /** Vista que mira la cámara. */
  focus: View3D;
  /** Quieto mirando `focus` (sin balanceo ni arrastre). */
  locked?: boolean;
  /** Vista cuya rasqueta vuelve a pasar cuando cambia `printKey`. */
  animView?: View3D;
  printKey?: number;
  /** Menos movimiento: sin balanceo, el diseño aparece de una. */
  still?: boolean;
  /** Pausa el render cuando no está en pantalla. */
  active?: boolean;
  onReady?: () => void;
  handleRef?: MutableRefObject<Mannequin3DHandle | null>;
}

/** Alto del maniquí en la escena (unidades). */
const HEIGHT = 2.4;
/** Ancho de la textura de cada vista (px). */
const TEX_W = 1024;
const PASS_SECONDS = 1.1;
const HALF_TAN = Math.tan(((CAMERA.fov / 2) * Math.PI) / 180);

/** Medio lado del escenario a una profundidad (distancia del eje hacia la cámara). */
const stageHalf = (depth: number) => HALF_TAN * (CAMERA.distance - depth);

/**
 * Maniquí con su camiseta: geometría centrada y al alto de la escena, sin la base original
 * (piernas o palo: se reemplaza por una base igual para todos los cortes).
 */
function useMannequin(cfg: ModelConfig) {
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
    addSmoothSurface(g);

    // Cuello del maniquí: centro y radio medidos justo encima del cuello de la camiseta.
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
function useGarmentMaterial(box: THREE.Box3, size: THREE.Vector3, cfg: ModelConfig, neck: { cx: number; cz: number; r: number }) {
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
          '#include <common>\nvarying vec3 vObj;\nuniform vec2 uNeckC;\nuniform float uNeckR;\nuniform float uCut;\nuniform float uCollarFront;\nuniform float uCollarBack;\nuniform vec2 uMin;\nuniform vec2 uSize;\nuniform float uHeadFrom;\nuniform float uBodyTop;\nuniform vec3 uShirt;\nuniform vec3 uDummy;',
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec2 muv = (vObj.xy - uMin) / uSize;
          if (muv.y < uCut) discard;
          vec2 d = vObj.xz - uNeckC;
          float rn = length(d);
          float front = clamp(d.y / max(rn, 1e-4) * 0.5 + 0.5, 0.0, 1.0);
          float line = mix(uCollarBack, uCollarFront, front);
          float below = 1.0 - smoothstep(line - 0.002, line + 0.002, muv.y);
          float far = smoothstep(uNeckR * 1.45, uNeckR * 1.7, rn);
          float cloth = max(below, far);
          if (muv.y < uBodyTop) cloth = 1.0;
          if (muv.y > uHeadFrom) cloth = 0.0;
          diffuseColor.rgb = mix(uDummy, uShirt, cloth);`,
        )
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.35, 0.92, cloth);');
    };
    m.userData.uniforms = uniforms;
    return m;
  }, [box, size, cfg, neck]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

/** Hacia dónde mira la cámara, en coordenadas del maniquí, cuando muestra una vista. */
function towardCamera(view: View3D) {
  const t = VIEW_ANGLE[view];
  return { dir: new THREE.Vector3(-Math.sin(t), 0, Math.cos(t)), right: new THREE.Vector3(Math.cos(t), 0, Math.sin(t)) };
}

/**
 * Profundidad de la tela que mira la cámara en cada vista (distancia desde el eje): el pecho, la
 * espalda o la cara de afuera de cada manga. Ahí se apoya el escenario.
 */
function viewDepths(geometry: THREE.BufferGeometry, box: THREE.Box3, size: THREE.Vector3, cfg: ModelConfig): Record<View3D, number> {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const far = Math.max(size.x, size.z) * 2 + 1;
  const chestY = box.min.y + size.y * 0.58;
  const sleeveY = box.min.y + size.y * cfg.sleeveY;
  const depth = (view: View3D, y: number, fallback: number) => {
    const { dir } = towardCamera(view);
    ray.set(new THREE.Vector3(dir.x * far, y, dir.z * far), dir.clone().negate());
    const hit = ray.intersectObject(mesh, false)[0];
    return hit ? hit.point.dot(dir) : fallback;
  };
  // Manga: lo más afuera a esa altura (el rayo por el centro puede pasar por delante o detrás).
  const sleeve = (side: 1 | -1) => {
    const pos = geometry.attributes.position;
    const band = size.y * 0.04;
    let m = 0;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) - sleeveY) < band) m = Math.max(m, pos.getX(i) * side);
    return m;
  };
  return {
    front: depth('front', chestY, box.max.z),
    back: depth('back', chestY, -box.min.z),
    rightSleeve: sleeve(-1),
    leftSleeve: sleeve(1),
  };
}

/**
 * Normales de la tela suavizada (sin las arrugas chicas), en el atributo `aSmoothN`. Solo deciden
 * qué tela mira hacia cada vista: así una arruga chica no corta el estampado y la tela de atrás
 * (otra capa de la manga o del torso) no lo repite. La posición del estampado sale de la tela real
 * (el suavizado desliza los vértices y deformaría la imagen).
 * Suavizado de Taubin (no encoge la malla) sobre los vértices soldados.
 */
function addSmoothSurface(g: THREE.BufferGeometry, passes = 40) {
  const pos = g.attributes.position.array as Float32Array;
  const n = pos.length / 3;
  // Soldar: la malla viene como triángulos sueltos.
  const ids = new Int32Array(n);
  const map = new Map<string, number>();
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`;
    let id = map.get(k);
    if (id === undefined) { id = pts.length / 3; map.set(k, id); pts.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); }
    ids[i] = id;
  }
  const m = pts.length / 3;
  const nbSets: Set<number>[] = Array.from({ length: m }, () => new Set<number>());
  for (let t = 0; t < n; t += 3) {
    const a = ids[t], b = ids[t + 1], c = ids[t + 2];
    nbSets[a].add(b); nbSets[a].add(c); nbSets[b].add(a); nbSets[b].add(c); nbSets[c].add(a); nbSets[c].add(b);
  }
  const nb = nbSets.map((set) => Int32Array.from(set));
  let cur = Float32Array.from(pts);
  let next = new Float32Array(cur.length);
  const step = (k: number) => {
    for (let i = 0; i < m; i++) {
      const list = nb[i];
      if (!list.length) { next[i * 3] = cur[i * 3]; next[i * 3 + 1] = cur[i * 3 + 1]; next[i * 3 + 2] = cur[i * 3 + 2]; continue; }
      let x = 0, y = 0, z = 0;
      for (let j = 0; j < list.length; j++) { const q = list[j] * 3; x += cur[q]; y += cur[q + 1]; z += cur[q + 2]; }
      const inv = 1 / list.length;
      next[i * 3] = cur[i * 3] + k * (x * inv - cur[i * 3]);
      next[i * 3 + 1] = cur[i * 3 + 1] + k * (y * inv - cur[i * 3 + 1]);
      next[i * 3 + 2] = cur[i * 3 + 2] + k * (z * inv - cur[i * 3 + 2]);
    }
    [cur, next] = [next, cur];
  };
  for (let p = 0; p < passes; p++) { step(0.5); step(-0.53); }

  // Normales de la superficie suavizada.
  const nrm = new Float32Array(m * 3);
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let t = 0; t < n; t += 3) {
    const a = ids[t], b = ids[t + 1], c = ids[t + 2];
    va.fromArray(cur, a * 3); vb.fromArray(cur, b * 3); vc.fromArray(cur, c * 3);
    e1.subVectors(vb, va); e2.subVectors(vc, va); e1.cross(e2);
    for (const v of [a, b, c]) { nrm[v * 3] += e1.x; nrm[v * 3 + 1] += e1.y; nrm[v * 3 + 2] += e1.z; }
  }
  const sn = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const id = ids[i] * 3;
    const l = Math.hypot(nrm[id], nrm[id + 1], nrm[id + 2]) || 1;
    sn[i * 3] = nrm[id] / l; sn[i * 3 + 1] = nrm[id + 1] / l; sn[i * 3 + 2] = nrm[id + 2] / l;
  }
  g.setAttribute('aSmoothN', new THREE.BufferAttribute(sn, 3));
}

/** Proyección del escenario de una vista sobre la tela (en coordenadas del maniquí). */
interface Projection {
  dir: THREE.Vector2;
  right: THREE.Vector2;
  /** Centro (x a lo largo de `right`, y) y tamaño del área que cubre la textura. */
  rect: THREE.Vector4;
  /** Distancias desde el eje (hacia la cámara) entre las que se estampa. */
  range: THREE.Vector2;
  aspect: number;
}

/** Cómo cae el área `frame` (en % del escenario) de una vista sobre la tela. */
function projectView(view: View3D, depth: number, frame: ArtArea, geometry: THREE.BufferGeometry): Projection {
  const half = stageHalf(depth);
  const { dir, right } = towardCamera(view);
  const sleeve = view === 'rightSleeve' || view === 'leftSleeve';
  const fx = ((frame.x + frame.w / 2) / 100 - 0.5) * 2 * half;
  const fy = (0.5 - (frame.y + frame.h / 2) / 100) * 2 * half;
  const fw = (frame.w / 100) * 2 * half, fh = (frame.h / 100) * 2 * half;

  // Lo que más sobresale hacia la cámara dentro del área: hasta ahí llega el estampado.
  const pos = geometry.attributes.position;
  let ext = depth;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (Math.abs(y - fy) > fh / 2) continue;
    if (Math.abs(x * right.x + z * right.z - fx) > fw / 2) continue;
    const d = x * dir.x + z * dir.z;
    if (d > ext) ext = d;
  }
  // Frente y espalda: hasta cerca del eje (sin pasar al otro lado). Mangas: solo su mitad de
  // afuera, sin tocar el costado del torso que queda detrás.
  return {
    dir: new THREE.Vector2(dir.x, dir.z),
    right: new THREE.Vector2(right.x, right.z),
    rect: new THREE.Vector4(fx, fy, fw, fh),
    range: new THREE.Vector2(sleeve ? ext - 0.17 : 0.02, ext + 0.05),
    aspect: frame.w / frame.h,
  };
}

const VIEW_IDS: View3D[] = ['front', 'back', 'rightSleeve', 'leftSleeve'];

const PRINT_GLSL = `
varying vec3 vObjP;
varying vec3 vSmN;
uniform sampler2D uMap0;
uniform sampler2D uMap1;
uniform sampler2D uMap2;
uniform sampler2D uMap3;
uniform vec2 uDir[4];
uniform vec2 uRight[4];
uniform vec4 uRect[4];
uniform vec2 uRange[4];
vec4 viewPrint(sampler2D map, vec2 dir, vec2 right, vec4 rect, vec2 range) {
  // La textura se lee SIEMPRE y luego se recorta con máscaras: leerla dentro de un "if" rompe el
  // cálculo del nivel de detalle en los bordes y deja puntos grises (promedio de todo el diseño).
  float d = dot(vObjP.xz, dir);
  vec2 uv = vec2((dot(vObjP.xz, right) - rect.x) / rect.z + 0.5, (vObjP.y - rect.y) / rect.w + 0.5);
  vec4 c = texture2D(map, uv);
  float inside = step(range.x, d) * step(d, range.y) * step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float facing = dot(normalize(vSmN), vec3(dir.x, 0.0, dir.y));
  // Textura premultiplicada (color × alfa): sin bordes oscuros al filtrar junto a lo transparente.
  return c * (inside * smoothstep(0.05, 0.22, facing));
}
// Mezcla "encima" en premultiplicado.
vec4 overPrint(vec4 acc, vec4 c) {
  return c + acc * (1.0 - c.a);
}
`;

const PRINT_APPLY = `
vec4 pr = vec4(0.0);
pr = overPrint(pr, viewPrint(uMap0, uDir[0], uRight[0], uRect[0], uRange[0]));
pr = overPrint(pr, viewPrint(uMap1, uDir[1], uRight[1], uRect[1], uRange[1]));
pr = overPrint(pr, viewPrint(uMap2, uDir[2], uRight[2], uRect[2], uRange[2]));
pr = overPrint(pr, viewPrint(uMap3, uDir[3], uRight[3], uRect[3], uRange[3]));
if (pr.a < 0.004) discard;
diffuseColor = vec4(pr.rgb / pr.a, pr.a);
`;

/**
 * Capa del estampado: la misma malla encima de la tela, con las 4 texturas (una por vista). Cada
 * punto toma el color de su vista según la superficie suavizada: dentro del área, entre `range` y
 * mirando hacia esa vista (si gira demasiado, se desvanece en vez de estirarse).
 */
function makePrintMaterial(textures: Record<View3D, THREE.Texture>) {
  const uniforms = {
    uMap0: { value: textures.front }, uMap1: { value: textures.back }, uMap2: { value: textures.rightSleeve }, uMap3: { value: textures.leftSleeve },
    uDir: { value: VIEW_IDS.map(() => new THREE.Vector2()) },
    uRight: { value: VIEW_IDS.map(() => new THREE.Vector2()) },
    uRect: { value: VIEW_IDS.map(() => new THREE.Vector4(0, 0, 1, 1)) },
    uRange: { value: VIEW_IDS.map(() => new THREE.Vector2(1, 0)) },
  };
  const m = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, depthWrite: false });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aSmoothN;\nvarying vec3 vObjP;\nvarying vec3 vSmN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjP = position;\nvSmN = aSmoothN;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PRINT_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${PRINT_APPLY}`);
  };
  m.userData.uniforms = uniforms;
  m.customProgramCacheKey = () => 'print-layer';
  return m;
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

function Garment({ model, color, art, artRef, frames, focus, locked = false, animView, printKey = 0, still = false, onReady, handleRef }: Omit<Mannequin3DProps, 'active'>) {
  const cfg = MODELS_3D[model];
  const group = useRef<THREE.Group>(null);
  const drag = useRef({ down: false, x: 0, offset: 0 });
  const { gl, scene, camera } = useThree();
  const { geometry, box, size, neck } = useMannequin(cfg);
  const material = useGarmentMaterial(box, size, cfg, neck);
  useEffect(() => { onReady?.(); }, [onReady]);

  useEffect(() => {
    (material.userData.uniforms.uShirt.value as THREE.Color).set(color);
  }, [material, color]);

  const depths = useMemo(() => viewDepths(geometry, box, size, cfg), [geometry, box, size, cfg]);

  // El área de cada vista solo cambia cuando cambian las zonas: se compara por valor.
  const frameKey = VIEWS_3D.map(({ id }) => { const f = frames?.[id] ?? FULL_FRAME; return `${f.x},${f.y},${f.w},${f.h}`; }).join('|');
  const stableFrames = useMemo(() => {
    const out = {} as Record<View3D, ArtArea>;
    for (const { id } of VIEWS_3D) out[id] = frames?.[id] ?? FULL_FRAME;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey]);

  const places = useMemo(() => {
    const out = {} as Record<View3D, Projection>;
    for (const { id } of VIEWS_3D) out[id] = projectView(id, depths[id], stableFrames[id], geometry);
    return out;
  }, [depths, stableFrames, geometry]);

  // Una textura (canvas) por vista.
  const decals = useMemo(() => {
    const out = {} as Record<View3D, { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture }>;
    for (const { id } of VIEWS_3D) {
      const c = document.createElement('canvas');
      c.width = TEX_W;
      c.height = Math.max(8, Math.round(TEX_W / places[id].aspect));
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      // Premultiplicada: el filtrado no oscurece los bordes del diseño (ver PRINT_GLSL).
      t.premultiplyAlpha = true;
      out[id] = { canvas: c, tex: t };
    }
    return out;
  }, [places]);
  useEffect(() => () => { Object.values(decals).forEach((d) => d.tex.dispose()); }, [decals]);

  // Capa del estampado (una sola para las 4 vistas).
  const printMaterial = useMemo(() => {
    const tex = {} as Record<View3D, THREE.Texture>;
    for (const { id } of VIEWS_3D) tex[id] = decals[id].tex;
    return makePrintMaterial(tex);
  }, [decals]);
  useEffect(() => () => printMaterial.dispose(), [printMaterial]);
  useEffect(() => {
    const u = printMaterial.userData.uniforms;
    VIEW_IDS.forEach((id, i) => {
      const pr = places[id];
      u.uDir.value[i].copy(pr.dir);
      u.uRight.value[i].copy(pr.right);
      u.uRect.value[i].copy(pr.rect);
      u.uRange.value[i].copy(pr.range);
    });
  }, [printMaterial, places]);

  const pass = useRef(Object.fromEntries(VIEWS_3D.map(({ id }) => [id, { progress: 1, dirty: true }])) as Record<View3D, { progress: number; dirty: boolean }>);
  const lastArt = useRef<MannequinArt>({});
  const lastVersion = useRef(-1);

  // Cambió el arte de una vista: se repinta (y si es la animada, pasa la rasqueta).
  useEffect(() => {
    for (const { id } of VIEWS_3D) {
      if (art[id] !== lastArt.current[id]) pass.current[id].dirty = true;
    }
    lastArt.current = art;
  }, [art]);
  useEffect(() => {
    for (const { id } of VIEWS_3D) pass.current[id].dirty = true;
  }, [decals]);
  useEffect(() => {
    if (!animView || !printKey) return;
    pass.current[animView].progress = still ? 1 : 0;
    pass.current[animView].dirty = true;
  }, [printKey, animView, still]);

  const currentArt = () => (artRef ? artRef.current.art : art);
  const paint = (id: View3D, progress: number) => {
    paintArt(decals[id].canvas.getContext('2d')!, currentArt()[id], progress, stableFrames[id]);
    decals[id].tex.needsUpdate = true;
  };

  useEffect(() => { drag.current.offset = 0; }, [focus, locked]);

  // Foto de una vista: gira al instante, pinta todo, renderiza y vuelve.
  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      capture: (view, opts) => {
        const g = group.current;
        if (!g) return null;
        const prev = g.rotation.y;
        g.rotation.y = VIEW_ANGLE[view];
        for (const { id } of VIEWS_3D) paint(id, 1);
        gl.render(scene, camera);
        const src = gl.domElement;
        const side = Math.min(src.width, src.height);
        const out = document.createElement('canvas');
        out.width = out.height = opts?.size ?? side;
        out.getContext('2d')!.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, out.width, out.height);
        g.rotation.y = prev;
        return out.toDataURL(opts?.type ?? 'image/png', opts?.quality);
      },
    };
    return () => { handleRef.current = null; };
  });

  useFrame((frame, delta) => {
    const version = artRef?.current.version ?? 0;
    const live = artRef && version !== lastVersion.current;
    lastVersion.current = version;
    for (const { id } of VIEWS_3D) {
      const st = pass.current[id];
      const hasArt = !!currentArt()[id]?.layers.length;
      if (live) st.dirty = true;
      if (st.dirty || (hasArt && st.progress < 1)) {
        if (hasArt && st.progress < 1) st.progress = Math.min(1, st.progress + delta / PASS_SECONDS);
        paint(id, hasArt ? st.progress : 1);
        st.dirty = false;
      }
    }
    const g = group.current;
    if (g) {
      const t = frame.clock.elapsedTime;
      const idle = still || locked || drag.current.down ? 0 : Math.sin(t * 0.45) * 0.3;
      const target = VIEW_ANGLE[focus] + drag.current.offset + idle;
      let diff = target - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, delta * (locked ? 6 : 3.5));
    }
  });

  return (
    <>
      <group
        ref={group}
        rotation-y={VIEW_ANGLE[focus]}
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
        <mesh geometry={geometry} material={material} />
        <mesh geometry={geometry} material={printMaterial} renderOrder={1} />
        <Stand box={box} size={size} hem={cfg.hem} />
      </group>
      <ContactShadows position={[0, box.min.y + 0.001, 0]} opacity={0.35} scale={3} blur={2.6} far={1.2} resolution={512} />
    </>
  );
}

useGLTF.preload(MODELS_3D.basica.model);
useGLTF.preload(MODELS_3D.oversize.model);

/** Escena del maniquí. Va en un recuadro cuadrado: el escenario de cada vista es ese cuadrado. */
export default function Mannequin3D({ active = true, ...props }: Mannequin3DProps) {
  const [ready, setReady] = useState(false);
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 2]}
      camera={{ position: [0, 0, CAMERA.distance], fov: CAMERA.fov }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onCreated={() => setReady(true)}
      style={{ touchAction: props.locked ? 'auto' : 'pan-y', cursor: props.locked ? 'default' : 'grab', opacity: ready ? 1 : 0, transition: 'opacity .4s' }}
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
        <Garment key={props.model} {...props} />
      </Suspense>
    </Canvas>
  );
}

