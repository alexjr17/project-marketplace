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
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import { CAMERA, MANNEQUIN_COLOR, MODELS_3D, VIEW_ANGLE, VIEWS_3D, type Model3D, type ModelConfig, type View3D } from './models';
import { FULL_FRAME, paintArt, type ArtArea, type MannequinArt } from './art';

export interface Mannequin3DHandle {
  /**
   * Foto del maniquí mirando una vista (PNG con fondo transparente, recortada al escenario). Gira
   * al instante, pinta, toma la foto y vuelve a como estaba.
   */
  capture: (view: View3D, opts?: {
    type?: string; quality?: number; size?: number;
    /** Giro exacto en radianes (p. ej. costados a 90° para generar el modelo 3D); por defecto, el de la vista. */
    angle?: number;
    /** Inclinación hacia la cámara en radianes (positiva: se ve desde arriba). */
    tilt?: number;
  }) => string | null;
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
  /** Modelos con patrón: tiñe suave cada pieza (frente, espalda, mangas) para ver dónde van las costuras. */
  pieceGuide?: boolean;
  /** Config propia en vez de la del registro (revisión de un maniquí generado, con ajustes sin guardar). */
  config?: ModelConfig;
  /** Giro continuo (radianes por segundo) en vez de mirar `focus`: video 360° del estudio de contenido. */
  spin?: number;
  /** Conserva cada cuadro para copiarlo a otro lienzo (grabar video). */
  recordable?: boolean;
}

/** Alto del maniquí en la escena (unidades). */
const HEIGHT = 2.4;
/** Ancho de la textura de cada vista (px). */
const TEX_W = 1024;
/** Lienzo del patrón mientras se arrastra (liviano) y pausa que marca el fin del arrastre. */
const LIVE_ATLAS = 2048;
const LIVE_MS = 250;
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
  // Maniquí aprobado (el de los suéteres): de ahí sale la cabeza estándar para las gorras.
  const { scene: standardScene } = useGLTF(MODELS_3D.basica.model);

  return useMemo(() => {
    if (cfg.parts) return partsMannequin(scene);
    let src: THREE.BufferGeometry | null = null;
    let srcMap: THREE.Texture | null = null;
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !src) {
        src = m.geometry.clone().applyMatrix4(m.matrixWorld);
        srcMap = ((Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial)?.map ?? null;
      }
    });
    let g = (src as unknown as THREE.BufferGeometry).toNonIndexed();
    // Tela por color (modelos generados en cabeza o piernas): lo claro de la textura es la prenda.
    let byColor = cfg.lightFrom !== undefined ? clothByColor(g, srcMap, cfg.lightFrom) : null;
    // Gorras: la gorra generada sobre la cabeza del maniquí aprobado (la IA inventa cabezas con cara).
    if (cfg.standardHead && byColor) {
      const composed = capOnStandardHead(g, byColor, standardScene);
      if (composed) { g = composed.geometry; byColor = composed.cloth; }
    }
    // Objetos: solo la pieza principal (la IA a veces deja partes sueltas flotando, como una correa).
    if (cfg.object && !cfg.standardHead) {
      const main = largestPiece(g, byColor);
      if (main) { g = main.geometry; byColor = main.cloth; }
    }
    if (cfg.yaw) g.rotateY(cfg.yaw);
    g.computeBoundingBox();
    const size0 = g.boundingBox!.getSize(new THREE.Vector3());
    const center0 = g.boundingBox!.getCenter(new THREE.Vector3());
    g.translate(-center0.x, -center0.y, -center0.z);
    // Maniquíes: por la altura. Objetos (gorra, bolso…): por la medida más grande, para que uno ancho
    // y bajo no se salga del recuadro.
    const fit = cfg.object && !cfg.standardHead ? (HEIGHT * 0.8) / Math.max(size0.x, size0.y, size0.z) : HEIGHT / size0.y;
    g.scale(fit, fit, fit);
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
    const clothOut = new Float32Array(keep.length * 3).fill(1);
    keep.forEach((t, j) => {
      for (let k = 0; k < 3; k++) {
        out.set([pos.getX(t + k), pos.getY(t + k), pos.getZ(t + k)], j * 9 + k * 3);
        if (byColor) clothOut[j * 3 + k] = byColor[t + k];
      }
    });
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(out, 3));
    g.computeVertexNormals();
    g.boundingBox = box;
    g.setAttribute('aCloth', new THREE.BufferAttribute(clothOut, 1));
    g.userData.clothByColor = !!byColor;
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
  }, [scene, cfg, standardScene]);
}

/**
 * La pieza más grande de la malla (triángulos unidos por vértices compartidos), con su tela por
 * vértice si la hay. null si ya es una sola pieza o no se puede calcular.
 */
