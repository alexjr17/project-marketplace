import { useState, useEffect } from 'react';
import { Move, Maximize2, RotateCw, Trash2, Link, Unlink } from 'lucide-react';
import type { Design } from '../../types/design';

interface DesignControlsProps {
  design: Design | null;
  onUpdate: (updates: Partial<Design>) => void;
  onDelete: () => void;
}

export const DesignControls = ({ design, onUpdate, onDelete }: DesignControlsProps) => {
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

  // Manejar cambio de ancho manteniendo proporción (trabajando en cm)
  const handleWidthChange = (newWidthCm: number) => {
    const newWidthPx = newWidthCm * 10; // Convertir cm a px
    if (keepAspectRatio) {
      const newHeightPx = Math.round(newWidthPx / aspectRatio);
      onUpdate({ size: { width: newWidthPx, height: newHeightPx } });
    } else {
      onUpdate({ size: { ...design.size, width: newWidthPx } });
    }
  };

  // Manejar cambio de alto manteniendo proporción (trabajando en cm)
  const handleHeightChange = (newHeightCm: number) => {
    const newHeightPx = newHeightCm * 10; // Convertir cm a px
    if (keepAspectRatio) {
      const newWidthPx = Math.round(newHeightPx * aspectRatio);
      onUpdate({ size: { width: newWidthPx, height: newHeightPx } });
    } else {
      onUpdate({ size: { ...design.size, height: newHeightPx } });
    }
  };

  return (
    <div className="space-y-6">
      {/* Position Controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Move className="w-4 h-4" />
          <span>Posición</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">X (horizontal)</label>
            <input
              type="range"
              min="0"
              max="600"
              step="5"
              value={design.position.x}
              onChange={(e) =>
                onUpdate({ position: { ...design.position, x: Number(e.target.value) } })
              }
              className="w-full"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">0 cm</span>
              <span className="text-xs text-gray-500 font-medium">{(design.position.x / 10).toFixed(1)} cm</span>
              <span className="text-xs text-gray-400">60 cm</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Y (vertical)</label>
            <input
              type="range"
              min="0"
              max="600"
              step="5"
              value={design.position.y}
              onChange={(e) =>
                onUpdate({ position: { ...design.position, y: Number(e.target.value) } })
              }
              className="w-full"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">0 cm</span>
              <span className="text-xs text-gray-500 font-medium">{(design.position.y / 10).toFixed(1)} cm</span>
              <span className="text-xs text-gray-400">60 cm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Size Controls */}
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
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Ancho</label>
            <input
              type="range"
              min="5"
              max="40"
              step="0.5"
              value={design.size.width / 10}
              onChange={(e) => handleWidthChange(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">5 cm</span>
              <span className="text-xs text-gray-500 font-medium">{(design.size.width / 10).toFixed(1)} cm</span>
              <span className="text-xs text-gray-400">40 cm</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Alto</label>
            <input
              type="range"
              min="5"
              max="40"
              step="0.5"
              value={design.size.height / 10}
              onChange={(e) => handleHeightChange(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">5 cm</span>
              <span className="text-xs text-gray-500 font-medium">{(design.size.height / 10).toFixed(1)} cm</span>
              <span className="text-xs text-gray-400">40 cm</span>
            </div>
          </div>
        </div>
        {keepAspectRatio && (
          <p className="text-xs text-purple-600 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded">
            <Link className="w-3 h-3" />
            <span>La proporción se mantiene automáticamente</span>
          </p>
        )}
      </div>

      {/* Rotation Control */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <RotateCw className="w-4 h-4" />
          <span>Rotación</span>
        </div>
        <input
          type="range"
          min="0"
          max="360"
          value={design.rotation}
          onChange={(e) => onUpdate({ rotation: Number(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0°</span>
          <span className="font-semibold text-gray-900">{design.rotation}°</span>
          <span>360°</span>
        </div>
      </div>

      {/* Opacity Control */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <span>Opacidad</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={design.opacity}
          onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span className="font-semibold text-gray-900">{Math.round(design.opacity * 100)}%</span>
          <span>100%</span>
        </div>
      </div>

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
