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
    const collar = cfg.collarFromMesh ? measureCollar(out, box, size, cfg, cx, cz) : null;

    return { geometry: g, box, size, neck: { cx, cz, r: neckR }, collar };
  }, [scene, cfg]);
}

/** Direcciones alrededor del cuello en las que se mide el escote (cada 15°). */
const COLLAR_BINS = 24;

/**
 * Escote medido en la malla: donde el resorte del suéter se junta con el cuello del maniquí la
 * superficie hace una canaleta (unión cóncava). Para cada dirección alrededor del cuello toma la
 * altura de la canaleta más marcada. Donde no hay canaleta clara (atrás el cuello baja liso) usa
 * las alturas del modelo: costados `collarSide` y espalda `collarBack`, y rellena entre medidas.
 * Devuelve la altura (fracción del alto) por dirección; dirección 0 = atrás (-180°), sube hacia +x.
 */
function measureCollar(pos: Float32Array, box: THREE.Box3, size: THREE.Vector3, cfg: ModelConfig, cx: number, cz: number): Float32Array {
  const n = pos.length / 3;
  // Soldar (triángulos sueltos → vértices compartidos).
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
  const nrm = new Float32Array(m * 3), sum = new Float32Array(m * 3), cnt = new Float32Array(m);
  for (let t = 0; t < n; t += 3) {
    const a = ids[t], b = ids[t + 1], c = ids[t + 2];
    const ux = pts[b * 3] - pts[a * 3], uy = pts[b * 3 + 1] - pts[a * 3 + 1], uz = pts[b * 3 + 2] - pts[a * 3 + 2];
    const vx = pts[c * 3] - pts[a * 3], vy = pts[c * 3 + 1] - pts[a * 3 + 1], vz = pts[c * 3 + 2] - pts[a * 3 + 2];
    const fx = uy * vz - uz * vy, fyN = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { nrm[v * 3] += fx; nrm[v * 3 + 1] += fyN; nrm[v * 3 + 2] += fz; }
    // Vecinos (cada arista dos veces: suma uniforme).
    for (const [p, q] of [[a, b], [b, c], [c, a], [b, a], [c, b], [a, c]]) {
      sum[p * 3] += pts[q * 3]; sum[p * 3 + 1] += pts[q * 3 + 1]; sum[p * 3 + 2] += pts[q * 3 + 2]; cnt[p]++;
    }
  }
  // Concavidad: el promedio de los vecinos queda "afuera" (sobre la normal) en un valle.
  const conc = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1;
    const k = cnt[i] || 1;
    conc[i] = ((sum[i * 3] / k - pts[i * 3]) * nrm[i * 3] + (sum[i * 3 + 1] / k - pts[i * 3 + 1]) * nrm[i * 3 + 1] + (sum[i * 3 + 2] / k - pts[i * 3 + 2]) * nrm[i * 3 + 2]) / l;
  }
  // Las 3 más marcadas de cada dirección, entre el pecho y la cabeza, cerca del cuello.
  const top: Array<Array<{ c: number; fy: number }>> = Array.from({ length: COLLAR_BINS }, () => []);
  for (let i = 0; i < m; i++) {
    const fy = (pts[i * 3 + 1] - box.min.y) / size.y;
    if (fy < cfg.bodyTop + 0.03 || fy > cfg.headFrom + 0.02) continue;
    const dx = pts[i * 3] - cx, dz = pts[i * 3 + 2] - cz;
    if (Math.hypot(dx, dz) > size.y * 0.19) continue;
    const b = Math.min(COLLAR_BINS - 1, Math.floor(((Math.atan2(dx, dz) + Math.PI) / (Math.PI * 2)) * COLLAR_BINS));
    const list = top[b];
    list.push({ c: conc[i], fy });
    list.sort((p, q) => q.c - p.c);
    if (list.length > 3) list.pop();
  }
  const strength = top.map((l) => (l.length ? l.reduce((s, p) => s + p.c, 0) / l.length : 0));
  const maxS = Math.max(...strength);
  // Anclas: las direcciones con canaleta clara y, fijas, los costados y la espalda del modelo.
  const anchors: Array<{ b: number; h: number }> = [];
  top.forEach((l, b) => { if (l.length && strength[b] > maxS * 0.45) anchors.push({ b, h: l.reduce((s, p) => s + p.fy, 0) / l.length }); });
  const side = cfg.collarSide ?? cfg.collarBack;
  const binOf = (deg: number) => ((deg + 180) / 360) * COLLAR_BINS - 0.5;
  for (const [deg, h] of [[-180, cfg.collarBack], [-90, side], [90, side]] as const) {
    const b = binOf(deg);
    if (!anchors.some((a) => Math.abs(a.b - b) < 1.5)) anchors.push({ b, h });
  }
  anchors.sort((p, q) => p.b - q.b);
  // Relleno circular lineal entre anclas.
  const out = new Float32Array(COLLAR_BINS);
  for (let b = 0; b < COLLAR_BINS; b++) {
    let prev = anchors[anchors.length - 1], next = anchors[0];
    for (let k = 0; k < anchors.length; k++) {
      if (anchors[k].b <= b) prev = anchors[k];
      if (anchors[k].b >= b) { next = anchors[k]; break; }
    }
    const pb = prev.b > b ? prev.b - COLLAR_BINS : prev.b;
    const nb = next.b < b ? next.b + COLLAR_BINS : next.b;
    out[b] = nb === pb ? prev.h : prev.h + ((b - pb) / (nb - pb)) * (next.h - prev.h);
  }
  // Curva suave (sin esquinas entre direcciones): dos pasadas de promedio circular 1-2-1.
  for (let pass = 0; pass < 2; pass++) {
    const prev = Float32Array.from(out);
    for (let b = 0; b < COLLAR_BINS; b++) {
      out[b] = (prev[(b + COLLAR_BINS - 1) % COLLAR_BINS] + 2 * prev[b] + prev[(b + 1) % COLLAR_BINS]) / 4;
    }
  }
  return out;
}

