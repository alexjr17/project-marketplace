import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../services/api.service';
import { assetUrl } from '../../utils/assetUrl';
import { templateZonesService, type TemplateZone, type CreateTemplateZoneDto } from '../../services/template-zones.service';
import { zoneTypesService, type ZoneType } from '../../services/zone-types.service';
import { Badge, Button, Field, MoneyInput, NumberInput, RadioGroup, SelectInput, Spinner, TextInput, toast, useConfirm } from '../ui';
import {
  Plus,
  Trash2,
  Move,
  Maximize2,
  Eye,
  EyeOff,
  Save,
  Layers,
  MousePointer2,
  Lock,
  Unlock,
  Upload,
  Image as ImageIcon,
  X,
  Ban,
  Square,
  Circle,
  Triangle,
  CheckCircle
} from 'lucide-react';

// Imágenes por tipo de zona (front, back, etc.)
interface ZoneTypeImages {
  [zoneTypeSlug: string]: string; // slug -> data URL o URL de imagen
}

interface VisualZoneEditorProps {
  templateId: number;
  templateImage: string;
  templateImageBack?: string;
  onZonesChange?: (zones: TemplateZone[]) => void;
  // Imágenes personalizadas por tipo de zona
  zoneTypeImages?: ZoneTypeImages;
  onZoneTypeImagesChange?: (images: ZoneTypeImages) => void;
}

interface DragState {
  isDragging: boolean;
  isResizing: boolean;
  startX: number;
  startY: number;
  startZoneX: number;
  startZoneY: number;
  startMaxWidth: number;
  startMaxHeight: number;
  resizeHandle: string | null;
}

/** Lee un archivo como data URL (base64). */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/** Sube una imagen base64 al servidor y devuelve su URL almacenada. */
async function uploadDataUrl(dataUrl: string): Promise<string> {
  const res = await api.post<{ url: string }>('/uploads/base64', {
    image: dataUrl,
    folder: 'templates',
  });
  const url = res.data?.url;
  if (!url) throw new Error('No se pudo subir la imagen');
  return url;
}

/**
 * Garantiza que el valor sea una URL: si todavía es base64 (data:...) lo
 * sube y devuelve la URL; si ya es una URL la deja igual. Así el template
 * guarda solo URLs y nunca imágenes base64 pesadas en la base de datos.
 */
async function ensureUrl(value: string): Promise<string> {
  if (typeof value === 'string' && value.startsWith('data:')) {
    return uploadDataUrl(value);
  }
  return value;
}

