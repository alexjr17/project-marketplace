import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useSettings } from '../../../context/SettingsContext';
import { ImageUploadField } from '../../../components/admin/ImageUploadField';
import type { FeatureCard, ProductSection, CTASettings, WhatsAppButtonSettings, SectionFilters, HeroCard, PromoBanner, HomeBlockKey, HomeBlockSettings } from '../../../types/settings';
import { FEATURE_ICONS, DEFAULT_HOME_BLOCKS, homeBlock } from '../../../types/settings';
import { FEATURE_ICON_COMPONENTS } from '../../../components/home/featureIcons';
import { productsService } from '../../../services/products.service';
import {
  Home,
  Save,
  Image,
  LayoutGrid,
  ShoppingBag,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Palette,
  Film,
  Images,
  Layers,
  X,
  Megaphone,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import {
  Alert, Badge, Button, Card, CardTitle, Checkbox, ColorInput, Dialog, EmptyState, Field, FormActions, FormGrid, IconButton,
  NumberInput, Page, PageHeader, RadioGroup, SelectInput, SettingsSection, Switch, Tabs, TextArea, TextInput, toast, useConfirm,
} from '../../../components/ui';

type HomeTab = 'hero' | 'features' | 'blocks' | 'content' | 'cta' | 'whatsapp';

/** Bloques fijos de la portada que se configuran en la pestaña "Bloques". */
const BLOCK_INFO: { key: HomeBlockKey; label: string; description: string }[] = [
  { key: 'categories', label: 'Compra por categoría', description: 'Tarjetas con la foto y el número de productos de cada categoría activa (las vacías no se muestran).' },
  { key: 'showcase', label: 'Vitrina', description: 'Pestañas Novedades · Mejor calificados · Ofertas. La pestaña de ofertas se oculta si no hay descuentos vigentes.' },
  { key: 'howItWorks', label: 'Personaliza en 3 pasos', description: 'Elige prenda → sube tu diseño → recíbelo. Solo se ve si el módulo de personalización está activo.' },
  { key: 'reviews', label: 'Reseñas de clientes', description: 'Últimas reseñas aprobadas con 4 o 5 estrellas. Si aún no hay reseñas, el bloque no aparece.' },
];

/** Opción seleccionable con icono (tipo de carta, fondo, icono de la tarjeta). */
function ChoiceButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2.5 text-xs transition-colors ${active ? 'border-app-500 bg-app-50 text-app-700 ring-1 ring-app-500' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
    >
      {children}
    </button>
  );
}