function largestPiece(g: THREE.BufferGeometry, cloth: Float32Array | null): { geometry: THREE.BufferGeometry; cloth: Float32Array | null } | null {
  const p = g.attributes.position.array as Float32Array;
  const n = p.length / 3;
  const ids = new Int32Array(n);
  const map = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(p[i * 3] * 1e4)},${Math.round(p[i * 3 + 1] * 1e4)},${Math.round(p[i * 3 + 2] * 1e4)}`;
    let id = map.get(k);
    if (id === undefined) { id = map.size; map.set(k, id); }
    ids[i] = id;
  }
  const parent = new Int32Array(map.size).map((_, i) => i);
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let t = 0; t < n; t += 3) {
    const a = find(ids[t]);
    for (const v of [ids[t + 1], ids[t + 2]]) { const b = find(v); if (a !== b) parent[b] = a; }
  }
  const count = new Map<number, number>();
  for (let t = 0; t < n; t += 3) { const r = find(ids[t]); count.set(r, (count.get(r) ?? 0) + 1); }
  if (count.size < 2) return null;
  let best = -1, bestN = 0;
  for (const [r, c] of count) if (c > bestN) { best = r; bestN = c; }
  const out = new Float32Array(bestN * 9);
  const outCloth = cloth ? new Float32Array(bestN * 3) : null;
  let j = 0;
  for (let t = 0; t < n; t += 3) {
    if (find(ids[t]) !== best) continue;
    out.set(p.subarray(t * 3, t * 3 + 9), j * 9);
    if (outCloth && cloth) outCloth.set(cloth.subarray(t, t + 3), j * 3);
    j++;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(out, 3));
  return { geometry, cloth: outCloth };
}

/** Mediana de una lista (0 si está vacía). */
const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

/**
 * Gorra sobre la cabeza estándar: de la malla generada se queda solo la tela (la gorra) y se pone
 * sobre la cabeza del maniquí aprobado (del cuello para arriba), con palo y base del mismo grafito.
 * El calce se mide en la cabeza que trae la malla generada: su ancho justo debajo del borde de la
 * gorra se iguala al de la cabeza estándar a la altura de la frente, y la visera queda al frente.
 * Devuelve la geometría (triángulos sueltos) y la tela por vértice, o null si no se puede medir.
 */
function capOnStandardHead(gen: THREE.BufferGeometry, cloth: Float32Array, standard: THREE.Object3D): { geometry: THREE.BufferGeometry; cloth: Float32Array } | null {
  // 1. Cabeza estándar.
  standard.updateMatrixWorld(true);
  const sp: number[] = [];
  const v = new THREE.Vector3();
  standard.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = ((Array.isArray(m.material) ? m.material[0] : m.material)?.name || '').toLowerCase();
    if (!name.includes('maniqui')) return;
    const gg = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const p = gg.attributes.position;
    for (let i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m.matrixWorld); sp.push(v.x, v.y, v.z); }
  });
  if (!sp.length) return null;
  let maxY = -Infinity, minY = Infinity;
  for (let i = 1; i < sp.length; i += 3) { maxY = Math.max(maxY, sp[i]); minY = Math.min(minY, sp[i]); }
  const H = maxY - minY;
  let scx = 0, scz = 0, sn = 0; // eje de la cabeza (se corrige al borde de la gorra)
  for (let i = 0; i < sp.length; i += 3) if (sp[i + 1] > maxY - 0.12 * H) { scx += sp[i]; scz += sp[i + 2]; sn++; }
  scx /= sn || 1; scz /= sn || 1;
  const radiusAt = (pts: number[], y: number, band: number, cx: number, cz: number) => {
    const r: number[] = [];
    for (let i = 0; i < pts.length; i += 3) if (Math.abs(pts[i + 1] - y) < band) r.push(Math.hypot(pts[i] - cx, pts[i + 2] - cz));
    return median(r);
  };
  // Cuello: bajando desde lo más ancho de la cabeza, donde el radio ya es menos del 70 % (bajo la
  // barbilla); se deja un tramo corto de cuello. Más abajo el maniquí de los suéteres es irregular
  // (queda tapado por el cuello de la camiseta).
  let rMax = 0, yMax = maxY - 0.1 * H;
  for (let y = maxY - 0.03 * H; y > maxY - 0.2 * H; y -= 0.004 * H) {
    const r = radiusAt(sp, y, 0.004 * H, scx, scz);
    if (r > rMax) { rMax = r; yMax = y; }
  }
  let yNeck = yMax - 0.1 * H;
  for (let y = yMax; y > maxY - 0.4 * H; y -= 0.003 * H) {
    const r = radiusAt(sp, y, 0.003 * H, scx, scz);
    if (r > 0 && r < rMax * 0.7) { yNeck = y; break; }
  }
  const yCut = yNeck - 0.015 * H;
  // Ancho del cuello limpio (justo bajo la barbilla), para el aro que remata el corte.
  const rNeck = radiusAt(sp, yNeck, 0.003 * H, scx, scz) || rMax * 0.6;

  // 2. Gorra generada: centro y ancho de la corona (sus paredes, por encima de la visera). No se usa
  // la cabeza generada: la cara y la nariz corren su centro hacia adelante.
  const gp = gen.attributes.position.array as Float32Array;
  const clothY: number[] = [];
  let capTop = -Infinity;
  for (let i = 0; i < cloth.length; i++) if (cloth[i] > 0.5) { clothY.push(gp[i * 3 + 1]); capTop = Math.max(capTop, gp[i * 3 + 1]); }
  if (clothY.length < 30) return null;
  clothY.sort((a, b) => a - b);
  const capBottom = clothY[Math.floor(clothY.length * 0.15)];
  const capH = capTop - capBottom;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < cloth.length; i++) {
    const y = gp[i * 3 + 1];
    if (cloth[i] < 0.5 || y < capBottom + 0.3 * capH || y > capBottom + 0.5 * capH) continue;
    x0 = Math.min(x0, gp[i * 3]); x1 = Math.max(x1, gp[i * 3]); z0 = Math.min(z0, gp[i * 3 + 2]); z1 = Math.max(z1, gp[i * 3 + 2]);
  }
  if (!Number.isFinite(x0)) return null;
  const gcx = (x0 + x1) / 2, gcz = (z0 + z1) / 2;
  const rG = ((x1 - x0) + (z1 - z0)) / 4; // radio de la corona
  // Visera: la tela baja que más se aleja del eje de la cabeza.
  let bx = 0, bz = 0;
  for (let i = 0; i < cloth.length; i++) {
    if (cloth[i] < 0.5 || gp[i * 3 + 1] > capBottom + 0.4 * capH) continue;
    const dx = gp[i * 3] - gcx, dz = gp[i * 3 + 2] - gcz;
    if (Math.hypot(dx, dz) > rG * 1.25) { bx += dx; bz += dz; }
  }
  const rot = bx || bz ? -Math.atan2(bx, bz) : 0; // la visera apunta a +z (frente)
  // Borde a la altura de la frente. La corona se ajusta al contorno de la cabeza de la frente para
  // arriba, por separado de lado a lado y de adelante hacia atrás (la cara sobresale más que la nuca),
  // con holgura; y como la cabeza estándar es un huevo más alto que una real, la gorra se alarga en
  // vertical solo lo necesario para cubrir la coronilla.
  const headH0 = maxY - yNeck;
  const rimS = yNeck + 0.56 * headH0;
  let hx0 = Infinity, hx1 = -Infinity, hz0 = Infinity, hz1 = -Infinity;
  for (let i = 0; i < sp.length; i += 3) {
    const y = sp[i + 1];
    if (y < rimS - 0.01 * H || y > rimS + 0.3 * headH0) continue;
    hx0 = Math.min(hx0, sp[i]); hx1 = Math.max(hx1, sp[i]); hz0 = Math.min(hz0, sp[i + 2]); hz1 = Math.max(hz1, sp[i + 2]);
  }
  const rS = (hx1 - hx0) / 2;
  if (rS <= 0) return null;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const rx = (x: number, z: number) => (x - gcx) * cr + (z - gcz) * sr;
  const rz = (x: number, z: number) => -(x - gcx) * sr + (z - gcz) * cr;
  let cx0 = Infinity, cx1 = -Infinity, cz0 = Infinity, cz1 = -Infinity;
  for (let i = 0; i < cloth.length; i++) {
    const y = gp[i * 3 + 1];
    if (cloth[i] < 0.5 || y < capBottom + 0.3 * capH || y > capBottom + 0.5 * capH) continue;
    const X = rx(gp[i * 3], gp[i * 3 + 2]), Z = rz(gp[i * 3], gp[i * 3 + 2]);
    cx0 = Math.min(cx0, X); cx1 = Math.max(cx1, X); cz0 = Math.min(cz0, Z); cz1 = Math.max(cz1, Z);
  }
  const sx = ((hx1 - hx0) * 1.16) / (cx1 - cx0), sz = ((hz1 - hz0) * 1.14) / (cz1 - cz0);
  const sy = Math.max((sx + sz) / 2, ((maxY - rimS) * 1.06) / (capH * 0.92));
  const hcx = (hx0 + hx1) / 2, hcz = (hz0 + hz1) / 2, ccx = (cx0 + cx1) / 2, ccz = (cz0 + cz1) / 2;

  // 3. Todo junto: cabeza (maniquí), gorra (tela), palo y base.
  const out: number[] = [];
  const outCloth: number[] = [];
  // Cuello cortado parejo: entran los triángulos con el centro sobre el corte y lo que baja de la
  // línea se aplana en ella.
  for (let t = 0; t < sp.length; t += 9) {
    if ((sp[t + 1] + sp[t + 4] + sp[t + 7]) / 3 < yCut) continue;
    // Triángulos grandes que bajan a los hombros: fuera (aplanados dejarían un ala).
    if (Math.min(sp[t + 1], sp[t + 4], sp[t + 7]) < yCut - 0.015 * H) continue;
    for (let k = 0; k < 3; k++) out.push(sp[t + k * 3], Math.max(yCut, sp[t + k * 3 + 1]), sp[t + k * 3 + 2]);
    outCloth.push(0, 0, 0);
  }
  for (let t = 0; t < cloth.length; t += 3) {
    if (cloth[t] < 0.5) continue;
    for (let k = 0; k < 3; k++) {
      const i = t + k;
      const X = rx(gp[i * 3], gp[i * 3 + 2]), Z = rz(gp[i * 3], gp[i * 3 + 2]);
      out.push(hcx + sx * (X - ccx), rimS + sy * (gp[i * 3 + 1] - capBottom), hcz + sz * (Z - ccz));
      outCloth.push(1);
    }
  }
  const headH = maxY - yNeck;
  const poleLen = headH * 0.9, baseH = rS * 0.14;
  const addCyl = (c: THREE.BufferGeometry, y: number) => {
    const n = c.toNonIndexed().attributes.position;
    for (let i = 0; i < n.count; i++) { out.push(scx + n.getX(i), y + n.getY(i), scz + n.getZ(i)); outCloth.push(0); }
  };
  // Remate del cuello: un aro del mismo grafito tapa el borde del corte (como el tapón de cuello de
  // un maniquí de vitrina).
  addCyl(new THREE.CylinderGeometry(rNeck * 1.12, rNeck * 1.12, 0.022 * H, 40), yCut + 0.004 * H);
  // El palo entra en el cuello (sin hueco entre el cuello y el palo).
  addCyl(new THREE.CylinderGeometry(rS * 0.12, rS * 0.12, poleLen, 24), yCut + 0.03 * H - poleLen / 2);
  addCyl(new THREE.CylinderGeometry(rS * 1.25, rS * 1.3, baseH, 48), yCut + 0.03 * H - poleLen - baseH / 2);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3));
  return { geometry, cloth: new Float32Array(outCloth) };
}

/**
 * Tela por color: lee la textura del modelo generado en cada vértice. La prenda sale blanca en la foto
 * estándar y el maniquí es grafito, así que lo claro (luminancia > `threshold`) es tela. Para que una
 * costura o sombra no deje puntos sueltos, cada triángulo queda entero del lado de la mayoría.
 * Devuelve 1 (tela) / 0 (maniquí) por vértice, o null si el modelo no trae textura.
 */
function clothByColor(g: THREE.BufferGeometry, map: THREE.Texture | null, threshold: number): Float32Array | null {
  const uv = g.attributes.uv;
  const img = map?.image as CanvasImageSource & { width?: number; height?: number } | undefined;
  if (!uv || !img || !img.width || !img.height) return null;
  const W = Math.min(1024, img.width), H = Math.min(1024, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  // glTF: el origen de la textura es arriba a la izquierda (flipY = false).
  const flip = map?.flipY ?? false;
  const out = new Float32Array(uv.count);
  for (let i = 0; i < uv.count; i++) {
    const u = ((uv.getX(i) % 1) + 1) % 1, v = ((uv.getY(i) % 1) + 1) % 1;
    const x = Math.min(W - 1, Math.floor(u * W)), y = Math.min(H - 1, Math.floor((flip ? 1 - v : v) * H));
    const o = (y * W + x) * 4;
    const lum = (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255;
    out[i] = lum > threshold ? 1 : 0;
  }
  // Cada triángulo entero de un lado (el borde sigue las aristas de la malla, sin puntos sueltos).
  for (let t = 0; t < out.length; t += 3) {
    const m = out[t] + out[t + 1] + out[t + 2] >= 2 ? 1 : 0;
    out[t] = out[t + 1] = out[t + 2] = m;
  }
  return out;
}

/**
 * Modelo por piezas (v2): une las piezas del .glb en una geometría centrada y al alto de la escena,
 * con el atributo `aCloth` (1 = material "camiseta", 0 = "maniqui"). Conserva las normales suaves del
 * archivo y su base; no recorta nada.
 */
function partsMannequin(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true);
  const pos: number[] = [], nor: number[] = [], cloth: number[] = [], uvs: number[] = [];
  let flat = false;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = ((Array.isArray(m.material) ? m.material[0] : m.material)?.name || '').toLowerCase();
    const isCloth = name.includes('camiseta') ? 1 : 0;
    // El .glb web viene comprimido (posiciones en enteros normalizados + escala del nodo): se lee cada
    // vértice ya en decimal y recién ahí se aplica la transformación (sobre el formato comprimido se desborda).
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const p = g.attributes.position, n = g.attributes.normal, uvA = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m.matrixWorld);
      pos.push(v.x, v.y, v.z);
      if (n) { v.set(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); } else { nor.push(0, 1, 0); flat = true; }
      cloth.push(isCloth);
      uvs.push(uvA ? uvA.getX(i) : 0, uvA ? uvA.getY(i) : 0);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('aCloth', new THREE.BufferAttribute(new Float32Array(cloth), 1));
  // Patrón de la tela (modelos v2): el estampado se pinta en una textura con estas coordenadas.
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  // Sin normales en el archivo: sombreado plano por triángulo (como la versión 1).
  if (flat) g.computeVertexNormals();
  g.computeBoundingBox();
  const size0 = g.boundingBox!.getSize(new THREE.Vector3());
  const center0 = g.boundingBox!.getCenter(new THREE.Vector3());
  g.translate(-center0.x, -center0.y, -center0.z);
  g.scale(HEIGHT / size0.y, HEIGHT / size0.y, HEIGHT / size0.y);
  g.computeBoundingBox();
  const box = g.boundingBox!.clone();
  const size = box.getSize(new THREE.Vector3());
  addSmoothSurface(g);
  // Con patrón (piezas en la UV): pliegues más suaves, el estampado se ve parejo al moverlo.
  if (uvs.some((v) => v !== 0)) relaxFolds(g, size);
  return { geometry: g, box, size, neck: { cx: 0, cz: 0, r: size.y * 0.04 }, collar: null as Float32Array | null };
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
function useGarmentMaterial(box: THREE.Box3, size: THREE.Vector3, cfg: ModelConfig, neck: { cx: number; cz: number; r: number }, collar: Float32Array | null, byColor = false) {
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
      uParts: { value: cfg.parts || byColor ? 1 : 0 },
      uPrint: { value: null as THREE.Texture | null },
      uUsePrint: { value: 0 },
      uCollarH: { value: Array.from(collar ?? new Float32Array(COLLAR_BINS)) },
      uMin: { value: new THREE.Vector2(box.min.x, box.min.y) },
      uSize: { value: new THREE.Vector2(size.x, size.y) },
      uHeadFrom: { value: cfg.headFrom },
      uBodyTop: { value: cfg.bodyTop },
      uClothFrom: { value: cfg.clothFrom ?? -1 },
      uShirt: { value: new THREE.Color('#ffffff') },
      uDummy: { value: new THREE.Color(MANNEQUIN_COLOR) },
    };
    const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aCloth;\nvarying vec3 vObj;\nvarying float vCloth;\nvarying vec2 vPrintUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;\nvCloth = aCloth;\nvPrintUv = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vObj;\nuniform vec2 uNeckC;\nuniform float uNeckR;\nuniform float uCut;\nuniform float uCollarFront;\nuniform float uCollarBack;\nuniform float uCollarCurve;\nuniform float uCollarSide;\nuniform float uCollarMesh;\nuniform float uCollarH[24];\nuniform float uParts;\nvarying float vCloth;\nvarying vec2 vPrintUv;\nuniform sampler2D uPrint;\nuniform float uUsePrint;\nuniform vec2 uMin;\nuniform vec2 uSize;\nuniform float uHeadFrom;\nuniform float uBodyTop;\nuniform float uClothFrom;\nuniform vec3 uShirt;\nuniform vec3 uDummy;',
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec2 muv = (vObj.xy - uMin) / uSize;
          if (uParts < 0.5 && muv.y < uCut) discard;
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
          // Maniquí de cabeza o de piernas: tela arriba de la línea, maniquí abajo.
          if (uClothFrom >= 0.0) cloth = smoothstep(uClothFrom - aa, uClothFrom + aa, muv.y);
          // Modelo por piezas (v2): la tela es la pieza "camiseta" del archivo.
          if (uParts > 0.5) cloth = step(0.5, vCloth);
          diffuseColor.rgb = mix(uDummy, uShirt, cloth);
          // Modelos con patrón (v2): el estampado está pintado en la tela misma.
          vec4 printC = texture2D(uPrint, vPrintUv);
          diffuseColor.rgb = mix(diffuseColor.rgb, printC.rgb, printC.a * cloth * uUsePrint);`,
        )
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.5, 0.92, cloth);');
    };
    m.userData.uniforms = uniforms;
    return m;
  }, [box, size, cfg, neck, collar, byColor]);
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
  // Objeto completo: los cuatro lados de frente (no hay mangas que buscar).
  if (cfg.object) return { ...VIEW_ANGLE };
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
  if (cfg.object) {
    // Objeto completo: cada lado donde lo toca un rayo a media altura.
    const midY = box.min.y + size.y * 0.5;
    return {
      front: depth('front', midY, box.max.z), back: depth('back', midY, -box.min.z),
      rightSleeve: depth('rightSleeve', midY, -box.min.x), leftSleeve: depth('leftSleeve', midY, box.max.x),
    };
  }
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
  const sn = new Float32Array(n * 3), sp = new Float32Array(n * 3), smooth = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const id = ids[i] * 3;
    smooth[i * 3] = cur[id]; smooth[i * 3 + 1] = cur[id + 1]; smooth[i * 3 + 2] = cur[id + 2];
    const l = Math.hypot(nrm[id], nrm[id + 1], nrm[id + 2]) || 1;
    const nx = nrm[id] / l, ny = nrm[id + 1] / l, nz = nrm[id + 2] / l;
    sn[i * 3] = nx; sn[i * 3 + 1] = ny; sn[i * 3 + 2] = nz;
    const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
    const h = (cur[id] - px) * nx + (cur[id + 1] - py) * ny + (cur[id + 2] - pz) * nz;
    sp[i * 3] = px + nx * h; sp[i * 3 + 1] = py + ny * h; sp[i * 3 + 2] = pz + nz * h;
  }
  g.setAttribute('aSmoothN', new THREE.BufferAttribute(sn, 3));
  g.setAttribute('aFlat', new THREE.BufferAttribute(sp, 3));
  // Superficie lisa (sin arrugas) y vértices soldados: los usa relaxFolds.
  g.setAttribute('aSmoothP', new THREE.BufferAttribute(smooth, 3));
  g.userData.weld = { ids, nb };
}

