import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Facebook,
  Image as ImageIcon,
  Loader2,
  Package,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import socialService from '../../services/social.service';
import productsService from '../../services/products.service';
import type { Product } from '../../types/product';
import type { SocialPost } from '../../types/messaging';
import { useSettings } from '../../context/SettingsContext';

export const PostsPage = () => {
  const { settings } = useSettings();
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };
  const gradient = `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary})`;

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  // Galería: lista ordenada de URLs (públicas). El primer item se publica como
  // foto principal; con 2+ se publica como carrusel en Facebook.
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [uploadingCount, setUploadingCount] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selector de productos del marketplace.
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  // Recordar qué producto se usó para etiquetar el post (visual y para info).
  const [linkedProduct, setLinkedProduct] = useState<Product | null>(null);

  const loadPosts = async () => {
    try {
      const result = await socialService.list({ perPage: 30 });
      setPosts(result.data);
    } catch (err) {
      console.error('[Posts] Error cargando:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  // Cargar productos solo la primera vez que se abre el selector.
  const ensureProductsLoaded = async () => {
    if (products.length > 0 || loadingProducts) return;
    setLoadingProducts(true);
    try {
      const result = await productsService.getAll({ limit: 100, sortBy: 'createdAt', sortOrder: 'desc' });
      setProducts(result.data);
    } catch (err) {
      console.error('[Posts] Error cargando productos:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const openPicker = () => {
    setPickerOpen(true);
    ensureProductsLoaded();
  };

  // Genera un caption razonable a partir del producto. El usuario puede editarlo libremente.
  const buildCaptionFromProduct = (p: Product): string => {
    const price = (p as { basePrice?: number; price?: number }).basePrice
      ?? (p as { basePrice?: number; price?: number }).price
      ?? 0;
    const priceFmt = price > 0
      ? `$${Math.round(price).toLocaleString('es-CO')} COP`
      : '';
    const desc = (p.description || '').trim();
    const lines: string[] = [];
    lines.push(`✨ ${p.name}`);
    if (desc) lines.push('', desc);
    if (priceFmt) lines.push('', `💰 ${priceFmt}`);
    lines.push('', '📩 Escríbenos para pedirlo o tener más información.');
    return lines.join('\n');
  };

  const handlePickProduct = async (product: Product) => {
    setContent(buildCaptionFromProduct(product));
    setLinkedProduct(product);
    setPickerOpen(false);
    setFeedback(null);

    // Tomar TODAS las imágenes del producto (front, back, side, extra1, extra2)
    // en orden, saltando vacías.
    const imgs = product.images as Partial<Record<'front' | 'back' | 'side' | 'extra1' | 'extra2', string>> | undefined;
    const productImages = [imgs?.front, imgs?.back, imgs?.side, imgs?.extra1, imgs?.extra2]
      .filter((u): u is string => !!u && u.trim() !== '');

    if (productImages.length === 0) return;

    // Las imágenes pueden venir como URL normal o como data:base64. Meta no
    // acepta data URLs, así que las base64 las convertimos a archivos subidos
    // al backend y usamos esa URL pública.
    setUploadingCount((n) => n + productImages.length);
    try {
      const urls = await Promise.all(
        productImages.map(async (img) => {
          if (img.startsWith('data:')) {
            return socialService.uploadBase64(img, 'general');
          }
          return img; // ya es URL (Cloudinary, http, etc.)
        })
      );
      setMediaUrls((prev) => Array.from(new Set([...urls, ...prev])));
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error
          ? `No se pudieron convertir las imágenes del producto: ${err.message}`
          : 'No se pudieron convertir las imágenes del producto.',
      });
    } finally {
      setUploadingCount((n) => Math.max(0, n - productImages.length));
    }
  };

  const handleClearProduct = () => {
    setLinkedProduct(null);
  };

  // ============ Galería de imágenes ============

  const handleAddFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    setUploadingCount((n) => n + arr.length);
    setFeedback(null);
    try {
      const urls = await Promise.all(arr.map((f) => socialService.uploadImage(f, 'general')));
      setMediaUrls((prev) => [...prev, ...urls]);
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : 'No se pudo subir alguna imagen',
      });
    } finally {
      setUploadingCount((n) => Math.max(0, n - arr.length));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    setMediaUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setUrlInput('');
  };

  const handleRemoveImage = (idx: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMoveImage = (idx: number, direction: -1 | 1) => {
    setMediaUrls((prev) => {
      const next = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const reset = () => {
    setContent('');
    setMediaUrls([]);
    setUrlInput('');
    setLinkedProduct(null);
  };

  const buildPayload = () => ({
    platform: 'facebook' as const,
    content: content.trim() || undefined,
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
  });

  const validate = (): boolean => {
    if (!content.trim() && mediaUrls.length === 0) {
      setFeedback({ ok: false, msg: 'Agrega al menos texto o una imagen.' });
      return false;
    }
    if (uploadingCount > 0) {
      setFeedback({ ok: false, msg: 'Espera a que terminen las subidas en curso.' });
      return false;
    }
    return true;
  };

  const handlePublish = async () => {
    if (!validate()) return;
    setPublishing(true);
    setFeedback(null);
    try {
      const post = await socialService.publishNow(buildPayload());
      if (post) {
        setPosts((prev) => [post, ...prev]);
        reset();
        setFeedback({ ok: true, msg: '¡Publicado en Facebook!' });
      }
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : 'No se pudo publicar.',
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!validate()) return;
    setPublishing(true);
    setFeedback(null);
    try {
      const post = await socialService.saveDraft(buildPayload());
      if (post) {
        setPosts((prev) => [post, ...prev]);
        reset();
        setFeedback({ ok: true, msg: 'Borrador guardado.' });
      }
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : 'No se pudo guardar.',
      });
    } finally {
      setPublishing(false);
    }
  };

  const handlePublishExisting = async (post: SocialPost) => {
    try {
      const updated = await socialService.publishExisting(post.id);
      if (updated) {
        setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo publicar el borrador');
    }
  };

  const handleDelete = async (post: SocialPost) => {
    const confirmMsg = post.status === 'published'
      ? '¿Borrar esta publicación de Facebook? La acción no se puede deshacer.'
      : '¿Borrar este borrador?';
    if (!confirm(confirmMsg)) return;
    try {
      await socialService.remove(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo borrar');
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Facebook className="w-6 h-6 text-blue-600" />
            Publicaciones
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Crea posts directamente en la Página de Facebook conectada. Instagram y programación llegan en la siguiente fase.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Composer */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
              <h2 className="font-semibold text-gray-900 text-sm">Nueva publicación</h2>

              {/* Selector de producto: auto-llena texto + imagen con un producto del marketplace */}
              {!linkedProduct ? (
                <button
                  type="button"
                  onClick={openPicker}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-violet-300 hover:bg-violet-50/30 rounded-lg px-3 py-2.5 text-sm text-gray-600 transition-colors"
                >
                  <Package className="w-4 h-4" style={{ color: brandColors.primary }} />
                  Publicar un producto del marketplace
                </button>
              ) : (
                <div
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{ backgroundColor: `${brandColors.primary}10`, border: `1px solid ${brandColors.primary}30` }}
                >
                  {linkedProduct.images?.front && (
                    <img
                      src={linkedProduct.images.front}
                      alt={linkedProduct.name}
                      className="w-10 h-10 rounded object-cover flex-shrink-0 bg-white"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700">Producto vinculado</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{linkedProduct.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearProduct}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-white rounded"
                    title="Desvincular producto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="¿Qué quieres compartir hoy?"
                rows={6}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none"
              />

              {/* Galería — subir desde el equipo o pegar URL */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" /> Imágenes
                  {mediaUrls.length > 1 && (
                    <span className="text-[10px] font-normal text-violet-600 ml-1">
                      (se publica como carrusel)
                    </span>
                  )}
                </label>

                {/* Grid de previews */}
                {mediaUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {mediaUrls.map((url, idx) => (
                      <div
                        key={`${url}-${idx}`}
                        className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group"
                      >
                        <img
                          src={url}
                          alt={`Imagen ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')}
                        />
                        {/* Etiqueta de orden */}
                        <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center">
                          {idx + 1}
                        </span>
                        {/* Acciones (visible en hover y siempre en móvil) */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-between p-1 opacity-0 group-hover:opacity-100">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, -1)}
                              disabled={idx === 0}
                              className="w-6 h-6 rounded bg-white/90 hover:bg-white text-gray-700 disabled:opacity-30 flex items-center justify-center"
                              title="Mover izquierda"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, 1)}
                              disabled={idx === mediaUrls.length - 1}
                              className="w-6 h-6 rounded bg-white/90 hover:bg-white text-gray-700 disabled:opacity-30 flex items-center justify-center"
                              title="Mover derecha"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="w-6 h-6 rounded bg-red-500/90 hover:bg-red-600 text-white flex items-center justify-center"
                            title="Quitar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {uploadingCount > 0 && (
                      <div className="aspect-square rounded-lg border-2 border-dashed border-violet-300 bg-violet-50 flex flex-col items-center justify-center text-violet-600">
                        <Loader2 className="w-5 h-5 animate-spin mb-1" />
                        <span className="text-[10px]">Subiendo {uploadingCount}…</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Acciones para agregar imágenes */}
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => handleAddFiles(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingCount > 0}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {mediaUrls.length === 0 ? 'Subir desde mi equipo' : 'Agregar más'}
                  </button>
                </div>

                {/* Pegar URL (alternativa) */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700 select-none">
                    O pegar una URL pública
                  </summary>
                  <div className="flex gap-2 mt-1.5">
                    <input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUrl())}
                      placeholder="https://…/imagen.jpg"
                      className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                    <button
                      type="button"
                      onClick={handleAddUrl}
                      disabled={!urlInput.trim()}
                      className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </details>

                <p className="text-[11px] text-gray-400">
                  PNG, JPG, WebP (máx. 10 MB cada una). El primer item se publica como portada.
                  Con 2+ imágenes, FB lo muestra como carrusel.
                </p>
              </div>

              {feedback && (
                <div
                  className={`text-xs rounded-lg px-3 py-2 flex items-start gap-2 ${
                    feedback.ok
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {feedback.ok ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.msg}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex-1 inline-flex items-center justify-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
                  style={{ background: gradient }}
                >
                  {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Publicar ahora
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={publishing}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Borrador
                </button>
              </div>
            </div>
          </div>

          {/* Lista de posts */}
          <div className="lg:col-span-3 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 px-1">
              Publicaciones recientes
              {posts.length > 0 && <span className="ml-1.5 text-xs text-gray-400">({posts.length})</span>}
            </h2>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
                <Facebook className="w-10 h-10 mx-auto mb-2 opacity-40" />
                Aún no hay publicaciones. Crea la primera en el formulario de la izquierda.
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPublish={() => handlePublishExisting(post)}
                  onDelete={() => handleDelete(post)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal selector de producto */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <Package className="w-5 h-5" style={{ color: brandColors.primary }} />
              <h3 className="font-semibold text-gray-900">Elige un producto</h3>
              <button
                onClick={() => setPickerOpen(false)}
                className="ml-auto p-1 text-gray-400 hover:text-gray-600"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar por nombre, descripción o SKU"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {loadingProducts ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-10">
                  {products.length === 0
                    ? 'Aún no hay productos en el marketplace.'
                    : 'Ningún producto coincide con la búsqueda.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredProducts.map((p) => {
                    const price = (p as { basePrice?: number; price?: number }).basePrice
                      ?? (p as { basePrice?: number; price?: number }).price
                      ?? 0;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handlePickProduct(p)}
                        className="flex items-center gap-3 text-left p-2 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50/30 transition-colors"
                      >
                        <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {p.images?.front ? (
                            <img src={p.images.front} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                          {price > 0 && (
                            <p className="text-xs text-gray-500">
                              ${Math.round(price).toLocaleString('es-CO')} COP
                            </p>
                          )}
                          {p.sku && <p className="text-[11px] text-gray-400 font-mono">{p.sku}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 text-[11px] text-gray-400">
              Solo se usa el nombre, descripción, precio e imagen frontal. Podrás editar el texto antes de publicar.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface PostCardProps {
  post: SocialPost;
  onPublish: () => void;
  onDelete: () => void;
}

const PostCard = ({ post, onPublish, onDelete }: PostCardProps) => {
  const statusStyle: Record<SocialPost['status'], string> = {
    draft: 'bg-gray-100 text-gray-700',
    scheduled: 'bg-amber-100 text-amber-700',
    published: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };
  const statusLabel: Record<SocialPost['status'], string> = {
    draft: 'Borrador',
    scheduled: 'Programado',
    published: 'Publicado',
    failed: 'Falló',
  };

  return (
    <article className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Facebook className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{post.platform}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusStyle[post.status]}`}>
            {statusLabel[post.status]}
          </span>
        </div>
        <span className="text-[11px] text-gray-400">
          {post.publishedAt
            ? new Date(post.publishedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
            : post.createdAt
              ? new Date(post.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
              : ''}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {(() => {
          const urls = post.mediaUrls && post.mediaUrls.length > 0
            ? post.mediaUrls
            : (post.mediaUrl ? [post.mediaUrl] : []);
          if (urls.length === 0) return null;
          if (urls.length === 1) {
            return (
              <img
                src={urls[0]}
                alt=""
                className="w-full max-h-72 object-cover rounded-lg border border-gray-100"
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            );
          }
          return (
            <div className="grid grid-cols-3 gap-1.5">
              {urls.slice(0, 6).map((u, i) => (
                <div key={i} className="relative aspect-square rounded overflow-hidden border border-gray-100 bg-gray-50">
                  <img
                    src={u}
                    alt={`${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')}
                  />
                  {i === 5 && urls.length > 6 && (
                    <div className="absolute inset-0 bg-black/60 text-white text-xs font-semibold flex items-center justify-center">
                      +{urls.length - 6}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
        {post.content && (
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>
        )}
        {post.error && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded px-2 py-1.5 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{post.error}</span>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-2 justify-end">
        {post.status === 'draft' && (
          <button
            onClick={onPublish}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white inline-flex items-center gap-1"
          >
            <Send className="w-3 h-3" /> Publicar
          </button>
        )}
        {post.status === 'published' && post.externalUrl && (
          <a
            href={post.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-1 text-gray-700"
          >
            <ExternalLink className="w-3 h-3" /> Ver en Facebook
          </a>
        )}
        <button
          onClick={onDelete}
          className="text-xs font-medium px-2 py-1.5 rounded-lg text-red-600 hover:bg-red-50 inline-flex items-center gap-1"
          title="Borrar"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </article>
  );
};

export default PostsPage;
