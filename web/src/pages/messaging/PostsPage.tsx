import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Facebook,
  Image as ImageIcon,
  Loader2,
  Package,
  Plus,
  Send,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { Alert, Badge, Button, Card, CardTitle, Dialog, EmptyState, FileDrop, IconButton, Page, PageHeader, SearchInput, Spinner, TextArea, TextInput, Thumb, toast, useConfirm, type Tone } from '../../components/ui';
import socialService from '../../services/social.service';
import productsService from '../../services/products.service';
import type { Product } from '../../types/product';
import type { SocialPost } from '../../types/messaging';

export const PostsPage = () => {
  const confirm = useConfirm();

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

  const handleAddFiles = async (files: FileList | File[] | null) => {
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
      toast.error(err instanceof Error ? err.message : 'No se pudo publicar el borrador');
    }
  };

  const handleDelete = async (post: SocialPost) => {
    const confirmMsg = post.status === 'published'
      ? '¿Borrar esta publicación de Facebook? La acción no se puede deshacer.'
      : '¿Borrar este borrador?';
    if (!(await confirm({ title: confirmMsg, tone: 'danger', confirmText: 'Borrar' }))) return;
    try {
      await socialService.remove(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo borrar');
    }
  };

  return (
    <Page className="max-w-6xl mx-auto">
      <PageHeader
        icon={Share2}
        title="Publicaciones"
        subtitle="Crea posts en la Página de Facebook conectada. Instagram y programación llegan en la siguiente fase."
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* Nueva publicación */}
        <div className="lg:col-span-2">
          <Card>
            <CardTitle icon={Facebook}>Nueva publicación</CardTitle>
            <div className="space-y-4">
              {/* Producto del marketplace: llena texto + imágenes */}
              {!linkedProduct ? (
                <Button variant="outline" fullWidth icon={<Package className="w-4 h-4" />} onClick={openPicker}>
                  Publicar un producto del marketplace
                </Button>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-app-200 bg-app-50 px-3 py-2">
                  <Thumb src={linkedProduct.images?.front} alt={linkedProduct.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">Producto vinculado</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{linkedProduct.name}</p>
                  </div>
                  <IconButton title="Desvincular producto" onClick={handleClearProduct}><X className="w-4 h-4" /></IconButton>
                </div>
              )}

              <TextArea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="¿Qué quieres compartir hoy?"
                rows={6}
                className="resize-none"
                aria-label="Texto de la publicación"
              />

              {/* Imágenes: subir desde el equipo o pegar URL */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-gray-400" /> Imágenes
                  {mediaUrls.length > 1 && <Badge tone="app">Carrusel</Badge>}
                </p>

                {mediaUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {mediaUrls.map((url, idx) => (
                      <div key={`${url}-${idx}`} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group">
                        <img
                          src={url}
                          alt={`Imagen ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')}
                        />
                        <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center">
                          {idx + 1}
                        </span>
                        {/* Acciones: siempre visibles en táctil, en hover con ratón */}
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-1 bg-gradient-to-t from-black/50 to-transparent sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <div className="flex gap-1">
                            <button type="button" onClick={() => handleMoveImage(idx, -1)} disabled={idx === 0} className="w-7 h-7 rounded-md bg-white/95 text-gray-700 disabled:opacity-30 flex items-center justify-center" title="Mover a la izquierda">
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => handleMoveImage(idx, 1)} disabled={idx === mediaUrls.length - 1} className="w-7 h-7 rounded-md bg-white/95 text-gray-700 disabled:opacity-30 flex items-center justify-center" title="Mover a la derecha">
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button type="button" onClick={() => handleRemoveImage(idx)} className="w-7 h-7 rounded-md bg-white/95 text-red-600 flex items-center justify-center" title="Quitar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {uploadingCount > 0 && (
                      <div className="aspect-square rounded-lg border border-dashed border-app-300 bg-app-50 flex flex-col items-center justify-center text-app-700">
                        <Loader2 className="w-5 h-5 animate-spin mb-1" />
                        <span className="text-[11px]">Subiendo {uploadingCount}…</span>
                      </div>
                    )}
                  </div>
                )}
                {mediaUrls.length === 0 && uploadingCount > 0 && (
                  <p className="text-sm text-app-700 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Subiendo {uploadingCount}…</p>
                )}

                <FileDrop
                  compact
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  maxSizeMB={10}
                  disabled={uploadingCount > 0}
                  title={mediaUrls.length === 0 ? 'Subir desde mi equipo' : 'Agregar más'}
                  hint="PNG, JPG o WebP · máx. 10 MB c/u. La primera es la portada; con 2+ se publica como carrusel."
                  onFiles={(files) => handleAddFiles(files)}
                />

                {/* Pegar URL (alternativa) */}
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-800 select-none">O pegar una URL pública</summary>
                  <div className="flex gap-2 mt-2">
                    <TextInput
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUrl())}
                      placeholder="https://…/imagen.jpg"
                      className="font-mono text-xs"
                    />
                    <Button variant="secondary" onClick={handleAddUrl} disabled={!urlInput.trim()} title="Agregar URL" icon={<Plus className="w-4 h-4" />} />
                  </div>
                </details>
              </div>

              {feedback && <Alert tone={feedback.ok ? 'success' : 'error'}>{feedback.msg}</Alert>}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-gray-100">
                <Button variant="secondary" onClick={handleSaveDraft} disabled={publishing}>Guardar borrador</Button>
                <Button onClick={handlePublish} isLoading={publishing} icon={!publishing ? <Send className="w-4 h-4" /> : undefined}>Publicar ahora</Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Publicaciones recientes */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            Publicaciones recientes
            {posts.length > 0 && <Badge tone="gray">{posts.length}</Badge>}
          </h2>

          {loading ? (
            <Spinner label="Cargando publicaciones…" />
          ) : posts.length === 0 ? (
            <Card><EmptyState icon={Facebook} title="Aún no hay publicaciones" description="Crea la primera en el formulario de Nueva publicación." /></Card>
          ) : (
            posts.map((post) => (
              <PostCard key={post.id} post={post} onPublish={() => handlePublishExisting(post)} onDelete={() => handleDelete(post)} />
            ))
          )}
        </div>
      </div>

      {/* Selector de producto */}
      <Dialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        size="lg"
        title="Elige un producto"
        description="Se usan el nombre, la descripción, el precio y las imágenes. Podrás editar el texto antes de publicar."
      >
        <div className="space-y-3">
          <SearchInput value={productSearch} onChange={setProductSearch} placeholder="Buscar por nombre, descripción o SKU" />
          {loadingProducts ? (
            <Spinner />
          ) : filteredProducts.length === 0 ? (
            <EmptyState icon={Package} title={products.length === 0 ? 'Aún no hay productos en el marketplace' : 'Ningún producto coincide con la búsqueda'} />
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
                    className="flex items-center gap-3 text-left p-2 rounded-lg border border-gray-200 hover:border-app-400 hover:bg-app-50 transition-colors"
                  >
                    <Thumb src={p.images?.front} alt={p.name} size="lg" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      {price > 0 && <p className="text-xs text-gray-500">${Math.round(price).toLocaleString('es-CO')} COP</p>}
                      {p.sku && <p className="text-[11px] text-gray-400 font-mono">{p.sku}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Dialog>
    </Page>
  );
};

interface PostCardProps {
  post: SocialPost;
  onPublish: () => void;
  onDelete: () => void;
}

const STATUS_TONE: Record<SocialPost['status'], Tone> = {
  draft: 'gray',
  scheduled: 'yellow',
  published: 'green',
  failed: 'red',
};
const STATUS_LABEL: Record<SocialPost['status'], string> = {
  draft: 'Borrador',
  scheduled: 'Programado',
  published: 'Publicado',
  failed: 'Falló',
};

const PostCard = ({ post, onPublish, onDelete }: PostCardProps) => {
  const urls = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : (post.mediaUrl ? [post.mediaUrl] : []);
  const when = post.publishedAt || post.createdAt;
  return (
    <article className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Facebook className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-medium text-gray-600 capitalize">{post.platform}</span>
          <Badge tone={STATUS_TONE[post.status]}>{STATUS_LABEL[post.status]}</Badge>
        </div>
        <span className="text-xs text-gray-400">
          {when ? new Date(when).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : ''}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {urls.length === 1 && (
          <img src={urls[0]} alt="" className="w-full max-h-72 object-cover rounded-lg border border-gray-100" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
        )}
        {urls.length > 1 && (
          <div className="grid grid-cols-3 gap-1.5">
            {urls.slice(0, 6).map((u, i) => (
              <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-gray-100 bg-gray-50">
                <img src={u} alt={`${i + 1}`} className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')} />
                {i === 5 && urls.length > 6 && (
                  <div className="absolute inset-0 bg-black/60 text-white text-xs font-semibold flex items-center justify-center">+{urls.length - 6}</div>
                )}
              </div>
            ))}
          </div>
        )}
        {post.content && <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>}
        {post.error && <Alert tone="error">{post.error}</Alert>}
      </div>

      <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-2 justify-end">
        {post.status === 'published' && post.externalUrl && (
          <a
            href={post.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink className="w-4 h-4" /> Ver en Facebook
          </a>
        )}
        {post.status === 'draft' && (
          <Button size="sm" icon={<Send className="w-4 h-4" />} onClick={onPublish}>Publicar</Button>
        )}
        <IconButton title="Borrar" tone="danger" onClick={onDelete}><Trash2 className="w-4 h-4" /></IconButton>
      </div>
    </article>
  );
};

export default PostsPage;