/**
 * Pliegues más suaves en la forma de la tela (sobre todo en las mangas, donde son hondos): el estampado
 * se ve parejo en vez de ondulado. La sombra de los pliegues se conserva (normales), así se siguen viendo.
 * Cerca del cuello y de los bordes de la tela no se toca nada.
 */
const RELAX_SLEEVE = 0.85;
const RELAX_TORSO = 0.85;
function relaxFolds(g: THREE.BufferGeometry, size: THREE.Vector3) {
  const weld = g.userData.weld as { ids: Int32Array; nb: Int32Array[] } | undefined;
  const sp = g.attributes.aSmoothP, sn = g.attributes.aSmoothN, uv = g.attributes.uv, cloth = g.attributes.aCloth;
  if (!weld || !sp || !uv || !cloth) return;
  const { ids, nb } = weld;
  const pos = g.attributes.position, nor = g.attributes.normal;
  const m = nb.length;
  // cuánto se alisa cada vértice soldado; 0 en el maniquí y en lo que lo toca
  let f = new Float32Array(m).fill(-1);
  const isMan = new Uint8Array(m);
  for (let i = 0; i < pos.count; i++) {
    const w = ids[i];
    if (cloth.getX(i) < 0.5) { isMan[w] = 1; continue; }
    const k = uv.getY(i) >= 0.5 ? RELAX_SLEEVE : RELAX_TORSO;
    f[w] = Math.max(f[w], k);
  }
  for (let w = 0; w < m; w++) if (isMan[w] || f[w] < 0) f[w] = 0;
  // bordes de la tela (cuello, puños, ruedo): sin vecinos por algún lado → 0
  const deg = new Uint16Array(m);
  for (let i = 0; i < pos.count; i += 3) for (let k = 0; k < 3; k++) deg[ids[i + k]]++;
  // axila: debajo, la tela cuelga separada del cuerpo (se puede alisar también el ruedo y bajar crestas)
  let armpitY = Infinity;
  for (let i = 0; i < pos.count; i++) if (cloth.getX(i) > 0.5 && uv.getY(i) >= 0.5) armpitY = Math.min(armpitY, pos.getY(i));
  const freeY = armpitY - size.y * 0.04;
  const wy = new Float32Array(m);
  for (let i = 0; i < pos.count; i++) wy[ids[i]] = pos.getY(i);
  // borde: menos triángulos que vecinos (abanico abierto); el ruedo del torso sí se alisa
  for (let w = 0; w < m; w++) {
    const hem = f[w] === RELAX_TORSO && wy[w] < freeY;
    if ((deg[w] < nb[w].length && !hem) || nb[w].some((r) => isMan[r])) f[w] = 0;
  }
  // cuello: la parte de arriba de la tela no se toca
  let clothTop = -Infinity;
  for (let i = 0; i < pos.count; i++) if (cloth.getX(i) > 0.5) clothTop = Math.max(clothTop, pos.getY(i));
  const neckY = clothTop - size.y * 0.05;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > neckY && uv.getY(i) < 0.5) f[ids[i]] = 0;
  // transición suave hacia lo que no se toca
  const fixed = Uint8Array.from(f, (x) => (x === 0 ? 1 : 0));
  for (let it = 0; it < 12; it++) {
    const nf = new Float32Array(m);
    for (let w = 0; w < m; w++) {
      if (fixed[w]) continue;
      let acc = f[w];
      for (const r of nb[w]) acc += f[r];
      nf[w] = acc / (nb[w].length + 1);
    }
    f = nf;
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const k = f[ids[i]];
    if (k <= 0) continue;
    // solo se rellenan los valles (hacia afuera): hundir las crestas dejaría ver el maniquí
    b.fromBufferAttribute(sp, i).sub(a.fromBufferAttribute(pos, i));
    const out = b.x * sn.getX(i) + b.y * sn.getY(i) + b.z * sn.getZ(i);
    // Solo se rellenan los valles, hacia afuera y en línea recta (a lo largo de la normal lisa):
    // hundir la tela deja asomar el maniquí (el básico va ceñido) y deslizarla de lado volteaba
    // triángulos que quedaban como huequitos.
    const lift = Math.max(0, out) * k;
    a.x += sn.getX(i) * lift; a.y += sn.getY(i) * lift; a.z += sn.getZ(i) * lift;
    pos.setXYZ(i, a.x, a.y, a.z);
    // la normal conserva casi toda la sombra del pliegue
    a.fromBufferAttribute(nor, i).lerp(b.fromBufferAttribute(sn, i), k * 0.35).normalize();
    nor.setXYZ(i, a.x, a.y, a.z);
  }
  pos.needsUpdate = true; nor.needsUpdate = true;
  g.computeBoundingBox();
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
varying vec3 vObjN;
varying float vClothP;
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
  // Además, la tela real tiene que mirar hacia la vista: en las esquinas de un torso cuadrado la
  // normal suavizada sigue "de frente" y el estampado se iría al costado. Umbral bajo: los pliegues
  // del pecho no lo cortan.
  float facingReal = dot(normalize(vObjN), vec3(dir.x, 0.0, dir.y));
  // Textura premultiplicada (color × alfa): sin bordes oscuros al filtrar junto a lo transparente.
  // Mangas (face negativo): solo se apaga en su cara de atrás, con la normal suavizada; con la real,
  // el estampado se cortaba donde la manga se curva y en cada arruguita.
  float realOk = face.x < 0.0 ? 1.0 : smoothstep(0.08, 0.26, facingReal);
  return c * (inside * smoothstep(face.x, face.y, facing) * realOk);
}
// Mezcla "encima" en premultiplicado.
vec4 overPrint(vec4 acc, vec4 c) {
  return c + acc * (1.0 - c.a);
}
`;

const PRINT_APPLY = `
vec4 pr = vec4(0.0);
pr = overPrint(pr, viewPrint(uMap0, uDir[0], uRight[0], uRect[0], uRange[0], vec2(0.22, 0.45)));
pr = overPrint(pr, viewPrint(uMap1, uDir[1], uRight[1], uRect[1], uRange[1], vec2(0.22, 0.45)));
pr = overPrint(pr, viewPrint(uMap2, uDir[2], uRight[2], uRect[2], uRange[2], vec2(-0.3, -0.1)));
pr = overPrint(pr, viewPrint(uMap3, uDir[3], uRight[3], uRect[3], uRange[3], vec2(-0.3, -0.1)));
pr *= step(0.5, vClothP);
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
      .replace('#include <common>', '#include <common>\nattribute vec3 aSmoothN;\nattribute vec3 aFlat;\nattribute float aCloth;\nvarying vec3 vObjP;\nvarying vec3 vFlat;\nvarying vec3 vSmN;\nvarying vec3 vObjN;\nvarying float vClothP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjP = position;\nvFlat = aFlat;\nvSmN = aSmoothN;\nvObjN = normal;\nvClothP = aCloth;');
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

