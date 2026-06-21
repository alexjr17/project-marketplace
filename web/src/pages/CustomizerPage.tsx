import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Loader2, Package, Eye, EyeOff, Download, Move } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { canvasService } from '../services/canvas.service';
import { templatesService, type Template, type DesignZone } from '../services/templates.service';
import { templateZonesService, type TemplateZone } from '../services/template-zones.service';
import { templateRecipesService } from '../services/template-recipes.service';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { ColorPicker } from '../components/customizer/ColorPicker';
import { ImageUploader, type ImageUploadData } from '../components/customizer/ImageUploader';
import { SizeGuideModal } from '../components/customizer/SizeGuideModal';
import { ImageCarousel } from '../components/customizer/ImageCarousel';
import { applyColorToImage } from '../utils/imageColorizer';
import { assetUrl } from '../utils/assetUrl';
import { exportDesignsToZip } from '../utils/designExporter';
import { detectPngBounds, clampPositionToBounds, type PngBounds } from '../utils/pngBoundsDetector';
import type { ProductType, PrintZone } from '../types/product';
import type { Design, CustomizedProduct } from '../types/design';

export const CustomizerPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { addCustomizedProduct, updateCustomizedProduct, getCartItemById } = useCart();
  const { settings } = useSettings();
  // Solo el admin puede colocar una imagen por cada zona de impresión.
  // El cliente normal mantiene un único diseño por vista.
  const { isAdmin } = useAuth();

  // Estado para modo edición
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Colores de marca dinámicos
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };
  const gradientStyle = `linear-gradient(to right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`;

  // State principal
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateZones, setTemplateZones] = useState<TemplateZone[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>('#FFFFFF');
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [currentZoneType, setCurrentZoneType] = useState<string | null>(null);
  // Diseños por vista (front, back, etc.) - uno por vista, posicionamiento libre
  const [designs, setDesigns] = useState<Map<string, Design>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ naturalWidth: 0, naturalHeight: 0 });
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [showZoneGuides, setShowZoneGuides] = useState(true); // Zonas como guías visuales
  const [colorizedTemplateImage, setColorizedTemplateImage] = useState<string | null>(null);
  const [isColorizingTemplate, setIsColorizingTemplate] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Stock disponible del template seleccionado
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);

  // Límites del contenido visible del PNG (para restringir el diseño)
  const [pngBounds, setPngBounds] = useState<PngBounds | null>(null);
  // Zona seleccionada para ajustar el tamaño del diseño
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  // Modo admin: id de la zona de impresión donde se está colocando/editando el diseño
  const [activeZoneId, setActiveZoneId] = useState<number | null>(null);
  // Zonas de diseño (habilitadas y bloqueadas) del template actual
  const [allowedZones, setAllowedZones] = useState<DesignZone[]>([]);
  const [blockedZones, setBlockedZones] = useState<DesignZone[]>([]);

  // Ref para el slider de tamaño (evita re-renders)
  const sliderRef = useRef<HTMLInputElement>(null);
  const sizeDisplayRef = useRef<HTMLSpanElement>(null);

  // Estado para drag & drop del diseño
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const designStartPosRef = useRef({ x: 0, y: 0 });
  const currentPosRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);

  // Ref para la imagen del template y el contenedor
  const templateImageRef = useRef<HTMLImageElement>(null);
  const designContainerRef = useRef<HTMLDivElement>(null);
  const designElementRef = useRef<HTMLDivElement>(null);

  // Refs para los handlers de drag (para poder agregar/remover listeners sin re-render)
  const handleDragMoveRef = useRef<(e: MouseEvent | TouchEvent) => void>(() => {});
  const handleDragEndRef = useRef<() => void>(() => {});
  const currentZoneTypeRef = useRef<string | null>(null);

  // Constantes del canvas
  const CANVAS_WIDTH = 600;
  const CANVAS_HEIGHT = 600;

  // Función auxiliar para verificar si un punto está dentro de un polígono (triángulo)
  const isPointInPolygon = useCallback((
    point: { x: number; y: number },
    polygonPoints: Array<{ x: number; y: number }>,
    zoneX: number,
    zoneY: number,
    zoneWidth: number,
    zoneHeight: number
  ): boolean => {
    // Convertir puntos relativos (0-100%) a coordenadas absolutas
    const absolutePoints = polygonPoints.map(p => ({
      x: zoneX + (p.x / 100) * zoneWidth,
      y: zoneY + (p.y / 100) * zoneHeight
    }));

    let inside = false;
    for (let i = 0, j = absolutePoints.length - 1; i < absolutePoints.length; j = i++) {
      const xi = absolutePoints[i].x, yi = absolutePoints[i].y;
      const xj = absolutePoints[j].x, yj = absolutePoints[j].y;

      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }, []);

  // Función para verificar si el diseño colisiona con una zona
  const checkZoneCollision = useCallback((
    position: { x: number; y: number },
    size: { width: number; height: number },
    zone: DesignZone
  ): boolean => {
    // Calcular los bordes del diseño (posición es el centro)
    const designLeft = position.x - size.width / 2;
    const designRight = position.x + size.width / 2;
    const designTop = position.y - size.height / 2;
    const designBottom = position.y + size.height / 2;

    if (zone.shape === 'circle' && zone.radius) {
      // Para círculos, verificar si el rectángulo del diseño intersecta con el círculo
      const centerX = zone.x + zone.radius;
      const centerY = zone.y + zone.radius;
      // Encontrar el punto más cercano del rectángulo al centro del círculo
      const closestX = Math.max(designLeft, Math.min(centerX, designRight));
      const closestY = Math.max(designTop, Math.min(centerY, designBottom));
      const distance = Math.sqrt(Math.pow(closestX - centerX, 2) + Math.pow(closestY - centerY, 2));
      return distance <= zone.radius;
    }

    if (zone.shape === 'polygon' && zone.points && zone.points.length >= 3) {
      // Para polígonos (triángulos), verificar si alguna esquina del diseño está dentro
      const zoneWidth = zone.width || 30;
      const zoneHeight = zone.height || 30;

      // Verificar las 4 esquinas del diseño
      const corners = [
        { x: designLeft, y: designTop },
        { x: designRight, y: designTop },
        { x: designRight, y: designBottom },
        { x: designLeft, y: designBottom },
        { x: position.x, y: position.y } // También el centro
      ];

      for (const corner of corners) {
        if (isPointInPolygon(corner, zone.points, zone.x, zone.y, zoneWidth, zoneHeight)) {
          return true;
        }
      }

      // Verificar si el centro del triángulo está dentro del diseño
      const triangleCenter = {
        x: zone.x + zoneWidth / 2,
        y: zone.y + zoneHeight * 0.67 // El centroide del triángulo está a 2/3 de la altura
      };

      if (triangleCenter.x >= designLeft && triangleCenter.x <= designRight &&
          triangleCenter.y >= designTop && triangleCenter.y <= designBottom) {
        return true;
      }

      return false;
    }

    // Rectángulo: verificar intersección
    const zoneLeft = zone.x;
    const zoneRight = zone.x + (zone.width || 0);
    const zoneTop = zone.y;
    const zoneBottom = zone.y + (zone.height || 0);

    return !(
      designRight < zoneLeft ||
      designLeft > zoneRight ||
      designBottom < zoneTop ||
      designTop > zoneBottom
    );
  }, [isPointInPolygon]);

  // Función para verificar si la posición del diseño es válida
  // Retorna true si el diseño está en una posición válida
  const isDesignPositionValid = useCallback((
    position: { x: number; y: number },
    size: { width: number; height: number }
  ): boolean => {
    // Verificar colisión con zonas bloqueadas - si colisiona, posición inválida
    for (const zone of blockedZones) {
      if (checkZoneCollision(position, size, zone)) {
        return false;
      }
    }

    // Si hay zonas habilitadas, el diseño debe estar dentro de al menos una
    if (allowedZones.length > 0) {
      let isInAnyAllowedZone = false;
      for (const zone of allowedZones) {
        if (checkZoneCollision(position, size, zone)) {
          isInAnyAllowedZone = true;
          break;
        }
      }
      // Si no está en ninguna zona habilitada, posición inválida
      if (!isInAnyAllowedZone) {
        return false;
      }
    }

    return true;
  }, [allowedZones, blockedZones, checkZoneCollision]);

  // Calcular el área real de la imagen visible considerando object-contain
  const getImageContentArea = useCallback(() => {
    const { naturalWidth, naturalHeight } = imageDimensions;
    const { width: containerWidth, height: containerHeight } = containerDimensions;

    console.log('[getImageContentArea] Dimensiones:', {
      containerWidth,
      containerHeight,
      naturalWidth,
      naturalHeight,
    });

    if (!naturalWidth || !naturalHeight) {
      console.log('[getImageContentArea] No hay dimensiones naturales');
      return null;
    }

    if (!containerWidth || !containerHeight) {
      console.log('[getImageContentArea] No hay dimensiones del contenedor');
      return null;
    }

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

    console.log('[getImageContentArea] Resultado:', {
      renderedWidth,
      renderedHeight,
      offsetX,
      offsetY,
    });

    return {
      renderedWidth,
      renderedHeight,
      offsetX,
      offsetY,
      containerWidth,
      containerHeight,
    };
  }, [imageDimensions, containerDimensions]);

  // Calcular dimensiones del recuadro en píxeles basándose en el área real de la imagen
  const getZoneDisplayDimensions = useCallback((zone: {
    positionXPercent: number;
    positionYPercent: number;
    widthPercent: number;
    heightPercent: number;
  }) => {
    const contentArea = getImageContentArea();

    if (!contentArea) {
      return {
        left: `${zone.positionXPercent}%`,
        top: `${zone.positionYPercent}%`,
        width: `${zone.widthPercent}%`,
        height: `${zone.heightPercent}%`,
      };
    }

    const { renderedWidth, renderedHeight, offsetX, offsetY } = contentArea;

    // Calcular posición y tamaño en píxeles basados en el área real de la imagen
    const leftPx = offsetX + (zone.positionXPercent / 100) * renderedWidth;
    const topPx = offsetY + (zone.positionYPercent / 100) * renderedHeight;
    const widthPx = (zone.widthPercent / 100) * renderedWidth;
    const heightPx = (zone.heightPercent / 100) * renderedHeight;

    return {
      left: `${leftPx}px`,
      top: `${topPx}px`,
      width: `${widthPx}px`,
      height: `${heightPx}px`,
    };
  }, [getImageContentArea]);

  // Manejar carga de imagen del template
  const handleTemplateImageLoad = useCallback(() => {
    if (templateImageRef.current) {
      const img = templateImageRef.current;
      const { naturalWidth, naturalHeight, clientWidth, clientHeight } = img;
      console.log('[handleTemplateImageLoad] Imagen cargada:', {
        naturalWidth,
        naturalHeight,
        clientWidth,
        clientHeight,
        complete: img.complete,
      });
      if (naturalWidth > 0 && naturalHeight > 0) {
        setImageDimensions({ naturalWidth, naturalHeight });

        // Forzar un re-cálculo de dimensiones del contenedor después del siguiente paint
        // Necesitamos esperar a que el browser renderice la imagen para obtener clientWidth/Height correctos
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (templateImageRef.current) {
              const { clientWidth: cw, clientHeight: ch } = templateImageRef.current;
              console.log('[handleTemplateImageLoad RAF2] Dimensiones del contenedor:', { cw, ch });
              setContainerDimensions({ width: cw, height: ch });
              setImageLoaded(true);
            }
          });
        });
      }
    }
  }, []);

  // Cargar todos los templates al inicio
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoadingTemplates(true);
        // Usar endpoint público que no requiere autenticación
        const activeTemplates = await templatesService.getPublicTemplates();
        setTemplates(activeTemplates);

        // Si viene un template en la URL, seleccionarlo
        const templateId = searchParams.get('template');
        if (templateId) {
          const template = activeTemplates.find(t => t.id === parseInt(templateId));
          if (template) {
            handleTemplateSelect(template);
          }
        }
      } catch (error) {
        console.error('Error cargando templates:', error);
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, []);

  // Consultar stock disponible cuando cambia el template, color o talla
  useEffect(() => {
    const fetchStock = async () => {
      if (!selectedTemplate) {
        setAvailableStock(null);
        return;
      }

      try {
        setLoadingStock(true);
        // Buscar los IDs de color y talla seleccionados
        const selectedColorData = selectedTemplate.colors?.find(c => c.hexCode === selectedColor);
        const selectedSizeData = selectedTemplate.sizes?.find(s => s.name === selectedSize);

        const stockInfo = await templateRecipesService.getVariantStock(
          selectedTemplate.id,
          selectedColorData?.id || null,
          selectedSizeData?.id || null
        );

        setAvailableStock(stockInfo.availableStock);
      } catch (error) {
        console.error('Error consultando stock:', error);
        setAvailableStock(null);
      } finally {
        setLoadingStock(false);
      }
    };

    fetchStock();
  }, [selectedTemplate, selectedColor, selectedSize]);

  // Cargar producto del carrito para editar
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && templates.length > 0) {
      const cartItem = getCartItemById(editId);
      if (cartItem && cartItem.type === 'customized') {
        const { customizedProduct } = cartItem;

        console.log('[Edit Mode] Cargando producto:', customizedProduct);

        setIsEditMode(true);
        setEditingCartItemId(editId);

        // Cargar diseños existentes. La key del Map es el slot:
        // viewType para cliente, `${viewType}::${zonaId}` (slotKey) para admin.
        const designsMap = new Map<string, Design>();
        customizedProduct.designs.forEach(design => {
          const key = design.slotKey || design.viewType || design.zoneId.replace('view-', '');
          console.log('[Edit Mode] Cargando diseño en slot:', key, design);
          designsMap.set(key, design);
        });

        // Cargar template primero (sin resetear diseños)
        if (customizedProduct.templateId) {
          const template = templates.find(t => t.id === customizedProduct.templateId);

          // Determinar la vista que tiene diseño para seleccionarla
          const viewWithDesign = customizedProduct.designs[0]?.viewType || null;

          // Función para aplicar los datos guardados del producto al template
          const applyEditData = (baseTemplate: typeof template) => {
            if (!baseTemplate) return;

            // Combinar el template base con las imágenes guardadas del producto
            // Prioridad: datos guardados en el producto > datos del template base
            const savedImages = customizedProduct.templateImages;
            const savedZoneTypeImages = customizedProduct.zoneTypeImages;

            console.log('[Edit Mode] Imágenes guardadas en producto:', savedImages);
            console.log('[Edit Mode] ZoneTypeImages guardadas:', savedZoneTypeImages);
            console.log('[Edit Mode] Imágenes del template base:', baseTemplate.images);
            console.log('[Edit Mode] ZoneTypeImages del template base:', baseTemplate.zoneTypeImages);

            const templateWithSavedData = {
              ...baseTemplate,
              // Usar las imágenes guardadas del producto si están disponibles
              images: savedImages || baseTemplate.images,
              zoneTypeImages: savedZoneTypeImages || baseTemplate.zoneTypeImages,
            };

            console.log('[Edit Mode] Template final con datos combinados:', {
              id: templateWithSavedData.id,
              images: templateWithSavedData.images,
              zoneTypeImages: templateWithSavedData.zoneTypeImages,
            });

            setSelectedTemplate(templateWithSavedData);
            setCurrentZoneType(viewWithDesign);
            setImageLoaded(false);
            setSelectedColor(customizedProduct.selectedColor);
            setSelectedSize(customizedProduct.selectedSize);
            setDesigns(designsMap);
          };

          if (template) {
            // Siempre cargar el template completo desde la API para tener las imágenes actualizadas
            templatesService.getTemplateById(customizedProduct.templateId)
              .then(freshTemplate => {
                console.log('[Edit Mode] Template fresco de API:', freshTemplate);
                applyEditData(freshTemplate);
              })
              .catch(err => {
                console.error('[Edit Mode] Error cargando template de API, usando cache:', err);
                applyEditData(template);
              });
          } else {
            // Cargar desde API si no está en la lista
            templatesService.getTemplateById(customizedProduct.templateId)
              .then(t => applyEditData(t))
              .catch(console.error);
          }
        }
      }
    }
  }, [searchParams, templates, getCartItemById]);

  // Cargar zonas del template (solo como guías visuales)
  // IMPORTANTE: No incluir 'designs' en dependencias para evitar cambios de vista al subir imagen
  useEffect(() => {
    const loadTemplateZones = async () => {
      if (selectedTemplate) {
        try {
          console.log('[CustomizerPage] Cargando zonas para template:', selectedTemplate.id);
          const zones = await templateZonesService.getByTemplateId(selectedTemplate.id);
          console.log('[CustomizerPage] Zonas recibidas:', zones);
          const validZones = Array.isArray(zones) ? zones : [];
          const activeZones = validZones.filter(z => z.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
          console.log('[CustomizerPage] Zonas activas (guías):', activeZones);
          setTemplateZones(activeZones);

          // Obtener tipos de zona únicos
          const zoneTypes = [...new Set(activeZones.map(z => z.zoneType?.slug).filter(Boolean))] as string[];
          console.log('[CustomizerPage] Tipos de vista encontrados:', zoneTypes);

          if (zoneTypes.length > 0) {
            // Solo establecer vista si no hay una seleccionada actualmente
            // Esto evita cambiar la vista cuando el usuario ya está trabajando
            setCurrentZoneType(prev => {
              if (prev && zoneTypes.includes(prev)) {
                // Mantener la vista actual si sigue siendo válida
                return prev;
              }
              // Si no hay vista o no es válida, usar la primera disponible
              return zoneTypes[0];
            });
          }
        } catch (error) {
          console.error('Error al cargar zonas:', error);
          setTemplateZones([]);
        }
      } else {
        setTemplateZones([]);
        setCurrentZoneType(null);
      }
    };
    loadTemplateZones();
  }, [selectedTemplate]);

  // Obtener tipos de zona únicos del template (usando Map para deduplicar por slug)
  const availableZoneTypes = Array.from(
    new Map(
      templateZones
        .filter(z => z.zoneType?.slug)
        .map(z => [z.zoneType!.slug, { slug: z.zoneType!.slug, name: z.zoneType!.name }])
    ).values()
  );

  // Zonas filtradas por tipo de zona actual (excluyendo bloqueadas para las guías)
  const zonesForCurrentType = templateZones.filter(
    z => z.zoneType?.slug === currentZoneType && !z.isBlocked
  );

  // Convertir zonas a formato del canvas (solo zonas NO bloqueadas para las guías)
  // positionX/Y son la esquina superior izquierda en porcentaje
  const availableZones = zonesForCurrentType.map(zone => ({
    id: `zone-${zone.id}` as PrintZone,
    dbId: zone.id, // Id numérico real de la zona en la base de datos
    name: zone.name,
    // Guardar porcentajes originales para el renderizado
    positionXPercent: zone.positionX,
    positionYPercent: zone.positionY,
    widthPercent: zone.maxWidth,
    heightPercent: zone.maxHeight,
    // También calcular en píxeles para otros usos
    position: {
      x: Math.round((zone.positionX / 100) * CANVAS_WIDTH),
      y: Math.round((zone.positionY / 100) * CANVAS_HEIGHT),
    },
    maxWidth: Math.round((zone.maxWidth / 100) * CANVAS_WIDTH),
    maxHeight: Math.round((zone.maxHeight / 100) * CANVAS_HEIGHT),
    isRequired: zone.isRequired,
    zoneType: zone.zoneType?.slug || 'unknown',
  }));

  // Debug: mostrar zonas disponibles (se ejecuta en cada render)
  useEffect(() => {
    console.log('[CustomizerPage RENDER] Estado actual:', {
      currentZoneType,
      zonesForCurrentType: zonesForCurrentType.length,
      availableZones: availableZones.length,
      imageLoaded,
      imageDimensions,
      templateZonesCount: templateZones.length,
    });
    if (availableZones.length > 0) {
      console.log('[CustomizerPage RENDER] Primera zona:', availableZones[0]);
    }
  }, [currentZoneType, zonesForCurrentType, availableZones, imageLoaded, imageDimensions, templateZones]);

  // Colores del template o fallback (deduplicados por hexCode)
  const availableColors = selectedTemplate?.colors?.length
    ? [...new Set(selectedTemplate.colors.map(c => c.hexCode))]
    : ['#FFFFFF', '#000000', '#EF4444', '#3B82F6', '#10B981'];

  // Tallas del template o fallback
  const availableSizes = selectedTemplate?.sizes?.length
    ? selectedTemplate.sizes.map(s => s.abbreviation)
    : ['S', 'M', 'L', 'XL'];

  // Inicializar canvas
  useEffect(() => {
    if (canvasRef.current) {
      canvasService.init(canvasRef.current);
      canvasService.resize(CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }, []);

  // Re-renderizar canvas cuando cambian los diseños
  useEffect(() => {
    renderCanvas();
  }, [designs, currentZoneType]);

  // Obtener la imagen actual para el tipo de zona seleccionado
  // IMPORTANTE: Las zonas se definen sobre zoneTypeImages, no sobre images.front/back
  const getCurrentTemplateImage = useCallback((): string | undefined => {
    if (!selectedTemplate) {
      console.log('[getCurrentTemplateImage] No hay template seleccionado');
      return undefined;
    }

    let imageUrl: string | undefined;

    console.log('[getCurrentTemplateImage] Template:', selectedTemplate.id, 'currentZoneType:', currentZoneType);
    console.log('[getCurrentTemplateImage] zoneTypeImages:', selectedTemplate.zoneTypeImages);
    console.log('[getCurrentTemplateImage] images:', selectedTemplate.images);

    // PRIORIDAD 1: Usar zoneTypeImages que es donde se definen las zonas en el admin
    if (selectedTemplate.zoneTypeImages && currentZoneType) {
      imageUrl = selectedTemplate.zoneTypeImages[currentZoneType];
      console.log('[getCurrentTemplateImage] Usando zoneTypeImages para:', currentZoneType, imageUrl ? 'encontrada' : 'no encontrada');
    }

    // PRIORIDAD 2: Fallback a images.front/back si no hay zoneTypeImages
    if (!imageUrl && selectedTemplate.images) {
      if (currentZoneType === 'back') {
        imageUrl = selectedTemplate.images.back || selectedTemplate.images.front;
      } else {
        // Para front o cualquier otra vista, usar front
        imageUrl = selectedTemplate.images.front;
      }
      console.log('[getCurrentTemplateImage] Fallback a images para:', currentZoneType, imageUrl ? 'encontrada' : 'no encontrada');
    }

    // PRIORIDAD 3: Si currentZoneType no está definido pero hay imagen front, usarla
    if (!imageUrl && !currentZoneType && selectedTemplate.images?.front) {
      imageUrl = selectedTemplate.images.front;
      console.log('[getCurrentTemplateImage] Sin zoneType, usando images.front');
    }

    // La imagen debe ser ABSOLUTA hacia el backend: en producción el front
    // está en otro dominio, así que una ruta relativa /uploads daría 404.
    // (Antes se forzaba relativa para el proxy de Vite en dev.)
    if (imageUrl) {
      imageUrl = assetUrl(imageUrl);
    }

    return imageUrl;
  }, [selectedTemplate, currentZoneType]);

  // Resetear imageLoaded cuando cambia el template o el tipo de zona
  // y verificar si la imagen ya está cacheada después de un tick
  useEffect(() => {
    console.log('[useEffect reset] Cambiando template/zoneType:', selectedTemplate?.id, currentZoneType);
    setImageLoaded(false);
    setImageDimensions({ naturalWidth: 0, naturalHeight: 0 });
    setContainerDimensions({ width: 0, height: 0 });

    // Usar un pequeño timeout para verificar imágenes cacheadas después del reset
    // Esto es especialmente importante para imágenes base64 que cargan inmediatamente
    const timeoutId = setTimeout(() => {
      if (templateImageRef.current) {
        const img = templateImageRef.current;
        console.log('[useEffect reset timeout] Verificando imagen:', {
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        });
        if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
          console.log('[useEffect reset] Imagen cacheada/base64 detectada, cargando dimensiones');
          handleTemplateImageLoad();
        }
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [selectedTemplate?.id, currentZoneType, handleTemplateImageLoad]);

  // Aplicar color a la imagen del template cuando cambia el color seleccionado
  useEffect(() => {
    const colorizeTemplate = async () => {
      const originalImage = getCurrentTemplateImage();
      if (!originalImage) {
        setColorizedTemplateImage(null);
        return;
      }

      // Si el color es blanco o no hay color, usar imagen original
      if (!selectedColor || selectedColor.toUpperCase() === '#FFFFFF' || selectedColor.toUpperCase() === '#FFF') {
        setColorizedTemplateImage(null);
        return;
      }

      setIsColorizingTemplate(true);
      try {
        const colorized = await applyColorToImage(originalImage, selectedColor);
        setColorizedTemplateImage(colorized);
      } catch (error) {
        console.error('Error al colorizar template:', error);
        setColorizedTemplateImage(null);
      } finally {
        setIsColorizingTemplate(false);
      }
    };

    colorizeTemplate();
  }, [selectedColor, getCurrentTemplateImage]);

  // Detectar los límites del contenido visible del PNG
  useEffect(() => {
    const detectBounds = async () => {
      const templateImage = getCurrentTemplateImage();
      if (!templateImage || !imageLoaded) {
        setPngBounds(null);
        return;
      }

      try {
        const bounds = await detectPngBounds(templateImage);
        console.log('[detectBounds] Límites detectados:', bounds);
        setPngBounds(bounds);
      } catch (error) {
        console.error('Error al detectar límites del PNG:', error);
        // Fallback: usar toda el área
        setPngBounds({
          left: 0,
          top: 0,
          right: 100,
          bottom: 100,
          width: 100,
          height: 100,
        });
      }
    };

    detectBounds();
  }, [getCurrentTemplateImage, imageLoaded]);

  // Cargar zonas de diseño (habilitadas y bloqueadas) desde la base de datos
  useEffect(() => {
    const loadZonesFromDB = async () => {
      if (!selectedTemplate?.id || !currentZoneType) {
        setAllowedZones([]);
        setBlockedZones([]);
        return;
      }

      try {
        // Cargar zonas desde la tabla template_zones
        const templateZones = await templateZonesService.getByTemplateId(selectedTemplate.id);

        // Filtrar por el tipo de zona actual (front, back, etc.)
        const zonesForCurrentView = templateZones.filter(
          (z) => z.zoneType?.slug === currentZoneType && z.isActive
        );

        console.log('[CustomizerPage] Zonas de BD para', currentZoneType, ':', zonesForCurrentView);

        // Convertir TemplateZone a formato DesignZone para compatibilidad
        const convertToDesignZone = (zone: TemplateZone): DesignZone => ({
          id: zone.zoneId || `zone-${zone.id}`,
          type: zone.isBlocked ? 'blocked' : 'allowed',
          shape: zone.shape || 'rect',
          x: zone.positionX,
          y: zone.positionY,
          width: zone.maxWidth,
          height: zone.maxHeight,
          radius: zone.radius || undefined,
          points: zone.points || undefined,
          name: zone.name,
        });

        // Separar zonas por isBlocked
        const allowed = zonesForCurrentView
          .filter((z) => !z.isBlocked)
          .map(convertToDesignZone);
        const blocked = zonesForCurrentView
          .filter((z) => z.isBlocked)
          .map(convertToDesignZone);

        console.log('[CustomizerPage] Zonas habilitadas:', allowed.length, 'Zonas bloqueadas:', blocked.length);
        setAllowedZones(allowed);
        setBlockedZones(blocked);
      } catch (error) {
        console.error('[CustomizerPage] Error al cargar zonas:', error);
        setAllowedZones([]);
        setBlockedZones([]);
      }
    };

    loadZonesFromDB();
  }, [selectedTemplate?.id, currentZoneType]);

  const renderCanvas = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // El canvas ahora solo se usa para exportar la vista previa final
    // La visualización principal es con la imagen + overlays HTML
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setDesigns(new Map());
    // Resetear el tipo de zona para que se cargue el nuevo del template
    setCurrentZoneType(null);
    setImageLoaded(false);

    // Establecer color y talla por defecto del template
    if (template.colors?.length) {
      setSelectedColor(template.colors[0].hexCode);
    }
    if (template.sizes?.length) {
      setSelectedSize(template.sizes[0].abbreviation);
    }
  };

  // Clave del "slot" de diseño dentro del Map `designs`.
  // - Cliente: la propia vista (un diseño por vista, comportamiento original).
  // - Admin: `${vista}::${zonaId}` (un diseño por cada zona de impresión).
  const slotKey = useCallback(
    (view: string | null, zoneId: number | null): string | null => {
      if (!view) return null;
      return isAdmin && zoneId != null ? `${view}::${zoneId}` : view;
    },
    [isAdmin]
  );

  // Slot que se está editando ahora mismo
  const activeKey = slotKey(currentZoneType, activeZoneId);

  // Diseño actualmente activo (el que se puede arrastrar/redimensionar)
  const currentDesign = activeKey ? designs.get(activeKey) ?? null : null;

  // Todos los diseños de la vista actual (en modo admin puede haber varios)
  const designsForCurrentView = Array.from(designs.values()).filter(
    (d) => d.viewType === currentZoneType
  );

  // Al cambiar de vista, olvidar la zona activa (pertenece a otra vista)
  useEffect(() => {
    setActiveZoneId(null);
    setSelectedZone(null);
  }, [currentZoneType]);

  // Sincronizar slider cuando cambia el diseño
  useEffect(() => {
    if (currentDesign) {
      if (sliderRef.current) {
        sliderRef.current.value = String(currentDesign.size.width);
      }
      if (sizeDisplayRef.current) {
        sizeDisplayRef.current.textContent = `${Math.round(currentDesign.size.width)}%`;
      }
    }
  }, [currentDesign?.id, currentDesign?.size.width]);

  const handleImageUpload = (imageData: string, uploadData?: ImageUploadData) => {
    if (!currentZoneType) return;

    // Modo admin: hay que elegir primero la zona de impresión destino.
    if (isAdmin && activeZoneId == null) {
      alert('Selecciona una zona de impresión (haz clic en una guía) antes de subir la imagen.');
      return;
    }

    setIsUploading(true);

    // Zona de impresión destino (solo admin). Si existe, la imagen se coloca
    // dentro de ese recuadro; si no, se centra con un tamaño por defecto.
    const targetZone = isAdmin && activeZoneId != null
      ? availableZones.find(z => z.dbId === activeZoneId)
      : undefined;

    let initialWidth = 30;
    let initialHeight = 30;
    let initialX = 50;
    let initialY = 50;

    if (targetZone) {
      // Admin: el diseño nace ocupando la zona seleccionada
      initialWidth = targetZone.widthPercent;
      initialHeight = targetZone.heightPercent;
      initialX = targetZone.positionXPercent + targetZone.widthPercent / 2;
      initialY = targetZone.positionYPercent + targetZone.heightPercent / 2;
    } else if (availableZones.length > 0) {
      // Cliente: tamaño inicial basado en la zona más grande disponible
      const maxZoneWidth = Math.max(...availableZones.map(z => z.widthPercent));
      const maxZoneHeight = Math.max(...availableZones.map(z => z.heightPercent));
      initialWidth = Math.min(maxZoneWidth * 0.7, 50);
      initialHeight = Math.min(maxZoneHeight * 0.7, 50);
    }

    const designKey = slotKey(currentZoneType, activeZoneId);
    if (!designKey) {
      setIsUploading(false);
      return;
    }

    const newDesign: Design = {
      id: `design-${designKey}-${Date.now()}`,
      zoneId: `view-${currentZoneType}` as PrintZone,
      viewType: currentZoneType,
      slotKey: designKey,
      templateZoneId: targetZone?.dbId,
      zoneName: targetZone?.name,
      imageUrl: '',
      imageData: imageData,
      originalImageData: uploadData?.original,
      originalFileName: uploadData?.fileName,
      originalFileSize: uploadData?.fileSize,
      position: {
        x: initialX,
        y: initialY,
      },
      size: {
        width: initialWidth,
        height: initialHeight,
      },
      rotation: 0,
      opacity: 1,
    };

    setDesigns(prev => new Map(prev).set(designKey, newDesign));
    setIsUploading(false);
  };

  // Manejar selección de imagen desde el carrusel de prediseñados
  // thumbnailUrl: imagen pequeña para preview en el personalizador
  // fullUrl: URL de alta calidad para guardar en el pedido
  const handlePresetImageSelect = (thumbnailUrl: string, fullUrl: string, imageName: string) => {
    handleImageUpload(thumbnailUrl, { original: fullUrl, fileName: imageName, fileSize: 0 });
  };

  // Función interna de movimiento (usa refs para evitar re-renders)
  const dragMoveHandler = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDraggingRef.current || !designContainerRef.current || !designElementRef.current) return;

    // Prevenir scroll de la página durante el arrastre táctil
    e.preventDefault();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    // Cancelar cualquier RAF pendiente
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    // Usar requestAnimationFrame para suavizar el movimiento
    rafIdRef.current = requestAnimationFrame(() => {
      if (!designContainerRef.current || !designElementRef.current) return;

      const container = designContainerRef.current;
      const rect = container.getBoundingClientRect();

      // Calcular el movimiento en píxeles y convertir a porcentaje
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;

      // Convertir delta de píxeles a porcentaje del contenedor
      const deltaXPercent = (deltaX / rect.width) * 100;
      const deltaYPercent = (deltaY / rect.height) * 100;

      // Nueva posición calculada
      let newX = designStartPosRef.current.x + deltaXPercent;
      let newY = designStartPosRef.current.y + deltaYPercent;

      // Aplicar límites simples (0-100)
      newX = Math.max(0, Math.min(100, newX));
      newY = Math.max(0, Math.min(100, newY));

      // Guardar posición actual
      currentPosRef.current = { x: newX, y: newY };

      // Actualizar visualmente sin re-render (manipulación directa del DOM)
      if (designElementRef.current) {
        // Obtener tamaño del diseño desde el elemento
        const widthMatch = designElementRef.current.style.width.match(/(\d+\.?\d*)%/);
        const heightMatch = designElementRef.current.style.height.match(/(\d+\.?\d*)%/);
        const width = widthMatch ? parseFloat(widthMatch[1]) : 30;
        const height = heightMatch ? parseFloat(heightMatch[1]) : 30;

        const leftPercent = newX - (width / 2);
        const topPercent = newY - (height / 2);
        designElementRef.current.style.left = `${leftPercent}%`;
        designElementRef.current.style.top = `${topPercent}%`;
      }
    });
  }, []);

  // Función interna de fin de arrastre
  const dragEndHandler = useCallback(() => {
    if (!isDraggingRef.current) return;

    // Remover event listeners
    window.removeEventListener('mousemove', handleDragMoveRef.current);
    window.removeEventListener('mouseup', handleDragEndRef.current);
    window.removeEventListener('touchmove', handleDragMoveRef.current);
    window.removeEventListener('touchend', handleDragEndRef.current);

    // Cancelar RAF pendiente
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Limpiar estilos visuales
    if (designElementRef.current) {
      designElementRef.current.style.willChange = 'auto';
      designElementRef.current.style.boxShadow = '';
    }

    isDraggingRef.current = false;

    // Actualizar el estado con la posición final (solo si cambió)
    const zoneType = currentZoneTypeRef.current;
    if (zoneType && (currentPosRef.current.x !== designStartPosRef.current.x ||
        currentPosRef.current.y !== designStartPosRef.current.y)) {
      setDesigns(prev => {
        const updated = new Map(prev);
        const design = updated.get(zoneType);
        if (design) {
          updated.set(zoneType, {
            ...design,
            position: { x: currentPosRef.current.x, y: currentPosRef.current.y }
          });
        }
        return updated;
      });
    }

    setIsDragging(false);
  }, []);

  // Actualizar refs cuando cambian las funciones
  useEffect(() => {
    handleDragMoveRef.current = dragMoveHandler;
    handleDragEndRef.current = dragEndHandler;
  }, [dragMoveHandler, dragEndHandler]);

  // Funciones de Drag & Drop para mover el diseño libremente
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!currentDesign || !designContainerRef.current || !designElementRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = { x: clientX, y: clientY };
    designStartPosRef.current = { x: currentDesign.position.x, y: currentDesign.position.y };
    currentPosRef.current = { x: currentDesign.position.x, y: currentDesign.position.y };

    isDraggingRef.current = true;
    // Guardar el slot activo (vista para cliente, vista::zona para admin)
    currentZoneTypeRef.current = activeKey;

    // Agregar event listeners inmediatamente (sin esperar re-render)
    window.addEventListener('mousemove', handleDragMoveRef.current);
    window.addEventListener('mouseup', handleDragEndRef.current);
    window.addEventListener('touchmove', handleDragMoveRef.current, { passive: false });
    window.addEventListener('touchend', handleDragEndRef.current);

    // Aplicar estilo visual inmediatamente
    designElementRef.current.style.willChange = 'left, top';
    designElementRef.current.style.boxShadow = `0 0 0 2px white, 0 0 0 4px ${brandColors.primary}`;

    setIsDragging(true);
  };

  const handleDesignUpdate = (updates: Partial<Design>) => {
    if (!activeKey) return;
    const design = designs.get(activeKey);
    if (!design) return;

    const updatedDesign = { ...design, ...updates };
    setDesigns(prev => new Map(prev).set(activeKey, updatedDesign));
  };

  const handleDesignDelete = () => {
    if (!activeKey) return;
    setDesigns(prev => {
      const newMap = new Map(prev);
      newMap.delete(activeKey);
      return newMap;
    });
  };

  // Generar imagen de preview usando el canvas oculto
  // El diseño se recorta al contorno del template PNG (como en el personalizador)
  const generatePreviewImage = async (): Promise<string | null> => {
    if (!canvasRef.current || !selectedTemplate) return null;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Obtener imagen del template (coloreada si aplica)
    const imageUrl = colorizedTemplateImage || getCurrentTemplateImage();
    // También necesitamos la imagen original (sin colorear) para la máscara
    const originalTemplateUrl = getCurrentTemplateImage();
    if (!imageUrl || !originalTemplateUrl) return null;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Usar las dimensiones originales de la imagen para preservar aspect ratio
        const imgWidth = img.naturalWidth || CANVAS_WIDTH;
        const imgHeight = img.naturalHeight || CANVAS_HEIGHT;

        // Redimensionar canvas para que coincida con la imagen original (máximo 800px)
        const maxSize = 800;
        let canvasW = imgWidth;
        let canvasH = imgHeight;
        if (canvasW > maxSize || canvasH > maxSize) {
          const scale = maxSize / Math.max(canvasW, canvasH);
          canvasW = Math.round(canvasW * scale);
          canvasH = Math.round(canvasH * scale);
        }

        canvas.width = canvasW;
        canvas.height = canvasH;

        // Dibuja un diseño concreto sobre el canvas, conservando proporción
        // (object-contain) y aplicando rotación/opacidad.
        const drawOneDesign = (design: Design): Promise<void> => {
          return new Promise<void>((res) => {
            if (!design.imageData) {
              res();
              return;
            }
            const designImg = new Image();
            designImg.crossOrigin = 'anonymous';
            designImg.onload = () => {
              // Caja del diseño en píxeles (equivale al <div> del editor)
              const w = (design.size.width / 100) * canvas.width;
              const h = (design.size.height / 100) * canvas.height;

              // Calcular posición (centro del diseño en porcentaje)
              const centerX = (design.position.x / 100) * canvas.width;
              const centerY = (design.position.y / 100) * canvas.height;
              const x = centerX - w / 2;
              const y = centerY - h / 2;

              // Ajusta la imagen dentro de la caja conservando su proporción
              // natural (como el `object-contain` del editor) para no deformarla.
              const fitContain = (iw: number, ih: number) => {
                const imgRatio = iw / ih;
                const boxRatio = w / h;
                let dw: number;
                let dh: number;
                if (imgRatio > boxRatio) {
                  dw = w;
                  dh = w / imgRatio;
                } else {
                  dh = h;
                  dw = h * imgRatio;
                }
                return { dx: x + (w - dw) / 2, dy: y + (h - dh) / 2, dw, dh };
              };

              ctx.save();
              ctx.globalAlpha = design.opacity || 1;

              // Aplicar rotación si existe
              if (design.rotation) {
                ctx.translate(centerX, centerY);
                ctx.rotate((design.rotation * Math.PI) / 180);
                ctx.translate(-centerX, -centerY);
              }

              // Usar imagen coloreada si existe
              const displayImage = design.colorizedImageData || design.imageData!;
              const colorizedImg = new Image();
              colorizedImg.crossOrigin = 'anonymous';
              colorizedImg.onload = () => {
                const f = fitContain(colorizedImg.naturalWidth, colorizedImg.naturalHeight);
                ctx.drawImage(colorizedImg, f.dx, f.dy, f.dw, f.dh);
                ctx.restore();
                res();
              };
              colorizedImg.onerror = () => {
                const f = fitContain(designImg.naturalWidth, designImg.naturalHeight);
                ctx.drawImage(designImg, f.dx, f.dy, f.dw, f.dh);
                ctx.restore();
                res();
              };
              colorizedImg.src = displayImage;
            };
            designImg.onerror = () => res();
            designImg.src = design.imageData;
          });
        };

        // Dibujar todos los diseños de la vista actual, recortados al contorno
        // del template (en modo admin puede haber varios, uno por zona).
        const drawDesign = async () => {
          const viewDesigns = designsForCurrentView.filter((d) => d.imageData);

          // Limpiar canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (viewDesigns.length > 0) {
            // PASO 1: Dibujar cada diseño
            for (const design of viewDesigns) {
              await drawOneDesign(design);
            }

            // PASO 2: Usar el template como máscara para recortar los diseños.
            // Solo los píxeles donde el template tiene contenido se mantienen.
            const maskImg = new Image();
            maskImg.crossOrigin = 'anonymous';
            await new Promise<void>((res) => {
              maskImg.onload = () => {
                ctx.globalCompositeOperation = 'destination-in';
                ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = 'source-over';
                res();
              };
              maskImg.onerror = () => res();
              maskImg.src = originalTemplateUrl;
            });
          }

          // PASO 3: Dibujar el template encima (con el diseño ya recortado debajo)
          ctx.globalCompositeOperation = 'destination-over';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx.globalCompositeOperation = 'source-over';

          // Exportar como imagen
          const dataUrl = canvas.toDataURL('image/png', 0.95);
          resolve(dataUrl);
        };

        drawDesign();
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  };

  const handleAddToCart = async () => {
    if (!selectedTemplate) {
      alert('Por favor selecciona un modelo');
      return;
    }

    // Validar stock disponible
    if (availableStock !== null && availableStock < quantity) {
      alert(`Stock insuficiente. Solo hay ${availableStock} unidades disponibles.`);
      return;
    }

    const previewImage = await generatePreviewImage();
    if (!previewImage) {
      alert('Error al generar vista previa');
      return;
    }

    const allDesigns = Array.from(designs.values());
    const basePrice = selectedTemplate.basePrice;
    const pricePerView = 2000; // Precio por cada vista con diseño
    const customizationPrice = designs.size * pricePerView;
    const totalPrice = basePrice + customizationPrice;

    const selectedColorData = selectedTemplate.colors?.find(c => c.hexCode === selectedColor);
    const selectedSizeData = selectedTemplate.sizes?.find(s => s.name === selectedSize);

    // Guardar zonas como referencia (ya no son obligatorias para posicionar)
    const savedZones = templateZones.map(zone => ({
      zoneId: `zone-${zone.id}`,
      zoneName: zone.name,
      zoneTypeSlug: zone.zoneType?.slug || 'unknown',
      positionX: zone.positionX,
      positionY: zone.positionY,
      maxWidth: zone.maxWidth,
      maxHeight: zone.maxHeight,
    }));

    // Buscar diseños por vista
    const frontDesign = allDesigns.find(d => d.viewType === 'front');
    const backDesign = allDesigns.find(d => d.viewType === 'back');

    const customizedProduct: CustomizedProduct = {
      id: `custom-${Date.now()}`,
      productId: selectedTemplate.id.toString(),
      productType: (selectedTemplate.typeSlug || 'tshirt') as ProductType,
      productName: selectedTemplate.name,
      basePrice: basePrice,
      selectedColor: selectedColor,
      selectedColorName: selectedColorData?.name || selectedColor,
      colorId: selectedColorData?.id,
      selectedSize: selectedSize,
      sizeId: selectedSizeData?.id,
      designs: allDesigns,
      previewImages: { front: previewImage },
      productionImages: {
        front: frontDesign?.originalImageData || frontDesign?.imageData,
        back: backDesign?.originalImageData || backDesign?.imageData,
      },
      customizationPrice: customizationPrice,
      totalPrice: totalPrice,
      createdAt: new Date(),
      templateId: selectedTemplate.id,
      templateSlug: selectedTemplate.slug,
      templateImages: selectedTemplate.images,
      zoneTypeImages: selectedTemplate.zoneTypeImages || undefined,
      savedZones: savedZones.length > 0 ? savedZones : undefined,
    };

    if (isEditMode && editingCartItemId) {
      updateCustomizedProduct(editingCartItemId, customizedProduct);
      alert('¡Diseño actualizado exitosamente!');
    } else {
      addCustomizedProduct(customizedProduct, quantity);
      alert(`¡${quantity} producto(s) agregado(s) al carrito!`);
    }

    navigate('/cart');
  };

  // Exportar diseños como ZIP
  const handleExportDesigns = async () => {
    if (designs.size === 0) {
      alert('No hay diseños para exportar');
      return;
    }

    setIsExporting(true);
    try {
      // Construir mapa de imágenes del template por vista.
      // Se usa el viewType real de cada diseño (no la clave del Map, que en
      // modo admin es un slot `vista::zona`).
      const templateImages = new Map<string, string>();
      const colorizedImages = new Map<string, string>();
      const viewTypes = [
        ...new Set(
          Array.from(designs.values())
            .map(d => d.viewType)
            .filter((v): v is string => !!v)
        ),
      ];

      // Para cada vista con diseño, obtener la imagen del template correspondiente
      for (const viewType of viewTypes) {
        // Obtener imagen del template para esta vista
        let imageUrl: string | undefined;

        if (selectedTemplate?.zoneTypeImages && viewType) {
          imageUrl = selectedTemplate.zoneTypeImages[viewType];
        }
        if (!imageUrl && selectedTemplate?.images) {
          if (viewType === 'back') {
            imageUrl = selectedTemplate.images.back || selectedTemplate.images.front;
          } else {
            imageUrl = selectedTemplate.images.front;
          }
        }

        // Normalizar URL absoluta de /uploads a ruta relativa (mismo origen).
        if (imageUrl) {
          const uploadsIdx = imageUrl.indexOf('/uploads/');
          if (uploadsIdx > 0 && /^https?:\/\//i.test(imageUrl)) {
            imageUrl = imageUrl.slice(uploadsIdx);
          }
        }

        if (imageUrl) {
          templateImages.set(viewType, imageUrl);

          // Si hay un color seleccionado y no es blanco, colorizar TODAS las vistas
          const needsColorization = selectedColor &&
            selectedColor.toUpperCase() !== '#FFFFFF' &&
            selectedColor.toUpperCase() !== '#FFF';

          if (needsColorization) {
            // Si es la vista actual y ya tenemos la imagen colorizada, usarla
            if (viewType === currentZoneType && colorizedTemplateImage) {
              colorizedImages.set(viewType, colorizedTemplateImage);
            } else {
              // Colorizar esta vista
              try {
                console.log(`Colorizando vista ${viewType} con color ${selectedColor}...`);
                const colorized = await applyColorToImage(imageUrl, selectedColor);
                colorizedImages.set(viewType, colorized);
              } catch (err) {
                console.warn(`No se pudo colorizar vista ${viewType}:`, err);
                // Continuar sin colorizar esta vista
              }
            }
          }
        }
      }

      await exportDesignsToZip(designs, {
        templateName: selectedTemplate?.name || 'diseño',
        selectedColor: selectedColor,
        selectedSize: selectedSize,
        includeOriginal: true,
        templateImages,
        colorizedTemplateImages: colorizedImages.size > 0 ? colorizedImages : undefined,
      });
    } catch (error) {
      console.error('Error al exportar:', error);
      alert('Error al exportar los diseños');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <PageHeader
        title={isEditMode ? 'Editar Diseño' : 'Personalizador'}
        subtitle={isEditMode ? 'Modifica tu diseño' : 'Crea tu diseño único'}
        backLabel={isEditMode ? 'Carrito' : 'Catálogo'}
        onBack={() => navigate(isEditMode ? '/cart' : '/catalog')}
      />

      <div className="max-w-7xl mx-auto px-4 py-4 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          {/* Left: Selección de Modelo - order-1 en móvil */}
          <aside className="lg:col-span-3 space-y-4 lg:space-y-6 order-1">
            {/* Selector de Modelos */}
            <div className="bg-white rounded-xl shadow-md p-4 lg:p-6">
              <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-3 lg:mb-4">Selecciona un Modelo</h3>

              {loadingTemplates ? (
                <div className="flex items-center justify-center py-6 lg:py-8">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: brandColors.primary }} />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-6 lg:py-8">
                  <Package className="w-12 h-12 mx-auto mb-2" style={{ color: `${brandColors.primary}40` }} />
                  <p className="text-sm" style={{ color: `${brandColors.primary}80` }}>No hay modelos disponibles</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-2 gap-2 lg:gap-3 max-h-[200px] lg:max-h-[400px] overflow-y-auto pr-1 lg:pr-2">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={`relative rounded-lg border-2 overflow-hidden transition-all ${
                        selectedTemplate?.id === template.id
                          ? 'shadow-lg'
                          : 'border-gray-200 hover:shadow-md'
                      }`}
                      style={selectedTemplate?.id === template.id ? {
                        borderColor: brandColors.primary,
                        boxShadow: `0 0 0 2px ${brandColors.primary}30`
                      } : undefined}
                    >
                      {template.images?.front && (
                        <img
                          src={template.images.front}
                          alt={template.name}
                          className="w-full aspect-square object-cover"
                        />
                      )}
                      <div className="p-2 bg-white">
                        <p className="text-xs font-semibold truncate">{template.name}</p>
                        <p className="text-xs text-gray-500">
                          ${template.basePrice.toLocaleString('es-CO')}
                        </p>
                      </div>
                      {selectedTemplate?.id === template.id && (
                        <div
                          className="absolute top-1 right-1 text-white text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: brandColors.primary }}
                        >
                          ✓
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Opciones del producto */}
            {selectedTemplate && (
              <div className="bg-white rounded-xl shadow-md p-4 lg:p-6 space-y-4">
                {/* Color */}
                <div>
                  <ColorPicker
                    colors={availableColors}
                    selectedColor={selectedColor}
                    onColorChange={setSelectedColor}
                  />
                </div>

                {/* Tallas */}
                {availableSizes.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-900">Talla</span>
                      <button
                        onClick={() => setShowSizeGuide(true)}
                        className="text-xs font-medium hover:opacity-80"
                        style={{ color: brandColors.primary }}
                      >
                        Guía
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableSizes.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`min-w-[40px] px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                            selectedSize === size
                              ? ''
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                          style={selectedSize === size ? {
                            borderColor: brandColors.primary,
                            backgroundColor: `${brandColors.primary}15`,
                            color: brandColors.primary
                          } : undefined}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vista */}
                {availableZoneTypes.length > 0 && (
                  <div>
                    <span className="text-sm font-semibold text-gray-900 mb-2 block">Vista</span>
                    <div className="flex flex-wrap gap-2">
                      {availableZoneTypes.map((zt) => (
                        <button
                          key={zt.slug}
                          onClick={() => setCurrentZoneType(zt.slug)}
                          className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all relative ${
                            currentZoneType === zt.slug
                              ? ''
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                          style={currentZoneType === zt.slug ? {
                            borderColor: brandColors.primary,
                            backgroundColor: `${brandColors.primary}15`,
                            color: brandColors.primary
                          } : undefined}
                        >
                          {zt.name}
                          {Array.from(designs.values()).some(d => d.viewType === zt.slug) && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white" style={{ backgroundColor: brandColors.secondary }}></span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* Center: Canvas - order-2 en móvil */}
          <main className="lg:col-span-6 order-2">
            <div className="bg-white rounded-xl shadow-md p-4 lg:p-6">
              {selectedTemplate && (
                <div
                  className="mb-3 lg:mb-4 p-2 lg:p-3 rounded-lg"
                  style={{
                    backgroundColor: `${brandColors.primary}10`,
                    border: `1px solid ${brandColors.primary}30`
                  }}
                >
                  <div className="flex items-center gap-2 lg:gap-3">
                    {selectedTemplate.images?.front && (
                      <img
                        src={selectedTemplate.images.front}
                        alt={selectedTemplate.name}
                        className="w-10 h-10 lg:w-12 lg:h-12 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {selectedTemplate.name}
                      </p>
                      <p className="text-xs" style={{ color: brandColors.primary }}>
                        ${selectedTemplate.basePrice.toLocaleString('es-CO')} COP
                      </p>
                    </div>
                  </div>

                  {/* Control de tamaño compacto - solo si hay diseño */}
                  {currentDesign && (() => {
                    const maxWidth = availableZones.length === 0 ? 80 : Math.max(...availableZones.map(z => z.widthPercent));
                    const aspectRatio = currentDesign.size.width / currentDesign.size.height;

                    return (
                      <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${brandColors.primary}30` }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium" style={{ color: brandColors.primary }}>Tamaño</span>
                          <span ref={sizeDisplayRef} className="text-xs tabular-nums" style={{ color: `${brandColors.primary}cc` }}>
                            {Math.round(currentDesign.size.width)}%
                          </span>
                        </div>
                        <input
                          ref={sliderRef}
                          type="range"
                          min="5"
                          max={maxWidth}
                          defaultValue={currentDesign.size.width}
                          onInput={(e) => {
                            const newWidth = Number((e.target as HTMLInputElement).value);
                            const newHeight = newWidth / aspectRatio;
                            // Actualizar display
                            if (sizeDisplayRef.current) {
                              sizeDisplayRef.current.textContent = `${Math.round(newWidth)}%`;
                            }
                            // Actualizar diseño visualmente
                            if (designElementRef.current) {
                              designElementRef.current.style.width = `${newWidth}%`;
                              designElementRef.current.style.height = `${newHeight}%`;
                              const leftPercent = currentDesign.position.x - (newWidth / 2);
                              const topPercent = currentDesign.position.y - (newHeight / 2);
                              designElementRef.current.style.left = `${leftPercent}%`;
                              designElementRef.current.style.top = `${topPercent}%`;
                            }
                          }}
                          onMouseUp={(e) => {
                            const newWidth = Number((e.target as HTMLInputElement).value);
                            handleDesignUpdate({ size: { width: newWidth, height: newWidth / aspectRatio } });
                          }}
                          onTouchEnd={(e) => {
                            const newWidth = Number((e.target as HTMLInputElement).value);
                            handleDesignUpdate({ size: { width: newWidth, height: newWidth / aspectRatio } });
                          }}
                          className="w-full h-2 cursor-pointer"
                          style={{ accentColor: brandColors.primary }}
                        />
                      </div>
                    );
                  })()}

                  {/* Cantidad y botones de acción - siempre visible con template seleccionado */}
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${brandColors.primary}30` }}>
                    {/* Cantidad y Stock */}
                    {!isEditMode && (
                      <div className="flex flex-col items-center gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium" style={{ color: brandColors.primary }}>Cantidad:</span>
                          <div
                            className="flex items-center rounded-lg overflow-hidden"
                            style={{ border: `1px solid ${brandColors.primary}30` }}
                          >
                            <button
                              onClick={() => setQuantity(Math.max(1, quantity - 1))}
                              className="px-2.5 py-1 text-sm hover:opacity-80"
                              style={{ backgroundColor: `${brandColors.primary}15`, color: brandColors.primary }}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={availableStock !== null ? availableStock : 99}
                              value={quantity}
                              onChange={(e) => setQuantity(Math.max(1, Math.min(availableStock || 99, parseInt(e.target.value) || 1)))}
                              className="w-10 text-center py-1 text-sm"
                              style={{ borderLeft: `1px solid ${brandColors.primary}30`, borderRight: `1px solid ${brandColors.primary}30` }}
                            />
                            <button
                              onClick={() => setQuantity(Math.min(availableStock || 99, quantity + 1))}
                              className="px-2.5 py-1 text-sm hover:opacity-80"
                              style={{ backgroundColor: `${brandColors.primary}15`, color: brandColors.primary }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        {/* Indicador de stock */}
                        {availableStock !== null && (
                          <span className={`text-xs font-medium ${availableStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {loadingStock ? 'Verificando stock...' : availableStock > 0 ? `${availableStock} disponibles` : 'Sin stock'}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Botones */}
                    <div className="flex items-center gap-2">
                      {/* Descargar - solo icono, solo si hay diseño */}
                      {designs.size > 0 && (
                        <button
                          onClick={handleExportDesigns}
                          disabled={isExporting}
                          className="p-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                          title="Descargar diseños"
                        >
                          {isExporting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Download className="w-5 h-5" />
                          )}
                        </button>
                      )}

                      {/* Agregar al carrito - siempre visible */}
                      <button
                        onClick={handleAddToCart}
                        disabled={!selectedTemplate || (availableStock !== null && availableStock < quantity)}
                        className="flex-1 font-bold py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm text-white hover:opacity-90"
                        style={{ backgroundColor: availableStock === 0 ? '#dc2626' : isEditMode ? '#2563eb' : brandColors.primary }}
                      >
                        <ShoppingCart className="w-4 h-4" />
                        {availableStock !== null && availableStock === 0 ? 'Sin Stock' : isEditMode ? 'Guardar' : designs.size > 0 ? 'Agregar' : 'Comprar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Área de visualización con imagen + zonas como overlays */}
              <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-100 min-h-[300px] lg:min-h-[500px]">
                {selectedTemplate ? (
                  <>
                    {/* Imagen del template - usa coloreada si existe */}
                    {getCurrentTemplateImage() ? (
                      <img
                        key={`${selectedTemplate.id}-${currentZoneType}-${selectedColor}`}
                        ref={templateImageRef}
                        src={colorizedTemplateImage || getCurrentTemplateImage()}
                        alt={selectedTemplate.name}
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          console.log('[img onLoad] Evento onLoad disparado', {
                            naturalWidth: img.naturalWidth,
                            naturalHeight: img.naturalHeight,
                            complete: img.complete,
                          });
                          handleTemplateImageLoad();
                        }}
                        onError={() => {
                          console.error('[img onError] Error loading image:', getCurrentTemplateImage()?.substring(0, 100));
                          // Si falla, marcar como cargada para mostrar mensaje de error
                          setImageLoaded(true);
                        }}
                        className="w-full h-auto max-h-[600px] object-contain transition-opacity duration-200"
                        style={{ opacity: imageLoaded ? 1 : 0 }}
                      />
                    ) : null}

                    {/* Loading mientras carga la imagen o coloriza */}
                    {(!imageLoaded || isColorizingTemplate) && getCurrentTemplateImage() && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: brandColors.primary }} />
                      </div>
                    )}

                    {/* Mensaje si no hay imagen */}
                    {!getCurrentTemplateImage() && (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <p className="text-sm">No hay imagen disponible para esta vista</p>
                      </div>
                    )}

                    {/* Botones para mostrar/ocultar zonas */}
                    <div className="absolute top-2 right-2 z-20 flex flex-col gap-2">
                      {/* Botón para guías de zonas */}
                      {imageLoaded && availableZones.length > 0 && (
                        <button
                          onClick={() => setShowZoneGuides(!showZoneGuides)}
                          className="bg-white/90 hover:bg-white shadow-md rounded-lg px-3 py-2 flex items-center gap-2 text-sm font-medium text-gray-700 transition-all"
                          title={showZoneGuides ? 'Ocultar guías' : 'Mostrar guías'}
                        >
                          {showZoneGuides ? (
                            <>
                              <EyeOff className="w-4 h-4" />
                              <span className="hidden sm:inline">Ocultar guías</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4" />
                              <span className="hidden sm:inline">Mostrar guías</span>
                            </>
                          )}
                        </button>
                      )}

                    </div>

                    {/* Contenedor de guías de zonas (sin máscara para que se vean) */}
                    <div className="absolute inset-0" style={{ pointerEvents: 'auto' }}>
                      {/* Zonas como GUÍAS visuales - Seleccionables para ajustar tamaño */}
                      {imageLoaded && showZoneGuides && availableZones.map((zone) => {
                        const dimensions = getZoneDisplayDimensions(zone);
                        const isSelected = selectedZone === zone.id;

                        return (
                          <div
                            key={zone.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Admin: elegir esta zona como destino para colocar/editar su imagen
                              if (isAdmin) {
                                setActiveZoneId(zone.dbId);
                                setSelectedZone(zone.id);
                                return;
                              }
                              // Cliente: si hay diseño, ajustar su tamaño a la zona seleccionada
                              if (currentDesign && currentZoneType) {
                                // Calcular el centro de la zona
                                const zoneCenterX = zone.positionXPercent + (zone.widthPercent / 2);
                                const zoneCenterY = zone.positionYPercent + (zone.heightPercent / 2);

                                // Aplicar límites del PNG si están disponibles
                                let finalX = zoneCenterX;
                                let finalY = zoneCenterY;
                                if (pngBounds) {
                                  const clampedPos = clampPositionToBounds(
                                    { x: zoneCenterX, y: zoneCenterY },
                                    { width: zone.widthPercent, height: zone.heightPercent },
                                    pngBounds
                                  );
                                  finalX = clampedPos.x;
                                  finalY = clampedPos.y;
                                }

                                setDesigns(prev => {
                                  const updated = new Map(prev);
                                  const design = activeKey ? updated.get(activeKey) : undefined;
                                  if (design && activeKey) {
                                    updated.set(activeKey, {
                                      ...design,
                                      position: { x: finalX, y: finalY },
                                      size: { width: zone.widthPercent, height: zone.heightPercent },
                                    });
                                  }
                                  return updated;
                                });
                              }
                              setSelectedZone(isSelected ? null : zone.id);
                            }}
                            className={`absolute border-2 cursor-pointer transition-all ${
                              isSelected
                                ? ''
                                : 'border-dashed border-blue-400/50 hover:border-blue-500 hover:bg-blue-50/10'
                            }`}
                            style={{
                              left: dimensions.left,
                              top: dimensions.top,
                              width: dimensions.width,
                              height: dimensions.height,
                              ...(isSelected ? {
                                borderColor: brandColors.primary,
                                backgroundColor: `${brandColors.primary}20`
                              } : {})
                            }}
                          >
                            {/* Etiqueta de la guía */}
                            <div
                              className="absolute -top-5 left-0 px-1.5 py-0.5 text-xs font-medium rounded-t whitespace-nowrap text-white"
                              style={{ backgroundColor: isSelected ? brandColors.primary : 'rgba(59, 130, 246, 0.7)' }}
                            >
                              {zone.name}
                              {isSelected && (isAdmin ? ' — zona activa' : ' - Clic para ajustar')}
                            </div>
                          </div>
                        );
                      })}

                      {/* Las zonas habilitadas y bloqueadas NO se muestran, solo aplican máscara */}
                    </div>

                    {/* SVG con definiciones de máscaras para zonas bloqueadas */}
                    {blockedZones.length > 0 && (() => {
                      // Obtener el área real de la imagen para transformar coordenadas
                      const contentArea = getImageContentArea();

                      return (
                        <svg
                          className="absolute"
                          style={{ width: 0, height: 0, position: 'absolute' }}
                        >
                          <defs>
                            <mask id="blocked-zones-container-mask" maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
                              {/* Fondo blanco = visible */}
                              <rect x="0" y="0" width="1" height="1" fill="white" />
                              {/* Zonas bloqueadas en negro = invisible */}
                              {blockedZones.map((zone) => {
                                // Las coordenadas de zona están en porcentaje (0-100) relativo a la IMAGEN
                                // Necesitamos convertirlas a porcentaje (0-1) relativo al CONTENEDOR
                                let containerLeft: number;
                                let containerTop: number;
                                let containerWidth: number;
                                let containerHeight: number;

                                if (contentArea) {
                                  const { renderedWidth, renderedHeight, offsetX, offsetY, containerWidth: cw, containerHeight: ch } = contentArea;
                                  // Convertir de % de imagen a px, luego a % del contenedor
                                  containerLeft = (offsetX + (zone.x / 100) * renderedWidth) / cw;
                                  containerTop = (offsetY + (zone.y / 100) * renderedHeight) / ch;
                                  containerWidth = ((zone.width || 0) / 100) * renderedWidth / cw;
                                  containerHeight = ((zone.height || 0) / 100) * renderedHeight / ch;
                                } else {
                                  // Fallback si no hay contentArea
                                  containerLeft = zone.x / 100;
                                  containerTop = zone.y / 100;
                                  containerWidth = (zone.width || 0) / 100;
                                  containerHeight = (zone.height || 0) / 100;
                                }

                                if (zone.shape === 'circle') {
                                  // Usar elipse para cubrir todo el área definida (width x height)
                                  const cx = containerLeft + containerWidth / 2;
                                  const cy = containerTop + containerHeight / 2;
                                  const rx = containerWidth / 2;  // Radio horizontal
                                  const ry = containerHeight / 2; // Radio vertical
                                  return (
                                    <ellipse
                                      key={zone.id}
                                      cx={cx}
                                      cy={cy}
                                      rx={rx}
                                      ry={ry}
                                      fill="black"
                                    />
                                  );
                                }
                                if (zone.shape === 'polygon' && zone.points) {
                                  const points = zone.points.map(p => {
                                    const px = containerLeft + (p.x / 100) * containerWidth;
                                    const py = containerTop + (p.y / 100) * containerHeight;
                                    return `${px},${py}`;
                                  }).join(' ');
                                  return (
                                    <polygon
                                      key={zone.id}
                                      points={points}
                                      fill="black"
                                    />
                                  );
                                }
                                return (
                                  <rect
                                    key={zone.id}
                                    x={containerLeft}
                                    y={containerTop}
                                    width={containerWidth}
                                    height={containerHeight}
                                    fill="black"
                                  />
                                );
                              })}
                            </mask>
                          </defs>
                        </svg>
                      );
                    })()}

                    {/* Contenedor del diseño con máscara del PNG */}
                    {/* La máscara hace que el diseño se recorte al contorno de la prenda */}
                    <div
                      ref={designContainerRef}
                      className="absolute inset-0"
                      style={{
                        pointerEvents: 'none', // El contenedor no captura eventos, solo el diseño
                        // Usar la imagen del template como máscara para recortar el diseño
                        WebkitMaskImage: getCurrentTemplateImage()
                          ? `url(${getCurrentTemplateImage()})`
                          : undefined,
                        maskImage: getCurrentTemplateImage()
                          ? `url(${getCurrentTemplateImage()})`
                          : undefined,
                        WebkitMaskSize: 'contain',
                        maskSize: 'contain',
                        WebkitMaskPosition: 'center',
                        maskPosition: 'center',
                        WebkitMaskRepeat: 'no-repeat',
                        maskRepeat: 'no-repeat',
                      } as React.CSSProperties}
                    >
                      {/* Capa adicional con máscara de zonas bloqueadas */}
                      <div
                        className="absolute inset-0"
                        style={blockedZones.length > 0 ? {
                          mask: 'url(#blocked-zones-container-mask)',
                          WebkitMask: 'url(#blocked-zones-container-mask)',
                        } : undefined}
                      >
                        {/* Diseños posicionables. Cliente: uno por vista.
                            Admin: uno por cada zona; el activo se arrastra,
                            los demás se ven y se pueden seleccionar al hacer clic. */}
                        {designsForCurrentView.map((design) => {
                          const isActive = design === currentDesign;
                          const displayImage = design.colorizedImageData || design.imageData;

                          // Calcular posición y tamaño como porcentajes del contenedor
                          const leftPercent = design.position.x - (design.size.width / 2);
                          const topPercent = design.position.y - (design.size.height / 2);

                          return (
                            <div
                              key={design.id}
                              ref={isActive ? designElementRef : undefined}
                              className={`absolute select-none rounded ${
                                isActive ? 'cursor-move hover:ring-2' : 'cursor-pointer'
                              }`}
                              style={{
                                left: `${leftPercent}%`,
                                top: `${topPercent}%`,
                                width: `${design.size.width}%`,
                                height: `${design.size.height}%`,
                                opacity: design.opacity || 1,
                                transform: `rotate(${design.rotation || 0}deg)`,
                                transformOrigin: 'center center',
                                pointerEvents: 'auto', // El diseño sí captura eventos
                                touchAction: 'none', // Prevenir scroll/zoom al arrastrar
                                outline: !isActive && showZoneGuides ? `1px dashed ${brandColors.primary}80` : undefined,
                                '--tw-ring-color': `${brandColors.primary}60`,
                              } as React.CSSProperties}
                              onMouseDown={isActive ? handleDragStart : undefined}
                              onTouchStart={isActive ? handleDragStart : undefined}
                              onClick={
                                !isActive
                                  ? () => {
                                      // Admin: seleccionar este diseño/zona para editarlo
                                      if (design.templateZoneId != null) {
                                        setActiveZoneId(design.templateZoneId);
                                        setSelectedZone(`zone-${design.templateZoneId}`);
                                      }
                                    }
                                  : undefined
                              }
                            >
                              <img
                                src={displayImage}
                                alt="Diseño"
                                className="w-full h-full object-contain pointer-events-none"
                                draggable={false}
                              />
                              {/* Indicador de arrastre (solo el activo) */}
                              {isActive && (
                                <div
                                  className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity"
                                  style={{ backgroundColor: brandColors.primary }}
                                >
                                  <Move className="w-3 h-3" />
                                  <span>Arrastra para mover</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Indicador cuando no hay ningún diseño en la vista */}
                    {designsForCurrentView.length === 0 && imageLoaded && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none">
                        <Package className="w-12 h-12 mb-2 opacity-50" />
                        <span className="text-sm font-medium opacity-70">
                          {isAdmin
                            ? 'Selecciona una zona y sube una imagen'
                            : 'Sube una imagen para esta vista'}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  // Sin template seleccionado
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                    <Package className="w-16 h-16 mb-4" />
                    <p className="text-lg font-medium">Selecciona un modelo</p>
                    <p className="text-sm">para comenzar a personalizar</p>
                  </div>
                )}

                {/* Canvas oculto para exportar imagen final */}
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className="hidden"
                />
              </div>
            </div>
          </main>

          {/* Right: Controles de Diseño - order-3 en móvil para estar cerca del canvas */}
          <aside className="lg:col-span-3 space-y-4 lg:space-y-6 order-3">
            <div className="bg-white rounded-xl shadow-md p-4 lg:p-6">
              <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-3 lg:mb-4">Tu Diseño</h3>

              {selectedTemplate && currentZoneType ? (
                <div className="space-y-4">
                  {/* Selector de zona de impresión (solo admin) */}
                  {isAdmin && availableZones.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-gray-900 mb-1.5 block">
                        Zona de impresión
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {availableZones.map((zone) => {
                          const zoneSlot = slotKey(currentZoneType, zone.dbId);
                          const hasDesign = !!zoneSlot && designs.has(zoneSlot);
                          const isActiveZone = activeZoneId === zone.dbId;
                          return (
                            <button
                              key={zone.dbId}
                              onClick={() => {
                                setActiveZoneId(zone.dbId);
                                setSelectedZone(zone.id);
                              }}
                              className={`px-2.5 py-1.5 rounded-lg border-2 text-xs font-medium transition-all relative ${
                                isActiveZone ? '' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                              }`}
                              style={isActiveZone ? {
                                borderColor: brandColors.primary,
                                backgroundColor: `${brandColors.primary}15`,
                                color: brandColors.primary,
                              } : undefined}
                            >
                              {zone.name}
                              {hasDesign && (
                                <span
                                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white"
                                  style={{ backgroundColor: brandColors.secondary }}
                                ></span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        {activeZoneId == null
                          ? 'Elige una zona para colocar su imagen.'
                          : 'Sube una imagen para esta zona.'}
                      </p>
                    </div>
                  )}

                  {/* Estado actual del diseño */}
                  {currentDesign && (
                    <div
                      className="p-2.5 rounded-lg flex items-center gap-2"
                      style={{
                        backgroundColor: `${brandColors.secondary}15`,
                        border: `1px solid ${brandColors.secondary}40`
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white"
                        style={{ border: `1px solid ${brandColors.secondary}40` }}
                      >
                        <img src={currentDesign.imageData} alt="Tu diseño" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium" style={{ color: brandColors.secondary }}>
                          {currentDesign.zoneName ? `Zona: ${currentDesign.zoneName}` : 'Diseño cargado'}
                        </p>
                        <p className="text-xs" style={{ color: `${brandColors.secondary}cc` }}>Sube otra para reemplazar</p>
                      </div>
                      <button
                        onClick={handleDesignDelete}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors flex-shrink-0"
                        title="Eliminar diseño"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Subida de imagen: en modo admin requiere una zona seleccionada */}
                  {(!isAdmin || activeZoneId != null) ? (
                    <>
                      <ImageUploader onImageUpload={handleImageUpload} isUploading={isUploading} />

                      {/* Separador */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gray-200"></div>
                        <span className="text-xs text-gray-400">o elige</span>
                        <div className="flex-1 h-px bg-gray-200"></div>
                      </div>

                      {/* Carrusel de imágenes prediseñadas */}
                      <ImageCarousel
                        onImageSelect={handlePresetImageSelect}
                        isLoading={isUploading}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-center text-gray-400 py-4">
                      Selecciona una zona de impresión arriba para subir su imagen.
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Package className="w-10 h-10 mx-auto mb-2" style={{ color: `${brandColors.primary}40` }} />
                  <p className="text-sm" style={{ color: `${brandColors.primary}80` }}>Selecciona un modelo</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Modal guía de tallas */}
      <SizeGuideModal
        isOpen={showSizeGuide}
        onClose={() => setShowSizeGuide(false)}
        sizeChart={null}
      />
    </div>
  );
};
