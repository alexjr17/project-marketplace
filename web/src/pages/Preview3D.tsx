import { Suspense, useMemo, useRef, useState, Component, type ReactNode } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Decal, Bounds, useTexture, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

/** Contiene errores del visor 3D para que un modelo incompatible no tumbe la app. */
class ViewerBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: Error) { return { error: err?.message || 'Error al renderizar el modelo' }; }
  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-3">
          <p className="text-gray-700 font-medium">No se pudo renderizar este modelo 3D</p>
          <p className="text-xs text-gray-500 max-w-sm">Puede no ser compatible (malla con esqueleto o sin coordenadas). Prueba con otro .glb más sencillo.</p>
          <p className="text-[11px] text-red-500 font-mono">{this.state.error}</p>
          <button
            onClick={() => { this.setState({ error: null }); this.props.onReset(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Probar con otro modelo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface DecalState {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

/** Capa de decal (diseño) proyectada sobre la malla principal del modelo. */
function DecalLayer({ meshRef, texUrl, decal }: { meshRef: React.RefObject<THREE.Mesh | null>; texUrl: string; decal: DecalState }) {
  const texture = useTexture(texUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  return (
    // @ts-expect-error drei Decal acepta mesh como ref a la malla destino
    <Decal mesh={meshRef} position={decal.position} rotation={decal.rotation} scale={decal.scale}>
      <meshBasicMaterial
        map={texture}
        transparent
        polygonOffset
        polygonOffsetFactor={-10}
        toneMapped={false}
      />
    </Decal>
  );
}

function Garment({ url, texUrl, decal, setDecal }: {
  url: string;
  texUrl: string | null;
  decal: DecalState;
  setDecal: (d: DecalState) => void;
}) {
  // useGLTF configura Draco/Meshopt automáticamente (modelos comprimidos).
  const gltf = useGLTF(url);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);

  // Malla principal = la de mayor número de vértices (el cuerpo de la prenda).
  const mainMesh = useMemo<THREE.Mesh | null>(() => {
    let best: THREE.Mesh | null = null;
    let max = -1;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        const count = m.geometry.attributes.position?.count ?? 0;
        if (count > max) { max = count; best = m as THREE.Mesh; }
      }
    });
    return best;
  }, [scene]);

  const meshRef = useRef<THREE.Mesh | null>(null);
  meshRef.current = mainMesh;

  // Clic sobre el modelo: coloca el decal en ese punto, orientado a la superficie.
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!mainMesh || !e.face) return;
    const localPoint = mainMesh.worldToLocal(e.point.clone());
    const normal = e.face.normal.clone();
    const dummy = new THREE.Object3D();
    dummy.position.copy(localPoint);
    dummy.lookAt(localPoint.clone().add(normal));
    setDecal({
      ...decal,
      position: [localPoint.x, localPoint.y, localPoint.z],
      rotation: [dummy.rotation.x, dummy.rotation.y, dummy.rotation.z],
    });
  };

  return (
    <Bounds fit clip observe margin={1.2}>
      <group>
        <primitive object={scene} onClick={handleClick} />
        {texUrl && mainMesh && <DecalLayer meshRef={meshRef} texUrl={texUrl} decal={decal} />}
      </group>
    </Bounds>
  );
}

export default function Preview3D() {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [texUrl, setTexUrl] = useState<string | null>(null);
  const [decal, setDecal] = useState<DecalState>({ position: [0, 0, 0.1], rotation: [0, 0, 0], scale: 0.15 });

  const onModel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setModelUrl(URL.createObjectURL(f));
  };
  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setTexUrl(URL.createObjectURL(f));
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Prueba 3D — Personalización de prenda</h1>
        <a href="/" className="text-sm text-blue-600 hover:underline">Volver</a>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Controles */}
        <aside className="lg:w-80 bg-white border-r border-gray-200 p-4 space-y-5 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">1. Modelo 3D (.glb / .gltf)</label>
            <input type="file" accept=".glb,.gltf,model/gltf-binary" onChange={onModel}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">2. Diseño (imagen PNG/JPG)</label>
            <input type="file" accept="image/*" onChange={onImage}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
            Haz <strong>clic sobre el modelo</strong> para colocar el diseño en ese punto.
            Arrastra para <strong>rotar</strong>, rueda para <strong>zoom</strong>.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tamaño del diseño: {decal.scale.toFixed(2)}</label>
            <input type="range" min={0.03} max={0.6} step={0.01} value={decal.scale}
              onChange={(e) => setDecal({ ...decal, scale: parseFloat(e.target.value) })} className="w-full" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Girar diseño</label>
            <input type="range" min={-Math.PI} max={Math.PI} step={0.05} value={decal.rotation[2]}
              onChange={(e) => setDecal({ ...decal, rotation: [decal.rotation[0], decal.rotation[1], parseFloat(e.target.value)] })} className="w-full" />
          </div>

          <p className="text-xs text-gray-400">
            Esto es una prueba de concepto: subes el modelo y el diseño, lo posicionas y giras la prenda.
            Si te convence, lo integramos al editor de plantillas y al preview del cliente.
          </p>
        </aside>

        {/* Visor 3D */}
        <main className="flex-1 min-h-0 relative">
          {!modelUrl ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm px-6 text-center">
              Sube un modelo 3D (.glb) para empezar.
            </div>
          ) : (
            <ViewerBoundary key={modelUrl} onReset={() => { setModelUrl(null); setTexUrl(null); }}>
              <Canvas camera={{ position: [0, 0, 2.5], fov: 35 }} dpr={[1, 2]}>
                <ambientLight intensity={0.8} />
                <hemisphereLight intensity={0.6} />
                <directionalLight position={[5, 5, 5]} intensity={1.4} />
                <directionalLight position={[-5, 2, -5]} intensity={0.6} />
                <Suspense fallback={null}>
                  <Garment key={modelUrl} url={modelUrl} texUrl={texUrl} decal={decal} setDecal={setDecal} />
                </Suspense>
                <OrbitControls makeDefault enablePan={false} minDistance={1} maxDistance={6} />
              </Canvas>
            </ViewerBoundary>
          )}
        </main>
      </div>
    </div>
  );
}