/** Lado de la textura del patrón (px): 4096 en equipos que la soportan, si no 2048. */
const atlasSize = (gl: THREE.WebGLRenderer) => (gl.capabilities.maxTextureSize >= 4096 ? 4096 : 2048);

/**
 * Del escenario de una vista (en %) al patrón de la tela: lanza un rayo desde la cámara (con el maniquí
 * girado como en esa vista) y devuelve el punto del patrón (u, v en 0..1) donde toca la tela, o null.
 */
/** Dónde cae un punto del escenario en el patrón: centro (u, v en 0..1), escala y giro locales. */
interface PatternHit {
  /** Punto del patrón (0..1). */
  c: THREE.Vector2;
  /** Unidades de patrón (0..1) por 1 % del escenario, medido sobre la tela (sin estirarse). */
  perPct: number;
  /** Giro (radianes) de "a la derecha en pantalla" dentro del patrón. */
  rot: number;
}

/**
 * Del escenario de una vista (en %) al patrón de la tela: lanza un rayo desde la cámara (con el maniquí
 * girado como en esa vista) hasta la tela. La escala sale de una constante del patrón (todas las
 * piezas tienen la misma escala de tela) y de la distancia real a la cámara; el giro, del triángulo
 * de tela que se toca (sin rayos vecinos, que en una costura caían en otra pieza).
 */