export const VisualZoneEditor = ({
  templateId,
  templateImage,
  onZonesChange,
  zoneTypeImages: externalZoneTypeImages,
  onZoneTypeImagesChange,
}: VisualZoneEditorProps) => {
  const confirm = useConfirm();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [zones, setZones] = useState<TemplateZone[]>([]);
  const [zoneTypes, setZoneTypes] = useState<ZoneType[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentViewSlug, setCurrentViewSlug] = useState<string | null>(null);
  const [showZones, setShowZones] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  const [isCreatingZone, setIsCreatingZone] = useState(false);
  const [newZoneType, setNewZoneType] = useState<number>(0);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneWidthCm, setNewZoneWidthCm] = useState<number>(18);
  const [newZoneHeightCm, setNewZoneHeightCm] = useState<number>(25);
  const [newZoneShape, setNewZoneShape] = useState<'rect' | 'circle' | 'polygon'>('rect');
  const [newZoneIsBlocked, setNewZoneIsBlocked] = useState(false);
  const [newZonePrice, setNewZonePrice] = useState<number>(0);

  // Estado para bloqueo de proporciones al redimensionar
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true); // Bloquear proporciones por defecto

  // Estado para forzar re-render cuando cambia el tamaño de ventana
  const [, setWindowSize] = useState({ width: 0, height: 0 });

  // Estado para imágenes por tipo de zona
  const [zoneTypeImages, setZoneTypeImages] = useState<ZoneTypeImages>(externalZoneTypeImages || {});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedZoneTypeForImage, setSelectedZoneTypeForImage] = useState<string | null>(null);

  // Estado para precio editable de la zona seleccionada
  const [editablePrice, setEditablePrice] = useState<number>(0);

  // Actualizar precio cuando cambia la zona seleccionada
  useEffect(() => {
    const zone = zones.find(z => z.id === selectedZoneId);
    if (zone) {
      setEditablePrice(zone.price || 0);
    }
  }, [selectedZoneId, zones]);

  // Sincronizar con props externas cuando cambien
  useEffect(() => {
    if (externalZoneTypeImages) {
      setZoneTypeImages(externalZoneTypeImages);
    }
  }, [externalZoneTypeImages]);

  // Listener para cambios de tamaño de ventana
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    isResizing: false,
    startX: 0,
    startY: 0,
    startZoneX: 0,
    startZoneY: 0,
    startMaxWidth: 0,
    startMaxHeight: 0,
    resizeHandle: null,
  });

  useEffect(() => {
    loadData();
  }, [templateId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [zonesData, typesData] = await Promise.all([
        templateZonesService.getByTemplateId(templateId),
        zoneTypesService.getAll(),
      ]);

      const validZones = Array.isArray(zonesData) ? zonesData : [];
      const validTypes = Array.isArray(typesData) ? typesData : [];

      setZones(validZones.filter(z => z.isActive));
      setZoneTypes(validTypes.filter(t => t.isActive));

      onZonesChange?.(validZones);
    } catch (err) {
      setError('Error al cargar las zonas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageLoad = () => {
    if (imageRef.current) {
      setImageLoaded(true);
    }
  };

  const getRelativePosition = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current || !imageRef.current) return { x: 0, y: 0 };

    const img = imageRef.current;
    const rect = img.getBoundingClientRect();
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    if (!naturalWidth || !naturalHeight) {
      // Fallback si no hay dimensiones naturales
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      return {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y))
      };
    }

    // Calcular el área real renderizada de la imagen (considerando object-contain)
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

    // Calcular posición relativa dentro del área real de la imagen
    const mouseX = e.clientX - rect.left - offsetX;
    const mouseY = e.clientY - rect.top - offsetY;

    const x = (mouseX / renderedWidth) * 100;
    const y = (mouseY / renderedHeight) * 100;

    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    };
  }, []);

  const handleZoneMouseDown = (e: React.MouseEvent, zone: TemplateZone, handle?: string) => {
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
        startZoneX: zone.positionX,
        startZoneY: zone.positionY,
        startMaxWidth: zone.maxWidth,
        startMaxHeight: zone.maxHeight,
        resizeHandle: handle,
      });
    } else {
      setDragState({
        isDragging: true,
        isResizing: false,
        startX: pos.x,
        startY: pos.y,
        startZoneX: zone.positionX,
        startZoneY: zone.positionY,
        startMaxWidth: zone.maxWidth,
        startMaxHeight: zone.maxHeight,
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

      setZones(prev => prev.map(zone => {
        if (zone.id !== selectedZoneId) return zone;

        if (dragState.isDragging) {
          const newX = Math.max(0, Math.min(100 - zone.maxWidth, dragState.startZoneX + deltaX));
          const newY = Math.max(0, Math.min(100 - zone.maxHeight, dragState.startZoneY + deltaY));
          return { ...zone, positionX: Math.round(newX), positionY: Math.round(newY) };
        } else if (dragState.isResizing) {
          let newMaxWidth = dragState.startMaxWidth;
          let newMaxHeight = dragState.startMaxHeight;
          let newX = dragState.startZoneX;
          let newY = dragState.startZoneY;

          // Calcular aspect ratio original para bloqueo de proporciones
          const aspectRatio = dragState.startMaxWidth / dragState.startMaxHeight;

          // Mantener Ctrl (o Cmd) presionado redimensiona libremente,
          // sin conservar la proporción, aunque el bloqueo esté activo.
          const effectiveLock = lockAspectRatio && !(e.ctrlKey || e.metaKey);

          switch (dragState.resizeHandle) {
            case 'se':
              newMaxWidth = Math.max(10, dragState.startMaxWidth + deltaX);
              if (effectiveLock) {
                newMaxHeight = newMaxWidth / aspectRatio;
              } else {
                newMaxHeight = Math.max(10, dragState.startMaxHeight + deltaY);
              }
              break;
            case 'sw':
              newMaxWidth = Math.max(10, dragState.startMaxWidth - deltaX);
              if (effectiveLock) {
                newMaxHeight = newMaxWidth / aspectRatio;
              } else {
                newMaxHeight = Math.max(10, dragState.startMaxHeight + deltaY);
              }
              newX = dragState.startZoneX + (dragState.startMaxWidth - newMaxWidth);
              break;
            case 'ne':
              newMaxWidth = Math.max(10, dragState.startMaxWidth + deltaX);
              if (effectiveLock) {
                newMaxHeight = newMaxWidth / aspectRatio;
                newY = dragState.startZoneY + (dragState.startMaxHeight - newMaxHeight);
              } else {
                newMaxHeight = Math.max(10, dragState.startMaxHeight - deltaY);
                newY = dragState.startZoneY + (dragState.startMaxHeight - newMaxHeight);
              }
              break;
            case 'nw':
              newMaxWidth = Math.max(10, dragState.startMaxWidth - deltaX);
              if (effectiveLock) {
                newMaxHeight = newMaxWidth / aspectRatio;
                newX = dragState.startZoneX + (dragState.startMaxWidth - newMaxWidth);
                newY = dragState.startZoneY + (dragState.startMaxHeight - newMaxHeight);
              } else {
                newMaxHeight = Math.max(10, dragState.startMaxHeight - deltaY);
                newX = dragState.startZoneX + (dragState.startMaxWidth - newMaxWidth);
                newY = dragState.startZoneY + (dragState.startMaxHeight - newMaxHeight);
              }
              break;
            case 'n':
              if (effectiveLock) {
                // En modo bloqueado, redimensionar desde arriba también afecta el ancho
                newMaxHeight = Math.max(10, dragState.startMaxHeight - deltaY);
                newMaxWidth = newMaxHeight * aspectRatio;
                newY = dragState.startZoneY + (dragState.startMaxHeight - newMaxHeight);
              } else {
                newMaxHeight = Math.max(10, dragState.startMaxHeight - deltaY);
                newY = dragState.startZoneY + (dragState.startMaxHeight - newMaxHeight);
              }
              break;
            case 's':
              if (effectiveLock) {
                newMaxHeight = Math.max(10, dragState.startMaxHeight + deltaY);
                newMaxWidth = newMaxHeight * aspectRatio;
              } else {
                newMaxHeight = Math.max(10, dragState.startMaxHeight + deltaY);
              }
              break;
            case 'e':
              if (effectiveLock) {
                newMaxWidth = Math.max(10, dragState.startMaxWidth + deltaX);
                newMaxHeight = newMaxWidth / aspectRatio;
              } else {
                newMaxWidth = Math.max(10, dragState.startMaxWidth + deltaX);
              }
              break;
            case 'w':
              if (effectiveLock) {
                newMaxWidth = Math.max(10, dragState.startMaxWidth - deltaX);
                newMaxHeight = newMaxWidth / aspectRatio;
                newX = dragState.startZoneX + (dragState.startMaxWidth - newMaxWidth);
              } else {
                newMaxWidth = Math.max(10, dragState.startMaxWidth - deltaX);
                newX = dragState.startZoneX + (dragState.startMaxWidth - newMaxWidth);
              }
              break;
          }

          // Asegurar valores mínimos
          newMaxWidth = Math.max(10, newMaxWidth);
          newMaxHeight = Math.max(10, newMaxHeight);

          newX = Math.max(0, Math.min(100 - newMaxWidth, newX));
          newY = Math.max(0, Math.min(100 - newMaxHeight, newY));
          newMaxWidth = Math.min(100 - newX, newMaxWidth);
          newMaxHeight = Math.min(100 - newY, newMaxHeight);

          return {
            ...zone,
            positionX: Math.round(newX),
            positionY: Math.round(newY),
            maxWidth: Math.round(newMaxWidth),
            maxHeight: Math.round(newMaxHeight)
          };
        }
        return zone;
      }));
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
          startMaxWidth: 0,
          startMaxHeight: 0,
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
  }, [dragState, selectedZoneId, getRelativePosition, lockAspectRatio]);

  // Dimensiones de referencia del área de impresión (en cm)
  // Estas son las dimensiones máximas del área de impresión de una camiseta típica
  const PRINT_AREA_WIDTH_CM = 50;  // Ancho máximo del área de impresión
  const PRINT_AREA_HEIGHT_CM = 70; // Alto máximo del área de impresión

  // Factor de conversión: píxeles por centímetro (para visualización en el editor)
  // Esto mantiene las proporciones correctas entre ancho y alto

  // Convertir porcentaje a cm
  const percentToCm = (percent: number, isWidth: boolean): number => {
    const maxCm = isWidth ? PRINT_AREA_WIDTH_CM : PRINT_AREA_HEIGHT_CM;
    return Math.round((percent / 100) * maxCm * 10) / 10; // Redondear a 1 decimal
  };

  // Calcular el área real de la imagen visible considerando object-contain
  const getImageContentArea = useCallback(() => {
    if (!imageRef.current) return null;

    const img = imageRef.current;
    const containerWidth = img.clientWidth;
    const containerHeight = img.clientHeight;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    if (!naturalWidth || !naturalHeight) return null;

    // Calcular el aspect ratio de la imagen y del contenedor
    const imageRatio = naturalWidth / naturalHeight;
    const containerRatio = containerWidth / containerHeight;

    let renderedWidth: number;
    let renderedHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (imageRatio > containerRatio) {
      // La imagen es más ancha que el contenedor (barras arriba y abajo)
      renderedWidth = containerWidth;
      renderedHeight = containerWidth / imageRatio;
      offsetX = 0;
      offsetY = (containerHeight - renderedHeight) / 2;
    } else {
      // La imagen es más alta que el contenedor (barras a los lados)
      renderedHeight = containerHeight;
      renderedWidth = containerHeight * imageRatio;
      offsetX = (containerWidth - renderedWidth) / 2;
      offsetY = 0;
    }

    return {
      renderedWidth,
      renderedHeight,
      offsetX,
      offsetY,
    };
  }, []);

  // Calcular dimensiones del recuadro en píxeles basándose en el área real de la imagen
  // Esto garantiza que el recuadro se vea igual sin importar el tamaño de pantalla
  const getZoneDisplayDimensions = (zone: TemplateZone) => {
    const contentArea = getImageContentArea();

    if (!contentArea) {
      return {
        left: `${zone.positionX}%`,
        top: `${zone.positionY}%`,
        width: `${zone.maxWidth}%`,
        height: `${zone.maxHeight}%`,
      };
    }

    const { renderedWidth, renderedHeight, offsetX, offsetY } = contentArea;

    // Calcular posición y tamaño en píxeles basados en el área real de la imagen
    const leftPx = offsetX + (zone.positionX / 100) * renderedWidth;
    const topPx = offsetY + (zone.positionY / 100) * renderedHeight;
    const widthPx = (zone.maxWidth / 100) * renderedWidth;
    const heightPx = (zone.maxHeight / 100) * renderedHeight;

    return {
      left: `${leftPx}px`,
      top: `${topPx}px`,
      width: `${widthPx}px`,
      height: `${heightPx}px`,
    };
  };

  // Manejar subida de imagen para tipo de zona.
  // La imagen se sube como archivo y se guarda solo la URL (no base64),
  // para no enviar payloads enormes al guardar el template.
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedZoneTypeForImage) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen válido');
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5 MB');
      return;
    }

    setUploadingImage(true);
    try {
      // Subir la nueva imagen y obtener su URL.
      const dataUrl = await readFileAsDataUrl(file);
      const url = await uploadDataUrl(dataUrl);

      // Convertir a URL cualquier imagen previa que aún esté en base64,
      // para que el template termine guardando solo URLs.
      const newImages: ZoneTypeImages = {};
      for (const [slug, value] of Object.entries(zoneTypeImages)) {
        newImages[slug] = await ensureUrl(value);
      }
      newImages[selectedZoneTypeForImage] = url;

      setZoneTypeImages(newImages);
      onZoneTypeImagesChange?.(newImages);
      setSelectedZoneTypeForImage(null);
    } catch {
      toast.error('Error al subir la imagen');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Eliminar imagen de tipo de zona
  const handleRemoveZoneTypeImage = (zoneTypeSlug: string) => {
    const newImages = { ...zoneTypeImages };
    delete newImages[zoneTypeSlug];
    setZoneTypeImages(newImages);
    onZoneTypeImagesChange?.(newImages);
  };

  const handleCreateZone = async () => {
    if (!newZoneType || !newZoneName.trim()) {
      toast.error('Selecciona la vista y escribe un nombre');
      return;
    }

    if (newZoneWidthCm <= 0 || newZoneHeightCm <= 0) {
      toast.error('Las dimensiones deben ser mayores a 0');
      return;
    }

    const selectedType = zoneTypes.find(t => t.id === newZoneType);
    const zoneSlug = selectedType?.slug || 'zone';
    const blockedPrefix = newZoneIsBlocked ? 'blocked-' : '';

    // Convertir cm a porcentajes basados en el área de impresión
    const widthPercent = Math.min((newZoneWidthCm / PRINT_AREA_WIDTH_CM) * 100, 100);
    const heightPercent = Math.min((newZoneHeightCm / PRINT_AREA_HEIGHT_CM) * 100, 100);

    // Centrar la zona inicialmente
    const positionX = Math.max(0, (100 - widthPercent) / 2);
    const positionY = Math.max(0, (100 - heightPercent) / 2);

    const newZone: CreateTemplateZoneDto = {
      templateId,
      zoneTypeId: newZoneType,
      zoneId: `${blockedPrefix}${zoneSlug}-${Date.now()}`,
      name: newZoneIsBlocked
        ? `${newZoneName} (bloqueada)`
        : `${newZoneName} (${newZoneWidthCm}x${newZoneHeightCm}cm)`,
      shape: newZoneShape,
      positionX: Math.round(positionX),
      positionY: Math.round(positionY),
      maxWidth: Math.round(widthPercent),
      maxHeight: Math.round(heightPercent),
      radius: newZoneShape === 'circle' ? Math.round(Math.min(widthPercent, heightPercent) / 2) : undefined,
      points: newZoneShape === 'polygon' ? [
        { x: 50, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ] : undefined,
      price: newZonePrice,
      isRequired: false,
      isBlocked: newZoneIsBlocked,
      sortOrder: zones.length + 1,
    };

    try {
      const created = await templateZonesService.create(newZone);
      // Agregar manualmente el zoneType para que el filtro funcione inmediatamente
      const createdWithType: TemplateZone = {
        ...created,
        shape: newZoneShape,
        isBlocked: newZoneIsBlocked,
        zoneType: selectedType ? {
          id: selectedType.id,
          name: selectedType.name,
          slug: selectedType.slug,
        } : undefined,
      };
      setZones(prev => [...prev, createdWithType]);
      setIsCreatingZone(false);
      setNewZoneType(0);
      setNewZoneName('');
      setNewZoneWidthCm(18);
      setNewZoneHeightCm(25);
      setNewZoneShape('rect');
      setNewZoneIsBlocked(false);
      setNewZonePrice(0);
      setSelectedZoneId(created.id);
      onZonesChange?.([...zones, createdWithType]);
    } catch (err) {
      toast.error('Error al crear la zona');
      console.error(err);
    }
  };

  const handleDeleteZone = async (zoneId: number) => {
    if (!(await confirm({ title: '¿Eliminar esta zona?', message: 'Se quita del modelo. No se puede deshacer.', tone: 'danger' }))) return;

    try {
      await templateZonesService.delete(zoneId);
      const newZones = zones.filter(z => z.id !== zoneId);
      setZones(newZones);
      if (selectedZoneId === zoneId) setSelectedZoneId(null);
      onZonesChange?.(newZones);
    } catch (err) {
      toast.error('Error al eliminar la zona');
      console.error(err);
    }
  };

  const handleSaveZone = async (zone: TemplateZone) => {
    setSaving(true);
    try {
      await templateZonesService.update(zone.id, {
        positionX: zone.positionX,
        positionY: zone.positionY,
        maxWidth: zone.maxWidth,
        maxHeight: zone.maxHeight,
        price: editablePrice,
      });
      // Actualizar el precio en el estado local
      setZones(prev => prev.map(z => z.id === zone.id ? { ...z, price: editablePrice } : z));
      onZonesChange?.(zones);
      toast.success('Zona guardada');
    } catch (err) {
      toast.error('Error al guardar la zona');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAllZones = async () => {
    setSaving(true);
    try {
      await Promise.all(zones.map(zone =>
        templateZonesService.update(zone.id, {
          positionX: zone.positionX,
          positionY: zone.positionY,
          maxWidth: zone.maxWidth,
          maxHeight: zone.maxHeight,
        })
      ));
      toast.success('Zonas guardadas');
      onZonesChange?.(zones);
    } catch (err) {
      toast.error('Error al guardar las zonas');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Colores para zonas normales y bloqueadas
  const getZoneColor = (zone: TemplateZone) => {
    // Si es zona bloqueada, usar rojo
    if (zone.isBlocked) {
      return 'rgba(239, 68, 68, 0.3)';
    }
    // Colores para zonas normales basados en zoneTypeId
    const colors = [
      'rgba(239, 68, 68, 0.4)',
      'rgba(59, 130, 246, 0.4)',
      'rgba(16, 185, 129, 0.4)',
      'rgba(245, 158, 11, 0.4)',
      'rgba(139, 92, 246, 0.4)',
      'rgba(236, 72, 153, 0.4)',
    ];
    return colors[zone.zoneTypeId % colors.length];
  };

  const getBorderColor = (zone: TemplateZone) => {
    // Si es zona bloqueada, usar rojo
    if (zone.isBlocked) {
      return 'rgb(239, 68, 68)';
    }
    // Colores para zonas normales
    const colors = [
      'rgb(59, 130, 246)',
      'rgb(16, 185, 129)',
      'rgb(245, 158, 11)',
      'rgb(139, 92, 246)',
      'rgb(236, 72, 153)',
      'rgb(99, 102, 241)',
    ];
    return colors[zone.zoneTypeId % colors.length];
  };

  const selectedZone = zones.find(z => z.id === selectedZoneId);

  // Obtener los tipos de zona únicos que tienen zonas definidas
  const getAvailableZoneTypes = () => {
    const uniqueTypes = new Map<string, { slug: string; name: string }>();
    zones.forEach(zone => {
      if (zone.zoneType?.slug && !uniqueTypes.has(zone.zoneType.slug)) {
        uniqueTypes.set(zone.zoneType.slug, {
          slug: zone.zoneType.slug,
          name: zone.zoneType.name,
        });
      }
    });
    return Array.from(uniqueTypes.values());
  };

  const availableZoneTypes = getAvailableZoneTypes();

  // Seleccionar automáticamente el primer tipo de zona si no hay ninguno seleccionado
  const currentZoneType = currentViewSlug
    ? availableZoneTypes.find(t => t.slug === currentViewSlug) || availableZoneTypes[0]
    : availableZoneTypes[0];

  // Obtener imagen: prioridad a imagen personalizada del tipo de zona, luego template
  const getDisplayImage = () => {
    // Si hay un tipo de zona actual, buscar su imagen personalizada
    if (currentZoneType?.slug) {
      const customImage = zoneTypeImages[currentZoneType.slug];
      if (customImage) return customImage;
    }
    // Fallback a la imagen del template
    return templateImage;
  };
  const currentImage = getDisplayImage();

  // Filtrar zonas según el tipo de zona actual
  const getZonesForCurrentView = () => {
    if (!currentZoneType) return zones;
    return zones.filter(zone => zone.zoneType?.slug === currentZoneType.slug);
  };

  const filteredZones = getZonesForCurrentView();

  if (loading) {
    return <Spinner label="Cargando editor de zonas…" />;
  }

  const resetNewZone = () => { setIsCreatingZone(false); setNewZoneIsBlocked(false); setNewZoneShape('rect'); setNewZonePrice(0); };
  const shapeBtn = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg border text-xs transition-colors ${
      active
        ? (newZoneIsBlocked ? 'border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500' : 'border-app-500 bg-app-50 text-app-700 ring-1 ring-app-500')
        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
    }`;

  return (
    <div className="space-y-4">
      {/* Barra de herramientas */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-app-600" />
            Editor visual de zonas
          </h3>
          <p className="text-sm text-gray-500">Define dónde se puede (y dónde no) colocar el diseño en cada vista.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de vista basado en las zonas existentes */}
          {availableZoneTypes.length > 0 && (
            <RadioGroup
              variant="segmented"
              value={currentZoneType?.slug ?? ''}
              onChange={(v) => setCurrentViewSlug(v)}
              options={availableZoneTypes.map(type => ({ value: type.slug, label: type.name }))}
            />
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowZones(!showZones)}
            title={showZones ? 'Ocultar zonas' : 'Mostrar zonas'}
            icon={showZones ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          >
            {showZones ? 'Ocultar' : 'Mostrar'}
          </Button>

          <Button onClick={handleSaveAllZones} size="sm" isLoading={saving} disabled={zones.length === 0} icon={<Save className="w-4 h-4" />}>
            Guardar zonas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_1fr] gap-4">
        <div className="space-y-3 min-w-0">
          {!isCreatingZone ? (
            <Button onClick={() => setIsCreatingZone(true)} variant="outline" fullWidth icon={<Plus className="w-4 h-4" />}>
              Agregar zona
            </Button>
          ) : (
            <div className={`rounded-xl border p-4 space-y-4 ${newZoneIsBlocked ? 'border-red-200' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Nueva zona</p>
                <Badge tone={newZoneIsBlocked ? 'red' : 'app'}>{newZoneIsBlocked ? 'Bloqueada' : 'Normal'}</Badge>
              </div>

              {/* Tipo de zona: Normal o Bloqueada */}
              <Field label="Tipo" hint={newZoneIsBlocked ? 'Zona donde NO se puede colocar diseño' : 'Zona donde se puede colocar diseño'}>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setNewZoneIsBlocked(false)}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-sm transition-colors ${!newZoneIsBlocked ? 'border-app-500 bg-app-50 text-app-700 ring-1 ring-app-500' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                    <CheckCircle className="w-4 h-4" /> Normal
                  </button>
                  <button type="button" onClick={() => setNewZoneIsBlocked(true)}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-sm transition-colors ${newZoneIsBlocked ? 'border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                    <Ban className="w-4 h-4" /> Bloqueada
                  </button>
                </div>
              </Field>

              <Field label="Vista" required>
                <SelectInput value={newZoneType} onChange={(e) => setNewZoneType(parseInt(e.target.value))}>
                  <option value={0}>Seleccionar vista…</option>
                  {zoneTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                </SelectInput>
              </Field>

              <Field label="Nombre" required>
                <TextInput value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)}
                  placeholder={newZoneIsBlocked ? 'Ej: Costura, Logo' : 'Ej: Regular, Grande'} />
              </Field>

              <Field label="Forma">
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setNewZoneShape('rect')} className={shapeBtn(newZoneShape === 'rect')}>
                    <Square className="w-4 h-4" /> Rectángulo
                  </button>
                  <button type="button" onClick={() => setNewZoneShape('circle')} className={shapeBtn(newZoneShape === 'circle')}>
                    <Circle className="w-4 h-4" /> Círculo
                  </button>
                  <button type="button" onClick={() => setNewZoneShape('polygon')} className={shapeBtn(newZoneShape === 'polygon')}>
                    <Triangle className="w-4 h-4" /> Triángulo
                  </button>
                </div>
              </Field>

              {/* Dimensiones en cm */}
              <Field label={`Tamaño ${newZoneIsBlocked ? 'de la zona' : 'del área de impresión'}`} hint="Referencia: área máx. 50 × 70 cm">
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput aria-label="Ancho" value={newZoneWidthCm} onChange={(e) => setNewZoneWidthCm(parseFloat(e.target.value) || 0)} min="1" max="50" step="0.5" prefix="An" suffix="cm" />
                  <NumberInput aria-label="Alto" value={newZoneHeightCm} onChange={(e) => setNewZoneHeightCm(parseFloat(e.target.value) || 0)} min="1" max="70" step="0.5" prefix="Al" suffix="cm" />
                </div>
              </Field>

              <Field label="Precio" hint="Costo adicional por personalizar esta zona.">
                <MoneyInput value={newZonePrice} onChange={(e) => setNewZonePrice(parseFloat(e.target.value) || 0)} placeholder="0.00" />
              </Field>

              <div className="flex gap-2">
                <Button onClick={resetNewZone} variant="secondary" className="flex-1">Cancelar</Button>
                <Button onClick={handleCreateZone} variant={newZoneIsBlocked ? 'danger' : 'primary'} className="flex-1">
                  {newZoneIsBlocked ? 'Crear bloqueada' : 'Crear zona'}
                </Button>
              </div>
            </div>
          )}

          {/* Zonas de la vista actual */}
          <div className="rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 text-xs text-gray-500">
              {currentZoneType ? (
                <span>Vista: <span className="font-medium text-gray-800">{currentZoneType.name}</span></span>
              ) : <span>Sin zonas definidas</span>}
              <span>{filteredZones.length} zona{filteredZones.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
              {filteredZones.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6 px-3">No hay zonas en esta vista. Usa «Agregar zona».</p>
              ) : (
                filteredZones.map(zone => {
                  const active = selectedZoneId === zone.id;
                  return (
                    <div
                      key={zone.id}
                      onClick={() => setSelectedZoneId(zone.id)}
                      className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors border-l-2 ${
                        active ? (zone.isBlocked ? 'border-l-red-500 bg-red-50' : 'border-l-app-600 bg-app-50') : 'border-l-transparent hover:bg-gray-50'
                      }`}
                    >
                      {zone.isBlocked
                        ? <Ban className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        : <span className="w-3.5 h-3.5 rounded mt-0.5 flex-shrink-0" style={{ backgroundColor: getBorderColor(zone) }} />}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${zone.isBlocked ? 'text-red-700' : 'text-gray-900'}`}>{zone.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                          <Badge tone={zone.isBlocked ? 'red' : 'gray'}>{zone.isBlocked ? 'Bloqueada' : zone.zoneType?.name || 'Sin tipo'}</Badge>
                          {zone.shape && zone.shape !== 'rect' && (
                            <Badge tone="blue">{zone.shape === 'polygon' ? 'Triángulo' : 'Círculo'}</Badge>
                          )}
                          <span className="tabular-nums">{percentToCm(zone.maxWidth, true)} × {percentToCm(zone.maxHeight, false)} cm</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        title="Eliminar zona"
                        aria-label="Eliminar zona"
                        onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone.id); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {selectedZone && (
            <div className="rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate">{selectedZone.name}</p>
                {/* Botón de bloqueo de proporciones */}
                <button
                  type="button"
                  onClick={() => setLockAspectRatio(!lockAspectRatio)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors ${
                    lockAspectRatio ? 'bg-app-50 text-app-700 border-app-300' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                  title={lockAspectRatio ? 'Proporciones bloqueadas: al redimensionar se mantiene la proporción' : 'Proporciones libres: redimensionar independiente'}
                >
                  {lockAspectRatio ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  {lockAspectRatio ? 'Proporción fija' : 'Proporción libre'}
                </button>
              </div>

              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div className="col-span-3 sm:col-span-1 lg:col-span-3">
                  <dt className="text-gray-500">Tamaño</dt>
                  <dd className="font-medium text-gray-900 tabular-nums">{percentToCm(selectedZone.maxWidth, true)} × {percentToCm(selectedZone.maxHeight, false)} cm</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Posición X</dt>
                  <dd className="font-mono text-gray-900">{selectedZone.positionX}%</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Posición Y</dt>
                  <dd className="font-mono text-gray-900">{selectedZone.positionY}%</dd>
                </div>
              </dl>

              <Field label="Precio">
                <MoneyInput value={editablePrice} onChange={(e) => setEditablePrice(parseFloat(e.target.value) || 0)} />
              </Field>

              <Button onClick={() => handleSaveZone(selectedZone)} variant="secondary" size="sm" fullWidth disabled={saving} icon={<Save className="w-4 h-4" />}>
                Guardar esta zona
              </Button>
            </div>
          )}

          {/* Imagen de fondo de la vista actual (independiente de la zona seleccionada) */}
          {currentZoneType && (
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-1">
                <ImageIcon className="w-4 h-4 text-app-600" />
                Imagen de la vista «{currentZoneType.name}»
              </p>
              <p className="text-xs text-gray-500 mb-3">Se usa como fondo para posicionar sus zonas. Si no hay, se usa la imagen principal del modelo.</p>

              {zoneTypeImages[currentZoneType.slug] ? (
                <div className="space-y-2">
                  <div className="relative">
                    <img
                      src={assetUrl(zoneTypeImages[currentZoneType.slug])}
                      alt={`Imagen ${currentZoneType.name}`}
                      className="w-full h-28 object-contain rounded-lg border border-gray-200 bg-gray-50"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveZoneTypeImage(currentZoneType.slug)}
                      className="absolute top-1.5 right-1.5 p-1 bg-white border border-gray-200 text-gray-500 rounded-md hover:text-red-600"
                      title="Quitar imagen"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    icon={<Upload className="w-4 h-4" />}
                    isLoading={uploadingImage}
                    onClick={() => {
                      setSelectedZoneTypeForImage(currentZoneType.slug);
                      fileInputRef.current?.click();
                    }}
                  >
                    Cambiar imagen
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedZoneTypeForImage(currentZoneType.slug);
                    fileInputRef.current?.click();
                  }}
                  disabled={uploadingImage}
                  className="w-full flex items-center justify-center gap-2 px-3 py-4 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-app-400 hover:text-app-700 transition-colors disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingImage ? 'Subiendo…' : 'Subir imagen para esta vista'}
                </button>
              )}
            </div>
          )}

          {/* Nota informativa */}
          <div className="text-xs text-gray-500 px-1 space-y-1">
            <p><span className="font-medium text-gray-700">Zonas normales:</span> donde se puede colocar diseño.</p>
            <p><span className="font-medium text-red-600">Zonas bloqueadas:</span> donde NO se puede (costuras, logos, etc.).</p>
          </div>

          {/* Input oculto para subir archivos */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        <div className="min-w-0">
          <div
            ref={containerRef}
            className="relative bg-gray-50 rounded-xl overflow-hidden border border-gray-200"
            style={{ minHeight: '500px' }}
          >
            <img
              ref={imageRef}
              src={assetUrl(currentImage)}
              alt="Modelo"
              onLoad={handleImageLoad}
              className="w-full h-auto max-h-[600px] object-contain"
              style={{ display: imageLoaded ? 'block' : 'none' }}
            />

            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-gray-500">Cargando imagen...</div>
              </div>
            )}

            {/* Solo mostrar la zona seleccionada con proporciones correctas */}
            {imageLoaded && showZones && selectedZone && filteredZones.some(z => z.id === selectedZone.id) && (() => {
              const displayDimensions = getZoneDisplayDimensions(selectedZone);
              const borderColor = getBorderColor(selectedZone);
              const fillColor = getZoneColor(selectedZone);

              // Renderizado para TRIÁNGULO (polygon)
              if (selectedZone.shape === 'polygon') {
                return (
                  <div
                    key={selectedZone.id}
                    className="absolute cursor-move transition-shadow shadow-lg z-10"
                    style={{
                      left: displayDimensions.left,
                      top: displayDimensions.top,
                      width: displayDimensions.width,
                      height: displayDimensions.height,
                    }}
                    onMouseDown={(e) => handleZoneMouseDown(e, selectedZone)}
                  >
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polygon
                        points="50,0 100,100 0,100"
                        fill={fillColor}
                        stroke={borderColor}
                        strokeWidth={3}
                      />
                    </svg>
                    <div
                      className="absolute -top-6 left-0 px-2 py-0.5 text-xs font-medium text-white rounded-t whitespace-nowrap"
                      style={{ backgroundColor: borderColor }}
                    >
                      {selectedZone.name}
                    </div>
                    {/* Handles para triángulo - solo esquinas inferiores */}
                    <div
                      className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border-2 rounded-sm cursor-sw-resize"
                      style={{ borderColor }}
                      onMouseDown={(e) => handleZoneMouseDown(e, selectedZone, 'sw')}
                    />
                    <div
                      className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border-2 rounded-sm cursor-se-resize"
                      style={{ borderColor }}
                      onMouseDown={(e) => handleZoneMouseDown(e, selectedZone, 'se')}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-50" style={{ paddingTop: '25%' }}>
                      <Move className="w-6 h-6 text-gray-800" />
                    </div>
                  </div>
                );
              }

              // Renderizado para CÍRCULO
              if (selectedZone.shape === 'circle') {
                return (
                  <div
                    key={selectedZone.id}
                    className="absolute cursor-move transition-shadow shadow-lg z-10"
                    style={{
                      left: displayDimensions.left,
                      top: displayDimensions.top,
                      width: displayDimensions.width,
                      height: displayDimensions.height,
                      backgroundColor: fillColor,
                      borderColor: borderColor,
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      borderRadius: '50%',
                    }}
                    onMouseDown={(e) => handleZoneMouseDown(e, selectedZone)}
                  >
                    <div
                      className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 text-xs font-medium text-white rounded-t whitespace-nowrap"
                      style={{ backgroundColor: borderColor }}
                    >
                      {selectedZone.name}
                    </div>
                    {/* Handles para círculo - 4 esquinas del bounding box */}
                    <div
                      className="absolute -top-1 -left-1 w-3 h-3 bg-white border-2 rounded-sm cursor-nw-resize"
                      style={{ borderColor }}
                      onMouseDown={(e) => handleZoneMouseDown(e, selectedZone, 'nw')}
                    />
                    <div
                      className="absolute -top-1 -right-1 w-3 h-3 bg-white border-2 rounded-sm cursor-ne-resize"
                      style={{ borderColor }}
                      onMouseDown={(e) => handleZoneMouseDown(e, selectedZone, 'ne')}
                    />
                    <div
                      className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border-2 rounded-sm cursor-sw-resize"
                      style={{ borderColor }}
                      onMouseDown={(e) => handleZoneMouseDown(e, selectedZone, 'sw')}
                    />
                    <div
                      className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border-2 rounded-sm cursor-se-resize"
                      style={{ borderColor }}
                      onMouseDown={(e) => handleZoneMouseDown(e, selectedZone, 'se')}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-50">
                      <Move className="w-6 h-6 text-gray-800" />
                    </div>
                  </div>
                );
              }

              // Renderizado para RECTÁNGULO (default)
              return (
              <div
                key={selectedZone.id}
                className="absolute border-2 cursor-move transition-shadow shadow-lg z-10"
                style={{
                  left: displayDimensions.left,
                  top: displayDimensions.top,
                  width: displayDimensions.width,
                  height: displayDimensions.height,
                  backgroundColor: fillColor,
                  borderColor: borderColor,
                  borderStyle: 'solid',
                }}
                onMouseDown={(e) => handleZoneMouseDown(e, selectedZone)}
              >
                <div
                  className="absolute -top-6 left-0 px-2 py-0.5 text-xs font-medium text-white rounded-t whitespace-nowrap"
                  style={{ backgroundColor: borderColor }}
                >
                  {selectedZone.name}
                </div>

                {/* Handles de redimensionamiento */}
                <div
                  className="absolute -top-1 -left-1 w-3 h-3 bg-white border-2 rounded-sm cursor-nw-resize"
                  style={{ borderColor }}
                  onMouseDown={(e) => handleZoneMouseDown(e, selectedZone, 'nw')}
                />
                <div
                  className="absolute -top-1 -right-1 w-3 h-3 bg-white border-2 rounded-sm cursor-ne-resize"
                  style={{ borderColor }}
                  onMouseDown={(e) => handleZoneMouseDown(e, selectedZone, 'ne')}
                />
                <div
                  className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border-2 rounded-sm cursor-sw-resize"
                  style={{ borderColor }}
                  onMouseDown={(e) => handleZoneMouseDown(e, selectedZone, 'sw')}
                />
                <div
                  className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border-2 rounded-sm cursor-se-resize"
                  style={{ borderColor }}
                  onMouseDown={(e) => handleZoneMouseDown(e, selectedZone, 'se')}
                />
                <div
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-2 bg-white border-2 rounded-sm cursor-n-resize"
                  style={{ borderColor }}
                  onMouseDown={(e) => handleZoneMouseDown(e, selectedZone, 'n')}
                />
                <div
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-2 bg-white border-2 rounded-sm cursor-s-resize"
                  style={{ borderColor }}
                  onMouseDown={(e) => handleZoneMouseDown(e, selectedZone, 's')}
                />
                <div
                  className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-3 bg-white border-2 rounded-sm cursor-w-resize"
                  style={{ borderColor }}
                  onMouseDown={(e) => handleZoneMouseDown(e, selectedZone, 'w')}
                />
                <div
                  className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-3 bg-white border-2 rounded-sm cursor-e-resize"
                  style={{ borderColor }}
                  onMouseDown={(e) => handleZoneMouseDown(e, selectedZone, 'e')}
                />

                <div className="absolute inset-0 flex items-center justify-center opacity-50">
                  <Move className="w-6 h-6 text-gray-800" />
                </div>
              </div>
              );
            })()}

            {imageLoaded && zones.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white px-4 py-3 rounded-lg border border-gray-200 text-center">
                  <MousePointer2 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    Agrega zonas desde el panel lateral
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
              <Maximize2 className="w-3 h-3" /> Esquinas para redimensionar
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
};
