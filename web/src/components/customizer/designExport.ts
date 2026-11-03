/**
 * Descarga de los diseños en ZIP: un mockup por vista, los archivos originales y un
 * info.json con la posición de cada diseño (lo que necesita producción).
 */
import JSZip from 'jszip';
import { canvasCandidates } from './garment';
import type { StudioDesign, StudioView } from './customizerModel';

const extOf = (src: string) => {
  const m = /^data:image\/(png|jpe?g|webp|gif|svg\+xml)/i.exec(src);
  if (m) return m[1].toLowerCase().replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const u = /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.exec(src);
  return u ? u[1].toLowerCase().replace('jpeg', 'jpg') : 'png';
};

async function toBlob(src: string): Promise<Blob | null> {
  for (const url of canvasCandidates(src)) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.blob();
    } catch {
      /* siguiente */
    }
  }
  return null;
}

const safe = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || 'archivo';

export async function exportDesignsZip(opts: {
  templateName: string; color: string; size: string; designs: StudioDesign[]; previews: Record<string, string>; views: StudioView[];
}) {
  const zip = new JSZip();
  const info = {
    modelo: opts.templateName,
    color: opts.color,
    talla: opts.size,
    fecha: new Date().toISOString(),
    disenos: [] as Array<Record<string, unknown>>,
  };

  for (const v of opts.views) {
    const preview = opts.previews[v.slug];
    if (preview) {
      const blob = await toBlob(preview);
      if (blob) zip.file(`mockup_${safe(v.slug)}.png`, blob);
    }
  }

  let n = 0;
  for (const d of opts.designs) {
    n += 1;
    const src = d.originalImageData || d.imageData;
    const file = `original_${n}_${safe(d.viewSlug)}_${safe(d.zoneName || 'zona')}.${extOf(src)}`;
    const blob = await toBlob(src);
    if (blob) zip.file(file, blob);
    info.disenos.push({
      archivo: blob ? file : null,
      nombreOriginal: d.originalFileName || null,
      vista: d.viewSlug,
      zona: d.zoneName,
      zonaId: d.templateZoneId,
      posicion: d.position,
      tamano: d.size,
      rotacion: d.rotation,
      opacidad: d.opacity,
    });
  }

  zip.file('info.json', JSON.stringify(info, null, 2));
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe(opts.templateName)}_${safe(opts.color)}_${safe(opts.size)}_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