function makeStageToPattern(geometry: THREE.BufferGeometry) {
  // Índice espacial (BVH): cada rayo revisa unos pocos triángulos en vez de toda la malla (el arrastre
  // repinta varias veces por segundo).
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  (geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree ??= new MeshBVH(geometry);
  mesh.raycast = acceleratedRaycast;
  const ray = new THREE.Raycaster();
  (ray as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
  const cloth = geometry.attributes.aCloth;
  const pos = geometry.attributes.position, uv = geometry.attributes.uv;
  const half = Math.tan(((CAMERA.fov / 2) * Math.PI) / 180);
  // Unidades de patrón por unidad de largo de tela (igual en todas las piezas): sqrt(área UV / área 3D).
  let a3 = 0, a2 = 0;
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    if (cloth && cloth.getX(t) < 0.5) continue;
    p0.fromBufferAttribute(pos, t); p1.fromBufferAttribute(pos, t + 1); p2.fromBufferAttribute(pos, t + 2);
    a3 += p1.clone().sub(p0).cross(p2.clone().sub(p0)).length() / 2;
    const u0 = uv.getX(t), v0 = uv.getY(t), u1 = uv.getX(t + 1), v1 = uv.getY(t + 1), u2 = uv.getX(t + 2), v2 = uv.getY(t + 2);
    a2 += Math.abs((u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)) / 2;
  }
  const uvPerUnit = a3 > 0 ? Math.sqrt(a2 / a3) : 0;
  const cam = new THREE.Vector3(), dir = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
  const viewDir = new THREE.Vector3();

  /** En el triángulo tocado: cómo cambia el patrón al moverse `vec` (unidad 3D) sobre la tela. */
  const gradient = (a: number, b: number, c: number, vec: THREE.Vector3) => {
    p0.fromBufferAttribute(pos, a); p1.fromBufferAttribute(pos, b); p2.fromBufferAttribute(pos, c);
    e1.subVectors(p1, p0); e2.subVectors(p2, p0); n.crossVectors(e1, e2).normalize();
    const t = vec.clone().addScaledVector(n, -vec.dot(n));
    const len = t.length();
    if (len < 1e-6) return null;
    t.divideScalar(len);
    const d11 = e1.dot(e1), d12 = e1.dot(e2), d22 = e2.dot(e2), r1 = t.dot(e1), r2 = t.dot(e2);
    const det = d11 * d22 - d12 * d12;
    if (Math.abs(det) < 1e-14) return null;
    const s1 = (r1 * d22 - r2 * d12) / det, s2 = (r2 * d11 - r1 * d12) / det;
    const du = s1 * (uv.getX(b) - uv.getX(a)) + s2 * (uv.getX(c) - uv.getX(a));
    const dv = s1 * (uv.getY(b) - uv.getY(a)) + s2 * (uv.getY(c) - uv.getY(a));
    return { du, dv, scale: Math.hypot(du, dv) };
  };

  const cast = (angle: number, xPct: number, yPct: number) => {
    const nx = (xPct / 100) * 2 - 1, ny = 1 - (yPct / 100) * 2;
    cam.set(0, 0, CAMERA.distance).applyAxisAngle(Y_AXIS, -angle);
    dir.set(nx * half, ny * half, -1).normalize().applyAxisAngle(Y_AXIS, -angle);
    ray.set(cam, dir);
    const h = ray.intersectObject(mesh, false).find((x) => x.face && x.uv);
    if (!h || !h.face || !h.uv) return null;
    // la primera superficie que se ve: si es maniquí, ese punto no es de la prenda
    if (cloth && cloth.getX(h.face.a) < 0.5) return null;
    return h;
  };

  // Lo ya calculado (las zonas no cambian mientras se arrastra un diseño) no se vuelve a medir.
  const memo = new Map<string, PatternHit | null>();
  return (angle: number, xPct: number, yPct: number): PatternHit | null => {
    const key = `${angle}|${xPct}|${yPct}`;
    if (memo.has(key)) return memo.get(key)!;
    if (memo.size > 400) memo.clear();
    const out = measure(angle, xPct, yPct);
    memo.set(key, out);
    return out;
  };

  function measure(angle: number, xPct: number, yPct: number): PatternHit | null {
    const h = cast(angle, xPct, yPct);
    if (!h || !h.face || !h.uv) return null;
    viewDir.set(0, 0, -1).applyAxisAngle(Y_AXIS, -angle);
    right.set(1, 0, 0).applyAxisAngle(Y_AXIS, -angle);
    up.set(0, 1, 0);
    const g = gradient(h.face.a, h.face.b, h.face.c, right);
    const rot = g ? Math.atan2(g.dv, g.du) : 0;
    // Escala local de la tela (patrón por unidad de largo): mediana de los triángulos alrededor del
    // punto. Donde el aplanado comprime un poco (puño), el diseño igual mide lo mismo sobre la tela.
    const scales: number[] = [];
    for (const [ox, oy] of [[0, 0], [0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]]) {
      const hh = ox || oy ? cast(angle, xPct + ox, yPct + oy) : h;
      if (!hh || !hh.face) continue;
      const gr = gradient(hh.face.a, hh.face.b, hh.face.c, right), gu = gradient(hh.face.a, hh.face.b, hh.face.c, up);
      if (gr) scales.push(gr.scale);
      if (gu) scales.push(gu.scale);
    }
    scales.sort((x, y) => x - y);
    const local = scales.length ? scales[Math.floor(scales.length / 2)] : uvPerUnit;
    // 1 % del escenario = este largo de tela a la distancia del punto (de frente a la cámara)
    const depth = h.distance * dir.dot(viewDir);
    const perPct = ((2 * half * depth) / 100) * local;
    return { c: h.uv.clone(), perPct, rot };
  }
}
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * Pinta el arte de todas las vistas en el patrón. Cada diseño se ubica por su centro (rayo desde la
 * cámara) y se dibuja con la escala real de la tela en ese punto: así mide lo mismo en cualquier
 * zona y sigue la forma de la prenda sin estirarse. La zona recorta igual, medida en el patrón.
 */
function paintPattern(
  ctx: CanvasRenderingContext2D, art: MannequinArt, angles: Record<View3D, number>,
  toPattern: (angle: number, x: number, y: number) => PatternHit | null, progress: Partial<Record<View3D, number>>,
  pieceGuide = false,
) {
  const S = ctx.canvas.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, S, S);
  if (pieceGuide) {
    // piezas del patrón en una cuadrícula de 2×2: frente, espalda / manga der., manga izq.
    const tints = ['rgba(59,130,246,0.28)', 'rgba(239,68,68,0.24)', 'rgba(34,197,94,0.28)', 'rgba(234,179,8,0.32)'];
    tints.forEach((t, k) => { ctx.fillStyle = t; ctx.fillRect((k % 2) * S / 2, Math.floor(k / 2) * S / 2, S / 2, S / 2); });
  }
  for (const { id } of VIEWS_3D) {
    const v = art[id];
    if (!v) continue;
    const ang = angles[id];
    const prog = progress[id] ?? 1;
    // escala del escenario al patrón alrededor de un punto: px de patrón por 1 % del escenario
    const frameAt = (x: number, y: number) => {
      const f = toPattern(ang, x, y);
      return f ? { c: f.c, scale: f.perPct * S, rot: f.rot } : null;
    };
    const area = (a: ArtArea) => {
      const f = frameAt(a.x + a.w / 2, a.y + a.h / 2);
      if (!f) return null;
      return { x: f.c.x * S, y: f.c.y * S, w: a.w * f.scale, h: a.h * f.scale, rot: f.rot, circle: a.circle };
    };
    const pathOf = (r: { x: number; y: number; w: number; h: number; rot: number; circle?: boolean }) => {
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
      ctx.beginPath();
      if (r.circle) ctx.ellipse(0, 0, r.w / 2, r.h / 2, 0, 0, Math.PI * 2); else ctx.rect(-r.w / 2, -r.h / 2, r.w, r.h);
      ctx.restore();
    };
    for (const l of v.layers) {
      const f = frameAt(l.cx, l.cy);
      if (!f) continue;
      const src = l.src as CanvasImageSource & { naturalWidth?: number; width: number; height: number; naturalHeight?: number };
      const iw = src.naturalWidth || src.width, ih = src.naturalHeight || src.height;
      if (!iw || !ih) continue;
      const bw = l.w * f.scale, bh = l.h * f.scale;
      const k = Math.min(bw / iw, bh / ih);
      const dw = iw * k, dh = ih * k;
      ctx.save();
      // Nunca sale de su pieza del patrón (cuadrícula 2×2): en una prenda real ahí hay una costura, y
      // en el patrón seguiría hacia otra pieza.
      const qx = f.c.x < 0.5 ? 0 : S / 2, qy = f.c.y < 0.5 ? 0 : S / 2;
      ctx.beginPath(); ctx.rect(qx, qy, S / 2, S / 2); ctx.clip();
      if (l.clip) { const z = area(l.clip); if (z) { pathOf(z); ctx.clip(); } }
      ctx.translate(f.c.x * S, f.c.y * S);
      ctx.rotate(f.rot + ((l.rotation ?? 0) * Math.PI) / 180);
      // rasqueta: el diseño aparece de izquierda a derecha
      if (prog < 1) { ctx.beginPath(); ctx.rect(-dw / 2, -dh / 2, dw * Math.max(0, prog), dh); ctx.clip(); }
      ctx.globalAlpha = l.opacity ?? 1;
      ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
    if (v.holes?.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      for (const h of v.holes) { const r = area(h); if (r) { pathOf(r); ctx.fill(); } }
      ctx.restore();
    }
  }
}

function Garment({ model, color, art, artRef, frames, focus, locked = false, animView, printKey = 0, still = false, onReady, handleRef, pieceGuide = false, config, spin }: Omit<Mannequin3DProps, 'active'>) {
  const cfg = config ?? MODELS_3D[model];
  const group = useRef<THREE.Group>(null);
  const drag = useRef({ down: false, x: 0, offset: 0 });
  const { gl, scene, camera } = useThree();
  const { geometry, box, size, neck, collar } = useMannequin(cfg);
  const material = useGarmentMaterial(box, size, cfg, neck, collar, !!geometry.userData.clothByColor);
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

  // Modelos con patrón (v2): una textura para toda la tela, parte del material de la prenda.
  // Dos lienzos del patrón: el nítido y uno liviano (2048) que se usa mientras se arrastra un diseño
  // —subir 4096² en cada cuadro trababa el arrastre—; al soltar se repinta el nítido.
  const pattern = useMemo(() => {
    if (!cfg.uv) return null;
    const atlas = (size: number) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const t = new THREE.CanvasTexture(c);
      t.flipY = false; // el patrón del .glb tiene el origen arriba a la izquierda (como la imagen)
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return { canvas: c, tex: t };
    };
    const full = atlasSize(gl);
    const hi = atlas(full);
    return { hi, lo: full > LIVE_ATLAS ? atlas(LIVE_ATLAS) : hi, toPattern: makeStageToPattern(geometry) };
  }, [cfg.uv, gl, geometry]);
  useEffect(() => {
    const u = material.userData.uniforms;
    u.uPrint.value = pattern?.hi.tex ?? null;
    u.uUsePrint.value = pattern ? 1 : 0;
    return () => { pattern?.hi.tex.dispose(); pattern?.lo.tex.dispose(); };
  }, [material, pattern]);
  /** El arte está cambiando (arrastre): se pinta en el lienzo liviano hasta LIVE_MS sin cambios. */
  const motion = useRef({ last: 0, live: false });
  const noteChange = () => { motion.current.last = performance.now(); motion.current.live = true; };

  const pass = useRef(Object.fromEntries(VIEWS_3D.map(({ id }) => [id, { progress: 1, dirty: true }])) as Record<View3D, { progress: number; dirty: boolean }>);
  const lastArt = useRef<MannequinArt>({});
  const lastVersion = useRef(-1);

  // Cambió el arte de una vista: se repinta (y si es la animada, pasa la rasqueta).
  useEffect(() => {
    let changed = false;
    for (const { id } of VIEWS_3D) {
      if (art[id] !== lastArt.current[id]) { pass.current[id].dirty = true; changed = true; }
    }
    if (changed) noteChange();
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
    if (pattern) return; // los modelos con patrón se pintan todos juntos (paintAll)
    paintArt(decals[id].canvas.getContext('2d')!, currentArt()[id], progress, stableFrames[id]);
    decals[id].tex.needsUpdate = true;
  };
  const paintAll = (sharp = false) => {
    if (!pattern) return;
    const prog: Partial<Record<View3D, number>> = {};
    for (const { id } of VIEWS_3D) prog[id] = pass.current[id].progress;
    const target = motion.current.live && !sharp ? pattern.lo : pattern.hi;
    paintPattern(target.canvas.getContext('2d')!, currentArt(), angles, pattern.toPattern, prog, pieceGuide);
    target.tex.needsUpdate = true;
    material.userData.uniforms.uPrint.value = target.tex;
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
        const prevX = g.rotation.x;
        g.rotation.y = opts?.angle ?? angles[view];
        g.rotation.x = opts?.tilt ?? 0;
        for (const { id } of VIEWS_3D) { pass.current[id].progress = 1; paint(id, 1); }
        paintAll(true);
        gl.render(scene, camera);
        const src = gl.domElement;
        const side = Math.min(src.width, src.height);
        const out = document.createElement('canvas');
        out.width = out.height = opts?.size ?? side;
        out.getContext('2d')!.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, out.width, out.height);
        g.rotation.y = prev;
        g.rotation.x = prevX;
        return out.toDataURL(opts?.type ?? 'image/png', opts?.quality);
      },
    };
    return () => { handleRef.current = null; };
  });

  useFrame((frame, delta) => {
    const version = artRef?.current.version ?? 0;
    const live = artRef && version !== lastVersion.current;
    lastVersion.current = version;
    if (live) noteChange();
    let repaint = false;
    // terminó el arrastre: se repinta en el lienzo nítido
    if (motion.current.live && performance.now() - motion.current.last > LIVE_MS) { motion.current.live = false; repaint = true; }
    for (const { id } of VIEWS_3D) {
      const st = pass.current[id];
      const hasArt = !!currentArt()[id]?.layers.length;
      if (live) st.dirty = true;
      if (st.dirty || (hasArt && st.progress < 1)) {
        if (hasArt && st.progress < 1) st.progress = Math.min(1, st.progress + delta / PASS_SECONDS);
        paint(id, hasArt ? st.progress : 1);
        st.dirty = false;
        repaint = true;
      }
    }
    if (repaint) paintAll();
    const g = group.current;
    if (g && spin) {
      g.rotation.y += delta * spin;
    } else if (g) {
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
        {!pattern && <mesh geometry={geometry} material={printMaterial} renderOrder={1} />}
        {!cfg.parts && !cfg.object && <Stand box={box} size={size} hem={cfg.hem} />}
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
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: !!props.recordable, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
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

