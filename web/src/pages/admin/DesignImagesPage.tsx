import { useState, useEffect, useRef } from 'react';
import { designImagesService, type DesignImage } from '../../services/design-images.service';
import { CheckCircle, ImageIcon, Images, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Alert, Badge, Button, Dialog, EmptyState, Field, FilterBar, FormGrid, IconButton, ImageInput, NumberInput, Page,
  PageHeader, SearchInput, SelectInput, Spinner, StatCard, Switch, TextArea, TextInput, toast, useConfirm,
} from '../../components/ui';

const EMPTY_FORM = {
  name: '',
  description: '',
  thumbnailUrl: '',
  fullUrl: '',
  category: '',
  tags: '',
  sortOrder: 0,
  isActive: true,
};

// Redimensiona a máx. `maxWidth` px y devuelve PNG en base64 (conserva la transparencia).
const compressImage = (src: string, maxWidth: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No se pudo crear el contexto del canvas')); return; }
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Error al cargar la imagen'));
    img.src = src;
  });

export default function DesignImagesPage() {
  const confirm = useConfirm();
  const [images, setImages] = useState<DesignImage[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');

  // Diálogo para crear/editar
  const [showModal, setShowModal] = useState(false);
  const [editingImage, setEditingImage] = useState<DesignImage | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  // Nombre del último archivo elegido (para usarlo como nombre por defecto)
  const lastFileName = useRef<string | null>(null);

  // La imagen subida se redimensiona para el personalizador (máx. 300 px)
  const handleThumbnail = async (value: string) => {
    if (!value || !value.startsWith('data:')) {
      setFormData(prev => ({ ...prev, thumbnailUrl: value }));
      return;
    }
    try {
      setUploadingFile(true);
      const thumbnailBase64 = await compressImage(value, 300);
      const fileName = lastFileName.current?.replace(/\.[^/.]+$/, '') ?? '';
      setFormData(prev => ({ ...prev, thumbnailUrl: thumbnailBase64, name: prev.name || fileName }));
    } catch (err) {
      console.error('Error al procesar imagen:', err);
      toast.error('Error al procesar la imagen. Intenta con otra imagen.');
    } finally {
      setUploadingFile(false);
      lastFileName.current = null;
    }
  };

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

  const openCreateModal = () => {
    setEditingImage(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (image: DesignImage) => {
    setEditingImage(image);
    setFormData({
      name: image.name,
      description: image.description || '',
      thumbnailUrl: image.thumbnailUrl,
      fullUrl: image.fullUrl,
      category: image.category || '',
      tags: image.tags?.join(', ') || '',
      sortOrder: image.sortOrder,
      isActive: image.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.thumbnailUrl) {
      toast.error('Sube la imagen que se muestra en el personalizador');
      return;
    }
    if (!formData.fullUrl) {
      toast.error('Ingresa la URL de alta calidad');
      return;
    }

    try {
      setSaving(true);
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        thumbnailUrl: formData.thumbnailUrl,
        fullUrl: formData.fullUrl,
        category: formData.category || undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(t => t) : undefined,
        sortOrder: formData.sortOrder,
        isActive: formData.isActive,
      };

      if (editingImage) {
        await designImagesService.update(editingImage.id, data);
        toast.success('Imagen actualizada');
      } else {
        await designImagesService.create(data);
        toast.success('Imagen creada');
      }

      setShowModal(false);
      loadImages();
      loadCategories();
    } catch (err: any) {
      console.error('Error al guardar:', err);
      toast.error(`Error al guardar la imagen: ${err?.message || 'Error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (image: DesignImage) => {
    if (!(await confirm({ title: `¿Eliminar la imagen "${image.name}"?`, message: 'Esta acción no se puede deshacer.', tone: 'danger' }))) return;
    try {
      await designImagesService.remove(image.id);
      toast.success('Imagen eliminada');
      setShowModal(false);
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
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openCreateModal}>Nueva imagen</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={ImageIcon} label={hasFilters ? 'Encontradas' : 'Imágenes'} value={images.length} />
        <StatCard icon={CheckCircle} tone="green" label="Activas" value={activeCount} />
        <StatCard icon={Images} tone="gray" label="Categorías" value={categories.length} />
      </div>

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
                action={<Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={openCreateModal}>Nueva imagen</Button>} />}
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
                </div>
                <IconButton title="Editar" tone="app" className="!p-1.5" onClick={() => openEditModal(image)}><Pencil className="w-4 h-4" /></IconButton>
                <IconButton title="Eliminar" tone="danger" className="!p-1.5" onClick={() => handleDelete(image)}><Trash2 className="w-4 h-4" /></IconButton>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={showModal}
        onClose={() => setShowModal(false)}
        size="lg"
        title={editingImage ? 'Editar imagen' : 'Nueva imagen de diseño'}
        footer={(
          <>
            {editingImage && (
              <Button variant="ghost" className="sm:mr-auto text-red-600 hover:text-red-700 hover:bg-red-50" icon={<Trash2 className="w-4 h-4" />} onClick={() => handleDelete(editingImage)}>
                Eliminar
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" form="design-image-form" isLoading={saving} disabled={uploadingFile}>{editingImage ? 'Guardar cambios' : 'Crear'}</Button>
          </>
        )}
      >
        <form id="design-image-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-[13rem_1fr] gap-5">
          <Field label="Imagen para el personalizador" required hint={uploadingFile ? 'Procesando…' : 'Se redimensiona a 300 px (PNG con transparencia).'}>
            <div
              onChangeCapture={(e) => { const t = e.target as HTMLInputElement; if (t.type === 'file' && t.files?.[0]) lastFileName.current = t.files[0].name; }}
              onDropCapture={(e) => { const f = e.dataTransfer?.files?.[0]; if (f) lastFileName.current = f.name; }}
            >
              <ImageInput value={formData.thumbnailUrl} onChange={handleThumbnail} maxSizeMB={50} disabled={uploadingFile} />
            </div>
          </Field>

          <div className="space-y-4 min-w-0">
            <Field label="Nombre" required htmlFor="di-name">
              <TextInput id="di-name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Corazón rojo" />
            </Field>
            <Field label="URL de alta calidad (para pedidos)" required htmlFor="di-full"
              hint="Se usa al tomar el pedido para descargar la imagen en alta calidad (Google Drive, Dropbox, OneDrive…).">
              <TextInput id="di-full" type="url" required value={formData.fullUrl} onChange={(e) => setFormData({ ...formData, fullUrl: e.target.value })} placeholder="https://drive.google.com/…" />
            </Field>
            <Field label="Descripción" htmlFor="di-desc">
              <TextArea id="di-desc" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Descripción opcional" />
            </Field>
            <FormGrid>
              <Field label="Categoría" htmlFor="di-cat">
                <TextInput id="di-cat" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="Ej: Iconos, Logos…" list="design-categories-list" />
                <datalist id="design-categories-list">
                  {categories.map((cat) => <option key={cat} value={cat} />)}
                </datalist>
              </Field>
              <Field label="Orden" htmlFor="di-order">
                <NumberInput id="di-order" value={formData.sortOrder} onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })} step="1" />
              </Field>
            </FormGrid>
            <Field label="Etiquetas" htmlFor="di-tags" hint="Separadas por coma.">
              <TextInput id="di-tags" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} placeholder="amor, corazón, rojo" />
            </Field>
            <Switch checked={formData.isActive} onChange={(v) => setFormData({ ...formData, isActive: v })} label="Activa" description="Solo las imágenes activas aparecen en el personalizador." />
          </div>
        </form>
      </Dialog>
    </Page>
  );
}
