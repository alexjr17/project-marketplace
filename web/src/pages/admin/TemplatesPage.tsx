import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, CheckCircle, Grid3x3, LayoutTemplate, Palette, Pencil, Plus, Printer, Trash2,
} from 'lucide-react';
import { templatesService, type Template } from '../../services/templates.service';
import { TemplateForm, type TemplateFormData } from '../../components/admin/TemplateForm';
import { VisualZoneEditor } from '../../components/admin/VisualZoneEditor';
import { MannequinSnapshots } from '../../components/mannequin/MannequinSnapshots';
import { isModel3D, MODELS_3D, view3DOf, type View3D } from '../../components/mannequin/models';

/** Piezas del maniquí por slug del tipo de zona (el editor de zonas trabaja con slugs). */
const PIECE_SLUG: Record<View3D, string> = { front: 'frente', back: 'espalda', rightSleeve: 'manga-derecha', leftSleeve: 'manga-izquierda' };
const piecesBySlug = (p: Record<View3D, [number, number, number, number]>) =>
  Object.fromEntries((Object.keys(p) as View3D[]).map((v) => [PIECE_SLUG[v], p[v]]));
import { TemplateRecipesSection } from '../../components/admin/TemplateRecipesSection';
import { templateRecipesService } from '../../services/template-recipes.service';
import { useCatalogs } from '../../context/CatalogsContext';
import {
  ActionMenu, Alert, Badge, Button, Card, Dialog, EmptyState, FilterBar, IconButton, Page, PageHeader, Pager, SearchInput,
  SelectInput, Spinner, StatCard, Table, TableCard, TableMessage, Tabs, TBody, Td, Th, THead, Thumb, Tr, toast, useConfirm,
} from '../../components/ui';
import * as variantsService from '../../services/variants.service';

type ViewMode = 'list' | 'add' | 'edit';
type EditTab = 'data' | 'inputs' | 'zones';
type SortKey = 'name' | 'basePrice';

// Primera imagen del modelo (las imágenes pueden venir como lista o como objeto front/back/side)
const firstImage = (images: unknown): string => {
  if (!images) return '';
  if (Array.isArray(images)) return images[0] || '';
  const o = images as { front?: string; back?: string; side?: string };
  return o.front || o.back || o.side || '';
};
const backImage = (images: unknown): string | undefined => {
  if (!images) return undefined;
  if (Array.isArray(images)) return images[1];
  return (images as { back?: string }).back;
};
const money = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO');

