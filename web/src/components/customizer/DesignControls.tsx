import { useState, useEffect } from 'react';
import { Maximize2, Trash2, Link, Unlink } from 'lucide-react';
import type { Design } from '../../types/design';

interface DesignControlsProps {
  design: Design | null;
  onUpdate: (updates: Partial<Design>) => void;
  onDelete: () => void;
  maxZoneSize?: {
    width: number;
    height: number;
  } | null;
}

export const DesignControls = ({ design, onUpdate, onDelete, maxZoneSize }: DesignControlsProps) => {
  // Estado para mantener la proporción y la relación de aspecto
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<number>(1);

  // Calcular la relación de aspecto cuando el diseño cambie
  useEffect(() => {
    if (design) {
      const ratio = design.size.width / design.size.height;
      setAspectRatio(ratio);
    }
  }, [design?.id]); // Solo recalcular cuando cambie el diseño (nueva imagen)

  if (!design) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p className="text-sm">Sube una imagen para comenzar a personalizarla</p>
      </div>
    );
  }

  // Tamaños: mínimo 5%, máximo = tamaño de la zona más grande o 80% por defecto
  const minSize = 5;
  const maxWidth = maxZoneSize?.width || 80;
  const maxHeight = maxZoneSize?.height || 80;

  // Manejar cambio de ancho manteniendo proporción
  const handleWidthChange = (newWidth: number) => {
    // Limitar al máximo permitido por la zona
    const clampedWidth = Math.min(newWidth, maxWidth);

    if (keepAspectRatio) {
      let newHeight = Math.round(clampedWidth / aspectRatio);
      // También limitar la altura al máximo
      if (newHeight > maxHeight) {
        newHeight = maxHeight;
        const adjustedWidth = Math.round(newHeight * aspectRatio);
        onUpdate({ size: { width: Math.min(adjustedWidth, maxWidth), height: newHeight } });
      } else {
        onUpdate({ size: { width: clampedWidth, height: newHeight } });
      }
    } else {
      onUpdate({ size: { ...design.size, width: clampedWidth } });
    }
  };

  // Manejar cambio de alto manteniendo proporción
  const handleHeightChange = (newHeight: number) => {
    // Limitar al máximo permitido por la zona
    const clampedHeight = Math.min(newHeight, maxHeight);

    if (keepAspectRatio) {
      let newWidth = Math.round(clampedHeight * aspectRatio);
      // También limitar el ancho al máximo
      if (newWidth > maxWidth) {
        newWidth = maxWidth;
        const adjustedHeight = Math.round(newWidth / aspectRatio);
        onUpdate({ size: { width: newWidth, height: Math.min(adjustedHeight, maxHeight) } });
      } else {
        onUpdate({ size: { width: newWidth, height: clampedHeight } });
      }
    } else {
      onUpdate({ size: { ...design.size, height: clampedHeight } });
    }
  };

  return (
    <div className="space-y-5">
      {/* Size Controls - Porcentaje del template */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Maximize2 className="w-4 h-4" />
            <span>Tamaño</span>
          </div>
          <button
            onClick={() => setKeepAspectRatio(!keepAspectRatio)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              keepAspectRatio
                ? 'bg-app-100 text-app-700 hover:bg-app-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={keepAspectRatio ? 'Click para desbloquear proporción' : 'Click para mantener proporción'}
          >
            {keepAspectRatio ? (
              <>
                <Link className="w-3 h-3" />
                <span>Bloqueado</span>
              </>
            ) : (
              <>
                <Unlink className="w-3 h-3" />
                <span>Libre</span>
              </>
            )}
          </button>
        </div>

        {/* Indicador de límite máximo */}
        {maxZoneSize && (
          <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded flex items-center gap-1">
            <span>Máximo: {Math.round(maxZoneSize.width)}% x {Math.round(maxZoneSize.height)}%</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Ancho</label>
            <input
              type="range"
              min={minSize}
              max={maxWidth}
              step="1"
              value={Math.min(design.size.width, maxWidth)}
              onChange={(e) => handleWidthChange(Number(e.target.value))}
              className="w-full accent-app-600"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">{minSize}%</span>
              <span className="text-xs text-gray-500 font-medium">{Math.round(design.size.width)}%</span>
              <span className="text-xs text-gray-400">{Math.round(maxWidth)}%</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Alto</label>
            <input
              type="range"
              min={minSize}
              max={maxHeight}
              step="1"
              value={Math.min(design.size.height, maxHeight)}
              onChange={(e) => handleHeightChange(Number(e.target.value))}
              className="w-full accent-app-600"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">{minSize}%</span>
              <span className="text-xs text-gray-500 font-medium">{Math.round(design.size.height)}%</span>
              <span className="text-xs text-gray-400">{Math.round(maxHeight)}%</span>
            </div>
          </div>
        </div>
        {keepAspectRatio && (
          <p className="text-xs text-app-600 flex items-center gap-1 bg-app-50 px-2 py-1 rounded">
            <Link className="w-3 h-3" />
            <span>La proporción se mantiene automáticamente</span>
          </p>
        )}
      </div>

      {/* Tip para mover */}
      <p className="text-xs text-gray-500 text-center">
        Arrastra la imagen en el canvas para moverla
      </p>

      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <Trash2 className="w-5 h-5" />
        Eliminar Diseño
      </button>
    </div>
  );
};
