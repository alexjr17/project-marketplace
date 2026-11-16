/**
 * Admin → ficha del producto o de la plantilla: el fondo de su foto en la tienda. Se sube una imagen
 * o se crea con IA; el servidor recorta la foto principal para ponerla encima. Se guarda al elegirlo.
 */
import { useRef, useState } from 'react';
import { ImagePlus, Sparkles, Trash2, Wallpaper } from 'lucide-react';
import { Button, Card, CardTitle, toast } from '../ui';
import { errorMessage } from '../../lib/http';
import { productsService } from '../../services/products.service';
import type { ProductBackdrop } from '../../types/product';
import { AiBackdropDialog } from '../marketing/AiBackdropDialog';
import { ProductPhoto } from '../products/ProductPhoto';

/** Achica la imagen subida (lado mayor 2000 px, JPEG) para que pese poco. */
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 2000 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = URL.createObjectURL(file);
  });
}

export function ProductBackdropCard({ productId, mainImage, value, onChange }: {
  productId?: number;
  /** Foto principal del producto (la que va encima del fondo). */
  mainImage?: string | null;
  value?: ProductBackdrop | null;
  onChange: (b: ProductBackdrop | null) => void;
}) {
  const [busy, setBusy] = useState<null | 'subir' | 'guardar'>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const save = async (url: string | null) => {
    if (!productId) return;
    setBusy('guardar');
    try {
      const r = await productsService.setBackdrop(productId, url);
      onChange(r.backdrop);
      if (r.warning) toast.warning(r.warning);
      else toast.success(url ? 'Fondo guardado' : 'Fondo quitado');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo guardar el fondo'));
    } finally {
      setBusy(null);
    }
  };

  const upload = async (f: File) => {
    setBusy('subir');
    try {
      const url = await productsService.uploadImage(await shrink(f));
      await save(url);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo subir el fondo'));
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardTitle icon={Wallpaper}>Fondo en la tienda</CardTitle>
      {!productId ? (
        <p className="text-sm text-gray-500">Guarda el producto para ponerle un fondo a su foto.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[11rem_minmax(0,1fr)] gap-4 items-start">
          <div className="aspect-square rounded-xl overflow-hidden ring-1 ring-gray-200 bg-gray-50">
            {value?.url
              ? <ProductPhoto src={mainImage} backdrop={value} alt="Vista previa del fondo" />
              : mainImage ? <img src={mainImage} alt="" className="w-full h-full object-contain" /> : <span className="w-full h-full grid place-items-center text-xs text-gray-400">Sin foto</span>}
          </div>
          <div className="space-y-3 min-w-0">
            <p className="text-sm text-gray-600">
              La foto principal se recorta y se pone sobre este fondo en la tienda (tarjeta del catálogo, página del producto y personalizador).
            </p>
            {value?.url && !value.cutout && <p className="text-xs text-amber-700">La foto aún no está recortada: se ve tal cual sobre el fondo. Vuelve a elegir el fondo para intentarlo de nuevo.</p>}
            <div className="flex flex-wrap gap-2">
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Subir fondo"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
              <Button variant="secondary" icon={<ImagePlus className="w-4 h-4" />} isLoading={busy === 'subir'} disabled={!!busy} onClick={() => file.current?.click()}>Subir fondo</Button>
              <Button variant="secondary" icon={<Sparkles className="w-4 h-4" />} disabled={!!busy} onClick={() => setAiOpen(true)}>Crear con IA</Button>
              {value?.url && (
                <Button variant="ghost" className="!text-red-600 hover:!bg-red-50" icon={<Trash2 className="w-4 h-4" />} disabled={!!busy} onClick={() => void save(null)}>Quitar fondo</Button>
              )}
            </div>
            {busy === 'guardar' && <p className="text-xs text-gray-500">Recortando la foto del producto… puede tardar unos segundos.</p>}
          </div>
        </div>
      )}
      {aiOpen && (
        <AiBackdropDialog designUrls={mainImage ? [mainImage] : []} ratio="1:1" generateWith={productsService.aiBackdrop}
          onClose={() => setAiOpen(false)} onUse={(img) => { setAiOpen(false); void save(img.url); }} />
      )}
    </Card>
  );
}