/** Fila de una lista ordenable (carta, característica, sección o banner). */
function ItemRow({ icon, title, tag, inactive, meta, actions, className = '', ...drag }: {
  icon: ReactNode; title: ReactNode; tag?: ReactNode; inactive?: boolean; meta?: ReactNode; actions: ReactNode; className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${inactive ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'} ${className}`} {...drag}>
      {icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {tag}
          <span className={`font-medium truncate ${inactive ? 'text-gray-500' : 'text-gray-900'}`}>{title}</span>
          {inactive && <Badge>Inactiva</Badge>}
        </div>
        {meta && <div className="text-xs text-gray-500 mt-0.5 truncate">{meta}</div>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">{actions}</div>
    </div>
  );
}

const BG_LABELS: Record<string, string> = { gradient: 'Gradiente', image: 'Imagen', video: 'Video', carousel: 'Carrusel' };
const BG_ICONS: Record<string, typeof Palette> = { gradient: Palette, image: Image, video: Film, carousel: Images };

// Iconos de las características (compartidos con la portada)
const iconComponents = FEATURE_ICON_COMPONENTS;

export const SettingsHomePage = () => {
  const {
    settings,
    updateHomeSettings,
    addFeature,
    updateFeature,
    deleteFeature,
    addProductSection,
    updateProductSection,
    deleteProductSection,
    updateWhatsAppButton,
  } = useSettings();
  const confirm = useConfirm();
  const [tab, setTab] = useState<HomeTab>('hero');
  const [saving, setSaving] = useState(false);
  const withSaving = async (fn: () => Promise<void>) => {
    setSaving(true);
    try { await fn(); } finally { setSaving(false); }
  };

  // Database catalogs state
  const [dbCategories, setDbCategories] = useState<Array<{ id: number; name: string; slug: string }>>([]);
  const [dbTypes, setDbTypes] = useState<Array<{ id: number; name: string; slug: string; categoryId: number | null; categorySlug: string | null }>>([]);

  // Local form states
  const [heroCards, setHeroCards] = useState<HeroCard[]>(settings.home.hero?.cards || []);
  const [ctaForm, setCtaForm] = useState<CTASettings>(settings.home.cta);
  const [whatsappForm, setWhatsappForm] = useState<WhatsAppButtonSettings>(settings.home.whatsappButton);
  const [promoBanners, setPromoBanners] = useState<PromoBanner[]>(settings.home.promoBanners || []);
  const [blocksForm, setBlocksForm] = useState<Record<HomeBlockKey, HomeBlockSettings>>(() => ({
    categories: homeBlock(settings.home, 'categories'),
    showcase: homeBlock(settings.home, 'showcase'),
    howItWorks: homeBlock(settings.home, 'howItWorks'),
    reviews: homeBlock(settings.home, 'reviews'),
  }));
  const setBlock = (key: HomeBlockKey, patch: Partial<HomeBlockSettings>) =>
    setBlocksForm((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<{ type: 'section' | 'banner'; id: string } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ type: 'section' | 'banner'; id: string } | null>(null);

  // Modal states
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isHeroCardModalOpen, setIsHeroCardModalOpen] = useState(false);
  const [isPromoBannerModalOpen, setIsPromoBannerModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<FeatureCard | null>(null);
  const [editingSection, setEditingSection] = useState<ProductSection | null>(null);
  const [editingHeroCard, setEditingHeroCard] = useState<HeroCard | null>(null);
  const [editingPromoBanner, setEditingPromoBanner] = useState<PromoBanner | null>(null);

  // Form states para modales
  const [featureForm, setFeatureForm] = useState<Omit<FeatureCard, 'id'>>({
    icon: 'sparkles',
    title: '',
    description: '',
    isActive: true,
    order: 0,
  });
  const [sectionForm, setSectionForm] = useState<Omit<ProductSection, 'id'>>({
    title: '',
    subtitle: '',
    showSubtitle: true,
    filters: {},
    maxProducts: 5,
    showViewAll: true,
    viewAllLink: '/catalog',
    isActive: true,
    order: 0,
  });

  // Hero card form
  const [heroCardForm, setHeroCardForm] = useState<Omit<HeroCard, 'id'>>({
    position: 'side',
    order: 1,
    title: '',
    titleLine2: '',
    subtitle: '',
    showSubtitle: true,
    showBadge: false,
    badge: '',
    icon: 'sparkles',
    buttons: [],
    background: {
      type: 'gradient',
      overlayOpacity: 20,
    },
    isActive: true,
  });

  // Promo banner form
  const [promoBannerForm, setPromoBannerForm] = useState<Omit<PromoBanner, 'id'>>({
    order: 0,
    title: '',
    subtitle: '',
    buttonText: '',
    buttonLink: '',
    background: {
      type: 'gradient',
      overlayOpacity: 20,
    },
    height: 'medium',
    contentAlign: 'center',
    isActive: true,
  });

  // Sincronizar estado local con settings cuando se cargan de la API
  useEffect(() => {
    if (settings.home.hero?.cards) {
      setHeroCards(settings.home.hero.cards);
    }
    if (settings.home.cta) {
      setCtaForm(settings.home.cta);
    }
    if (settings.home.whatsappButton) {
      setWhatsappForm(settings.home.whatsappButton);
    }
    if (settings.home.promoBanners) {
      setPromoBanners(settings.home.promoBanners);
    }
  }, [settings.home.hero?.cards, settings.home.cta, settings.home.whatsappButton, settings.home.promoBanners]);

  // Bloques: se recalculan cuando llega lo guardado (los que no estén usan los por defecto).
  const savedBlocksKey = JSON.stringify(settings.home.blocks ?? {});
  useEffect(() => {
    const home = { blocks: JSON.parse(savedBlocksKey) };
    setBlocksForm({
      categories: homeBlock(home, 'categories'),
      showcase: homeBlock(home, 'showcase'),
      howItWorks: homeBlock(home, 'howItWorks'),
      reviews: homeBlock(home, 'reviews'),
    });
  }, [savedBlocksKey]);

  // Load categories and types from database
  useEffect(() => {
    const loadCatalogsData = async () => {
      try {
        const [categories, types] = await Promise.all([
          productsService.getCategories(),
          productsService.getTypes(),
        ]);
        setDbCategories(categories);
        setDbTypes(types);
      } catch (error) {
        console.error('Error loading catalogs data:', error);
      }
    };
    loadCatalogsData();
  }, []);

  // Hero card handlers
  const handleOpenHeroCardModal = (card?: HeroCard) => {
    if (card) {
      setEditingHeroCard(card);
      setHeroCardForm({
        position: card.position,
        order: card.order,
        title: card.title,
        titleLine2: card.titleLine2 || '',
        subtitle: card.subtitle || '',
        showSubtitle: card.showSubtitle,
        showBadge: card.showBadge,
        badge: card.badge || '',
        icon: card.icon || 'sparkles',
        buttons: card.buttons,
        background: card.background,
        isActive: card.isActive,
      });
    } else {
      setEditingHeroCard(null);
      const sideCardsCount = heroCards.filter(c => c.position === 'side').length;
      setHeroCardForm({
        position: 'side',
        order: sideCardsCount + 1,
        title: '',
        titleLine2: '',
        subtitle: '',
        showSubtitle: true,
        showBadge: false,
        badge: '',
        icon: 'sparkles',
        buttons: [{
          id: `btn-${Date.now()}`,
          text: 'Ver más',
          link: '/catalog',
          style: 'primary',
          isActive: true,
        }],
        background: {
          type: 'gradient',
          overlayOpacity: 20,
        },
        isActive: true,
      });
    }
    setIsHeroCardModalOpen(true);
  };

  const handleSaveHeroCard = () => withSaving(async () => {
    // Limpiar URLs vacías del carrusel antes de guardar
    const cleanedForm = {
      ...heroCardForm,
      background: {
        ...heroCardForm.background,
        carouselImages: heroCardForm.background.carouselImages?.filter(url => url.trim() !== '') || []
      }
    };

    let newCards: HeroCard[];

    if (editingHeroCard) {
      newCards = heroCards.map(c =>
        c.id === editingHeroCard.id ? { ...cleanedForm, id: c.id } : c
      );
    } else {
      const newCard: HeroCard = {
        ...cleanedForm,
        id: `card-${Date.now()}`,
      };
      newCards = [...heroCards, newCard];
    }

    try {
      // Persistir inmediatamente a la API
      await updateHomeSettings({
        hero: {
          ...settings.home.hero,
          cards: newCards,
        }
      });
      setHeroCards(newCards);
      toast.success(editingHeroCard ? 'Carta actualizada' : 'Carta creada');
      setIsHeroCardModalOpen(false);
    } catch (error) {
      console.error('Error guardando carta:', error);
      toast.error('Error al guardar la carta. Verifica la conexión.');
    }
  });

  const handleDeleteHeroCard = async (id: string) => {
    if (await confirm({ title: '¿Eliminar esta carta del hero?', message: 'Se quita de la portada.', tone: 'danger' })) {
      const newCards = heroCards.filter(c => c.id !== id);
      try {
        await updateHomeSettings({
          hero: {
            ...settings.home.hero,
            cards: newCards,
          }
        });
        setHeroCards(newCards);
        toast.success('Carta eliminada');
      } catch (error) {
        toast.error('Error al eliminar la carta');
      }
    }
  };

  const handleToggleHeroCard = async (id: string) => {
    const newCards = heroCards.map(c =>
      c.id === id ? { ...c, isActive: !c.isActive } : c
    );
    try {
      await updateHomeSettings({
        hero: {
          ...settings.home.hero,
          cards: newCards,
        }
      });
      setHeroCards(newCards);
    } catch (error) {
      toast.error('Error al cambiar estado de la carta');
    }
  };

  // Promo Banner handlers
  const handleOpenPromoBannerModal = (banner?: PromoBanner, insertOrder?: number) => {
    if (banner) {
      setEditingPromoBanner(banner);
      setPromoBannerForm({
        order: banner.order,
        title: banner.title,
        subtitle: banner.subtitle || '',
        buttonText: banner.buttonText || '',
        buttonLink: banner.buttonLink || '',
        background: banner.background,
        height: banner.height,
        contentAlign: banner.contentAlign,
        isActive: banner.isActive,
      });
    } else {
      setEditingPromoBanner(null);
      // Si se especifica insertOrder, usarlo; si no, calcular el siguiente orden
      const allItems = [
        ...settings.home.productSections.map(s => s.order),
        ...promoBanners.map(b => b.order),
      ];
      const nextOrder = insertOrder !== undefined ? insertOrder : (Math.max(0, ...allItems) + 1);
      setPromoBannerForm({
        order: nextOrder,
        title: '',
        subtitle: '',
        buttonText: '',
        buttonLink: '',
        background: {
          type: 'gradient',
          overlayOpacity: 20,
        },
        height: 'medium',
        contentAlign: 'center',
        isActive: true,
      });
    }
    setIsPromoBannerModalOpen(true);
  };

  const handleSavePromoBanner = () => withSaving(async () => {
    let newBanners: PromoBanner[];

    if (editingPromoBanner) {
      newBanners = promoBanners.map(b =>
        b.id === editingPromoBanner.id ? { ...promoBannerForm, id: b.id } : b
      );
    } else {
      const newBanner: PromoBanner = {
        ...promoBannerForm,
        id: `banner-${Date.now()}`,
      };
      newBanners = [...promoBanners, newBanner];
    }

    try {
      await updateHomeSettings({ promoBanners: newBanners });
      setPromoBanners(newBanners);
      toast.success(editingPromoBanner ? 'Banner actualizado' : 'Banner creado');
      setIsPromoBannerModalOpen(false);
    } catch (error) {
      console.error('Error guardando banner:', error);
      toast.error('Error al guardar el banner');
    }
  });

  const handleDeletePromoBanner = async (id: string) => {
    if (await confirm({ title: '¿Eliminar este banner promocional?', message: 'Se quita de la portada.', tone: 'danger' })) {
      const newBanners = promoBanners.filter(b => b.id !== id);
      try {
        await updateHomeSettings({ promoBanners: newBanners });
        setPromoBanners(newBanners);
        toast.success('Banner eliminado');
      } catch (error) {
        toast.error('Error al eliminar el banner');
      }
    }
  };

  const handleTogglePromoBanner = async (id: string) => {
    const newBanners = promoBanners.map(b =>
      b.id === id ? { ...b, isActive: !b.isActive } : b
    );
    try {
      await updateHomeSettings({ promoBanners: newBanners });
      setPromoBanners(newBanners);
    } catch (error) {
      toast.error('Error al cambiar estado del banner');
    }
  };

  // Drag and drop handlers para contenido del home
  const handleDragStart = (type: 'section' | 'banner', id: string) => {
    setDraggedItem({ type, id });
  };

  const handleDragOver = (e: React.DragEvent, type: 'section' | 'banner', id: string) => {
    e.preventDefault();
    if (draggedItem && (draggedItem.type !== type || draggedItem.id !== id)) {
      setDragOverItem({ type, id });
    }
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = async (e: React.DragEvent, targetType: 'section' | 'banner', targetId: string) => {
    e.preventDefault();
    if (!draggedItem) return;

    // Crear lista combinada ordenada
    type ContentItem = { type: 'section' | 'banner'; id: string; order: number };
    const allItems: ContentItem[] = [
      ...settings.home.productSections.map(s => ({ type: 'section' as const, id: s.id, order: s.order })),
      ...promoBanners.map(b => ({ type: 'banner' as const, id: b.id, order: b.order })),
    ].sort((a, b) => a.order - b.order);

    // Encontrar índices
    const draggedIndex = allItems.findIndex(item => item.type === draggedItem.type && item.id === draggedItem.id);
    const targetIndex = allItems.findIndex(item => item.type === targetType && item.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    // Reordenar: mover el elemento arrastrado a la posición del target
    const [removed] = allItems.splice(draggedIndex, 1);
    allItems.splice(targetIndex, 0, removed);

    // Asignar nuevos órdenes secuenciales
    const newSections = settings.home.productSections.map(section => {
      const newIndex = allItems.findIndex(item => item.type === 'section' && item.id === section.id);
      return { ...section, order: newIndex + 1 };
    });

    const newBanners = promoBanners.map(banner => {
      const newIndex = allItems.findIndex(item => item.type === 'banner' && item.id === banner.id);
      return { ...banner, order: newIndex + 1 };
    });

    try {
      await updateHomeSettings({ productSections: newSections, promoBanners: newBanners });
      setPromoBanners(newBanners);
      toast.success('Orden actualizado');
    } catch (error) {
      toast.error('Error al reordenar');
    }

    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleSaveBlocks = () => withSaving(async () => {
    try {
      await updateHomeSettings({ blocks: blocksForm });
      toast.success('Bloques de la portada guardados');
    } catch {
      toast.error('No se pudieron guardar los bloques');
    }
  });

  const handleSaveCTA = () => withSaving(async () => {
    try {
      await updateHomeSettings({ cta: ctaForm });
      toast.success('CTA actualizado');
    } catch (error) {
      console.error('Error guardando CTA:', error);
      toast.error('Error al guardar el CTA');
    }
  });

  const handleSaveWhatsApp = () => withSaving(async () => {
    try {
      await updateWhatsAppButton(whatsappForm);
      toast.success('Botón de WhatsApp actualizado');
    } catch {
      toast.error('No se pudo guardar el botón de WhatsApp');
    }
  });

  const handleToggleCustomizer = async () => {
    try {
      await updateHomeSettings({ enableCustomizer: !settings.home.enableCustomizer });
      toast.success(settings.home.enableCustomizer ? 'Personalización deshabilitada' : 'Personalización habilitada');
    } catch (error) {
      toast.error('Error al cambiar estado de personalización');
    }
  };

  const handleToggleFeatures = async () => {
    try {
      await updateHomeSettings({ showFeatures: !settings.home.showFeatures });
      toast.success(settings.home.showFeatures ? 'Características ocultadas' : 'Características visibles');
    } catch (error) {
      toast.error('Error al cambiar visibilidad');
    }
  };

  const handleToggleCTA = async () => {
    try {
      await updateHomeSettings({ cta: { ...settings.home.cta, isActive: !settings.home.cta.isActive } });
      toast.success(settings.home.cta.isActive ? 'CTA ocultado' : 'CTA visible');
    } catch (error) {
      toast.error('Error al cambiar visibilidad del CTA');
    }
  };

  // Feature handlers
  const handleOpenFeatureModal = (feature?: FeatureCard) => {
    if (feature) {
      setEditingFeature(feature);
      setFeatureForm({
        icon: feature.icon,
        title: feature.title,
        description: feature.description,
        isActive: feature.isActive,
        order: feature.order,
      });
    } else {
      setEditingFeature(null);
      setFeatureForm({
        icon: 'sparkles',
        title: '',
        description: '',
        isActive: true,
        order: settings.home.features.length + 1,
      });
    }
    setIsFeatureModalOpen(true);
  };

  const handleSaveFeature = () => withSaving(async () => {
    try {
      if (editingFeature) {
        await updateFeature(editingFeature.id, featureForm);
        toast.success('Característica actualizada');
      } else {
        await addFeature(featureForm);
        toast.success('Característica creada');
      }
      setIsFeatureModalOpen(false);
    } catch {
      toast.error('No se pudo guardar la característica');
    }
  });

  const handleDeleteFeature = async (id: string) => {
    if (await confirm({ title: '¿Eliminar esta característica?', tone: 'danger' })) {
      try {
        await deleteFeature(id);
        toast.success('Característica eliminada');
      } catch {
        toast.error('No se pudo eliminar la característica');
      }
    }
  };

  // Section handlers
  const handleOpenSectionModal = (section?: ProductSection, insertOrder?: number) => {
    if (section) {
      setEditingSection(section);
      setSectionForm({
        title: section.title,
        subtitle: section.subtitle,
        showSubtitle: section.showSubtitle ?? true,
        filters: section.filters || {},
        maxProducts: section.maxProducts,
        showViewAll: section.showViewAll,
        viewAllLink: section.viewAllLink,
        isActive: section.isActive,
        order: section.order,
      });
    } else {
      setEditingSection(null);
      // Si se especifica insertOrder, usarlo; si no, calcular el siguiente orden
      const allItems = [
        ...settings.home.productSections.map(s => s.order),
        ...promoBanners.map(b => b.order),
      ];
      const nextOrder = insertOrder !== undefined ? insertOrder : (Math.max(0, ...allItems) + 1);
      setSectionForm({
        title: '',
        subtitle: '',
        showSubtitle: true,
        filters: {},
        maxProducts: 5,
        showViewAll: true,
        viewAllLink: '/catalog',
        isActive: true,
        order: nextOrder,
      });
    }
    setIsSectionModalOpen(true);
  };

  // Helper para actualizar filtros y regenerar viewAllLink
  const updateSectionFilter = (key: keyof SectionFilters, value: any) => {
    const newFilters = {
      ...sectionForm.filters,
      [key]: value === '' || value === false ? undefined : value,
    };

    // Construir el viewAllLink basado en los filtros actualizados
    let link = '/catalog';
    const params: string[] = [];

    if (newFilters.category) params.push(`category=${newFilters.category}`);
    if (newFilters.type) params.push(`type=${newFilters.type}`);
    if (newFilters.featured) params.push('featured=true');
    if (newFilters.bestsellers) params.push('bestsellers=true');
    if (newFilters.newArrivals) params.push('newArrivals=true');
    if (newFilters.inStock) params.push('inStock=true');
    if (newFilters.sortBy) params.push(`sort=${newFilters.sortBy}`);

    if (params.length > 0) link += '?' + params.join('&');

    setSectionForm({
      ...sectionForm,
      filters: newFilters,
      viewAllLink: link,
    });
  };

  // Helper para generar descripción de filtros
  const getFilterDescription = (filters: SectionFilters) => {
    const parts: string[] = [];
    if (filters.featured) parts.push('Destacados');
    if (filters.bestsellers) parts.push('Más vendidos');
    if (filters.newArrivals) parts.push('Nuevos');
    if (filters.category) {
      const cat = dbCategories.find(c => c.slug === filters.category);
      parts.push(cat?.name || filters.category);
    }
    if (filters.type) {
      const type = dbTypes.find(t => t.slug === filters.type);
      parts.push(type?.name || filters.type);
    }
    if (filters.sortBy) {
      const sortLabels: Record<string, string> = {
        price: 'Por precio',
        newest: 'Más recientes',
        rating: 'Mejor valorados',
        reviewsCount: 'Más reseñas',
      };
      parts.push(sortLabels[filters.sortBy] || filters.sortBy);
    }
    if (filters.inStock) parts.push('En stock');
    return parts.length > 0 ? parts.join(' • ') : 'Sin filtros';
  };

  const handleSaveSection = () => withSaving(async () => {
    try {
      if (editingSection) {
        await updateProductSection(editingSection.id, sectionForm);
        toast.success('Sección actualizada');
      } else {
        await addProductSection(sectionForm);
        toast.success('Sección creada');
      }
      setIsSectionModalOpen(false);
    } catch {
      toast.error('No se pudo guardar la sección');
    }
  });

  const handleDeleteSection = async (id: string) => {
    if (await confirm({ title: '¿Eliminar esta sección?', tone: 'danger' })) {
      try {
        await deleteProductSection(id);
        toast.success('Sección eliminada');
      } catch {
        toast.error('No se pudo eliminar la sección');
      }
    }
  };

  const mainCard = heroCards.find(c => c.position === 'main');
  const sideCards = heroCards.filter(c => c.position === 'side').sort((a, b) => a.order - b.order);
  const activeSide = sideCards.filter(c => c.isActive);

  type ContentItem =
    | { type: 'section'; data: typeof settings.home.productSections[0] }
    | { type: 'banner'; data: PromoBanner };
  const contentItems: ContentItem[] = [
    ...settings.home.productSections.map(s => ({ type: 'section' as const, data: s })),
    ...promoBanners.map(b => ({ type: 'banner' as const, data: b })),
  ].sort((a, b) => a.data.order - b.data.order);

  const openNewMainCard = () => {
    setEditingHeroCard(null);
    setHeroCardForm({
      position: 'main',
      order: 0,
      title: 'Diseñado por ti,',
      titleLine2: 'hecho por Vexa',
      subtitle: 'Personaliza camisetas, hoodies y más con tus propios diseños.',
      showSubtitle: true,
      showBadge: false,
      badge: '',
      buttons: [
        { id: 'btn-1', text: 'Crear diseño', link: '/customizer', style: 'primary', icon: 'palette', isActive: true },
        { id: 'btn-2', text: 'Ver catálogo', link: '/catalog', style: 'secondary', icon: 'shoppingBag', isActive: true },
      ],
      background: { type: 'gradient', overlayOpacity: 0 },
      isActive: true,
    });
    setIsHeroCardModalOpen(true);
  };

  const iconPicker = (value: string | undefined, onPick: (id: FeatureCard['icon']) => void) => (
    <div className="grid grid-cols-6 gap-2">
      {FEATURE_ICONS.map((iconOption) => {
        const IconComp = iconComponents[iconOption.id as FeatureCard['icon']];
        return (
          <ChoiceButton key={iconOption.id} active={value === iconOption.id} onClick={() => onPick(iconOption.id as FeatureCard['icon'])} title={iconOption.label}>
            <IconComp className="w-5 h-5" />
          </ChoiceButton>
        );
      })}
    </div>
  );

  const dialogFooter = (onCancel: () => void, onSave: () => void, isEdit: boolean) => (
    <>
      <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancelar</Button>
      <Button onClick={onSave} isLoading={saving} icon={<Save className="w-4 h-4" />}>{isEdit ? 'Guardar' : 'Crear'}</Button>
    </>
  );

  return (
    <Page>
      <PageHeader icon={Home} title="Página de inicio" subtitle="Contenido de la portada de la tienda: hero, características, secciones de productos y banners" />

      <Card>
        <Switch
          checked={!!settings.home.enableCustomizer}
          onChange={handleToggleCustomizer}
          label="Módulo de personalización"
          description={settings.home.enableCustomizer
            ? 'Los clientes pueden personalizar productos con sus diseños.'
            : 'Solo tienda tradicional, sin opción de personalización.'}
        />
        {!settings.home.enableCustomizer && (
          <div className="mt-3">
            <Alert tone="warning">El botón "Personalizar" se oculta del menú y el acceso a /customize queda deshabilitado.</Alert>
          </div>
        )}
      </Card>

      <Tabs<HomeTab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'hero', label: 'Hero', count: heroCards.length },
          { value: 'features', label: 'Características', count: settings.home.features.length },
          { value: 'blocks', label: 'Bloques' },
          { value: 'content', label: 'Secciones y banners', count: contentItems.length },
          { value: 'cta', label: 'Llamado a la acción' },
          { value: 'whatsapp', label: 'WhatsApp' },
        ]}
      />

      {/* ───────── Hero ───────── */}
      {tab === 'hero' && (
        <Card>
          <CardTitle
            icon={Layers}
            actions={sideCards.length < 3 && (
              <Button size="sm" variant="secondary" icon={<Plus className="w-4 h-4" />} onClick={() => handleOpenHeroCardModal()}>Carta lateral</Button>
            )}
          >
            Cartas del hero
          </CardTitle>

          {/* Estructura */}
          <div className="mb-4 rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500 mb-2">Estructura en la tienda</p>
            <div className="flex gap-2 h-20">
              <div className={`flex-[2] rounded-md flex items-center justify-center text-xs font-medium ${mainCard?.isActive ? 'bg-app-600 text-white' : 'border border-dashed border-gray-300 text-gray-400'}`}>
                Principal
              </div>
              <div className="flex-1 flex flex-col gap-1">
                {activeSide.slice(0, 3).map((_, i) => (
                  <div key={i} className="flex-1 rounded-md bg-app-100 text-app-700 flex items-center justify-center text-[10px] font-medium">Lateral {i + 1}</div>
                ))}
                {activeSide.length === 0 && (
                  <div className="flex-1 rounded-md border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-[10px]">Sin laterales</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {mainCard ? (
              <ItemRow
                inactive={!mainCard.isActive}
                icon={<span className="w-10 h-10 rounded-lg bg-app-600 text-white flex items-center justify-center flex-shrink-0"><Layers className="w-5 h-5" /></span>}
                tag={<Badge tone="app">Principal</Badge>}
                title={mainCard.title || 'Sin título'}
                meta={`${mainCard.subtitle || 'Sin subtítulo'} · Fondo: ${BG_LABELS[mainCard.background.type] ?? mainCard.background.type} · ${mainCard.buttons.filter(b => b.isActive).length} botones`}
                actions={
                  <>
                    <Switch checked={mainCard.isActive} onChange={() => handleToggleHeroCard(mainCard.id)} />
                    <IconButton title="Editar" tone="app" onClick={() => handleOpenHeroCardModal(mainCard)}><Pencil className="w-4 h-4" /></IconButton>
                  </>
                }
              />
            ) : (
              <button type="button" onClick={openNewMainCard} className="w-full rounded-lg border-2 border-dashed border-gray-300 p-4 text-sm font-medium text-app-700 hover:border-app-400 hover:bg-app-50 flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Crear carta principal
              </button>
            )}

            {sideCards.map((card, index) => {
              const BgIcon = BG_ICONS[card.background.type] ?? Palette;
              return (
                <ItemRow
                  key={card.id}
                  inactive={!card.isActive}
                  icon={<span className="w-10 h-10 rounded-lg bg-app-50 text-app-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">{index + 1}</span>}
                  tag={<Badge>Lateral</Badge>}
                  title={card.title || 'Sin título'}
                  meta={
                    <span className="inline-flex items-center gap-1">
                      <BgIcon className="w-3 h-3" />{BG_LABELS[card.background.type] ?? card.background.type}
                      {card.buttons.length > 0 && <> · Enlace: {card.buttons[0]?.link}</>}
                    </span>
                  }
                  actions={
                    <>
                      <Switch checked={card.isActive} onChange={() => handleToggleHeroCard(card.id)} />
                      <IconButton title="Editar" tone="app" onClick={() => handleOpenHeroCardModal(card)}><Pencil className="w-4 h-4" /></IconButton>
                      <IconButton title="Eliminar" tone="danger" onClick={() => handleDeleteHeroCard(card.id)}><Trash2 className="w-4 h-4" /></IconButton>
                    </>
                  }
                />
              );
            })}

            {sideCards.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-300 py-5 text-center text-sm text-gray-500">
                No hay cartas laterales. Puedes agregar hasta 3.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* ───────── Características ───────── */}
      {tab === 'features' && (
        <Card>
          <CardTitle
            icon={LayoutGrid}
            actions={<Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => handleOpenFeatureModal()}>Nueva característica</Button>}
          >
            Tarjetas de características
          </CardTitle>
          <div className="mb-4">
            <Switch
              checked={!!settings.home.showFeatures}
              onChange={handleToggleFeatures}
              label="Mostrar en la portada"
              description="Bloque de ventajas de la tienda (calidad, envíos, garantía…)."
            />
          </div>
          {settings.home.features.length === 0 ? (
            <EmptyState icon={LayoutGrid} title="No hay características" description="Agrega la primera para mostrar las ventajas de tu tienda." />
          ) : (
            <div className="space-y-2">
              {settings.home.features
                .sort((a, b) => a.order - b.order)
                .map((feature) => {
                  const IconComponent = iconComponents[feature.icon] ?? Sparkles;
                  return (
                    <ItemRow
                      key={feature.id}
                      inactive={!feature.isActive}
                      icon={<span className="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0"><IconComponent className="w-5 h-5" /></span>}
                      title={feature.title}
                      meta={feature.description}
                      actions={
                        <>
                          <IconButton title="Editar" tone="app" onClick={() => handleOpenFeatureModal(feature)}><Pencil className="w-4 h-4" /></IconButton>
                          <IconButton title="Eliminar" tone="danger" onClick={() => handleDeleteFeature(feature.id)}><Trash2 className="w-4 h-4" /></IconButton>
                        </>
                      }
                    />
                  );
                })}
            </div>
          )}
        </Card>
      )}

      {/* ───────── Secciones y banners ───────── */}
      {tab === 'content' && (
        <Card>
          <CardTitle
            icon={ShoppingBag}
            actions={
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" icon={<Megaphone className="w-4 h-4" />} onClick={() => handleOpenPromoBannerModal()}>Banner</Button>
                <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => handleOpenSectionModal()}>Sección</Button>
              </div>
            }
          >
            Contenido de la portada
          </CardTitle>
          <p className="text-sm text-gray-500 -mt-2 mb-4">Arrastra para cambiar el orden en que aparecen las secciones de productos y los banners.</p>

          {contentItems.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No hay contenido" description="Agrega secciones de productos o banners promocionales." />
          ) : (
            <div className="space-y-2">
              {contentItems.map((item) => {
                const isSection = item.type === 'section';
                const id = item.data.id;
                const isDragging = draggedItem?.type === item.type && draggedItem?.id === id;
                const isDragOver = dragOverItem?.type === item.type && dragOverItem?.id === id;
                const dragProps = {
                  draggable: true,
                  onDragStart: () => handleDragStart(item.type, id),
                  onDragOver: (e: React.DragEvent) => handleDragOver(e, item.type, id),
                  onDragLeave: handleDragLeave,
                  onDrop: (e: React.DragEvent) => handleDrop(e, item.type, id),
                  onDragEnd: handleDragEnd,
                };
                const stateCls = `${isDragging ? 'opacity-50' : ''} ${isDragOver ? '!border-app-500 ring-1 ring-app-500' : ''}`;
                const grip = <GripVertical className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0" />;

                if (isSection) {
                  const section = item.data;
                  return (
                    <ItemRow
                      key={`section-${section.id}`}
                      {...dragProps}
                      className={stateCls}
                      inactive={!section.isActive}
                      icon={<>{grip}<span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0"><ShoppingBag className="w-4 h-4" /></span></>}
                      tag={<><Badge tone="blue">Sección</Badge><Badge>#{section.order}</Badge></>}
                      title={section.title}
                      meta={<>{section.subtitle ? `${section.subtitle} · ` : ''}<span className="text-gray-700">{getFilterDescription(section.filters || {})}</span> · Máx. {section.maxProducts} productos</>}
                      actions={
                        <>
                          <IconButton title="Editar" tone="app" onClick={() => handleOpenSectionModal(section)}><Pencil className="w-4 h-4" /></IconButton>
                          <IconButton title="Eliminar" tone="danger" onClick={() => handleDeleteSection(section.id)}><Trash2 className="w-4 h-4" /></IconButton>
                        </>
                      }
                    />
                  );
                }
                const banner = item.data;
                return (
                  <ItemRow
                    key={`banner-${banner.id}`}
                    {...dragProps}
                    className={stateCls}
                    inactive={!banner.isActive}
                    icon={<>{grip}<span className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0"><Megaphone className="w-4 h-4" /></span></>}
                    tag={<><Badge tone="yellow">Banner</Badge><Badge>#{banner.order}</Badge><Badge>{banner.height === 'small' ? 'Pequeño' : banner.height === 'medium' ? 'Mediano' : 'Grande'}</Badge></>}
                    title={banner.title}
                    meta={[banner.subtitle, banner.buttonText && `Botón: ${banner.buttonText} → ${banner.buttonLink}`].filter(Boolean).join(' · ') || undefined}
                    actions={
                      <>
                        <Switch checked={banner.isActive} onChange={() => handleTogglePromoBanner(banner.id)} />
                        <IconButton title="Editar" tone="app" onClick={() => handleOpenPromoBannerModal(banner)}><Pencil className="w-4 h-4" /></IconButton>
                        <IconButton title="Eliminar" tone="danger" onClick={() => handleDeletePromoBanner(banner.id)}><Trash2 className="w-4 h-4" /></IconButton>
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ───────── CTA ───────── */}
      {tab === 'cta' && (
        <>
          <div>
            <SettingsSection title="Visibilidad" description="El bloque final de la portada que invita a comprar o personalizar.">
              <Switch
                checked={!!settings.home.cta.isActive}
                onChange={handleToggleCTA}
                label="Mostrar llamado a la acción"
                description="Se guarda al instante."
              />
            </SettingsSection>
            <SettingsSection title="Contenido" description="Etiqueta, título y subtítulo del bloque.">
              <Field label="Etiqueta (badge)">
                <TextInput value={ctaForm.badge} onChange={(e) => setCtaForm({ ...ctaForm, badge: e.target.value })} placeholder="Ej: Crea sin límites" disabled={!(ctaForm.showBadge ?? true)} />
              </Field>
              <Checkbox label="Mostrar la etiqueta" checked={ctaForm.showBadge ?? true} onChange={(e) => setCtaForm({ ...ctaForm, showBadge: e.target.checked })} />
              <FormGrid>
                <Field label="Título">
                  <TextInput value={ctaForm.title} onChange={(e) => setCtaForm({ ...ctaForm, title: e.target.value })} placeholder="Ej: ¿Listo para crear algo único?" />
                </Field>
                <Field label="Subtítulo">
                  <TextInput value={ctaForm.subtitle} onChange={(e) => setCtaForm({ ...ctaForm, subtitle: e.target.value })} placeholder="Descripción del CTA" />
                </Field>
              </FormGrid>
            </SettingsSection>
            <SettingsSection title="Botón" description="A dónde lleva al cliente.">
              <Switch checked={ctaForm.showButton ?? true} onChange={(v) => setCtaForm({ ...ctaForm, showButton: v })} label="Mostrar botón" />
              <FormGrid>
                <Field label="Texto del botón">
                  <TextInput value={ctaForm.buttonText} onChange={(e) => setCtaForm({ ...ctaForm, buttonText: e.target.value })} placeholder="Ej: Personalizar ahora" disabled={!(ctaForm.showButton ?? true)} />
                </Field>
                <Field label="Enlace del botón">
                  <TextInput value={ctaForm.buttonLink} onChange={(e) => setCtaForm({ ...ctaForm, buttonLink: e.target.value })} placeholder="/customize" disabled={!(ctaForm.showButton ?? true)} />
                </Field>
              </FormGrid>
            </SettingsSection>
          </div>
          <FormActions sticky>
            <Button onClick={handleSaveCTA} isLoading={saving} icon={<Save className="w-4 h-4" />}>Guardar llamado a la acción</Button>
          </FormActions>
        </>
      )}

      {/* ───────── Bloques fijos de la portada ───────── */}
      {tab === 'blocks' && (
        <>
          <div>
            {BLOCK_INFO.map((b) => (
              <SettingsSection key={b.key} title={b.label} description={b.description}>
                <Switch
                  checked={blocksForm[b.key].isActive}
                  onChange={(v) => setBlock(b.key, { isActive: v })}
                  label="Mostrar en la portada"
                />
                <FormGrid>
                  <Field label="Título" hint={`Vacío = "${DEFAULT_HOME_BLOCKS[b.key].title}".`}>
                    <TextInput
                      value={blocksForm[b.key].title}
                      onChange={(e) => setBlock(b.key, { title: e.target.value })}
                      placeholder={DEFAULT_HOME_BLOCKS[b.key].title}
                      disabled={!blocksForm[b.key].isActive}
                    />
                  </Field>
                  <Field label="Subtítulo">
                    <TextInput
                      value={blocksForm[b.key].subtitle}
                      onChange={(e) => setBlock(b.key, { subtitle: e.target.value })}
                      placeholder="Opcional"
                      disabled={!blocksForm[b.key].isActive}
                    />
                  </Field>
                </FormGrid>
                {b.key === 'howItWorks' && !settings.home.enableCustomizer && (
                  <Alert tone="warning">El módulo de personalización está apagado: este bloque no se mostrará.</Alert>
                )}
              </SettingsSection>
            ))}
          </div>
          <FormActions sticky>
            <Button onClick={handleSaveBlocks} isLoading={saving} icon={<Save className="w-4 h-4" />}>Guardar bloques</Button>
          </FormActions>
        </>
      )}

      {/* ───────── WhatsApp ───────── */}
      {tab === 'whatsapp' && (
        <>
          <div>
            <SettingsSection title="Botón flotante" description="Botón de contacto por WhatsApp que aparece en todas las páginas de la tienda.">
              <Switch checked={whatsappForm.isActive} onChange={(v) => setWhatsappForm({ ...whatsappForm, isActive: v })} label="Mostrar botón de WhatsApp" />
              <FormGrid>
                <Field label="Número de WhatsApp" required hint="Sin + ni espacios (ej: 573001234567).">
                  <TextInput value={whatsappForm.phoneNumber} onChange={(e) => setWhatsappForm({ ...whatsappForm, phoneNumber: e.target.value })} placeholder="573001234567" />
                </Field>
                <Field label="Color del botón">
                  <ColorInput value={whatsappForm.buttonColor} onChange={(v) => setWhatsappForm({ ...whatsappForm, buttonColor: v })} />
                </Field>
                <Field label="Mensaje predeterminado" className="md:col-span-2">
                  <TextArea rows={2} value={whatsappForm.defaultMessage} onChange={(e) => setWhatsappForm({ ...whatsappForm, defaultMessage: e.target.value })} placeholder="¡Hola! Me interesa obtener más información..." />
                </Field>
                <Field label="Posición">
                  <SelectInput value={whatsappForm.position} onChange={(e) => setWhatsappForm({ ...whatsappForm, position: e.target.value as 'bottom-right' | 'bottom-left' })}>
                    <option value="bottom-right">Abajo a la derecha</option>
                    <option value="bottom-left">Abajo a la izquierda</option>
                  </SelectInput>
                </Field>
                <Field label="Texto del tooltip">
                  <TextInput value={whatsappForm.tooltipText} onChange={(e) => setWhatsappForm({ ...whatsappForm, tooltipText: e.target.value })} placeholder="¿Necesitas ayuda?" disabled={!whatsappForm.showTooltip} />
                </Field>
              </FormGrid>
            </SettingsSection>
            <SettingsSection title="Comportamiento" description="Dónde y cómo se muestra el botón.">
              <Switch checked={whatsappForm.showOnMobile} onChange={(v) => setWhatsappForm({ ...whatsappForm, showOnMobile: v })} label="Mostrar en celular" />
              <Switch checked={whatsappForm.showOnDesktop} onChange={(v) => setWhatsappForm({ ...whatsappForm, showOnDesktop: v })} label="Mostrar en computador" />
              <Switch checked={whatsappForm.pulseAnimation} onChange={(v) => setWhatsappForm({ ...whatsappForm, pulseAnimation: v })} label="Animación de pulso" />
              <Switch checked={whatsappForm.showTooltip} onChange={(v) => setWhatsappForm({ ...whatsappForm, showTooltip: v })} label="Mostrar tooltip" />
            </SettingsSection>
          </div>
          <FormActions sticky>
            <Button onClick={handleSaveWhatsApp} isLoading={saving} icon={<Save className="w-4 h-4" />}>Guardar WhatsApp</Button>
          </FormActions>
        </>
      )}

      {/* ───────── Característica ───────── */}
      <Dialog
        open={isFeatureModalOpen}
        onClose={() => setIsFeatureModalOpen(false)}
        title={editingFeature ? 'Editar característica' : 'Nueva característica'}
        footer={dialogFooter(() => setIsFeatureModalOpen(false), handleSaveFeature, !!editingFeature)}
      >
        <div className="space-y-4">
          <Field label="Icono">{iconPicker(featureForm.icon, (icon) => setFeatureForm({ ...featureForm, icon }))}</Field>
          <Field label="Título" required>
            <TextInput value={featureForm.title} onChange={(e) => setFeatureForm({ ...featureForm, title: e.target.value })} placeholder="Ej: Alta calidad" />
          </Field>
          <Field label="Descripción" required>
            <TextArea rows={2} value={featureForm.description} onChange={(e) => setFeatureForm({ ...featureForm, description: e.target.value })} placeholder="Descripción de la característica" />
          </Field>
          <FormGrid>
            <Field label="Orden">
              <NumberInput min="1" value={featureForm.order} onChange={(e) => setFeatureForm({ ...featureForm, order: parseInt(e.target.value) || 1 })} />
            </Field>
            <div className="md:pt-7"><Switch checked={featureForm.isActive} onChange={(v) => setFeatureForm({ ...featureForm, isActive: v })} label="Activa" /></div>
          </FormGrid>
        </div>
      </Dialog>

      {/* ───────── Sección de productos ───────── */}
      <Dialog
        open={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        title={editingSection ? 'Editar sección' : 'Nueva sección de productos'}
        size="lg"
        footer={dialogFooter(() => setIsSectionModalOpen(false), handleSaveSection, !!editingSection)}
      >
        <div className="space-y-4">
          <FormGrid>
            <Field label="Título" required>
              <TextInput value={sectionForm.title} onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })} placeholder="Ej: Productos destacados" />
            </Field>
            <Field label="Subtítulo">
              <TextInput value={sectionForm.subtitle || ''} onChange={(e) => setSectionForm({ ...sectionForm, subtitle: e.target.value })} placeholder="Descripción opcional" />
            </Field>
          </FormGrid>
          <Checkbox label="Mostrar subtítulo" checked={sectionForm.showSubtitle ?? true} onChange={(e) => setSectionForm({ ...sectionForm, showSubtitle: e.target.checked })} />

          <Field label="Filtros de productos">
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Checkbox label="Destacados" checked={sectionForm.filters?.featured || false} onChange={(e) => updateSectionFilter('featured', e.target.checked)} />
              <Checkbox label="Más vendidos" checked={sectionForm.filters?.bestsellers || false} onChange={(e) => updateSectionFilter('bestsellers', e.target.checked)} />
              <Checkbox label="Nuevos" checked={sectionForm.filters?.newArrivals || false} onChange={(e) => updateSectionFilter('newArrivals', e.target.checked)} />
              <Checkbox label="En stock" checked={sectionForm.filters?.inStock || false} onChange={(e) => updateSectionFilter('inStock', e.target.checked)} />
            </div>
          </Field>

          <FormGrid cols={3}>
            <Field label="Categoría">
              <SelectInput
                value={sectionForm.filters?.category || ''}
                onChange={(e) => {
                  const categorySlug = e.target.value;
                  // Construir el viewAllLink basado en los filtros
                  let link = '/catalog';
                  const params: string[] = [];
                  if (categorySlug) params.push(`category=${categorySlug}`);
                  if (sectionForm.filters?.featured) params.push('featured=true');
                  if (sectionForm.filters?.bestsellers) params.push('bestsellers=true');
                  if (sectionForm.filters?.newArrivals) params.push('newArrivals=true');
                  if (sectionForm.filters?.inStock) params.push('inStock=true');
                  if (sectionForm.filters?.sortBy) params.push(`sort=${sectionForm.filters.sortBy}`);
                  if (params.length > 0) link += '?' + params.join('&');
                  // Al cambiar categoría, limpiar el tipo de producto y actualizar link
                  setSectionForm({
                    ...sectionForm,
                    filters: { ...sectionForm.filters, category: categorySlug || undefined, type: undefined },
                    viewAllLink: link,
                  });
                }}
              >
                <option value="">Todas las categorías</option>
                {dbCategories.map((cat) => <option key={cat.id} value={cat.slug}>{cat.name}</option>)}
              </SelectInput>
            </Field>
            <Field label="Tipo de producto" hint={!sectionForm.filters?.category ? 'Elige una categoría primero.' : undefined}>
              <SelectInput
                value={sectionForm.filters?.type || ''}
                disabled={!sectionForm.filters?.category}
                onChange={(e) => {
                  const typeSlug = e.target.value;
                  let link = '/catalog';
                  const params: string[] = [];
                  if (sectionForm.filters?.category) params.push(`category=${sectionForm.filters.category}`);
                  if (typeSlug) params.push(`type=${typeSlug}`);
                  if (sectionForm.filters?.featured) params.push('featured=true');
                  if (sectionForm.filters?.bestsellers) params.push('bestsellers=true');
                  if (sectionForm.filters?.newArrivals) params.push('newArrivals=true');
                  if (sectionForm.filters?.inStock) params.push('inStock=true');
                  if (sectionForm.filters?.sortBy) params.push(`sort=${sectionForm.filters.sortBy}`);
                  if (params.length > 0) link += '?' + params.join('&');
                  setSectionForm({ ...sectionForm, filters: { ...sectionForm.filters, type: typeSlug || undefined }, viewAllLink: link });
                }}
              >
                <option value="">{sectionForm.filters?.category ? 'Todos los tipos' : 'Sin categoría'}</option>
                {sectionForm.filters?.category &&
                  dbTypes.filter(t => t.categorySlug === sectionForm.filters?.category).map((type) => <option key={type.id} value={type.slug}>{type.name}</option>)}
              </SelectInput>
            </Field>
            <Field label="Ordenar por">
              <SelectInput value={sectionForm.filters?.sortBy || ''} onChange={(e) => updateSectionFilter('sortBy', e.target.value)}>
                <option value="">Por defecto</option>
                <option value="price">Por precio</option>
                <option value="newest">Más recientes</option>
                <option value="rating">Mejor valorados</option>
                <option value="reviewsCount">Más reseñas</option>
              </SelectInput>
            </Field>
          </FormGrid>

          <FormGrid>
            <Field label="Máximo de productos">
              <NumberInput min="1" max="20" value={sectionForm.maxProducts} onChange={(e) => setSectionForm({ ...sectionForm, maxProducts: parseInt(e.target.value) || 5 })} />
            </Field>
            <Field label="Orden">
              <NumberInput min="1" value={sectionForm.order} onChange={(e) => setSectionForm({ ...sectionForm, order: parseInt(e.target.value) || 1 })} />
            </Field>
          </FormGrid>

          <Switch checked={sectionForm.showViewAll} onChange={(v) => setSectionForm({ ...sectionForm, showViewAll: v })} label='Mostrar "Ver todo"' />
          {sectionForm.showViewAll && (
            <Field label='Enlace de "Ver todo"' hint="Se arma solo con los filtros; puedes cambiarlo.">
              <TextInput value={sectionForm.viewAllLink || ''} onChange={(e) => setSectionForm({ ...sectionForm, viewAllLink: e.target.value })} placeholder="/catalog" />
            </Field>
          )}
          <Switch checked={sectionForm.isActive} onChange={(v) => setSectionForm({ ...sectionForm, isActive: v })} label="Sección activa" />
        </div>
      </Dialog>

      {/* ───────── Carta del hero ───────── */}
      <Dialog
        open={isHeroCardModalOpen}
        onClose={() => setIsHeroCardModalOpen(false)}
        title={editingHeroCard ? 'Editar carta' : 'Nueva carta'}
        size="lg"
        footer={dialogFooter(() => setIsHeroCardModalOpen(false), handleSaveHeroCard, !!editingHeroCard)}
      >
        <div className="space-y-5">
          {!editingHeroCard && (
            <Field label="Tipo de carta">
              <RadioGroup
                variant="cards"
                value={heroCardForm.position}
                onChange={(position) => setHeroCardForm({ ...heroCardForm, position })}
                options={[
                  { value: 'main', label: 'Principal', description: 'La carta grande del hero, con botones.' },
                  { value: 'side', label: 'Lateral', description: 'Cartas pequeñas a la derecha (máx. 3).' },
                ]}
              />
            </Field>
          )}

          <div className="space-y-3">
            <Field label="Título" required>
              <TextInput value={heroCardForm.title} onChange={(e) => setHeroCardForm({ ...heroCardForm, title: e.target.value })} placeholder={heroCardForm.position === 'main' ? 'Ej: Diseñado por ti,' : 'Ej: Personaliza'} />
            </Field>
            {heroCardForm.position === 'main' && (
              <Field label="Segunda línea del título">
                <TextInput value={heroCardForm.titleLine2 || ''} onChange={(e) => setHeroCardForm({ ...heroCardForm, titleLine2: e.target.value })} placeholder="Ej: hecho por Vexa" />
              </Field>
            )}
            <Field label="Subtítulo">
              <TextInput value={heroCardForm.subtitle || ''} onChange={(e) => setHeroCardForm({ ...heroCardForm, subtitle: e.target.value })} placeholder={heroCardForm.position === 'main' ? 'Descripción del hero' : 'Ej: Tu creatividad'} />
            </Field>
            <Checkbox label="Mostrar subtítulo" checked={heroCardForm.showSubtitle} onChange={(e) => setHeroCardForm({ ...heroCardForm, showSubtitle: e.target.checked })} />
          </div>

          <div className="space-y-3 border-t border-gray-100 pt-4">
            <Field label="Fondo">
              <div className="grid grid-cols-4 gap-2">
                {(['gradient', 'image', 'video', 'carousel'] as const).map((type) => {
                  const Icon = BG_ICONS[type];
                  return (
                    <ChoiceButton key={type} active={heroCardForm.background.type === type} onClick={() => setHeroCardForm({ ...heroCardForm, background: { ...heroCardForm.background, type: type as any } })}>
                      <Icon className="w-5 h-5" />{BG_LABELS[type]}
                    </ChoiceButton>
                  );
                })}
              </div>
            </Field>

            {heroCardForm.background.type === 'image' && (
              <ImageUploadField
                label="Imagen de fondo"
                value={heroCardForm.background.imageUrl || ''}
                onChange={(newUrl) => setHeroCardForm({ ...heroCardForm, background: { ...heroCardForm.background, imageUrl: newUrl } })}
                placeholder="https://imagen.jpg"
              />
            )}

            {heroCardForm.background.type === 'video' && (
              <FormGrid>
                <Field label="URL del video">
                  <TextInput value={heroCardForm.background.videoUrl || ''} onChange={(e) => setHeroCardForm({ ...heroCardForm, background: { ...heroCardForm.background, videoUrl: e.target.value } })} placeholder="https://...mp4" />
                </Field>
                <Field label="Imagen de póster (opcional)">
                  <TextInput value={heroCardForm.background.videoPoster || ''} onChange={(e) => setHeroCardForm({ ...heroCardForm, background: { ...heroCardForm.background, videoPoster: e.target.value } })} placeholder="https://..." />
                </Field>
              </FormGrid>
            )}

            {heroCardForm.background.type === 'carousel' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Imágenes del carrusel</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={() => setHeroCardForm({ ...heroCardForm, background: { ...heroCardForm.background, carouselImages: [...(heroCardForm.background.carouselImages || []), ''] } })}
                  >
                    Agregar imagen
                  </Button>
                </div>
                {(heroCardForm.background.carouselImages || []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-3">No hay imágenes. Agrega al menos una.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(heroCardForm.background.carouselImages || []).map((url, idx) => (
                      <div key={idx} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-600">Imagen {idx + 1}</span>
                          <IconButton
                            title="Quitar imagen"
                            tone="danger"
                            onClick={() => {
                              const newImages = (heroCardForm.background.carouselImages || []).filter((_, i) => i !== idx);
                              setHeroCardForm({ ...heroCardForm, background: { ...heroCardForm.background, carouselImages: newImages } });
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        </div>
                        <ImageUploadField
                          label=""
                          value={url}
                          onChange={(newUrl) => {
                            const newImages = [...(heroCardForm.background.carouselImages || [])];
                            newImages[idx] = newUrl;
                            setHeroCardForm({ ...heroCardForm, background: { ...heroCardForm.background, carouselImages: newImages } });
                          }}
                          placeholder="https://imagen.jpg"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <Field label="Intervalo">
                  <NumberInput
                    min="1"
                    max="30"
                    suffix="seg"
                    value={(heroCardForm.background.carouselInterval || 5000) / 1000}
                    onChange={(e) => setHeroCardForm({ ...heroCardForm, background: { ...heroCardForm.background, carouselInterval: (parseInt(e.target.value) || 5) * 1000 } })}
                  />
                </Field>
              </div>
            )}

            <Field label={`Oscurecer fondo: ${heroCardForm.background.overlayOpacity || 0}%`}>
              <input
                type="range"
                min="0"
                max="80"
                value={heroCardForm.background.overlayOpacity || 0}
                onChange={(e) => setHeroCardForm({ ...heroCardForm, background: { ...heroCardForm.background, overlayOpacity: parseInt(e.target.value) } })}
                className="w-full accent-app-600"
              />
            </Field>
          </div>

          {heroCardForm.position === 'side' && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <Field label="Icono">{iconPicker(heroCardForm.icon, (icon) => setHeroCardForm({ ...heroCardForm, icon }))}</Field>
              <Field label="Enlace al hacer clic">
                <TextInput
                  value={heroCardForm.buttons[0]?.link || ''}
                  onChange={(e) => {
                    const newButtons = heroCardForm.buttons.length > 0
                      ? [{ ...heroCardForm.buttons[0], link: e.target.value }]
                      : [{ id: `btn-${Date.now()}`, text: 'Ver más', link: e.target.value, style: 'primary' as const, isActive: true }];
                    setHeroCardForm({ ...heroCardForm, buttons: newButtons });
                  }}
                  placeholder="/catalog"
                />
              </Field>
            </div>
          )}

          {heroCardForm.position === 'main' && (
            <div className="space-y-2 border-t border-gray-100 pt-4">
              <span className="block text-sm font-medium text-gray-700">Botones</span>
              {heroCardForm.buttons.map((btn, idx) => (
                <div key={btn.id} className="flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_1fr_9rem] gap-2">
                    <TextInput
                      aria-label="Texto del botón"
                      value={btn.text}
                      onChange={(e) => {
                        const newButtons = [...heroCardForm.buttons];
                        newButtons[idx] = { ...btn, text: e.target.value };
                        setHeroCardForm({ ...heroCardForm, buttons: newButtons });
                      }}
                      placeholder="Texto"
                    />
                    <TextInput
                      aria-label="Enlace del botón"
                      value={btn.link}
                      onChange={(e) => {
                        const newButtons = [...heroCardForm.buttons];
                        newButtons[idx] = { ...btn, link: e.target.value };
                        setHeroCardForm({ ...heroCardForm, buttons: newButtons });
                      }}
                      placeholder="/link"
                    />
                    <SelectInput
                      aria-label="Estilo del botón"
                      value={btn.style}
                      onChange={(e) => {
                        const newButtons = [...heroCardForm.buttons];
                        newButtons[idx] = { ...btn, style: e.target.value as 'primary' | 'secondary' };
                        setHeroCardForm({ ...heroCardForm, buttons: newButtons });
                      }}
                    >
                      <option value="primary">Primario</option>
                      <option value="secondary">Secundario</option>
                    </SelectInput>
                  </div>
                  <IconButton
                    title="Quitar botón"
                    tone="danger"
                    onClick={() => setHeroCardForm({ ...heroCardForm, buttons: heroCardForm.buttons.filter((_, i) => i !== idx) })}
                  >
                    <X className="w-4 h-4" />
                  </IconButton>
                </div>
              ))}
              {heroCardForm.buttons.length < 2 && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => {
                    const newButton = { id: `btn-${Date.now()}`, text: '', link: '', style: 'secondary' as const, isActive: true };
                    setHeroCardForm({ ...heroCardForm, buttons: [...heroCardForm.buttons, newButton] });
                  }}
                >
                  Agregar botón
                </Button>
              )}
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <Switch checked={heroCardForm.isActive} onChange={(v) => setHeroCardForm({ ...heroCardForm, isActive: v })} label="Carta activa" />
          </div>
        </div>
      </Dialog>

      {/* ───────── Banner promocional ───────── */}
      <Dialog
        open={isPromoBannerModalOpen}
        onClose={() => setIsPromoBannerModalOpen(false)}
        title={editingPromoBanner ? 'Editar banner' : 'Nuevo banner promocional'}
        size="lg"
        footer={dialogFooter(() => setIsPromoBannerModalOpen(false), handleSavePromoBanner, !!editingPromoBanner)}
      >
        <div className="space-y-4">
          <FormGrid>
            <Field label="Título" required>
              <TextInput value={promoBannerForm.title} onChange={(e) => setPromoBannerForm({ ...promoBannerForm, title: e.target.value })} placeholder="Ej: ¡Descuento del 20%!" />
            </Field>
            <Field label="Subtítulo">
              <TextInput value={promoBannerForm.subtitle || ''} onChange={(e) => setPromoBannerForm({ ...promoBannerForm, subtitle: e.target.value })} placeholder="Ej: Solo por tiempo limitado" />
            </Field>
            <Field label="Texto del botón">
              <TextInput value={promoBannerForm.buttonText || ''} onChange={(e) => setPromoBannerForm({ ...promoBannerForm, buttonText: e.target.value })} placeholder="Ej: Ver ofertas" />
            </Field>
            <Field label="Enlace del botón">
              <TextInput value={promoBannerForm.buttonLink || ''} onChange={(e) => setPromoBannerForm({ ...promoBannerForm, buttonLink: e.target.value })} placeholder="/catalog?discount=true" />
            </Field>
            <Field label="Orden" hint="Posición en la portada.">
              <NumberInput min="1" value={promoBannerForm.order} onChange={(e) => setPromoBannerForm({ ...promoBannerForm, order: parseInt(e.target.value) || 1 })} />
            </Field>
            <Field label="Altura">
              <RadioGroup
                variant="segmented"
                value={promoBannerForm.height}
                onChange={(height) => setPromoBannerForm({ ...promoBannerForm, height })}
                options={[{ value: 'small', label: 'Pequeño' }, { value: 'medium', label: 'Mediano' }, { value: 'large', label: 'Grande' }]}
              />
            </Field>
          </FormGrid>

          <Field label="Alineación del contenido">
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'left', Icon: AlignLeft, label: 'Izquierda' },
                { id: 'center', Icon: AlignCenter, label: 'Centro' },
                { id: 'right', Icon: AlignRight, label: 'Derecha' },
              ] as const).map(({ id, Icon, label }) => (
                <ChoiceButton key={id} active={promoBannerForm.contentAlign === id} onClick={() => setPromoBannerForm({ ...promoBannerForm, contentAlign: id })}>
                  <Icon className="w-4 h-4" />{label}
                </ChoiceButton>
              ))}
            </div>
          </Field>

          <Field label="Fondo">
            <div className="grid grid-cols-2 gap-2">
              {(['gradient', 'image'] as const).map((type) => {
                const Icon = BG_ICONS[type];
                return (
                  <ChoiceButton key={type} active={promoBannerForm.background.type === type} onClick={() => setPromoBannerForm({ ...promoBannerForm, background: { ...promoBannerForm.background, type } })}>
                    <Icon className="w-5 h-5" />{BG_LABELS[type]}
                  </ChoiceButton>
                );
              })}
            </div>
          </Field>

          {promoBannerForm.background.type === 'image' && (
            <ImageUploadField
              label="Imagen de fondo"
              value={promoBannerForm.background.imageUrl || ''}
              onChange={(newUrl) => setPromoBannerForm({ ...promoBannerForm, background: { ...promoBannerForm.background, imageUrl: newUrl } })}
              placeholder="https://imagen.jpg"
            />
          )}

          <Field label={`Oscurecer fondo: ${promoBannerForm.background.overlayOpacity ?? 20}%`}>
            <input
              type="range"
              min="0"
              max="80"
              value={promoBannerForm.background.overlayOpacity ?? 20}
              onChange={(e) => setPromoBannerForm({ ...promoBannerForm, background: { ...promoBannerForm.background, overlayOpacity: parseInt(e.target.value) } })}
              className="w-full accent-app-600"
            />
          </Field>
        </div>
      </Dialog>
    </Page>
  );
};
