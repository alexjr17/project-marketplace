import { useState, useRef, useCallback, useEffect } from 'react';
import { Button, toast, useConfirm } from '../ui';
import {
  Plus,
  Trash2,
  Move,
  Ban,
  CheckCircle,
  Square,
  Circle,
  Triangle,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import type { DesignZone } from '../../services/templates.service';

interface DesignZonesEditorProps {
  templateImage: string;
  designZones: Record<string, DesignZone[]> | null;
  onDesignZonesChange: (zones: Record<string, DesignZone[]>) => void;
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

export const DesignZonesEditor = ({
  templateImage,
  designZones,
  onDesignZonesChange,
  currentViewType = 'front'
}: DesignZonesEditorProps) => {
  const confirm = useConfirm();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showZones, setShowZones] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneShape, setNewZoneShape] = useState<'rect' | 'circle' | 'polygon'>('rect');
  const [newZoneType, setNewZoneType] = useState<'allowed' | 'blocked'>('allowed');

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
  const currentZones = designZones?.[currentViewType] || [];

  // Separar zonas por tipo
  const allowedZones = currentZones.filter(z => z.type === 'allowed');
  const blockedZones = currentZones.filter(z => z.type === 'blocked');

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

  const getZoneDisplayDimensions = (zone: DesignZone) => {
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

  const handleZoneMouseDown = (e: React.MouseEvent, zone: DesignZone, handle?: string) => {
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

  const updateZones = (newZonesForCurrentView: DesignZone[]) => {
    const updatedZones = {
      ...designZones,
      [currentViewType]: newZonesForCurrentView,
    };
    onDesignZonesChange(updatedZones);
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
      toast.error('Ingresa un nombre para la zona');
      return;
    }

    const newZone: DesignZone = {
      id: `zone-${newZoneType}-${Date.now()}`,
      type: newZoneType,
      shape: newZoneShape,
      x: 35,
      y: 35,
      width: 30,
      height: 30,
      name: newZoneName.trim(),
    };

    if (newZoneShape === 'circle') {
      newZone.radius = 15;
    } else if (newZoneShape === 'polygon') {
      // Triángulo: puntos relativos al bounding box (0-100%)
      newZone.points = [
        { x: 50, y: 0 },   // Punta superior (centro)
        { x: 100, y: 100 }, // Esquina inferior derecha
        { x: 0, y: 100 }    // Esquina inferior izquierda
      ];
    }

    const newZones = [...currentZones, newZone];
    updateZones(newZones);

    setIsCreating(false);
    setNewZoneName('');
    setSelectedZoneId(newZone.id);
  };

  const handleDeleteZone = async (zoneId: string) => {
    const zone = currentZones.find(z => z.id === zoneId);
    const typeText = zone?.type === 'allowed' ? 'habilitada' : 'bloqueada';
    if (!(await confirm({ title: `¿Eliminar esta zona ${typeText}?`, tone: 'danger' }))) return;

    const newZones = currentZones.filter(z => z.id !== zoneId);
    updateZones(newZones);

    if (selectedZoneId === zoneId) {
      setSelectedZoneId(null);
    }
  };

  const selectedZone = currentZones.find(z => z.id === selectedZoneId);

  // Colores por tipo
  const getZoneColors = (type: 'allowed' | 'blocked', isSelected: boolean) => {
    if (type === 'allowed') {
      return {
        bg: 'rgba(34, 197, 94, 0.25)',
        border: isSelected ? '3px solid rgb(34, 197, 94)' : '2px dashed rgb(34, 197, 94)',
        labelBg: 'bg-green-500',
        iconColor: 'text-green-600',
        listBorder: isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300',
      };
    } else {
      return {
        bg: 'rgba(239, 68, 68, 0.25)',
        border: isSelected ? '3px solid rgb(239, 68, 68)' : '2px dashed rgb(239, 68, 68)',
        labelBg: 'bg-red-500',
        iconColor: 'text-red-600',
        listBorder: isSelected ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300',
      };
    }
  };

  return (
    <div className="space-y-4 border-t border-gray-200 pt-6 mt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Zonas de Diseño</h3>
          <span className="text-sm text-gray-500">
            ({allowedZones.length} habilitada{allowedZones.length !== 1 ? 's' : ''}, {blockedZones.length} bloqueada{blockedZones.length !== 1 ? 's' : ''})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowZones(!showZones)}
            className={`p-2 rounded-lg border ${showZones ? 'bg-app-50 border-app-300' : 'bg-white border-gray-300'}`}
            title={showZones ? 'Ocultar zonas' : 'Mostrar zonas'}
          >
            {showZones ? <Eye className="w-5 h-5 text-app-600" /> : <EyeOff className="w-5 h-5 text-gray-500" />}
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Define zonas <span className="text-green-600 font-medium">habilitadas</span> (donde SÍ se puede colocar diseño)
        y zonas <span className="text-red-600 font-medium">bloqueadas</span> (donde NO se puede).
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
              Agregar Zona
            </Button>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">Nueva Zona</span>
                <button onClick={() => setIsCreating(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input
                type="text"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Nombre (ej: Pecho, Espalda, Costura)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
              />

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Zona</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewZoneType('allowed')}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded border text-sm ${
                      newZoneType === 'allowed'
                        ? 'bg-green-500 text-white border-green-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Habilitada
                  </button>
                  <button
                    onClick={() => setNewZoneType('blocked')}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded border text-sm ${
                      newZoneType === 'blocked'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Ban className="w-4 h-4" />
                    Bloqueada
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Forma</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setNewZoneShape('rect')}
                    className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded border text-xs ${
                      newZoneShape === 'rect'
                        ? 'bg-gray-700 text-white border-gray-700'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Square className="w-5 h-5" />
                    Rect
                  </button>
                  <button
                    onClick={() => setNewZoneShape('circle')}
                    className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded border text-xs ${
                      newZoneShape === 'circle'
                        ? 'bg-gray-700 text-white border-gray-700'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Circle className="w-5 h-5" />
                    Círculo
                  </button>
                  <button
                    onClick={() => setNewZoneShape('polygon')}
                    className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded border text-xs ${
                      newZoneShape === 'polygon'
                        ? 'bg-gray-700 text-white border-gray-700'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Triangle className="w-5 h-5" />
                    Triángulo
                  </button>
                </div>
              </div>

              <Button
                onClick={handleCreateZone}
                variant={newZoneType === 'allowed' ? 'primary' : 'danger'}
                className="w-full"
              >
                Crear Zona {newZoneType === 'allowed' ? 'Habilitada' : 'Bloqueada'}
              </Button>
            </div>
          )}

          {/* Lista de zonas habilitadas */}
          {allowedZones.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-green-700 uppercase mb-2 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Zonas Habilitadas
              </h4>
              <div className="space-y-2">
                {allowedZones.map(zone => {
                  const colors = getZoneColors('allowed', selectedZoneId === zone.id);
                  return (
                    <div
                      key={zone.id}
                      onClick={() => setSelectedZoneId(zone.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${colors.listBorder}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="font-medium text-sm">{zone.name || 'Sin nombre'}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone.id); }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
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
                  );
                })}
              </div>
            </div>
          )}

          {/* Lista de zonas bloqueadas */}
          {blockedZones.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-700 uppercase mb-2 flex items-center gap-1">
                <Ban className="w-3 h-3" /> Zonas Bloqueadas
              </h4>
              <div className="space-y-2">
                {blockedZones.map(zone => {
                  const colors = getZoneColors('blocked', selectedZoneId === zone.id);
                  return (
                    <div
                      key={zone.id}
                      onClick={() => setSelectedZoneId(zone.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${colors.listBorder}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Ban className="w-4 h-4 text-red-500" />
                          <span className="font-medium text-sm">{zone.name || 'Sin nombre'}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone.id); }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
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
                  );
                })}
              </div>
            </div>
          )}

          {currentZones.length === 0 && !isCreating && (
            <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
              No hay zonas definidas. Agrega zonas habilitadas y bloqueadas.
            </p>
          )}

          {/* Info de zona seleccionada */}
          {selectedZone && (
            <div className={`border rounded-lg p-3 space-y-2 ${
              selectedZone.type === 'allowed' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {selectedZone.type === 'allowed' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <Ban className="w-4 h-4 text-red-600" />
                )}
                <h4 className="font-medium text-sm">{selectedZone.name}</h4>
              </div>
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
            className="relative bg-gray-100 rounded-lg overflow-hidden border-2 border-dashed border-gray-300"
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

            {/* Renderizar todas las zonas */}
            {imageLoaded && showZones && currentZones.map(zone => {
              const displayDimensions = getZoneDisplayDimensions(zone);
              const isSelected = selectedZoneId === zone.id;
              const colors = getZoneColors(zone.type, isSelected);
              const borderColor = zone.type === 'allowed' ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)';
              const fillColor = zone.type === 'allowed' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)';

              // Para triángulos, usamos SVG
              if (zone.shape === 'polygon') {
                return (
                  <div
                    key={zone.id}
                    className={`absolute cursor-move transition-shadow ${
                      isSelected ? 'z-10' : 'z-5'
                    }`}
                    style={{
                      left: displayDimensions.left,
                      top: displayDimensions.top,
                      width: displayDimensions.width,
                      height: displayDimensions.height,
                    }}
                    onMouseDown={(e) => handleZoneMouseDown(e, zone)}
                  >
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polygon
                        points="50,0 100,100 0,100"
                        fill={fillColor}
                        stroke={borderColor}
                        strokeWidth={isSelected ? 3 : 2}
                        strokeDasharray={isSelected ? "none" : "5,5"}
                      />
                    </svg>
                    {/* Nombre de la zona */}
                    {isSelected && (
                      <div
                        className={`absolute -top-6 left-0 px-2 py-0.5 text-xs font-medium text-white rounded-t whitespace-nowrap ${colors.labelBg}`}
                      >
                        {zone.name}
                      </div>
                    )}
                    {/* Icono central */}
                    <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: '25%' }}>
                      {zone.type === 'allowed' ? (
                        <CheckCircle className={`w-5 h-5 ${colors.iconColor} ${isSelected ? 'opacity-70' : 'opacity-40'}`} />
                      ) : (
                        <Ban className={`w-5 h-5 ${colors.iconColor} ${isSelected ? 'opacity-70' : 'opacity-40'}`} />
                      )}
                    </div>
                    {/* Handles de redimensionamiento para triángulo */}
                    {isSelected && (
                      <>
                        <div
                          className={`absolute -bottom-1 -left-1 w-3 h-3 bg-white border-2 ${zone.type === 'allowed' ? 'border-green-500' : 'border-red-500'} rounded-sm cursor-sw-resize`}
                          onMouseDown={(e) => handleZoneMouseDown(e, zone, 'sw')}
                        />
                        <div
                          className={`absolute -bottom-1 -right-1 w-3 h-3 bg-white border-2 ${zone.type === 'allowed' ? 'border-green-500' : 'border-red-500'} rounded-sm cursor-se-resize`}
                          onMouseDown={(e) => handleZoneMouseDown(e, zone, 'se')}
                        />
                      </>
                    )}
                  </div>
                );
              }

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
                    backgroundColor: colors.bg,
                    border: colors.border,
                    borderRadius: zone.shape === 'circle' ? '50%' : '4px',
                  }}
                  onMouseDown={(e) => handleZoneMouseDown(e, zone)}
                >
                  {/* Nombre de la zona */}
                  {isSelected && (
                    <div
                      className={`absolute -top-6 left-0 px-2 py-0.5 text-xs font-medium text-white rounded-t whitespace-nowrap ${colors.labelBg}`}
                    >
                      {zone.name}
                    </div>
                  )}

                  {/* Handles de redimensionamiento para rect y circle */}
                  {isSelected && (
                    <>
                      <div
                        className={`absolute -top-1 -left-1 w-3 h-3 bg-white border-2 ${zone.type === 'allowed' ? 'border-green-500' : 'border-red-500'} rounded-sm cursor-nw-resize`}
                        onMouseDown={(e) => handleZoneMouseDown(e, zone, 'nw')}
                      />
                      <div
                        className={`absolute -top-1 -right-1 w-3 h-3 bg-white border-2 ${zone.type === 'allowed' ? 'border-green-500' : 'border-red-500'} rounded-sm cursor-ne-resize`}
                        onMouseDown={(e) => handleZoneMouseDown(e, zone, 'ne')}
                      />
                      <div
                        className={`absolute -bottom-1 -left-1 w-3 h-3 bg-white border-2 ${zone.type === 'allowed' ? 'border-green-500' : 'border-red-500'} rounded-sm cursor-sw-resize`}
                        onMouseDown={(e) => handleZoneMouseDown(e, zone, 'sw')}
                      />
                      <div
                        className={`absolute -bottom-1 -right-1 w-3 h-3 bg-white border-2 ${zone.type === 'allowed' ? 'border-green-500' : 'border-red-500'} rounded-sm cursor-se-resize`}
                        onMouseDown={(e) => handleZoneMouseDown(e, zone, 'se')}
                      />
                    </>
                  )}

                  {/* Icono central */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {zone.type === 'allowed' ? (
                      <CheckCircle className={`w-6 h-6 ${colors.iconColor} ${isSelected ? 'opacity-70' : 'opacity-40'}`} />
                    ) : (
                      <Ban className={`w-6 h-6 ${colors.iconColor} ${isSelected ? 'opacity-70' : 'opacity-40'}`} />
                    )}
                  </div>
                </div>
              );
            })}

            {imageLoaded && currentZones.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white/90 px-4 py-3 rounded-lg shadow text-center">
                  <div className="flex justify-center gap-2 mb-2">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                    <Ban className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-sm text-gray-600">
                    Agrega zonas de diseño desde el panel izquierdo
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
