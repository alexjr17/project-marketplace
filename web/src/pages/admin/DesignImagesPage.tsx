import { useState, useEffect } from 'react';
import { designImagesService, type DesignImage } from '../../services/design-images.service';
import { DesignStudio } from '../../components/admin/designStudio/DesignStudio';
import { DesignFamiliesPanel } from './DesignFamiliesPanel';
import { CheckCircle, ImageIcon, Images, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Alert, Badge, Button, EmptyState, FilterBar, IconButton, Page, PageHeader, SearchInput, SelectInput, Spinner, StatCard, Tabs, toast, useConfirm,
} from '../../components/ui';

export default function DesignImagesPage() {
  const confirm = useConfirm();
  const [images, setImages] = useState<DesignImage[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [tab, setTab] = useState<'disenos' | 'familias'>('disenos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');

  // Editor de diseños: null = cerrado; 'nuevo' = diseño nuevo; o el diseño que se edita.
  const [studio, setStudio] = useState<DesignImage | 'nuevo' | null>(null);

  useEffect(() => {
    loadImages();
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadImages = async () => {
    try {
      setLoading(true);
      const filters: { isActive?: boolean; category?: string; search?: string } = {};
      if (filterActive === 'true') filters.isActive = true;
      if (filterActive === 'false') filters.isActive = false;
      if (filterCategory) filters.category = filterCategory;
      if (searchQuery) filters.search = searchQuery;

      const data = await designImagesService.getAll(filters);
      setImages(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError('Error al cargar las imágenes');
      setImages([]);
      console.error('Error cargando imágenes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await designImagesService.getCategories();
      setCategories(Array.isArray(data) ? data : []);
      setSeasons(await designImagesService.getSeasons().catch(() => []));
    } catch (err) {
      console.error('Error cargando categorías:', err);
    }
  };

  // Aplicar filtros cuando cambian
  useEffect(() => {
    const debounce = setTimeout(() => {
      loadImages();
    }, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterCategory, filterActive]);

  const openCreateModal = () => setStudio('nuevo');
  const openEditModal = (image: DesignImage) => setStudio(image);

  const handleDelete = async (image: DesignImage) => {
    if (!(await confirm({ title: `¿Eliminar la imagen "${image.name}"?`, message: 'Esta acción no se puede deshacer.', tone: 'danger' }))) return;
    try {
      await designImagesService.remove(image.id);
      toast.success('Imagen eliminada');
      loadImages();
    } catch (err) {
      toast.error('Error al eliminar la imagen');
      console.error(err);
    }
  };

  const activeCount = images.filter((i) => i.isActive).length;
  const hasFilters = !!(searchQuery || filterCategory || filterActive);

  return (
    <Page>
      <PageHeader
        icon={Images}
        title="Imágenes de diseño"
        subtitle="Catálogo de imágenes prediseñadas para el personalizador"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openCreateModal}>Nuevo diseño</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={ImageIcon} label={hasFilters ? 'Encontradas' : 'Imágenes'} value={images.length} />
        <StatCard icon={CheckCircle} tone="green" label="Activas" value={activeCount} />
        <StatCard icon={Images} tone="gray" label="Categorías" value={categories.length} />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'disenos', label: 'Diseños', count: images.length }, { value: 'familias', label: 'Familias (pack familiar)' }]} />

      {tab === 'familias' ? <DesignFamiliesPanel designs={images} seasons={seasons} onChanged={loadImages} /> : (<>
      <FilterBar>
        <div className="sm:col-span-2"><SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por nombre…" /></div>
        <SelectInput value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </SelectInput>
        <SelectInput value={filterActive} onChange={(e) => setFilterActive(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          <option value="true">Activas</option>
          <option value="false">Inactivas</option>
        </SelectInput>
      </FilterBar>

      {error && <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={loadImages}>Reintentar</Button>}>{error}</Alert>}

      {loading && images.length === 0 ? (
        <Spinner label="Cargando imágenes de diseño…" />
      ) : images.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          {hasFilters
            ? <EmptyState icon={ImageIcon} title="Sin resultados" description="Prueba con otra búsqueda o quita los filtros." />
            : <EmptyState icon={ImageIcon} title="No hay imágenes de diseño" description="Sube imágenes para que los clientes las usen en el personalizador."
                action={<Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={openCreateModal}>Nuevo diseño</Button>} />}
        </div>
      ) : (
        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 ${loading ? 'opacity-60' : ''}`}>
          {images.map((image) => (
            <div key={image.id} className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 transition-colors">
              <button type="button" onClick={() => openEditModal(image)} className="block w-full aspect-square bg-gray-50 relative" title="Editar">
                <img
                  src={image.thumbnailUrl}
                  alt={image.name}
                  className={`w-full h-full object-contain p-3 ${image.isActive ? '' : 'opacity-50 grayscale'}`}
                  onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
                />
                {!image.isActive && <span className="absolute top-2 left-2"><Badge>Inactiva</Badge></span>}
              </button>
              <div className="flex items-start gap-1 p-3 pt-2 border-t border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate" title={image.name}>{image.name}</p>
                  <p className="text-xs text-gray-500 truncate">{image.category || 'Sin categoría'}</p>
                  {(!!image.textFields?.length || image.season) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {!!image.textFields?.length && <Badge tone="app">Con nombre</Badge>}
                      {image.season && <Badge>{image.season}</Badge>}
                    </div>
                  )}
                </div>
                <IconButton title="Editar" tone="app" className="!p-1.5" onClick={() => openEditModal(image)}><Pencil className="w-4 h-4" /></IconButton>
                <IconButton title="Eliminar" tone="danger" className="!p-1.5" onClick={() => handleDelete(image)}><Trash2 className="w-4 h-4" /></IconButton>
              </div>
            </div>
          ))}
        </div>
      )}

      </>)}

      {studio && (
        <DesignStudio
          design={studio === 'nuevo' ? null : studio} categories={categories} seasons={seasons}
          onClose={() => setStudio(null)} onSaved={() => { setStudio(null); loadImages(); loadCategories(); }}
        />
      )}
    </Page>
  );
}