/**
 * Material: tela mate del color elegido o maniquí satinado (por píxel). Cabeza: maniquí. Cuello:
 * maniquí cerca del eje del cuello, tela (el resorte) más afuera. Debajo del cuello: tela.
 */
function useGarmentMaterial(box: THREE.Box3, size: THREE.Vector3, cfg: ModelConfig, neck: { cx: number; cz: number; r: number }, collar: Float32Array | null) {
  const material = useMemo(() => {
    const uniforms = {
      uNeckC: { value: new THREE.Vector2(neck.cx, neck.cz) },
      uNeckR: { value: neck.r },
      uCollarFront: { value: cfg.collarFront },
      uCut: { value: cfg.cut },
      uCollarBack: { value: cfg.collarBack },
      uCollarCurve: { value: cfg.collarCurve },
      uCollarSide: { value: cfg.collarSide ?? 0 },
      uCollarMesh: { value: collar ? 1 : 0 },
      uCollarH: { value: Array.from(collar ?? new Float32Array(COLLAR_BINS)) },
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
          '#include <common>\nvarying vec3 vObj;\nuniform vec2 uNeckC;\nuniform float uNeckR;\nuniform float uCut;\nuniform float uCollarFront;\nuniform float uCollarBack;\nuniform float uCollarCurve;\nuniform float uCollarSide;\nuniform float uCollarMesh;\nuniform float uCollarH[24];\nuniform vec2 uMin;\nuniform vec2 uSize;\nuniform float uHeadFrom;\nuniform float uBodyTop;\nuniform vec3 uShirt;\nuniform vec3 uDummy;',
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec2 muv = (vObj.xy - uMin) / uSize;
          if (muv.y < uCut) discard;
          vec2 d = vObj.xz - uNeckC;
          float rn = length(d);
          // Escote de cuello redondo: de la espalda al frente con la curva de cada talla.
          float front = clamp(d.y / max(rn, 1e-4) * 0.5 + 0.5, 0.0, 1.0);
          // Con altura propia de los costados (uCollarSide > 0): espalda → costado → frente.
          float line = uCollarSide > 0.0
            ? (front < 0.5 ? mix(uCollarBack, uCollarSide, front * 2.0) : mix(uCollarSide, uCollarFront, front * 2.0 - 1.0))
            : mix(uCollarBack, uCollarFront, pow(front, uCollarCurve));
          // Escote medido en la malla (ver measureCollar): altura por dirección, interpolada.
          if (uCollarMesh > 0.5) {
            float t = (atan(d.x, d.y) + PI) / (2.0 * PI) * 24.0 - 0.5;
            float fi = floor(t);
            int i0 = int(mod(fi, 24.0));
            int i1 = int(mod(fi + 1.0, 24.0));
            line = mix(uCollarH[i0], uCollarH[i1], t - fi);
          }
          // Borde nítido: la transición dura un píxel (sin franja gris entre tela y maniquí).
          float aa = max(fwidth(muv.y), 1e-5);
          float below = 1.0 - smoothstep(line - aa, line + aa, muv.y);
          // Lejos del cuello (los hombros) siempre es tela.
          float far = smoothstep(uNeckR * 2.3, uNeckR * 2.5, rn);
          float cloth = max(below, far);
          if (muv.y < uBodyTop) cloth = 1.0;
          if (muv.y > uHeadFrom) cloth = 0.0;
          diffuseColor.rgb = mix(uDummy, uShirt, cloth);`,
        )
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.5, 0.92, cloth);');
    };
    m.userData.uniforms = uniforms;
    return m;
  }, [box, size, cfg, neck, collar]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

type Angles = Record<View3D, number>;

/** Hacia dónde mira la cámara, en coordenadas del maniquí, con el maniquí girado `t`. */
function towardCamera(t: number) {
  return { dir: new THREE.Vector3(-Math.sin(t), 0, Math.cos(t)), right: new THREE.Vector3(Math.cos(t), 0, Math.sin(t)) };
}

/**
 * Profundidad de la tela que mira la cámara en cada vista (distancia desde el eje): el pecho, la
 * espalda o la cara de afuera de cada manga. Ahí se apoya el escenario.
 */
/**
 * Giro del maniquí para cada vista. Frente y espalda, fijos; cada manga se mira de frente a su cara
 * de afuera (en la oversize la manga cae un poco hacia adelante o atrás): promedio de la normal
 * suavizada de la manga a la altura del estampado, sin pasar de ±35° del costado.
 */
function viewAngles(geometry: THREE.BufferGeometry, box: THREE.Box3, size: THREE.Vector3, cfg: ModelConfig): Angles {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.aSmoothN;
  const sleeveY = box.min.y + size.y * cfg.sleeveY;
  const band = size.y * 0.05;
  const sleeve = (side: 1 | -1) => {
    const base = VIEW_ANGLE[side === -1 ? 'rightSleeve' : 'leftSleeve'];
    let maxX = 0;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) - sleeveY) < band) maxX = Math.max(maxX, pos.getX(i) * side);
    let nx = 0, nz = 0;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - sleeveY) > band || pos.getX(i) * side < maxX * 0.8) continue;
      nx += nrm.getX(i); nz += nrm.getZ(i);
    }
    if (!nx && !nz) return base;
    let diff = Math.atan2(-nx, nz) - base;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    return base + Math.max(-0.6, Math.min(0.6, diff));
  };
  return { front: VIEW_ANGLE.front, back: VIEW_ANGLE.back, rightSleeve: sleeve(-1), leftSleeve: sleeve(1) };
}

function viewDepths(geometry: THREE.BufferGeometry, box: THREE.Box3, size: THREE.Vector3, cfg: ModelConfig, angles: Angles): Record<View3D, number> {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const far = Math.max(size.x, size.z) * 2 + 1;
  const chestY = box.min.y + size.y * 0.58;
  const sleeveY = box.min.y + size.y * cfg.sleeveY;
  const depth = (view: View3D, y: number, fallback: number) => {
    const { dir } = towardCamera(angles[view]);
    ray.set(new THREE.Vector3(dir.x * far, y, dir.z * far), dir.clone().negate());
    const hit = ray.intersectObject(mesh, false)[0];
    return hit ? hit.point.dot(dir) : fallback;
  };
  // Manga: lo más afuera a esa altura, en la dirección de su vista (el rayo por el centro puede
  // pasar por delante o detrás).
  const sleeve = (view: View3D) => {
    const pos = geometry.attributes.position;
    const { dir } = towardCamera(angles[view]);
    const band = size.y * 0.04;
    let m = 0;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) - sleeveY) < band) m = Math.max(m, pos.getX(i) * dir.x + pos.getZ(i) * dir.z);
    return m;
  };
  return {
    front: depth('front', chestY, box.max.z),
    back: depth('back', chestY, -box.min.z),
    rightSleeve: sleeve('rightSleeve'),
    leftSleeve: sleeve('leftSleeve'),
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
  // Punto de cada vértice "aplanado" hacia la tela lisa SOLO a lo largo de la normal suavizada (sin
  // el deslizamiento de lado del suavizado): en un pliegue, las laderas caen sobre la tela lisa y el
  // estampado se ve plegado (comprimido) como en tela real, en vez de estirado.
  const sn = new Float32Array(n * 3), sp = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const id = ids[i] * 3;
    const l = Math.hypot(nrm[id], nrm[id + 1], nrm[id + 2]) || 1;
    const nx = nrm[id] / l, ny = nrm[id + 1] / l, nz = nrm[id + 2] / l;
    sn[i * 3] = nx; sn[i * 3 + 1] = ny; sn[i * 3 + 2] = nz;
    const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
    const h = (cur[id] - px) * nx + (cur[id + 1] - py) * ny + (cur[id + 2] - pz) * nz;
    sp[i * 3] = px + nx * h; sp[i * 3 + 1] = py + ny * h; sp[i * 3 + 2] = pz + nz * h;
  }
  g.setAttribute('aSmoothN', new THREE.BufferAttribute(sn, 3));
  g.setAttribute('aFlat', new THREE.BufferAttribute(sp, 3));
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
function projectView(view: View3D, angle: number, depth: number, frame: ArtArea, geometry: THREE.BufferGeometry): Projection {
  const half = stageHalf(depth);
  const { dir, right } = towardCamera(angle);
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
varying vec3 vFlat;
varying vec3 vSmN;
uniform sampler2D uMap0;
uniform sampler2D uMap1;
uniform sampler2D uMap2;
uniform sampler2D uMap3;
uniform vec2 uDir[4];
uniform vec2 uRight[4];
uniform vec4 uRect[4];
uniform vec2 uRange[4];
// face: de qué inclinación a cuál se desvanece (más estricto en las mangas: solo su cara de afuera).
vec4 viewPrint(sampler2D map, vec2 dir, vec2 right, vec4 rect, vec2 range, vec2 face) {
  // La textura se lee SIEMPRE y luego se recorta con máscaras: leerla dentro de un "if" rompe el
  // cálculo del nivel de detalle en los bordes y deja puntos grises (promedio de todo el diseño).
  float d = dot(vObjP.xz, dir);
  // Posición en la tela aplanada (ver addSmoothSurface): los pliegues comprimen, no estiran.
  vec2 uv = vec2((dot(vFlat.xz, right) - rect.x) / rect.z + 0.5, (vFlat.y - rect.y) / rect.w + 0.5);
  vec4 c = texture2D(map, uv);
  float inside = step(range.x, d) * step(d, range.y) * step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float facing = dot(normalize(vSmN), vec3(dir.x, 0.0, dir.y));
  // Textura premultiplicada (color × alfa): sin bordes oscuros al filtrar junto a lo transparente.
  return c * (inside * smoothstep(face.x, face.y, facing));
}
// Mezcla "encima" en premultiplicado.
vec4 overPrint(vec4 acc, vec4 c) {
  return c + acc * (1.0 - c.a);
}
`;

const PRINT_APPLY = `
vec4 pr = vec4(0.0);
pr = overPrint(pr, viewPrint(uMap0, uDir[0], uRight[0], uRect[0], uRange[0], vec2(0.05, 0.22)));
pr = overPrint(pr, viewPrint(uMap1, uDir[1], uRight[1], uRect[1], uRange[1], vec2(0.05, 0.22)));
pr = overPrint(pr, viewPrint(uMap2, uDir[2], uRight[2], uRect[2], uRange[2], vec2(0.3, 0.55)));
pr = overPrint(pr, viewPrint(uMap3, uDir[3], uRight[3], uRect[3], uRange[3], vec2(0.3, 0.55)));
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
      .replace('#include <common>', '#include <common>\nattribute vec3 aSmoothN;\nattribute vec3 aFlat;\nvarying vec3 vObjP;\nvarying vec3 vFlat;\nvarying vec3 vSmN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjP = position;\nvFlat = aFlat;\nvSmN = aSmoothN;');
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
  const { geometry, box, size, neck, collar } = useMannequin(cfg);
  const material = useGarmentMaterial(box, size, cfg, neck, collar);
  useEffect(() => { onReady?.(); }, [onReady]);

  useEffect(() => {
    (material.userData.uniforms.uShirt.value as THREE.Color).set(color);
  }, [material, color]);

  const angles = useMemo(() => viewAngles(geometry, box, size, cfg), [geometry, box, size, cfg]);
  const depths = useMemo(() => viewDepths(geometry, box, size, cfg, angles), [geometry, box, size, cfg, angles]);

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
    for (const { id } of VIEWS_3D) out[id] = projectView(id, angles[id], depths[id], stableFrames[id], geometry);
    return out;
  }, [angles, depths, stableFrames, geometry]);

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
        g.rotation.y = angles[view];
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
      const target = angles[focus] + drag.current.offset + idle;
      let diff = target - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, delta * (locked ? 6 : 3.5));
    }
  });

  return (
    <>
      <group
        ref={group}
        rotation-y={angles[focus]}
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

