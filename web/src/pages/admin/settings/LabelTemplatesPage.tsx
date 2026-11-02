import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Copy, Tag, Save, Eye, Download, Trash2, Ruler, LayoutGrid } from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import * as labelTemplatesService from '../../../services/label-templates.service';
import * as barcodeService from '../../../services/barcode.service';
import { catalogsService } from '../../../services/catalogs.service';
import type { ProductType as ProductTypeCatalog } from '../../../types/catalog';
import type { LabelTemplate, LabelZone } from '../../../types/label-template';
import { LabelTemplateEditor } from '../../../components/admin/LabelTemplateEditor';
import {
  ActionMenu, Badge, Button, Card, CardTitle, Checkbox, Dialog, EmptyState, Field, FilterBar, FormGrid, IconButton,
  NumberInput, Page, PageHeader, Pager, SearchInput, SelectInput, Spinner, Switch, Table, TableCard, TBody, Td, TextInput,
  Th, THead, Tr, toast, useConfirm, type Tone,
} from '../../../components/ui';

const utilTone = (pct: number): Tone => (pct >= 70 ? 'green' : pct >= 60 ? 'yellow' : 'red');

type ViewMode = 'list' | 'editor';

export default function LabelTemplatesPage() {
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [productTypes, setProductTypes] = useState<ProductTypeCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingTemplate, setEditingTemplate] = useState<LabelTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const confirm = useConfirm();
  // Duplicar: nombre de la copia (reemplaza al prompt() del navegador)
  const [duplicating, setDuplicating] = useState<{ id: number; name: string } | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicatingBusy, setDuplicatingBusy] = useState(false);

  // Editor state
  const [editorData, setEditorData] = useState({
    name: '',
    backgroundImage: null as string | null,
    width: 170.08,
    height: 255.12,
    pageType: 'A4',
    pageMargin: 20, // Optimizado: 0.7cm para mejor aprovechamiento
    labelSpacing: 5.67, // Optimizado: 0.2cm para mejor aprovechamiento
    isDefault: false,
    productTypeIds: [] as number[],
    zones: [] as LabelZone[],
  });


  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesData, productTypesData] = await Promise.all([
        labelTemplatesService.getLabelTemplates(),
        catalogsService.getProductTypes(),
      ]);
      setTemplates(templatesData);
      setProductTypes(productTypesData.filter(pt => pt.isActive));
    } catch (err: any) {
      console.error('Error loading data:', err);
      toast.error(err.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await labelTemplatesService.getLabelTemplates();
      setTemplates(data);
    } catch (err: any) {
      console.error('Error loading templates:', err);
      toast.error(err.message || 'Error al cargar plantillas');
    }
  };

  // Función para escalar zonas proporcionalmente cuando cambian las dimensiones de la etiqueta
  const scaleZones = (
    zones: LabelZone[],
    newWidth: number,
    newHeight: number,
    refWidth: number,
    refHeight: number
  ): LabelZone[] => {
    const scaleX = newWidth / refWidth;
    const scaleY = newHeight / refHeight;

    return zones.map(zone => ({
      ...zone,
      x: zone.x * scaleX,
      y: zone.y * scaleY,
      width: zone.width * scaleX,
      height: zone.height * scaleY,
      // Escalar fontSize proporcionalmente
      fontSize: Math.round(zone.fontSize * Math.min(scaleX, scaleY)),
    }));
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setEditorData({
      name: '',
      backgroundImage: null,
      width: 170.08,
      height: 255.12,
      pageType: 'A4',
      pageMargin: 20, // Optimizado: 0.7cm
      labelSpacing: 5.67, // Optimizado: 0.2cm
      isDefault: false,
      productTypeIds: [],
      zones: [],
    });
    setViewMode('editor');
  };

  const handleEdit = async (template: LabelTemplate) => {
    try {
      // Cargar la plantilla completa con zonas
      const fullTemplate = await labelTemplatesService.getLabelTemplateById(template.id);

      setEditingTemplate(fullTemplate);

      setEditorData({
        name: fullTemplate.name,
        backgroundImage: fullTemplate.backgroundImage,
        width: fullTemplate.width,
        height: fullTemplate.height,
        pageType: fullTemplate.pageType || 'A4',
        pageMargin: fullTemplate.pageMargin ?? 20, // Optimizado: 0.7cm
        labelSpacing: fullTemplate.labelSpacing ?? 5.67, // Optimizado: 0.2cm
        isDefault: fullTemplate.isDefault,
        productTypeIds: fullTemplate.productTypes?.map(pt => pt.productTypeId) || [],
        zones: fullTemplate.zones || [],
      });
      setViewMode('editor');
    } catch (err: any) {
      console.error('Error loading template:', err);
      toast.error(err.message || 'Error al cargar plantilla');
    }
  };

  const handleSave = async () => {
    if (!editorData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    if (editorData.width <= 0 || editorData.height <= 0) {
      toast.error('Las dimensiones deben ser mayores a 0');
      return;
    }

    setSaving(true);

    try {
      const templateData = {
        name: editorData.name,
        backgroundImage: editorData.backgroundImage,
        width: editorData.width,
        height: editorData.height,
        pageType: editorData.pageType,
        pageMargin: editorData.pageMargin,
        labelSpacing: editorData.labelSpacing,
        isDefault: editorData.isDefault,
        productTypeIds: editorData.productTypeIds,
      };

      let templateId: number;

      if (editingTemplate) {
        // Actualizar plantilla existente
        await labelTemplatesService.updateLabelTemplate(editingTemplate.id, templateData);
        templateId = editingTemplate.id;
      } else {
        // Crear nueva plantilla
        const created = await labelTemplatesService.createLabelTemplate(templateData);
        templateId = created.id;
      }

      // Guardar zonas
      // Primero, eliminar zonas que ya no existen (las que tienen ID positivo pero no están en la lista)
      if (editingTemplate) {
        const existingZoneIds = editorData.zones.filter(z => z.id > 0).map(z => z.id);
        const originalZoneIds = editingTemplate.zones?.map(z => z.id) || [];
        const zonesToDelete = originalZoneIds.filter(id => !existingZoneIds.includes(id));

        for (const zoneId of zonesToDelete) {
          await labelTemplatesService.deleteLabelZone(zoneId);
        }
      }

      // Luego, crear o actualizar cada zona
      for (const zone of editorData.zones) {
        if (zone.id < 0) {
          // Zona nueva (ID temporal negativo)
          await labelTemplatesService.createLabelZone(templateId, {
            zoneType: zone.zoneType,
            x: zone.x,
            y: zone.y,
            width: zone.width,
            height: zone.height,
            fontSize: zone.fontSize,
            fontWeight: zone.fontWeight,
            textAlign: zone.textAlign,
            fontColor: zone.fontColor,
            showLabel: zone.showLabel,
            rotation: zone.rotation,
            zIndex: zone.zIndex,
          });
        } else {
          // Zona existente
          await labelTemplatesService.updateLabelZone(zone.id, {
            x: zone.x,
            y: zone.y,
            width: zone.width,
            height: zone.height,
            fontSize: zone.fontSize,
            fontWeight: zone.fontWeight,
            textAlign: zone.textAlign,
            fontColor: zone.fontColor,
            showLabel: zone.showLabel,
            rotation: zone.rotation,
            zIndex: zone.zIndex,
          });
        }
      }

      await loadTemplates();
      setViewMode('list');
      toast.success(editingTemplate ? 'Plantilla actualizada correctamente' : 'Plantilla creada correctamente');
    } catch (err: any) {
      console.error('Error saving template:', err);
      toast.error(err.message || 'Error al guardar plantilla');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (editorData.zones.length > 0 || editorData.name.trim()) {
      if (!(await confirm({ title: '¿Descartar los cambios?', message: 'Lo que no hayas guardado se perderá.', confirmText: 'Descartar', tone: 'danger' }))) {
        return;
      }
    }
    setViewMode('list');
  };

  const handleDelete = async (id: number, name: string) => {
    if (!(await confirm({ title: `¿Eliminar la plantilla "${name}"?`, message: 'No se puede deshacer.', tone: 'danger' }))) {
      return;
    }

    try {
      await labelTemplatesService.deleteLabelTemplate(id);
      await loadTemplates();
      toast.success('Plantilla eliminada');
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar plantilla');
    }
  };

  const handleDuplicate = (id: number, name: string) => {
    setDuplicating({ id, name });
    setDuplicateName(`${name} (Copia)`);
  };

  const confirmDuplicate = async () => {
    if (!duplicating) return;
    const newName = duplicateName.trim();
    if (!newName) {
      toast.error('Escribe un nombre para la copia');
      return;
    }
    setDuplicatingBusy(true);
    try {
      await labelTemplatesService.duplicateLabelTemplate(duplicating.id, newName);
      await loadTemplates();
      toast.success('Plantilla duplicada');
      setDuplicating(null);
    } catch (err: any) {
      toast.error(err.message || 'Error al duplicar plantilla');
    } finally {
      setDuplicatingBusy(false);
    }
  };

  const handleGenerateExample = async (templateId: number) => {
    try {
      setGeneratingPDF(true);

      // Calcular cuántas etiquetas caben en una hoja con esta plantilla
      const template = templates.find(t => t.id === templateId);
      if (!template) {
        toast.error('Plantilla no encontrada');
        return;
      }

      // Calcular grid basado en configuración de la plantilla
      const pageType = template.pageType || 'A4';
      let pageWidth: number, pageHeight: number;

      switch (pageType) {
        case 'A3':
          pageWidth = 841.89; pageHeight = 1190.55;
          break;
        case 'LETTER':
          pageWidth = 612; pageHeight = 792;
          break;
        case 'A4':
        default:
          pageWidth = 595.28; pageHeight = 841.89;
          break;
      }

      const margin = template.pageMargin ?? 30;
      const spacing = template.labelSpacing ?? 10;
      const labelCols = Math.floor((pageWidth - margin * 2 + spacing) / (template.width + spacing));
      const labelRows = Math.floor((pageHeight - margin * 2 + spacing) / (template.height + spacing));
      const labelsPerPage = labelCols * labelRows;

      // Generar items de ejemplo (repetir para llenar una página)
      const exampleItems = Array(labelsPerPage).fill(null).map(() => ({
        variantId: 1, // Usaremos la primera variante disponible
        quantity: 1,
      }));

      // Generar PDF
      const pdfBlob = await barcodeService.generateBarcodeLabels(exampleItems, templateId);

      // Crear URL del blob para previsualización
      const url = window.URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(url);
      setShowPreviewModal(true);

    } catch (err: any) {
      console.error('Error generando PDF:', err);
      toast.error(err?.message || 'Error al generar PDF de ejemplo');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleGenerateExampleFromEditor = async () => {
    try {
      setGeneratingPDF(true);

      // Si estamos editando, primero guardar la configuración actual temporalmente
      if (editingTemplate) {
        // Actualizar la plantilla con la configuración actual del editor
        await labelTemplatesService.updateLabelTemplate(editingTemplate.id, {
          name: editorData.name,
          backgroundImage: editorData.backgroundImage,
          width: editorData.width,
          height: editorData.height,
          pageType: editorData.pageType,
          pageMargin: editorData.pageMargin,
          labelSpacing: editorData.labelSpacing,
          isDefault: editorData.isDefault,
          productTypeIds: editorData.productTypeIds,
        });

        // Actualizar zonas si cambiaron
        if (editorData.zones && editorData.zones.length > 0) {
          const zonesWithIds = editorData.zones.filter(z => z.id);
          if (zonesWithIds.length > 0) {
            await labelTemplatesService.updateLabelZones(
              editingTemplate.id,
              zonesWithIds.map(zone => ({
                id: zone.id!,
                data: {
                  x: zone.x,
                  y: zone.y,
                  width: zone.width,
                  height: zone.height,
                  fontSize: zone.fontSize,
                  fontWeight: zone.fontWeight,
                  textAlign: zone.textAlign,
                  fontColor: zone.fontColor,
                  showLabel: zone.showLabel,
                  rotation: zone.rotation,
                  zIndex: zone.zIndex,
                },
              }))
            );
          }
        }
      } else {
        toast.info('Debes guardar la plantilla antes de ver el ejemplo');
        return;
      }

      // Calcular grid basado en la configuración actual del editor
      const pageType = editorData.pageType || 'A4';
      let pageWidth: number, pageHeight: number;

      switch (pageType) {
        case 'A3':
          pageWidth = 841.89; pageHeight = 1190.55;
          break;
        case 'LETTER':
          pageWidth = 612; pageHeight = 792;
          break;
        case 'A4':
        default:
          pageWidth = 595.28; pageHeight = 841.89;
          break;
      }

      const margin = editorData.pageMargin ?? 20;
      const spacing = editorData.labelSpacing ?? 5.67;
      const labelCols = Math.floor((pageWidth - margin * 2 + spacing) / (editorData.width + spacing));
      const labelRows = Math.floor((pageHeight - margin * 2 + spacing) / (editorData.height + spacing));
      const labelsPerPage = labelCols * labelRows;

      // Generar items de ejemplo (repetir para llenar una página)
      const exampleItems = Array(labelsPerPage).fill(null).map(() => ({
        variantId: 1,
        quantity: 1,
      }));

      // Generar PDF usando la plantilla con la configuración actualizada
      const pdfBlob = await barcodeService.generateBarcodeLabels(exampleItems, editingTemplate.id);

      // Crear URL del blob para previsualización
      const url = window.URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(url);
      setShowPreviewModal(true);

    } catch (err: any) {
      console.error('Error generando PDF:', err);
      toast.error(err?.message || 'Error al generar PDF de ejemplo');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleClosePreview = () => {
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
    setShowPreviewModal(false);
  };

  const handleDownloadPDF = () => {
    if (!pdfPreviewUrl) return;

    const link = document.createElement('a');
    link.href = pdfPreviewUrl;
    link.download = `ejemplo-etiquetas-${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calcular métricas de aprovechamiento de forma reactiva
  const metrics = useMemo(() => {
    const pageType = editorData.pageType || 'A4';
    let pageWidth: number, pageHeight: number, pageNameCm: string;

    switch (pageType) {
      case 'A3':
        pageWidth = 841.89; pageHeight = 1190.55;
        pageNameCm = '29.7 × 42 cm';
        break;
      case 'LETTER':
        pageWidth = 612; pageHeight = 792;
        pageNameCm = '21.6 × 27.9 cm';
        break;
      case 'A4':
      default:
        pageWidth = 595.28; pageHeight = 841.89;
        pageNameCm = '21 × 29.7 cm';
        break;
    }

    const margin = editorData.pageMargin ?? 20;
    const spacing = editorData.labelSpacing ?? 5.67;
    const labelCols = Math.floor((pageWidth - margin * 2 + spacing) / (editorData.width + spacing));
    const labelRows = Math.floor((pageHeight - margin * 2 + spacing) / (editorData.height + spacing));
    const labelsPerPage = labelCols * labelRows;

    // Calcular área utilizada vs área total
    const pageAreaCm2 = (pageWidth / 28.35) * (pageHeight / 28.35);
    const labelAreaCm2 = (editorData.width / 28.35) * (editorData.height / 28.35);
    const usedAreaCm2 = labelAreaCm2 * labelsPerPage;
    const utilizationPercent = (usedAreaCm2 / pageAreaCm2) * 100;

    return {
      pageType,
      pageNameCm,
      labelCols,
      labelRows,
      labelsPerPage,
      utilizationPercent,
    };
  }, [
    editorData.pageType,
    editorData.width,
    editorData.height,
    editorData.pageMargin,
    editorData.labelSpacing,
  ]);

  // Calcular configuraciones optimizadas dinámicamente para el tipo de hoja actual
  const optimizedConfigs = useMemo(() => {
    const pageType = editorData.pageType || 'A4';
    let pageWidth: number, pageHeight: number;

    switch (pageType) {
      case 'A3':
        pageWidth = 841.89; pageHeight = 1190.55;
        break;
      case 'LETTER':
        pageWidth = 612; pageHeight = 792;
        break;
      case 'A4':
      default:
        pageWidth = 595.28; pageHeight = 841.89;
        break;
    }

    // Usar márgenes y separación actuales del editor
    const currentMargin = editorData.pageMargin ?? 20;
    const currentSpacing = editorData.labelSpacing ?? 5.67;

    // Área disponible después de márgenes
    const availableWidth = pageWidth - currentMargin * 2;
    const availableHeight = pageHeight - currentMargin * 2;

    // Función helper para calcular métricas
    const calculateMetrics = (width: number, height: number) => {
      const cols = Math.floor((availableWidth + currentSpacing) / (width + currentSpacing));
      const rows = Math.floor((availableHeight + currentSpacing) / (height + currentSpacing));
      const total = cols * rows;
      const pageAreaCm2 = (pageWidth / 28.35) * (pageHeight / 28.35);
      const labelAreaCm2 = (width / 28.35) * (height / 28.35);
      const usedAreaCm2 = labelAreaCm2 * total;
      const utilization = (usedAreaCm2 / pageAreaCm2) * 100;
      return { cols, rows, total, utilization };
    };

    // Función para calcular dimensiones óptimas dado un grid objetivo
    // Usa los márgenes y separación ACTUALES del formulario
    const calculateOptimalDimensions = (targetCols: number, targetRows: number, aspectRatio: number = 1.5) => {
      // Calcular el ancho máximo que puede tener cada etiqueta
      // availableWidth = (labelWidth × cols) + (spacing × (cols - 1))
      // labelWidth = (availableWidth - spacing × (cols - 1)) / cols
      const maxWidth = (availableWidth - currentSpacing * (targetCols - 1)) / targetCols;
      const maxHeight = (availableHeight - currentSpacing * (targetRows - 1)) / targetRows;

      // Mantener proporción vertical (2:3) ajustando dimensiones
      let finalWidth = maxWidth;
      let finalHeight = finalWidth * aspectRatio;

      // Si la altura calculada excede el máximo, ajustar desde la altura
      if (finalHeight > maxHeight) {
        finalHeight = maxHeight;
        finalWidth = finalHeight / aspectRatio;
      }

      return { width: finalWidth, height: finalHeight };
    };

    // Definir grids objetivo para cada tamaño
    // Estos grids se adaptan automáticamente al tamaño de hoja seleccionado
    const configs = [];

    // PEQUEÑA: Grid denso (más etiquetas)
    // Para A4: típicamente 4×6 = 24 etiquetas
    // Para A3: típicamente 6×9 = 54 etiquetas
    // Para Letter: típicamente 4×5 = 20 etiquetas
    let smallCols = 4, smallRows = 6;
    if (pageType === 'A3') {
      smallCols = 6;
      smallRows = 9;
    } else if (pageType === 'LETTER') {
      smallCols = 4;
      smallRows = 5;
    }

    const smallSize = calculateOptimalDimensions(smallCols, smallRows, 1.5);
    configs.push({
      name: 'Pequeña',
      description: 'Máxima cantidad de etiquetas',
      recommendation: 'Ideal para accesorios, ropa infantil o producción masiva',
      width: smallSize.width,
      height: smallSize.height,
      color: 'purple',
      icon: '📦',
    });

    // MEDIANA: Grid balanceado
    // Para A4: típicamente 3×3 = 9 etiquetas
    // Para A3: típicamente 4×6 = 24 etiquetas
    // Para Letter: típicamente 3×3 = 9 etiquetas
    let mediumCols = 3, mediumRows = 3;
    if (pageType === 'A3') {
      mediumCols = 4;
      mediumRows = 6;
    }

    const mediumSize = calculateOptimalDimensions(mediumCols, mediumRows, 1.5);
    configs.push({
      name: 'Mediana',
      description: 'Balance entre tamaño y cantidad',
      recommendation: 'Recomendada para ropa en general y uso estándar',
      width: mediumSize.width,
      height: mediumSize.height,
      color: 'green',
      icon: '📋',
    });

    // GRANDE: Grid espacioso (menos etiquetas, más grandes)
    // Para A4: típicamente 2×2 = 4 etiquetas
    // Para A3: típicamente 3×4 = 12 etiquetas
    // Para Letter: típicamente 2×2 = 4 etiquetas
    let largeCols = 2, largeRows = 2;
    if (pageType === 'A3') {
      largeCols = 3;
      largeRows = 4;
    }

    const largeSize = calculateOptimalDimensions(largeCols, largeRows, 1.5);
    configs.push({
      name: 'Grande',
      description: 'Mayor espacio y legibilidad',
      recommendation: 'Perfecta para productos premium o con mucha información',
      width: largeSize.width,
      height: largeSize.height,
      color: 'amber',
      icon: '📄',
    });

    // Calcular métricas reales para cada configuración
    return configs.map(config => {
      const metrics = calculateMetrics(config.width, config.height);
      return {
        ...config,
        metrics,
        widthCm: (config.width / 28.35).toFixed(1),
        heightCm: (config.height / 28.35).toFixed(1),
      };
    }).filter(config => config.metrics.total > 0); // Solo mostrar si caben etiquetas
  }, [editorData.pageType, editorData.pageMargin, editorData.labelSpacing]);

  // Función para aplicar una configuración optimizada (solo cambia dimensiones)
  const applyOptimizedConfig = (config: typeof optimizedConfigs[0]) => {
    // Usar la forma funcional para acceder al estado más reciente
    setEditorData(prevData => {
      // Escalar zonas proporcionalmente a las nuevas dimensiones
      // Usamos prevData.width y prevData.height como referencia (valores ANTES del cambio)
      const scaledZones = scaleZones(
        prevData.zones,
        config.width,
        config.height,
        prevData.width,
        prevData.height
      );

      return {
        ...prevData,
        width: config.width,
        height: config.height,
        zones: scaledZones,
        // Mantiene pageMargin y labelSpacing actuales del usuario
      };
    });
  };

  // Columnas de la tabla
  const columns = useMemo<ColumnDef<LabelTemplate>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Nombre',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-app-50 text-app-600 flex items-center justify-center flex-shrink-0"><Tag className="w-4 h-4" /></div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900">{row.original.name}</p>
              {row.original.isDefault && <Badge tone="app" className="mt-0.5">Por defecto</Badge>}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'productTypes',
        header: 'Tipos de producto',
        cell: ({ row }) => {
          const productTypes = row.original.productTypes || [];
          if (productTypes.length === 0) return <span className="text-gray-400">Todos los tipos</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {productTypes.slice(0, 2).map((pt) => <Badge key={pt.id}>{pt.productType.name}</Badge>)}
              {productTypes.length > 2 && <Badge>+{productTypes.length - 2}</Badge>}
            </div>
          );
        },
      },
      {
        accessorKey: 'dimensions',
        header: 'Dimensiones',
        cell: ({ row }) => (
          <div>
            <p className="text-gray-900 whitespace-nowrap">{(row.original.width / 28.35).toFixed(1)} × {(row.original.height / 28.35).toFixed(1)} cm</p>
            <p className="text-xs text-gray-500">
              {row.original.pageType || 'A4'} · {row.original.zones.length} zona{row.original.zones.length !== 1 ? 's' : ''}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'backgroundImage',
        header: 'Fondo',
        cell: ({ row }) => (row.original.backgroundImage ? <Badge tone="blue">Con imagen</Badge> : <span className="text-gray-400">Blanco</span>),
      },
      {
        accessorKey: 'isActive',
        header: 'Estado',
        cell: ({ row }) => <Badge tone={row.original.isActive ? 'green' : 'gray'}>{row.original.isActive ? 'Activa' : 'Inactiva'}</Badge>,
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <IconButton title="Editar plantilla" tone="app" onClick={() => handleEdit(row.original)}><Pencil className="w-4 h-4" /></IconButton>
            <ActionMenu
              items={[
                { label: 'Ver ejemplo en PDF', icon: <Eye className="w-4 h-4" />, onClick: () => handleGenerateExample(row.original.id), disabled: generatingPDF },
                { label: 'Duplicar', icon: <Copy className="w-4 h-4" />, onClick: () => handleDuplicate(row.original.id, row.original.name) },
                { label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => handleDelete(row.original.id, row.original.name) },
              ]}
            />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generatingPDF, templates]
  );

  // Filter data
  const filteredData = useMemo(() => {
    if (!searchTerm) return templates;
    const term = searchTerm.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        t.pageType?.toLowerCase().includes(term) ||
        t.productTypes?.some(pt => pt.productType.name.toLowerCase().includes(term))
    );
  }, [templates, searchTerm]);

  // Table instance
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  const alignOf = (id: string) => (id === 'actions' ? 'right' : id === 'isActive' ? 'center' : 'left') as 'left' | 'center' | 'right';

  // Previsualización del PDF (lista y editor)
  const previewDialog = (
    <Dialog
      open={showPreviewModal && !!pdfPreviewUrl}
      onClose={handleClosePreview}
      title="Ejemplo de etiquetas"
      description="Una hoja completa con la plantilla y datos de ejemplo."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClosePreview}>Cerrar</Button>
          <Button icon={<Download className="w-4 h-4" />} onClick={handleDownloadPDF}>Descargar PDF</Button>
        </>
      }
    >
      {pdfPreviewUrl && (
        <div className="rounded-lg border border-gray-200 overflow-hidden h-[65vh]">
          <iframe src={pdfPreviewUrl} className="w-full h-full" title="Vista previa del PDF" />
        </div>
      )}
    </Dialog>
  );

  const cmField = (label: string, value: number, opts: { min: string; max: string; fallback: number; onCm: (cm: number) => void; hint?: string }) => (
    <Field label={label} hint={opts.hint}>
      <NumberInput
        step="0.1"
        min={opts.min}
        max={opts.max}
        suffix="cm"
        value={(value / 28.35).toFixed(1)}
        onChange={(e) => opts.onCm(parseFloat(e.target.value) || opts.fallback)}
      />
    </Field>
  );

  // Vista de Editor
  if (viewMode === 'editor') {
    return (
      <Page>
        <PageHeader
          icon={Tag}
          title={editingTemplate ? 'Editar plantilla' : 'Nueva plantilla'}
          subtitle="Diseña la etiqueta arrastrando las zonas de información"
          actions={
            <>
              <Button variant="secondary" onClick={handleCancel} disabled={saving}>Cancelar</Button>
              <Button
                variant="outline"
                icon={<Eye className="w-4 h-4" />}
                onClick={handleGenerateExampleFromEditor}
                isLoading={generatingPDF}
                disabled={!editingTemplate}
                title={!editingTemplate ? 'Guarda la plantilla primero para ver el ejemplo' : 'Ver ejemplo en PDF'}
              >
                Ver ejemplo
              </Button>
              <Button icon={<Save className="w-4 h-4" />} onClick={handleSave} isLoading={saving}>Guardar plantilla</Button>
            </>
          }
        />

        <Card>
          <CardTitle icon={Tag}>Datos de la plantilla</CardTitle>
          <div className="space-y-4">
            <FormGrid>
              <Field label="Nombre de la plantilla" required>
                <TextInput value={editorData.name} onChange={(e) => setEditorData({ ...editorData, name: e.target.value })} placeholder="Ej: Etiqueta camisetas" />
              </Field>
              <div className="md:pt-7">
                <Switch
                  checked={editorData.isDefault}
                  onChange={(isDefault) => setEditorData({ ...editorData, isDefault })}
                  label="Plantilla por defecto"
                  description="Se usa cuando no hay otra para el tipo de producto."
                />
              </div>
            </FormGrid>
            <Field label="Tipos de producto" hint="Opcional. Si no marcas ninguno, la plantilla estará disponible para todos los tipos.">
              {productTypes.length === 0 ? (
                <p className="text-sm text-gray-400">No hay tipos de producto activos.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 pt-1">
                  {productTypes.map((productType) => (
                    <Checkbox
                      key={productType.id}
                      label={productType.name}
                      checked={editorData.productTypeIds.includes(productType.id)}
                      onChange={(e) => {
                        const newIds = e.target.checked
                          ? [...editorData.productTypeIds, productType.id]
                          : editorData.productTypeIds.filter(id => id !== productType.id);
                        setEditorData({ ...editorData, productTypeIds: newIds });
                      }}
                    />
                  ))}
                </div>
              )}
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle icon={Ruler}>Hoja e impresión</CardTitle>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Field label="Tipo de hoja">
                <SelectInput value={editorData.pageType} onChange={(e) => setEditorData({ ...editorData, pageType: e.target.value })}>
                  <option value="A4">A4 (21 × 29.7 cm)</option>
                  <option value="A3">A3 (29.7 × 42 cm)</option>
                  <option value="LETTER">Carta (21.6 × 27.9 cm)</option>
                  <option value="CUSTOM">Personalizado</option>
                </SelectInput>
              </Field>
              {cmField('Ancho de etiqueta', editorData.width, {
                min: '1', max: '30', fallback: 6,
                onCm: (cm) => {
                  const newWidth = cm * 28.35;
                  // Escalar zonas proporcionalmente desde el ancho ACTUAL
                  setEditorData(prevData => ({
                    ...prevData,
                    width: newWidth,
                    zones: scaleZones(prevData.zones, newWidth, prevData.height, prevData.width, prevData.height),
                  }));
                },
              })}
              {cmField('Alto de etiqueta', editorData.height, {
                min: '1', max: '40', fallback: 9,
                onCm: (cm) => {
                  const newHeight = cm * 28.35;
                  // Escalar zonas proporcionalmente desde el alto ACTUAL
                  setEditorData(prevData => ({
                    ...prevData,
                    height: newHeight,
                    zones: scaleZones(prevData.zones, prevData.width, newHeight, prevData.width, prevData.height),
                  }));
                },
              })}
              {cmField('Margen de la hoja', editorData.pageMargin, {
                min: '0', max: '5', fallback: 1,
                onCm: (cm) => setEditorData({ ...editorData, pageMargin: cm * 28.35 }),
              })}
              {cmField('Separación', editorData.labelSpacing, {
                min: '0', max: '2', fallback: 0.3, hint: 'Recomendado: 0.3–0.4 cm',
                onCm: (cm) => setEditorData({ ...editorData, labelSpacing: cm * 28.35 }),
              })}
            </div>

            {/* Aprovechamiento */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-gray-200 px-4 py-3 text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium text-gray-700"><LayoutGrid className="w-4 h-4 text-app-600" /> Aprovechamiento</span>
              <span className="text-gray-500">Hoja <b className="font-medium text-gray-900">{metrics.pageType} ({metrics.pageNameCm})</b></span>
              <span className="text-gray-500">Rejilla <b className="font-medium text-gray-900">{metrics.labelCols} × {metrics.labelRows}</b></span>
              <span className="text-gray-500">Etiquetas <b className="font-medium text-gray-900">{metrics.labelsPerPage} por hoja</b></span>
              <Badge tone={utilTone(metrics.utilizationPercent)}>{metrics.utilizationPercent.toFixed(1)}% de la hoja</Badge>
            </div>

            {/* Recomendaciones de tamaño */}
            {optimizedConfigs.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Tamaños recomendados para {editorData.pageType || 'A4'}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {optimizedConfigs.map((config, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => applyOptimizedConfig(config)}
                      className="text-left rounded-lg border border-gray-200 p-3 transition-colors hover:border-app-400 hover:bg-app-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-gray-900">{config.name}</p>
                          <p className="text-xs text-gray-500">{config.widthCm} × {config.heightCm} cm · rejilla {config.metrics.cols} × {config.metrics.rows}</p>
                        </div>
                        <Badge tone={utilTone(config.metrics.utilization)}>{config.metrics.utilization.toFixed(0)}%</Badge>
                      </div>
                      <p className="mt-2 text-sm text-gray-700"><b className="font-semibold">{config.metrics.total}</b> etiquetas por hoja</p>
                      <p className="mt-1 text-xs text-gray-500">{config.description}. {config.recommendation}.</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <LabelTemplateEditor
            key={`${editorData.width}-${editorData.height}`}
            backgroundImage={editorData.backgroundImage}
            width={editorData.width}
            height={editorData.height}
            zones={editorData.zones}
            onZonesChange={(zones) => setEditorData(prevData => ({ ...prevData, zones }))}
            onBackgroundImageChange={(image) => setEditorData(prevData => ({ ...prevData, backgroundImage: image }))}
          />
        </Card>

        {previewDialog}
      </Page>
    );
  }

  // Vista de Lista
  const { pageIndex, pageSize } = table.getState().pagination;

  return (
    <Page>
      <PageHeader
        icon={Tag}
        title="Plantillas de etiquetas"
        subtitle="Diseño de las etiquetas con código de barras que se imprimen para los productos"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Nueva plantilla</Button>}
      />

      {loading ? (
        <Spinner label="Cargando plantillas…" />
      ) : (
        <>
          <FilterBar>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por nombre, tipo de hoja o tipo de producto…" className="sm:col-span-2" />
          </FilterBar>

          <TableCard
            footer={filteredData.length > 0 && (
              <Pager page={pageIndex + 1} pageSize={pageSize} total={filteredData.length} onPage={(p) => table.setPageIndex(p - 1)} onPageSize={(s) => table.setPageSize(s)} />
            )}
          >
            {table.getRowModel().rows.length === 0 ? (
              <EmptyState
                icon={Tag}
                title={searchTerm ? 'No se encontraron plantillas' : 'No hay plantillas de etiquetas'}
                description={searchTerm ? 'Intenta con otra búsqueda.' : 'Crea la primera para imprimir etiquetas de tus productos.'}
                action={!searchTerm && <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Nueva plantilla</Button>}
              />
            ) : (
              <Table>
                <THead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <Th key={h.id} align={alignOf(h.column.id)}>
                          {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        </Th>
                      ))}
                    </tr>
                  ))}
                </THead>
                <TBody>
                  {table.getRowModel().rows.map((row) => (
                    <Tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <Td key={cell.id} align={alignOf(cell.column.id)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </TableCard>
        </>
      )}

      {previewDialog}

      <Dialog
        open={!!duplicating}
        onClose={() => setDuplicating(null)}
        title="Duplicar plantilla"
        description={duplicating ? `Se crea una copia de "${duplicating.name}" con sus zonas.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDuplicating(null)}>Cancelar</Button>
            <Button icon={<Copy className="w-4 h-4" />} isLoading={duplicatingBusy} onClick={confirmDuplicate}>Duplicar</Button>
          </>
        }
      >
        <Field label="Nombre de la copia" required>
          <TextInput autoFocus value={duplicateName} onChange={(e) => setDuplicateName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmDuplicate(); }} />
        </Field>
      </Dialog>
    </Page>
  );
}
