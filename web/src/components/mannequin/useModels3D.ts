/**
 * Carga una vez los maniquíes publicados en Admin → Modelos 3D y los suma al registro MODELS_3D.
 * Los componentes que listan o usan maniquíes llaman `useModels3D()` para volver a pintarse cuando
 * llegan. Si la API falla, quedan solo los del sistema.
 */
import { useEffect, useState } from 'react';
import { mannequinModelsService } from '../../services/mannequinModels.service';
import { registerModels3D } from './models';

let loading: Promise<void> | null = null;
let loaded = false;

export function loadModels3D(force = false): Promise<void> {
  if (force) loading = null;
  if (!loading) {
    loading = mannequinModelsService.published()
      .then((list) => { registerModels3D(list ?? []); })
      .catch(() => { /* sin la API: solo los del sistema */ })
      .finally(() => { loaded = true; });
  }
  return loading;
}

/** true cuando ya están los maniquíes publicados en el registro. */
export function useModels3D(): boolean {
  const [ready, setReady] = useState(loaded);
  useEffect(() => {
    let alive = true;
    loadModels3D().then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  return ready;
}
