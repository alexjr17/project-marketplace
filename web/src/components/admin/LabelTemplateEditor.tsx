import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, Move, Eye, EyeOff, Lock, Unlock, Type, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { LabelZone, LabelZoneType } from '../../types/label-template';
import { ZONE_TYPE_LABELS, ZONE_SAMPLE_DATA } from '../../types/label-template';
import { Button, Field, IconButton, ImageInput, NumberInput, SelectInput, Switch, toast, useConfirm } from '../ui';

interface LabelTemplateEditorProps {
  backgroundImage: string | null;
  width: number;  // en points (6cm = 170.08 points)
  height: number; // en points (9cm = 255.12 points)
  zones: LabelZone[];
  onZonesChange: (zones: LabelZone[]) => void;
  onBackgroundImageChange?: (imageUrl: string | null) => void;
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

// Convertir points a cm (72 DPI: 1 cm = 28.35 points)
const pointsToCm = (points: number): number => {
  return Math.round((points / 28.35) * 10) / 10;
};

const cmToPoints = (cm: number): number => {
  return Math.round(cm * 28.35 * 10) / 10;
};

// Calcular tamaño de fuente proporcional a las dimensiones de la zona
const calculateFontSize = (width: number, height: number): number => {
  // Usar el lado más pequeño como referencia para que el texto quepa
  const minDimension = Math.min(width, height);
  // Aproximadamente 35% del lado más pequeño, con límites razonables
  const fontSize = Math.round(minDimension * 0.35);
  // Limitar entre 6pt (mínimo legible) y 28pt (máximo práctico)
  return Math.max(6, Math.min(28, fontSize));
};

export const LabelTemplateEditor = ({
  backgroundImage,
  width,
  height,
  zones,
  onZonesChange,
  onBackgroundImageChange,
}: LabelTemplateEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const confirm = useConfirm();

  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [showZones, setShowZones] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [, setImageDimensions] = useState({ width: 0, height: 0 });
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [zonesReady, setZonesReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0); // 1.0 = 100%, 1.5 = 150%, etc.

  // Estado para crear nueva zona
  const [isCreatingZone, setIsCreatingZone] = useState(false);
  const [newZoneType, setNewZoneType] = useState<LabelZoneType | ''>('');
  const [newZoneWidthCm, setNewZoneWidthCm] = useState<number>(3);
  const [newZoneHeightCm, setNewZoneHeightCm] = useState<number>(1);

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

  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      // Capturar las dimensiones naturales de la imagen
      setImageDimensions({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });

      // Usar requestAnimationFrame para esperar a que el navegador calcule el layout
      requestAnimationFrame(() => {
        setImageLoaded(true);
        setUploadingImage(false);
        setImageError(false);
      });
    }
  }, []);

  const handleImageError = useCallback(() => {
    console.error('Error al cargar la imagen de fondo');
    setImageLoaded(false);
    setUploadingImage(false);
    setImageError(true);
  }, []);

  // Si no hay imagen de fondo, marcar como cargado inmediatamente
  useEffect(() => {
    if (!backgroundImage) {
      setImageLoaded(true);
      setUploadingImage(false);
      setImageError(false);
      setZonesReady(true);
    } else {
      setImageLoaded(false);
      setImageError(false);
      setZonesReady(false);
    }
  }, [backgroundImage]);

  // Verificar si la imagen ya está cargada (desde caché o base64)
  useEffect(() => {
    if (!backgroundImage) return;

    let attempts = 0;
    const maxAttempts = 50; // 5 segundos máximo (50 * 100ms)

    // Verificar periódicamente hasta que la imagen esté cargada
    const checkInterval = setInterval(() => {
      if (imageRef.current) {
        const img = imageRef.current as HTMLImageElement;

        // Si la imagen ya está completa (cargada desde caché o base64), disparar onLoad inmediatamente
        if (img.complete && img.naturalWidth > 0) {
          handleImageLoad();
          clearInterval(checkInterval);
        }
      }

      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
      }
    }, 100);

    return () => clearInterval(checkInterval);
  }, [backgroundImage, handleImageLoad]);

  // Verificar si las zonas están listas para renderizarse
  useEffect(() => {
    if (!imageLoaded || !backgroundImage) return;

    // Dar un pequeño delay para que el navegador calcule las dimensiones
    const timer = setTimeout(() => {
      setZonesReady(true);
    }, 150);

    return () => clearTimeout(timer);
  }, [imageLoaded, backgroundImage]);

  // Forzar actualización de zonas cuando cambia el zoom
  useEffect(() => {
    // Si hay imagen de fondo pero no está cargada, no hacer nada
    if (backgroundImage && !imageLoaded) return;

    // Temporalmente desactivar zonas
    setZonesReady(false);

    // Esperar a que el navegador aplique el transform: scale()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setZonesReady(true);
      });
    });
  }, [zoomLevel, imageLoaded, backgroundImage]);

  const getRelativePosition = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current || !imageRef.current) return { x: 0, y: 0 };

    const element = imageRef.current;

    // Si no hay imagen de fondo, el elemento es un div con el rectángulo blanco
    if (!backgroundImage) {
      // El rectángulo blanco está dentro del div contenedor
      const whiteRect = element.querySelector('#label-white-rect') as HTMLDivElement;
      if (!whiteRect) return { x: 0, y: 0 };

      const rect = whiteRect.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // El rectángulo ya tiene el tamaño correcto en píxeles, calcular la escala
      // Compensar por el zoom dividiendo el tamaño del rect
      const scale = (rect.width / zoomLevel) / width;

      const x = mouseX / scale / zoomLevel;
      const y = mouseY / scale / zoomLevel;

      return {
        x: Math.max(0, Math.min(width, x)),
        y: Math.max(0, Math.min(height, y))
      };
    }

    // Si hay imagen de fondo - SIMPLIFICADO con object-fill
    const img = element as HTMLImageElement;
    const rect = img.getBoundingClientRect();

    // Con object-fill, la imagen llena todo el contenedor, sin offsets
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Escalar directamente de píxeles de pantalla a points
    // Compensar por el zoom dividiendo las dimensiones del rect
    const scaleX = width / (rect.width / zoomLevel);
    const scaleY = height / (rect.height / zoomLevel);

    const x = (mouseX / zoomLevel) * scaleX;
    const y = (mouseY / zoomLevel) * scaleY;

    return {
      x: Math.max(0, Math.min(width, x)),
      y: Math.max(0, Math.min(height, y))
    };
  }, [width, height, backgroundImage, zoomLevel]);

  const handleZoneMouseDown = (e: React.MouseEvent, zone: LabelZone, handle?: string) => {
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
        startWidth: zone.width,
        startHeight: zone.height,
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
        startWidth: zone.width,
        startHeight: zone.height,
        resizeHandle: null,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging && !dragState.isResizing) return;
      if (selectedZoneId === null) return;

      const pos = getRelativePosition(e);
      const deltaX = pos.x - dragState.startX;
      const deltaY = pos.y - dragState.startY;

      const updatedZones = zones.map(zone => {
        if (zone.id !== selectedZoneId) return zone;

        if (dragState.isDragging) {
          const newX = Math.max(0, Math.min(width - zone.width, dragState.startZoneX + deltaX));
          const newY = Math.max(0, Math.min(height - zone.height, dragState.startZoneY + deltaY));
          return { ...zone, x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 };
        } else if (dragState.isResizing) {
          let newWidth = dragState.startWidth;
          let newHeight = dragState.startHeight;
          let newX = dragState.startZoneX;
          let newY = dragState.startZoneY;

          const aspectRatio = dragState.startWidth / dragState.startHeight;

          switch (dragState.resizeHandle) {
            case 'se':
              newWidth = Math.max(10, dragState.startWidth + deltaX);
              if (lockAspectRatio) {
                newHeight = newWidth / aspectRatio;
              } else {
                newHeight = Math.max(10, dragState.startHeight + deltaY);
              }
              break;
            case 'sw':
              newWidth = Math.max(10, dragState.startWidth - deltaX);
              if (lockAspectRatio) {
                newHeight = newWidth / aspectRatio;
              } else {
                newHeight = Math.max(10, dragState.startHeight + deltaY);
              }
              newX = dragState.startZoneX + (dragState.startWidth - newWidth);
              break;
            case 'ne':
              newWidth = Math.max(10, dragState.startWidth + deltaX);
              if (lockAspectRatio) {
                newHeight = newWidth / aspectRatio;
                newY = dragState.startZoneY + (dragState.startHeight - newHeight);
              } else {
                newHeight = Math.max(10, dragState.startHeight - deltaY);
                newY = dragState.startZoneY + (dragState.startHeight - newHeight);
              }
              break;
            case 'nw':
              newWidth = Math.max(10, dragState.startWidth - deltaX);
              if (lockAspectRatio) {
                newHeight = newWidth / aspectRatio;
                newX = dragState.startZoneX + (dragState.startWidth - newWidth);
                newY = dragState.startZoneY + (dragState.startHeight - newHeight);
              } else {
                newHeight = Math.max(10, dragState.startHeight - deltaY);
                newX = dragState.startZoneX + (dragState.startWidth - newWidth);
                newY = dragState.startZoneY + (dragState.startHeight - newHeight);
              }
              break;
          }

          newWidth = Math.max(10, newWidth);
          newHeight = Math.max(10, newHeight);
          newX = Math.max(0, Math.min(width - newWidth, newX));
          newY = Math.max(0, Math.min(height - newHeight, newY));
          newWidth = Math.min(width - newX, newWidth);
          newHeight = Math.min(height - newY, newHeight);

          return {
            ...zone,
            x: Math.round(newX * 10) / 10,
            y: Math.round(newY * 10) / 10,
            width: Math.round(newWidth * 10) / 10,
            height: Math.round(newHeight * 10) / 10,
            fontSize: calculateFontSize(newWidth, newHeight) // Actualizar fontSize proporcionalmente
          };
        }
        return zone;
      });

      onZonesChange(updatedZones);
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
  }, [dragState, selectedZoneId, getRelativePosition, lockAspectRatio, zones, width, height, onZonesChange]);

  const getImageContentArea = useCallback(() => {
    if (!imageRef.current) return null;

    const element = imageRef.current;

    // Si no hay imagen de fondo, obtener el rectángulo blanco
    if (!backgroundImage) {
      const whiteRect = element.querySelector('#label-white-rect') as HTMLDivElement;
      if (!whiteRect) return null;

      const rect = whiteRect.getBoundingClientRect();

      // Validar que las dimensiones sean válidas antes de devolver
      if (!rect.width || !rect.height || rect.width <= 0 || rect.height <= 0) {
        return null;
      }

      // Las zonas están DENTRO del rectángulo blanco, no necesitan offset
      // Dividir por zoomLevel para compensar el transform: scale() aplicado al contenedor
      return {
        renderedWidth: rect.width / zoomLevel,
        renderedHeight: rect.height / zoomLevel,
        offsetX: 0,
        offsetY: 0,
      };
    }

    // Si hay imagen de fondo - SIMPLIFICADO con object-fill
    const img = element as HTMLImageElement;
    const rect = img.getBoundingClientRect();

    if (!rect.width || !rect.height || rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    // Con object-fill, el área renderizada = área del contenedor, SIN offsets
    // Dividir por zoomLevel para compensar el transform: scale() aplicado al contenedor
    return {
      renderedWidth: rect.width / zoomLevel,
      renderedHeight: rect.height / zoomLevel,
      offsetX: 0,  // Siempre 0 con object-fill
      offsetY: 0,  // Siempre 0 con object-fill
    };
  }, [backgroundImage, zoomLevel]);

  const getZoneDisplayDimensions = (zone: LabelZone) => {
    const contentArea = getImageContentArea();

    if (!contentArea) {
      // Si no hay área de contenido válida, no renderizar (dimensiones 0)
      return null;
    }

    const { renderedWidth, renderedHeight, offsetX, offsetY } = contentArea;

    // Convertir coordenadas de points a píxeles de pantalla
    const leftPx = offsetX + (zone.x / width) * renderedWidth;
    const topPx = offsetY + (zone.y / height) * renderedHeight;
    const widthPx = (zone.width / width) * renderedWidth;
    const heightPx = (zone.height / height) * renderedHeight;

    return {
      left: `${leftPx}px`,
      top: `${topPx}px`,
      width: `${widthPx}px`,
      height: `${heightPx}px`,
    };
  };

  const handleCreateZone = () => {
    if (!newZoneType) {
      toast.error('Selecciona un tipo de zona');
      return;
    }

    if (newZoneWidthCm <= 0 || newZoneHeightCm <= 0) {
      toast.error('Las dimensiones deben ser mayores a 0');
      return;
    }

    const zoneWidth = cmToPoints(newZoneWidthCm);
    const zoneHeight = cmToPoints(newZoneHeightCm);

    // Centrar la zona inicialmente
    const posX = Math.max(0, (width - zoneWidth) / 2);
    const posY = Math.max(0, (height - zoneHeight) / 2);

    // Crear ID temporal negativo para zonas nuevas (antes de guardar en DB)
    const tempId = -Date.now();

    const newZone: LabelZone = {
      id: tempId,
      labelTemplateId: 0, // Se asignará al guardar
      zoneType: newZoneType,
      x: Math.round(posX * 10) / 10,
      y: Math.round(posY * 10) / 10,
      width: Math.round(zoneWidth * 10) / 10,
      height: Math.round(zoneHeight * 10) / 10,
      fontSize: calculateFontSize(zoneWidth, zoneHeight), // Calculado proporcionalmente
      fontWeight: 'normal',
      textAlign: 'center',
      fontColor: '#000000',
      showLabel: true,
      rotation: 0,
      zIndex: zones.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onZonesChange([...zones, newZone]);
    setIsCreatingZone(false);
    setNewZoneType('');
    setNewZoneWidthCm(3);
    setNewZoneHeightCm(1);
    setSelectedZoneId(tempId);
  };

  const handleDeleteZone = async (zoneId: number) => {
    if (!(await confirm({ title: '¿Eliminar esta zona?', tone: 'danger' }))) return;
    const newZones = zones.filter(z => z.id !== zoneId);
    onZonesChange(newZones);
    if (selectedZoneId === zoneId) setSelectedZoneId(null);
  };

  const getZoneColor = (zone: LabelZone) => {
    const colors: Record<string, string> = {
      PRODUCT_NAME: 'rgba(59, 130, 246, 0.1)',
      SIZE: 'rgba(16, 185, 129, 0.1)',
      COLOR: 'rgba(245, 158, 11, 0.1)',
      BARCODE: 'rgba(139, 92, 246, 0.1)',
      BARCODE_TEXT: 'rgba(236, 72, 153, 0.1)',
      SKU: 'rgba(99, 102, 241, 0.1)',
      PRICE: 'rgba(239, 68, 68, 0.1)',
      CUSTOM_TEXT: 'rgba(107, 114, 128, 0.1)',
    };
    return colors[zone.zoneType] || 'rgba(156, 163, 175, 0.1)';
  };

  const getBorderColor = (zone: LabelZone) => {
    const colors: Record<string, string> = {
      PRODUCT_NAME: 'rgb(59, 130, 246)',
      SIZE: 'rgb(16, 185, 129)',
      COLOR: 'rgb(245, 158, 11)',
      BARCODE: 'rgb(139, 92, 246)',
      BARCODE_TEXT: 'rgb(236, 72, 153)',
      SKU: 'rgb(99, 102, 241)',
      PRICE: 'rgb(239, 68, 68)',
      CUSTOM_TEXT: 'rgb(107, 114, 128)',
    };
    return colors[zone.zoneType] || 'rgb(156, 163, 175)';
  };

  const selectedZone = zones.find(z => z.id === selectedZoneId);

  const zoneTypeOptions = Object.keys(ZONE_TYPE_LABELS) as LabelZoneType[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Type className="w-5 h-5 text-app-600" />
          Diseño de la etiqueta
        </h2>

        <div className="flex items-center gap-2">
          {/* Zoom */}
          <div className="flex items-center rounded-lg border border-gray-300 bg-white">
            <IconButton title="Alejar" onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))} disabled={zoomLevel <= 0.5}>
              <ZoomOut className="w-4 h-4" />
            </IconButton>
            <span className="px-1 text-sm font-medium text-gray-700 min-w-[52px] text-center tabular-nums">{Math.round(zoomLevel * 100)}%</span>
            <IconButton title="Acercar" onClick={() => setZoomLevel(prev => Math.min(3.0, prev + 0.25))} disabled={zoomLevel >= 3.0}>
              <ZoomIn className="w-4 h-4" />
            </IconButton>
            <button
              type="button"
              onClick={() => setZoomLevel(1.0)}
              disabled={zoomLevel === 1.0}
              title="Restablecer zoom"
              className="h-9 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 border-l border-gray-300 rounded-r-lg"
            >
              100%
            </button>
          </div>

          <Button
            size="sm"
            variant={showZones ? 'outline' : 'secondary'}
            icon={showZones ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            onClick={() => setShowZones(!showZones)}
            title={showZones ? 'Ocultar zonas' : 'Mostrar zonas'}
          >
            Zonas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Imagen de fondo */}
          <Field
            label="Imagen de fondo"
            hint={backgroundImage
              ? `Se ajusta a ${pointsToCm(width)} × ${pointsToCm(height)} cm; si la proporción no coincide, se recorta para llenar el área.`
              : `Opcional. Tamaño de la etiqueta: ${pointsToCm(width)} × ${pointsToCm(height)} cm.`}
          >
            <ImageInput
              value={backgroundImage}
              onChange={(v) => onBackgroundImageChange?.(v || null)}
              ratio="landscape"
              allowUrl={false}
              disabled={!onBackgroundImageChange}
            />
          </Field>

          {/* Zonas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Zonas ({zones.length})</span>
              {!isCreatingZone && (
                <Button size="sm" variant="secondary" icon={<Plus className="w-4 h-4" />} onClick={() => setIsCreatingZone(true)}>
                  Agregar zona
                </Button>
              )}
            </div>

            {isCreatingZone && (
              <div className="rounded-lg border border-app-300 p-3 space-y-3 mb-3">
                <Field label="Tipo de información" required>
                  <SelectInput value={newZoneType} onChange={(e) => setNewZoneType(e.target.value as LabelZoneType)}>
                    <option value="">Seleccionar tipo…</option>
                    {zoneTypeOptions.map(type => (
                      <option key={type} value={type}>{ZONE_TYPE_LABELS[type]}</option>
                    ))}
                  </SelectInput>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ancho">
                    <NumberInput suffix="cm" value={newZoneWidthCm} onChange={(e) => setNewZoneWidthCm(parseFloat(e.target.value) || 0)} min="0.5" max={pointsToCm(width)} step="0.5" />
                  </Field>
                  <Field label="Alto">
                    <NumberInput suffix="cm" value={newZoneHeightCm} onChange={(e) => setNewZoneHeightCm(parseFloat(e.target.value) || 0)} min="0.5" max={pointsToCm(height)} step="0.5" />
                  </Field>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="secondary" onClick={() => setIsCreatingZone(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleCreateZone}>Crear zona</Button>
                </div>
              </div>
            )}

            {zones.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-500">
                Aún no hay zonas. Agrega la primera (nombre, talla, código de barras…).
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 max-h-[320px] overflow-y-auto">
                {zones.map(zone => {
                  const active = selectedZoneId === zone.id;
                  return (
                    <li
                      key={zone.id}
                      onClick={() => setSelectedZoneId(zone.id)}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${active ? 'bg-app-50' : 'hover:bg-gray-50'}`}
                    >
                      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: getBorderColor(zone) }} />
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm truncate ${active ? 'font-medium text-app-700' : 'text-gray-800'}`}>{ZONE_TYPE_LABELS[zone.zoneType]}</span>
                        <span className="block text-xs text-gray-500">{pointsToCm(zone.width)} × {pointsToCm(zone.height)} cm</span>
                      </span>
                      <IconButton title="Eliminar zona" tone="danger" onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone.id); }}>
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Zona seleccionada */}
          {selectedZone && (
            <div className="rounded-lg border border-gray-200 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm text-gray-900">{ZONE_TYPE_LABELS[selectedZone.zoneType]}</p>
                <Button
                  size="sm"
                  variant={lockAspectRatio ? 'outline' : 'ghost'}
                  icon={lockAspectRatio ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  onClick={() => setLockAspectRatio(!lockAspectRatio)}
                  title={lockAspectRatio ? 'Proporciones bloqueadas' : 'Proporciones libres'}
                >
                  {lockAspectRatio ? 'Proporción fija' : 'Proporción libre'}
                </Button>
              </div>

              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-gray-500">Tamaño</dt><dd className="font-medium text-gray-900 tabular-nums">{pointsToCm(selectedZone.width)} × {pointsToCm(selectedZone.height)} cm</dd></div>
                <div><dt className="text-gray-500">Posición X</dt><dd className="font-medium text-gray-900 tabular-nums">{pointsToCm(selectedZone.x)} cm</dd></div>
                <div><dt className="text-gray-500">Posición Y</dt><dd className="font-medium text-gray-900 tabular-nums">{pointsToCm(selectedZone.y)} cm</dd></div>
              </dl>

              {['SIZE', 'COLOR', 'SKU'].includes(selectedZone.zoneType) && (
                <Switch
                  checked={selectedZone.showLabel !== false}
                  onChange={() => {
                    const newZones = zones.map(z => (z.id === selectedZone.id ? { ...z, showLabel: !z.showLabel } : z));
                    onZonesChange(newZones);
                  }}
                  label="Mostrar etiqueta"
                  description={'Ej: "Talla:", "Color:", "SKU:"'}
                />
              )}

              <p className="rounded-md bg-gray-50 px-2.5 py-2 text-xs text-gray-600">
                Vista previa:{' '}
                <strong className="text-gray-900">
                  {selectedZone.showLabel !== false
                    ? ZONE_SAMPLE_DATA[selectedZone.zoneType]
                    : ZONE_SAMPLE_DATA[selectedZone.zoneType].replace(/^(Talla:|Color:|SKU:)\s*/, '')}
                </strong>
              </p>
            </div>
          )}
        </div>

        {/* Vista previa de la etiqueta */}
        <div className="col-span-12 lg:col-span-8">
          <div
            ref={containerRef}
            className="relative bg-gray-100 rounded-lg overflow-auto border-2 border-dashed border-gray-300 flex items-center justify-center p-8"
            style={{ minHeight: '500px', maxHeight: '700px' }}
          >
            {uploadingImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-20">
                <div className="text-gray-700 font-medium">Cargando imagen...</div>
              </div>
            )}

            {backgroundImage ? (
              <div
                key={`label-${zoomLevel}`}
                className="relative"
                style={{
                  width: `${width}px`,
                  height: `${height}px`,
                  maxWidth: '100%',
                  maxHeight: '700px',
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center',
                }}
              >
                <img
                  ref={imageRef}
                  src={backgroundImage}
                  alt="Etiqueta"
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  className="w-full h-full object-cover"
                  style={{
                    display: imageLoaded ? 'block' : 'none',
                  }}
                />

                {!imageLoaded && !uploadingImage && !imageError && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-gray-500">Cargando...</div>
                  </div>
                )}

                {imageError && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-red-500 text-sm">Error al cargar la imagen</div>
                  </div>
                )}

                {/* Renderizar zonas DENTRO del contenedor de la imagen */}
                {showZones && imageLoaded && zonesReady && zones.map(zone => {
                  const displayDimensions = getZoneDisplayDimensions(zone);

                  // No renderizar si no hay dimensiones válidas
                  if (!displayDimensions) return null;

                  const borderColor = getBorderColor(zone);
                  const fillColor = getZoneColor(zone);
                  const isSelected = selectedZoneId === zone.id;

                  return (
                    <div
                      key={zone.id}
                      className={`absolute border-2 cursor-move transition-all ${
                        isSelected ? 'shadow-lg z-10 opacity-70' : 'z-0 opacity-20 hover:opacity-40'
                      }`}
                      style={{
                        left: displayDimensions.left,
                        top: displayDimensions.top,
                        width: displayDimensions.width,
                        height: displayDimensions.height,
                        backgroundColor: fillColor,
                        borderColor: borderColor,
                        borderStyle: 'solid',
                      }}
                      onMouseDown={(e) => handleZoneMouseDown(e, zone)}
                    >
                      {isSelected && (
                        <div
                          className="absolute -top-6 left-0 px-2 py-0.5 text-xs font-medium text-white rounded-t whitespace-nowrap"
                          style={{ backgroundColor: borderColor }}
                        >
                          {ZONE_TYPE_LABELS[zone.zoneType]}
                        </div>
                      )}

                      {isSelected && (
                        <>
                          {/* Handles de redimensionamiento */}
                          <div
                            className="absolute -top-1 -left-1 w-3 h-3 bg-white border-2 rounded-sm cursor-nw-resize"
                            style={{ borderColor }}
                            onMouseDown={(e) => handleZoneMouseDown(e, zone, 'nw')}
                          />
                          <div
                            className="absolute -top-1 -right-1 w-3 h-3 bg-white border-2 rounded-sm cursor-ne-resize"
                            style={{ borderColor }}
                            onMouseDown={(e) => handleZoneMouseDown(e, zone, 'ne')}
                          />
                          <div
                            className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border-2 rounded-sm cursor-sw-resize"
                            style={{ borderColor }}
                            onMouseDown={(e) => handleZoneMouseDown(e, zone, 'sw')}
                          />
                          <div
                            className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border-2 rounded-sm cursor-se-resize"
                            style={{ borderColor }}
                            onMouseDown={(e) => handleZoneMouseDown(e, zone, 'se')}
                          />

                          <div className="absolute inset-0 flex items-center justify-center opacity-50 pointer-events-none">
                            <Move className="w-6 h-6 text-gray-800" />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                ref={imageRef as React.RefObject<HTMLDivElement>}
                className="flex items-center justify-center"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center',
                }}
              >
                <div
                  id="label-white-rect"
                  className="relative bg-white border-2 border-gray-300 shadow-sm"
                  style={{
                    width: `${width}px`,
                    height: `${height}px`,
                    maxWidth: '100%',
                    aspectRatio: `${width} / ${height}`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm pointer-events-none">
                    {pointsToCm(width)} cm × {pointsToCm(height)} cm
                  </div>

                  {/* Renderizar zonas DENTRO del rectángulo blanco */}
                  {showZones && zonesReady && zones.map(zone => {
                    const displayDimensions = getZoneDisplayDimensions(zone);

                    // No renderizar si no hay dimensiones válidas
                    if (!displayDimensions) return null;

                    const borderColor = getBorderColor(zone);
                    const fillColor = getZoneColor(zone);
                    const isSelected = selectedZoneId === zone.id;

                    return (
                      <div
                        key={zone.id}
                        className={`absolute border-2 cursor-move transition-all ${
                          isSelected ? 'shadow-lg z-10 opacity-70' : 'z-0 opacity-20 hover:opacity-40'
                        }`}
                        style={{
                          left: displayDimensions.left,
                          top: displayDimensions.top,
                          width: displayDimensions.width,
                          height: displayDimensions.height,
                          backgroundColor: fillColor,
                          borderColor: borderColor,
                          borderStyle: 'solid',
                        }}
                        onMouseDown={(e) => handleZoneMouseDown(e, zone)}
                      >
                        {isSelected && (
                          <div
                            className="absolute -top-6 left-0 px-2 py-0.5 text-xs font-medium text-white rounded-t whitespace-nowrap"
                            style={{ backgroundColor: borderColor }}
                          >
                            {ZONE_TYPE_LABELS[zone.zoneType]}
                          </div>
                        )}

                        {isSelected && (
                          <>
                            {/* Handles de redimensionamiento */}
                            <div
                              className="absolute -top-1 -left-1 w-3 h-3 bg-white border-2 rounded-sm cursor-nw-resize"
                              style={{ borderColor }}
                              onMouseDown={(e) => handleZoneMouseDown(e, zone, 'nw')}
                            />
                            <div
                              className="absolute -top-1 -right-1 w-3 h-3 bg-white border-2 rounded-sm cursor-ne-resize"
                              style={{ borderColor }}
                              onMouseDown={(e) => handleZoneMouseDown(e, zone, 'ne')}
                            />
                            <div
                              className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border-2 rounded-sm cursor-sw-resize"
                              style={{ borderColor }}
                              onMouseDown={(e) => handleZoneMouseDown(e, zone, 'sw')}
                            />
                            <div
                              className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border-2 rounded-sm cursor-se-resize"
                              style={{ borderColor }}
                              onMouseDown={(e) => handleZoneMouseDown(e, zone, 'se')}
                            />

                            <div className="absolute inset-0 flex items-center justify-center opacity-50 pointer-events-none">
                              <Move className="w-6 h-6 text-gray-800" />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Move className="w-3 h-3" /> Arrastra para mover
            </span>
            <span className="flex items-center gap-1">
              <Maximize2 className="w-3 h-3" /> Esquinas para redimensionar
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