export const TemplatesPage = () => {
  const { categories, productTypes } = useCatalogs();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editTab, setEditTab] = useState<EditTab>('data');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  // Fotos del maniquí 3D de la plantilla (fondo del editor de zonas).
  const [snapshots, setSnapshots] = useState<Record<View3D, string> | null>(null);
  const model3d = isModel3D(selectedTemplate?.model3d) ? selectedTemplate.model3d : null;
  useEffect(() => { setSnapshots(null); }, [model3d]);
  const [generatingVariantsFor, setGeneratingVariantsFor] = useState<Template | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [templatesWithVariants, setTemplatesWithVariants] = useState<Set<number>>(new Set());
  const [selectedInputIds, setSelectedInputIds] = useState<number[]>([]);

  // Filtros del listado
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [desc, setDesc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await templatesService.getAllTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error al cargar modelos:', error);
      toast.error('Error al cargar modelos');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = async (data: TemplateFormData) => {
    try {
      await templatesService.createTemplate({
        name: data.name,
        description: data.description,
        sku: data.sku,
        slug: data.slug,
        categoryId: data.categoryId || undefined,
        typeId: data.typeId || undefined,
        basePrice: data.basePrice,
        images: data.images,
        model3d: data.model3d,
        tags: data.tags,
        colorIds: data.colorIds,
        sizeIds: data.sizeIds,
      });

      toast.success('Modelo creado exitosamente');
      await loadTemplates();
      setViewMode('list');
    } catch (error) {
      toast.error((error as Error)?.message || 'Error al crear modelo');
    }
  };

  const handleEditTemplate = async (data: TemplateFormData) => {
    if (!selectedTemplate) return;

    try {
      // Actualizar datos del template
      await templatesService.updateTemplate(selectedTemplate.id, {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        typeId: data.typeId,
        basePrice: data.basePrice,
        images: data.images,
        model3d: data.model3d,
        tags: data.tags,
        isActive: data.isActive,
        colorIds: data.colorIds,
        sizeIds: data.sizeIds,
      });

      // Guardar insumos asociados
      await templateRecipesService.associateInputs(selectedTemplate.id, selectedInputIds);

      toast.success('Modelo y recetas actualizados exitosamente');
      await loadTemplates();
      setViewMode('list');
      setSelectedTemplate(null);
      setSelectedInputIds([]);
    } catch (error) {
      console.error('Error al guardar:', error);
      toast.error((error as Error)?.message || 'Error al actualizar modelo');
    }
  };

  const handleDeleteTemplate = async (template: Template) => {
    if (!(await confirm({ title: `¿Eliminar el modelo "${template.name}"?`, message: 'Esta acción no se puede deshacer.', tone: 'danger' }))) return;
    try {
      await templatesService.deleteTemplate(template.id);
      toast.success('Modelo eliminado exitosamente');
      await loadTemplates();
      setViewMode('list');
      setSelectedTemplate(null);
    } catch (error) {
      toast.error((error as Error)?.message || 'Error al eliminar modelo');
    }
  };

  const startEdit = async (template: Template) => {
    setSelectedTemplate(template);
    setEditTab('data');
    setViewMode('edit');

    // Cargar insumos asociados a este template
    try {
      const inputIds = await templateRecipesService.getAssociatedInputIds(template.id);
      setSelectedInputIds(inputIds);
    } catch (error) {
      console.error('Error loading associated inputs:', error);
      setSelectedInputIds([]);
    }
  };

  const cancelEdit = () => {
    setViewMode('list');
    setSelectedTemplate(null);
    setSelectedInputIds([]);
  };

  const handlePrintBarcodes = (template: Template) => {
    navigate(`/admin-panel/barcodes/print/${template.id}`);
  };

  // Verificar qué templates tienen variantes
  const checkTemplateVariants = async () => {
    const templateIds = new Set<number>();
    for (const template of templates) {
      try {
        const variants = await variantsService.getVariants({ productId: template.id });
        if (variants.length > 0) {
          templateIds.add(template.id);
        }
      } catch (error) {
        console.error(`Error checking variants for template ${template.id}:`, error);
      }
    }
    setTemplatesWithVariants(templateIds);
  };

  // Cargar información de variantes al montar o cuando cambian los templates
  useEffect(() => {
    if (templates.length > 0 && viewMode === 'list') {
      checkTemplateVariants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, viewMode]);

  const handleGenerateVariants = async () => {
    if (!generatingVariantsFor) return;

    try {
      setIsGenerating(true);
      const result = await variantsService.generateVariantsForProduct(
        generatingVariantsFor.id,
        0 // Stock inicial
      );

      // La API devuelve la lista de variantes creadas.
      const created = Array.isArray(result.created) ? result.created.length : Number(result.created) || 0;
      if (created > 0) {
        toast.success(`${created} variantes creadas exitosamente`);
        setTemplatesWithVariants(prev => new Set(prev).add(generatingVariantsFor.id));
      } else if (!result.errors?.length) {
        toast.info('No había variantes nuevas para crear');
      }

      if (result.errors && result.errors.length > 0) {
        toast.error(`${result.errors.length} errores al crear variantes`);
      }

      setGeneratingVariantsFor(null);
    } catch (error) {
      toast.error('Error al generar variantes: ' + ((error as Error)?.message));
    } finally {
      setIsGenerating(false);
    }
  };

  const types = useMemo(
    () => Array.from(new Set(templates.map(t => t.typeName).filter((n): n is string => !!n))).sort(),
    [templates],
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let list = templates.filter((tpl) => {
      if (typeFilter && tpl.typeName !== typeFilter) return false;
      if (statusFilter === 'active' && !tpl.isActive) return false;
      if (statusFilter === 'inactive' && tpl.isActive) return false;
      if (!t) return true;
      return `${tpl.name} ${tpl.sku} ${tpl.typeName ?? ''} ${tpl.categoryName ?? ''}`.toLowerCase().includes(t);
    });
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const r = sortKey === 'name' ? a.name.localeCompare(b.name, 'es') : a.basePrice - b.basePrice;
        return desc ? -r : r;
      });
    }
    return list;
  }, [templates, q, typeFilter, statusFilter, sortKey, desc]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const toggleSort = (k: SortKey) => { if (sortKey === k) setDesc(d => !d); else { setSortKey(k); setDesc(false); } };
  const sortIcon = (k: SortKey) => sortKey === k ? (desc ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />;

  // Si no están cargados los catálogos, mostrar loading
  if (!categories || !productTypes) {
    return <Page><Spinner label="Cargando catálogos…" /></Page>;
  }

  const backButton = (
    <Button variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={cancelEdit}>Volver a modelos</Button>
  );

  // Vista de formulario (agregar)
  if (viewMode === 'add') {
    return (
      <Page>
        <PageHeader icon={LayoutTemplate} title="Nuevo modelo" subtitle="Completa la información del modelo base" actions={backButton} />
        <Alert tone="info">Después de crear el modelo podrás asignarle insumos y dibujar sus zonas de diseño.</Alert>
        <TemplateForm onSubmit={handleAddTemplate} onCancel={cancelEdit} />
      </Page>
    );
  }

  // Vista de formulario (editar): pestañas Datos · Insumos · Zonas.
  // Las tres quedan montadas para no perder lo editado al cambiar de pestaña.
  if (viewMode === 'edit' && selectedTemplate) {
    return (
      <Page>
        <PageHeader icon={LayoutTemplate} title={selectedTemplate.name} subtitle={`Modelo ${selectedTemplate.sku}`} actions={backButton} />

        <Tabs<EditTab>
          value={editTab}
          onChange={setEditTab}
          tabs={[
            { value: 'data', label: 'Datos del modelo' },
            { value: 'inputs', label: 'Insumos', count: selectedInputIds.length },
            { value: 'zones', label: 'Zonas de diseño' },
          ]}
        />

        <div className={editTab === 'data' ? '' : 'hidden'}>
          <TemplateForm
            key={selectedTemplate.id}
            template={selectedTemplate}
            onSubmit={handleEditTemplate}
            onCancel={cancelEdit}
            onDelete={() => handleDeleteTemplate(selectedTemplate)}
          />
        </div>

        <div className={editTab === 'inputs' ? 'space-y-4' : 'hidden'}>
          <Alert tone="warning" action={<Button size="sm" variant="secondary" onClick={() => setEditTab('data')}>Ir a Datos</Button>}>
            Los insumos se guardan junto con el modelo: usa «Guardar cambios» en la pestaña Datos del modelo.
          </Alert>
          <Card>
            <TemplateRecipesSection
              templateId={selectedTemplate.id}
              selectedInputIds={selectedInputIds}
              onInputsChange={setSelectedInputIds}
            />
          </Card>
        </div>

        <div className={editTab === 'zones' ? 'space-y-4' : 'hidden'}>
          {/* Maniquí 3D: fotos de cada vista para dibujar las zonas encima. */}
          {editTab === 'zones' && model3d && (
            <MannequinSnapshots key={model3d} model={model3d} onDone={setSnapshots} />
          )}
          {!model3d && !firstImage(selectedTemplate.images) && (
            <Alert tone="warning">Agrega una imagen frontal al modelo para visualizar las zonas sobre la imagen.</Alert>
          )}
          <Card>
            <VisualZoneEditor
              templateId={selectedTemplate.id}
              templateImage={firstImage(selectedTemplate.images)}
              templateImageBack={backImage(selectedTemplate.images)}
              zoneTypeImages={selectedTemplate.zoneTypeImages || undefined}
              viewImageFor={model3d ? (snapshots ? (slug) => snapshots[view3DOf(slug)] : null) : undefined}
              modelPieces={model3d && MODELS_3D[model3d].pieces ? piecesBySlug(MODELS_3D[model3d].pieces!) : undefined}
              onZoneTypeImagesChange={async (images) => {
                try {
                  await templatesService.updateTemplate(selectedTemplate.id, {
                    zoneTypeImages: images,
                  });
                  // Actualizar el template seleccionado localmente
                  setSelectedTemplate(prev => prev ? { ...prev, zoneTypeImages: images } : null);
                  toast.success('Imágenes guardadas');
                } catch (error) {
                  console.error('Error al guardar imágenes:', error);
                  toast.error('Error al guardar las imágenes');
                }
              }}
            />
          </Card>
        </div>
      </Page>
    );
  }

  const activeCount = templates.filter(t => t.isActive).length;
  const hasFilters = !!(q || typeFilter || statusFilter !== 'all');

  // Vista de lista
  return (
    <Page>
      <PageHeader
        icon={LayoutTemplate}
        title="Plantillas personalizables"
        subtitle="Modelos base que el cliente personaliza (zonas, insumos y variantes)"
        actions={(
          <>
            <Button variant="secondary" onClick={() => navigate('/admin-panel/template-recipes')}>Recetas de insumos</Button>
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setViewMode('add')}>Nuevo modelo</Button>
          </>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={LayoutTemplate} label="Modelos" value={templates.length} />
        <StatCard icon={CheckCircle} tone="green" label="Activos" value={activeCount} />
        <StatCard icon={Grid3x3} tone="blue" label="Con variantes" value={templatesWithVariants.size} />
      </div>

      <FilterBar>
        <div className="sm:col-span-2"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por nombre, SKU, tipo o categoría…" /></div>
        <SelectInput value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} aria-label="Tipo">
          <option value="">Todos los tipos</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </SelectInput>
        <SelectInput value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }} aria-label="Estado">
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </SelectInput>
      </FilterBar>

      <TableCard footer={filtered.length > 0 && (
        <Pager page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
      )}>
        <Table>
          <THead>
            <tr>
              <Th><button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">Modelo {sortIcon('name')}</button></Th>
              <Th>Tipo</Th>
              <Th>Categoría</Th>
              <Th align="right">Colores</Th>
              <Th>Tallas</Th>
              <Th align="right"><button type="button" onClick={() => toggleSort('basePrice')} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">Precio base {sortIcon('basePrice')}</button></Th>
              <Th align="center">Estado</Th>
              <Th align="right">Acciones</Th>
            </tr>
          </THead>
          <TBody>
            {loading ? <TableMessage colSpan={8}>Cargando modelos…</TableMessage>
              : filtered.length === 0 ? (
                <tr><td colSpan={8}>
                  {hasFilters
                    ? <EmptyState icon={LayoutTemplate} title="No se encontraron modelos" description="Prueba con otra búsqueda o quita los filtros." />
                    : <EmptyState icon={LayoutTemplate} title="No hay modelos" description="Comienza agregando tu primer modelo personalizable."
                        action={<Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setViewMode('add')}>Nuevo modelo</Button>} />}
                </td></tr>
              ) : pageRows.map((template) => {
                const hasVariants = templatesWithVariants.has(template.id);
                const sizes = template.sizes || [];
                return (
                  <Tr key={template.id} onClick={() => startEdit(template)}>
                    <Td>
                      <div className="flex items-center gap-3 min-w-[13rem]">
                        <Thumb src={firstImage(template.images)} alt={template.name} size="lg" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{template.name}</p>
                          <p className="text-xs text-gray-500 font-mono truncate">{template.sku}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">{template.typeName || <span className="text-gray-400">Sin tipo</span>}</Td>
                    <Td className="whitespace-nowrap">{template.categoryName || <span className="text-gray-400">Sin categoría</span>}</Td>
                    <Td align="right">
                      <span className="inline-flex items-center gap-1 tabular-nums"><Palette className="w-4 h-4 text-gray-400" />{(template.colors || []).length}</span>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {sizes.slice(0, 3).map(size => <Badge key={size.id}>{size.abbreviation}</Badge>)}
                        {sizes.length > 3 && <span className="text-xs text-gray-400">+{sizes.length - 3}</span>}
                        {sizes.length === 0 && <span className="text-gray-400">—</span>}
                      </div>
                    </Td>
                    <Td align="right" className="tabular-nums whitespace-nowrap font-medium text-gray-900">{money(template.basePrice)}</Td>
                    <Td align="center"><Badge tone={template.isActive ? 'green' : 'gray'}>{template.isActive ? 'Activo' : 'Inactivo'}</Badge></Td>
                    <Td align="right" className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <IconButton title="Editar" tone="app" onClick={() => startEdit(template)}><Pencil className="w-4 h-4" /></IconButton>
                      <ActionMenu items={[
                        { label: 'Imprimir códigos de barras', icon: <Printer className="w-4 h-4" />, onClick: () => handlePrintBarcodes(template), hidden: !hasVariants },
                        { label: 'Generar variantes', icon: <Grid3x3 className="w-4 h-4" />, onClick: () => setGeneratingVariantsFor(template), hidden: hasVariants },
                        { label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDeleteTemplate(template), danger: true },
                      ]} />
                    </Td>
                  </Tr>
                );
              })}
          </TBody>
        </Table>
      </TableCard>

      <Dialog
        open={!!generatingVariantsFor}
        onClose={() => !isGenerating && setGeneratingVariantsFor(null)}
        title="Generar variantes"
        description={generatingVariantsFor?.name}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setGeneratingVariantsFor(null)} disabled={isGenerating}>Cancelar</Button>
            <Button onClick={handleGenerateVariants} isLoading={isGenerating} icon={<Grid3x3 className="w-4 h-4" />}>Generar variantes</Button>
          </>
        )}
      >
        <div className="space-y-3 text-sm text-gray-600">
          <p>Se generarán todas las combinaciones de colores y tallas configuradas para este modelo, con códigos de barras únicos.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Cada variante tendrá un código de barras EAN-13 único.</li>
            <li>El stock inicial será 0 (puedes ajustarlo después).</li>
            <li>Las variantes existentes no se duplicarán.</li>
          </ul>
        </div>
      </Dialog>
    </Page>
  );
};
