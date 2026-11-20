/**
 * Optimiza un modelo generado: los que salen de las 4 vistas traen más de un millón de triángulos
 * (decenas de MB). Se simplifica la malla con meshoptimizer hasta un tope que conserva la forma, las
 * arrugas y el cuello, y se arma un .glb liviano para la tienda.
 */
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Triángulos de un modelo listo para la tienda (los del sistema tienen ~25 mil). */
export const MAX_TRIANGLES = 120_000;

/**
 * El mismo modelo con a lo sumo MAX_TRIANGLES triángulos, o null si ya es liviano o trae textura
 * (simplificar movería sus coordenadas de textura).
 */
export async function optimizeModel(url: string): Promise<Blob | null> {
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  let mesh: THREE.Mesh | null = null;
  gltf.scene.traverse((o) => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
  if (!mesh) return null;
  const src = (mesh as THREE.Mesh).geometry.clone().applyMatrix4((mesh as THREE.Mesh).matrixWorld);
  const triangles = (src.index ? src.index.count : src.attributes.position.count) / 3;
  if (triangles <= MAX_TRIANGLES || src.attributes.uv) return null;

  // Solo la forma: posiciones unidas por vértice (la luz se calcula al cargar).
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', src.attributes.position);
  if (src.index) shape.setIndex(src.index);
  const welded = mergeVertices(shape, 1e-6);
  const positions = new Float32Array(welded.attributes.position.array);
  const indices = new Uint32Array(welded.index!.array);

  await MeshoptSimplifier.ready;
  const [simple] = MeshoptSimplifier.simplify(indices, positions, 3, MAX_TRIANGLES * 3, 0.02);
  // Solo los vértices que quedan.
  const remap = new Int32Array(positions.length / 3).fill(-1);
  const outPos: number[] = [];
  const outIdx = new Uint32Array(simple.length);
  for (let i = 0; i < simple.length; i++) {
    const v = simple[i];
    if (remap[v] < 0) {
      remap[v] = outPos.length / 3;
      outPos.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    }
    outIdx[i] = remap[v];
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3));
  out.setIndex(new THREE.BufferAttribute(outIdx, 1));

  const result = new THREE.Mesh(out, new THREE.MeshStandardMaterial({ color: '#ffffff' }));
  const glb = await new GLTFExporter().parseAsync(result, { binary: true });
  return new Blob([glb as ArrayBuffer], { type: 'model/gltf-binary' });
}
