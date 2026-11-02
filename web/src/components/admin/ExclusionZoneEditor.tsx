import { useState, useRef, useCallback, useEffect } from 'react';
import { Button, toast, useConfirm } from '../ui';
import {
  Plus,
  Trash2,
  Move,
  Ban,
  Square,
  Circle,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import type { ExclusionZone } from '../../services/templates.service';

interface ExclusionZoneEditorProps {
  templateImage: string;
  exclusionZones: Record<string, ExclusionZone[]> | null;
  onExclusionZonesChange: (zones: Record<string, ExclusionZone[]>) => void;
  currentViewType?: string; // 'front', 'back', etc.
}

interface DragState {
  isDragging: boolean;
  isResizing: boolean;
  startX: number;
  startY: number;
  startZoneX: number;
  startZoneY: number;
  startWidth: number;
  startHeight: number;
  resizeHandle: string | null;
}

export const ExclusionZoneEditor = ({
  templateImage,
  exclusionZones,
  onExclusionZonesChange,
  currentViewType = 'front'
}: ExclusionZoneEditorProps) => {
  const confirm = useConfirm();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showZones, setShowZones] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneShape, setNewZoneShape] = useState<'rect' | 'circle'>('rect');

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    isResizing: false,
    startX: 0,
    startY: 0,
    startZoneX: 0,
    startZoneY: 0,
    startWidth: 0,
    startHeight: 0,
    resizeHandle: null,
  });

  // Obtener zonas del tipo de vista actual
  const currentZones = exclusionZones?.[currentViewType] || [];

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const getRelativePosition = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current || !imageRef.current) return { x: 0, y: 0 };

    const img = imageRef.current;
    const rect = img.getBoundingClientRect();
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    if (!naturalWidth || !naturalHeight) {
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      return {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y))
      };
    }

    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const imageRatio = naturalWidth / naturalHeight;
    const containerRatio = containerWidth / containerHeight;

    let renderedWidth: number;
    let renderedHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (imageRatio > containerRatio) {
      renderedWidth = containerWidth;
      renderedHeight = containerWidth / imageRatio;
      offsetX = 0;
      offsetY = (containerHeight - renderedHeight) / 2;
    } else {
      renderedHeight = containerHeight;
      renderedWidth = containerHeight * imageRatio;
      offsetX = (containerWidth - renderedWidth) / 2;
      offsetY = 0;
    }

    const mouseX = e.clientX - rect.left - offsetX;
    const mouseY = e.clientY - rect.top - offsetY;

    const x = (mouseX / renderedWidth) * 100;
    const y = (mouseY / renderedHeight) * 100;

    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    };
  }, []);

  const getImageContentArea = useCallback(() => {
    if (!imageRef.current) return null;

    const img = imageRef.current;
    const containerWidth = img.clientWidth;
    const containerHeight = img.clientHeight;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    if (!naturalWidth || !naturalHeight) return null;

    const imageRatio = naturalWidth / naturalHeight;
    const containerRatio = containerWidth / containerHeight;

    let renderedWidth: number;
    let renderedHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (imageRatio > containerRatio) {
      renderedWidth = containerWidth;
      renderedHeight = containerWidth / imageRatio;
      offsetX = 0;
      offsetY = (containerHeight - renderedHeight) / 2;
    } else {
      renderedHeight = containerHeight;
      renderedWidth = containerHeight * imageRatio;
      offsetX = (containerWidth - renderedWidth) / 2;
      offsetY = 0;
    }

    return { renderedWidth, renderedHeight, offsetX, offsetY };
  }, []);

  const getZoneDisplayDimensions = (zone: ExclusionZone) => {
    const contentArea = getImageContentArea();

    if (!contentArea) {
      return {
        left: `${zone.x}%`,
        top: `${zone.y}%`,
        width: `${zone.width || 10}%`,
        height: `${zone.height || 10}%`,
      };
    }

    const { renderedWidth, renderedHeight, offsetX, offsetY } = contentArea;

    const leftPx = offsetX + (zone.x / 100) * renderedWidth;
    const topPx = offsetY + (zone.y / 100) * renderedHeight;
    const widthPx = ((zone.width || 10) / 100) * renderedWidth;
    const heightPx = ((zone.height || 10) / 100) * renderedHeight;

    return {
      left: `${leftPx}px`,
      top: `${topPx}px`,
      width: `${widthPx}px`,
      height: `${heightPx}px`,
    };
  };

  const handleZoneMouseDown = (e: React.MouseEvent, zone: ExclusionZone, handle?: string) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedZoneId(zone.id);
    const pos = getRelativePosition(e);

    if (handle) {
      setDragState({
        isDragging: false,
        isResizing: true,
        startX: pos.x,
        startY: pos.y,
        startZoneX: zone.x,
        startZoneY: zone.y,
        startWidth: zone.width || 10,
        startHeight: zone.height || 10,
        resizeHandle: handle,
      });
    } else {
      setDragState({
        isDragging: true,
        isResizing: false,
        startX: pos.x,
        startY: pos.y,
        startZoneX: zone.x,
        startZoneY: zone.y,
        startWidth: zone.width || 10,
        startHeight: zone.height || 10,
        resizeHandle: null,
      });
    }
  };

  const updateZones = (newZonesForCurrentView: ExclusionZone[]) => {
    const updatedZones = {
      ...exclusionZones,
      [currentViewType]: newZonesForCurrentView,
    };
    onExclusionZonesChange(updatedZones);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging && !dragState.isResizing) return;
      if (!selectedZoneId) return;

      const pos = getRelativePosition(e);
      const deltaX = pos.x - dragState.startX;
      const deltaY = pos.y - dragState.startY;

      const newZones = currentZones.map(zone => {
        if (zone.id !== selectedZoneId) return zone;

        if (dragState.isDragging) {
          const newX = Math.max(0, Math.min(100 - (zone.width || 10), dragState.startZoneX + deltaX));
          const newY = Math.max(0, Math.min(100 - (zone.height || 10), dragState.startZoneY + deltaY));
          return { ...zone, x: Math.round(newX), y: Math.round(newY) };
        } else if (dragState.isResizing) {
          let newWidth = dragState.startWidth;
          let newHeight = dragState.startHeight;
          let newX = dragState.startZoneX;
          let newY = dragState.startZoneY;

          switch (dragState.resizeHandle) {
            case 'se':
              newWidth = Math.max(5, dragState.startWidth + deltaX);
              newHeight = Math.max(5, dragState.startHeight + deltaY);
              break;
            case 'sw':
              newWidth = Math.max(5, dragState.startWidth - deltaX);
              newHeight = Math.max(5, dragState.startHeight + deltaY);
              newX = dragState.startZoneX + (dragState.startWidth - newWidth);
              break;
            case 'ne':
              newWidth = Math.max(5, dragState.startWidth + deltaX);
              newHeight = Math.max(5, dragState.startHeight - deltaY);
              newY = dragState.startZoneY + (dragState.startHeight - newHeight);
              break;
            case 'nw':
              newWidth = Math.max(5, dragState.startWidth - deltaX);
              newHeight = Math.max(5, dragState.startHeight - deltaY);
              newX = dragState.startZoneX + (dragState.startWidth - newWidth);
              newY = dragState.startZoneY + (dragState.startHeight - newHeight);
              break;
          }

          newX = Math.max(0, Math.min(100 - newWidth, newX));
          newY = Math.max(0, Math.min(100 - newHeight, newY));
          newWidth = Math.min(100 - newX, newWidth);
          newHeight = Math.min(100 - newY, newHeight);

          return {
            ...zone,
            x: Math.round(newX),
            y: Math.round(newY),
            width: Math.round(newWidth),
            height: Math.round(newHeight)
          };
        }
        return zone;
      });

      updateZones(newZones);
    };

    const handleMouseUp = () => {
      if (dragState.isDragging || dragState.isResizing) {
        setDragState({
          isDragging: false,
          isResizing: false,
          startX: 0,
          startY: 0,
          startZoneX: 0,
          startZoneY: 0,
          startWidth: 0,
          startHeight: 0,
          resizeHandle: null,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, selectedZoneId, currentZones, getRelativePosition]);

  const handleCreateZone = () => {
    if (!newZoneName.trim()) {
      toast.error('Ingresa un nombre para la zona de exclusión');
      return;
    }

    const newZone: ExclusionZone = {
      id: `excl-${Date.now()}`,
      shape: newZoneShape,
      x: 35,
      y: 35,
      width: 30,
      height: 30,
      name: newZoneName.trim(),
    };

    if (newZoneShape === 'circle') {
      newZone.radius = 15;
    }

    const newZones = [...currentZones, newZone];
    updateZones(newZones);

    setIsCreating(false);
    setNewZoneName('');
    setSelectedZoneId(newZone.id);
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!(await confirm({ title: '¿Eliminar esta zona de exclusión?', tone: 'danger' }))) return;

    const newZones = currentZones.filter(z => z.id !== zoneId);
    updateZones(newZones);

    if (selectedZoneId === zoneId) {
      setSelectedZoneId(null);
    }
  };

  const selectedZone = currentZones.find(z => z.id === selectedZoneId);

  return (
    <div className="space-y-4 border-t border-gray-200 pt-6 mt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-500" />
            Zonas de Exclusión
          </h3>
          <span className="text-sm text-gray-500">
            ({currentZones.length} zona{currentZones.length !== 1 ? 's' : ''})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowZones(!showZones)}
            className={`p-2 rounded-lg border ${showZones ? 'bg-red-50 border-red-300' : 'bg-white border-gray-300'}`}
            title={showZones ? 'Ocultar zonas' : 'Mostrar zonas'}
          >
            {showZones ? <Eye className="w-5 h-5 text-red-600" /> : <EyeOff className="w-5 h-5 text-gray-500" />}
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Define áreas donde NO se podrá colocar diseños (costuras, botones, etiquetas, etc.)
      </p>

      <div className="grid grid-cols-12 gap-4">
        {/* Panel izquierdo - Lista de zonas */}
        <div className="col-span-12 lg:col-span-4 space-y-3">
          {!isCreating ? (
            <Button
              onClick={() => setIsCreating(true)}
              variant="secondary"
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-1" />
              Agregar Zona de Exclusión
            </Button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-red-800">Nueva Zona de Exclusión</span>
                <button onClick={() => setIsCreating(false)} className="text-red-500 hover:text-red-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input
                type="text"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Nombre (ej: Costura cuello)"
                className="w-full px-3 py-2 border border-red-300 rounded-md text-sm bg-white"
              />

              <div>
                <label className="block text-xs font-medium text-red-700 mb-1">Forma</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewZoneShape('rect')}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded border text-sm ${
                      newZoneShape === 'rect'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Square className="w-4 h-4" />
                    Rectángulo
                  </button>
                  <button
                    onClick={() => setNewZoneShape('circle')}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded border text-sm ${
                      newZoneShape === 'circle'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Circle className="w-4 h-4" />
                    Círculo
                  </button>
                </div>
              </div>

              <Button onClick={handleCreateZone} variant="danger" className="w-full">
                Crear Zona
              </Button>
            </div>
          )}

          {/* Lista de zonas */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {currentZones.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                No hay zonas de exclusión definidas.
              </p>
            ) : (
              currentZones.map(zone => (
                <div
                  key={zone.id}
                  onClick={() => setSelectedZoneId(zone.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedZoneId === zone.id
                      ? 'border-red-500 bg-red-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-red-500" />
                      <span className="font-medium text-sm">{zone.name || 'Sin nombre'}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone.id); }}
                      className="p-1 text-red-500 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    <span className="inline-block px-1.5 py-0.5 bg-gray-100 rounded mr-2 capitalize">
                      {zone.shape}
                    </span>
                    {zone.width}% × {zone.height}%
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Info de zona seleccionada */}
          {selectedZone && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
              <h4 className="font-medium text-sm text-gray-900">{selectedZone.name}</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-gray-500">Posición X</label>
                  <div className="font-mono bg-white px-2 py-1 rounded border border-gray-200">{selectedZone.x}%</div>
                </div>
                <div>
                  <label className="text-gray-500">Posición Y</label>
                  <div className="font-mono bg-white px-2 py-1 rounded border border-gray-200">{selectedZone.y}%</div>
                </div>
                <div>
                  <label className="text-gray-500">Ancho</label>
                  <div className="font-mono bg-white px-2 py-1 rounded border border-gray-200">{selectedZone.width}%</div>
                </div>
                <div>
                  <label className="text-gray-500">Alto</label>
                  <div className="font-mono bg-white px-2 py-1 rounded border border-gray-200">{selectedZone.height}%</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Panel derecho - Canvas visual */}
        <div className="col-span-12 lg:col-span-8">
          <div
            ref={containerRef}
            className="relative bg-gray-100 rounded-lg overflow-hidden border-2 border-dashed border-red-200"
            style={{ minHeight: '400px' }}
          >
            <img
              ref={imageRef}
              src={templateImage}
              alt="Modelo"
              onLoad={handleImageLoad}
              className="w-full h-auto max-h-[500px] object-contain"
              style={{ display: imageLoaded ? 'block' : 'none' }}
            />

            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-gray-500">Cargando imagen...</div>
              </div>
            )}

            {/* Renderizar zonas de exclusión */}
            {imageLoaded && showZones && currentZones.map(zone => {
              const displayDimensions = getZoneDisplayDimensions(zone);
              const isSelected = selectedZoneId === zone.id;

              return (
                <div
                  key={zone.id}
                  className={`absolute cursor-move transition-shadow ${
                    isSelected ? 'shadow-lg z-10' : 'z-5'
                  }`}
                  style={{
                    left: displayDimensions.left,
                    top: displayDimensions.top,
                    width: displayDimensions.width,
                    height: displayDimensions.height,
                    backgroundColor: 'rgba(239, 68, 68, 0.3)',
                    border: isSelected ? '3px solid rgb(239, 68, 68)' : '2px dashed rgb(239, 68, 68)',
                    borderRadius: zone.shape === 'circle' ? '50%' : '4px',
                  }}
                  onMouseDown={(e) => handleZoneMouseDown(e, zone)}
                >
                  {/* Nombre de la zona */}
                  {isSelected && (
                    <div
                      className="absolute -top-6 left-0 px-2 py-0.5 text-xs font-medium text-white rounded-t whitespace-nowrap bg-red-500"
                    >
                      {zone.name}
                    </div>
                  )}

                  {/* Handles de redimensionamiento (solo si está seleccionada y es rectángulo) */}
                  {isSelected && zone.shape === 'rect' && (
                    <>
                      <div
                        className="absolute -top-1 -left-1 w-3 h-3 bg-white border-2 border-red-500 rounded-sm cursor-nw-resize"
                        onMouseDown={(e) => handleZoneMouseDown(e, zone, 'nw')}
                      />
                      <div
                        className="absolute -top-1 -right-1 w-3 h-3 bg-white border-2 border-red-500 rounded-sm cursor-ne-resize"
                        onMouseDown={(e) => handleZoneMouseDown(e, zone, 'ne')}
                      />
                      <div
                        className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border-2 border-red-500 rounded-sm cursor-sw-resize"
                        onMouseDown={(e) => handleZoneMouseDown(e, zone, 'sw')}
                      />
                      <div
                        className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border-2 border-red-500 rounded-sm cursor-se-resize"
                        onMouseDown={(e) => handleZoneMouseDown(e, zone, 'se')}
                      />
                    </>
                  )}

                  {/* Icono central */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Ban className={`w-6 h-6 text-red-600 ${isSelected ? 'opacity-70' : 'opacity-40'}`} />
                  </div>
                </div>
              );
            })}

            {imageLoaded && currentZones.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white/90 px-4 py-3 rounded-lg shadow text-center">
                  <Ban className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    Agrega zonas de exclusión desde el panel izquierdo
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Move className="w-3 h-3" /> Arrastra para mover
            </span>
            <span className="flex items-center gap-1">
              <Square className="w-3 h-3" /> Esquinas para redimensionar
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
