import { Upload, Image as ImageIcon } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';
import { useSettings } from '../../context/SettingsContext';

// Datos de imagen con original y comprimida
export interface ImageUploadData {
  compressed: string; // Para preview (menor peso)
  original: string; // Para producción (calidad original)
  fileName: string;
  fileSize: number;
}

interface ImageUploaderProps {
  onImageUpload: (imageData: string, uploadData?: ImageUploadData) => void;
  isUploading?: boolean;
}

// Detectar si una imagen tiene transparencia
const hasTransparency = (ctx: CanvasRenderingContext2D, width: number, height: number): boolean => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Revisar canal alpha (cada 4 bytes: R, G, B, A)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return true; // Encontró pixel con transparencia
    }
  }
  return false;
};

// Detectar los límites del contenido visible (no transparente) y recortar
const trimTransparentPixels = (imageDataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageDataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0);

      // Verificar si la imagen tiene transparencia
      if (!hasTransparency(ctx, canvas.width, canvas.height)) {
        resolve(imageDataUrl); // No tiene transparencia, devolver original
        return;
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = 0;
      let maxY = 0;

      // Umbral de transparencia (píxeles con alpha > 10 se consideran visibles)
      const alphaThreshold = 10;

      // Encontrar los límites del contenido visible
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const index = (y * canvas.width + x) * 4;
          const alpha = data[index + 3];

          if (alpha > alphaThreshold) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Si no se encontró contenido visible, devolver original
      if (minX > maxX || minY > maxY) {
        resolve(imageDataUrl);
        return;
      }

      // Agregar pequeño padding (2px) para evitar cortes muy ajustados
      const padding = 2;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(canvas.width - 1, maxX + padding);
      maxY = Math.min(canvas.height - 1, maxY + padding);

      // Crear nuevo canvas con el tamaño recortado
      const trimmedWidth = maxX - minX + 1;
      const trimmedHeight = maxY - minY + 1;

      const trimmedCanvas = document.createElement('canvas');
      trimmedCanvas.width = trimmedWidth;
      trimmedCanvas.height = trimmedHeight;

      const trimmedCtx = trimmedCanvas.getContext('2d');
      if (!trimmedCtx) {
        resolve(imageDataUrl);
        return;
      }

      // Copiar solo la región visible
      trimmedCtx.drawImage(
        canvas,
        minX, minY, trimmedWidth, trimmedHeight,
        0, 0, trimmedWidth, trimmedHeight
      );

      // Devolver imagen recortada como PNG
      resolve(trimmedCanvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
};

// Comprimir imagen para preview manteniendo calidad aceptable
const compressImage = (
  originalDataUrl: string,
  maxWidth: number = 800,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Solo redimensionar si es más grande que maxWidth
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);

        // Detectar si la imagen tiene transparencia
        const isTransparent = hasTransparency(ctx, width, height);

        // Usar PNG para imágenes con transparencia, JPEG para las demás
        const format = isTransparent ? 'image/png' : 'image/jpeg';
        const compressed = canvas.toDataURL(format, isTransparent ? undefined : quality);
        resolve(compressed);
      } else {
        resolve(originalDataUrl);
      }
    };
    img.onerror = () => resolve(originalDataUrl);
    img.src = originalDataUrl;
  });
};

// Tamaño aproximado en bytes del contenido de un data URL.
const dataUrlBytes = (dataUrl: string): number => {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((base64.length * 3) / 4);
};

// Garantiza que la imagen pese 10MB o menos: baja calidad (JPEG) y/o
// dimensiones hasta lograrlo, conservando la mejor calidad posible.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const compressToMaxSize = (
  dataUrl: string,
  maxBytes: number = MAX_IMAGE_BYTES
): Promise<string> => {
  return new Promise((resolve) => {
    const inputBytes = dataUrlBytes(dataUrl);
    if (inputBytes <= maxBytes) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      // Detectar transparencia en una miniatura (rápido, no escanea la
      // imagen completa que puede ser de muchos megapíxeles).
      let transparent = false;
      const pw = Math.max(1, Math.min(64, img.width));
      const ph = Math.max(1, Math.round((pw * img.height) / img.width));
      const probe = document.createElement('canvas');
      probe.width = pw;
      probe.height = ph;
      const pctx = probe.getContext('2d');
      if (pctx) {
        pctx.drawImage(img, 0, 0, pw, ph);
        try {
          transparent = hasTransparency(pctx, pw, ph);
        } catch {
          transparent = true; // ante la duda, conservar PNG
        }
      }
      const format = transparent ? 'image/png' : 'image/jpeg';

      // Renderiza a una escala (0-1 sobre las dimensiones originales).
      const render = (scale: number, quality?: number): string => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return dataUrl;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL(format, quality);
      };

      let result: string;

      if (!transparent) {
        // JPEG: bajar calidad suele bastar sin reescalar.
        result = render(1, 0.82);
        if (dataUrlBytes(result) > maxBytes) {
          result = render(1, 0.62);
        }
        // Si aún pesa, estimar la escala necesaria y afinar pocas veces.
        let scale = 1;
        for (let i = 0; i < 4 && dataUrlBytes(result) > maxBytes; i++) {
          scale *= Math.sqrt(maxBytes / dataUrlBytes(result)) * 0.92;
          result = render(scale, 0.62);
        }
      } else {
        // PNG: el peso depende de los píxeles → estimar la escala de una
        // y afinar un par de veces. Nunca se reencoda a tamaño completo.
        let scale = Math.min(1, Math.sqrt(maxBytes / inputBytes) * 0.9);
        result = render(scale);
        for (let i = 0; i < 4 && dataUrlBytes(result) > maxBytes; i++) {
          scale *= Math.sqrt(maxBytes / dataUrlBytes(result)) * 0.9;
          result = render(scale);
        }
      }

      resolve(result);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

export const ImageUploader = ({ onImageUpload, isUploading = false }: ImageUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings } = useSettings();

  // Colores de marca dinámicos
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida');
      return;
    }

    // Tope de seguridad para no agotar la memoria del navegador con archivos
    // absurdamente grandes. Lo que esté por debajo se comprime a 10MB o menos.
    if (file.size > 40 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Máximo 40MB');
      return;
    }

    // Leer archivo como base64 (original)
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawData = event.target?.result as string;

      // Recortar espacio transparente de imágenes PNG
      const trimmedData = await trimTransparentPixels(rawData);

      // Asegurar que la imagen original pese 10MB o menos.
      const originalData = await compressToMaxSize(trimmedData);

      // Comprimir para preview (usando la imagen ya recortada)
      const compressedData = await compressImage(originalData);

      // Crear objeto con ambas versiones (ambas recortadas)
      const uploadData: ImageUploadData = {
        compressed: compressedData,
        original: originalData, // Versión de calidad, garantizada ≤ 10MB
        fileName: file.name,
        fileSize: dataUrlBytes(originalData),
      };

      // Enviar la versión comprimida para el canvas, pero incluir datos completos
      onImageUpload(compressedData, uploadData);

      // Reset file input to allow uploading to different zones
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        onClick={handleClick}
        disabled={isUploading}
        className="w-full text-white font-semibold py-3 px-6 rounded-lg transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ backgroundColor: brandColors.primary }}
      >
        {isUploading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Cargando...
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" />
            Subir Imagen
          </>
        )}
      </button>

      <div
        className="mt-4 p-4 rounded-lg"
        style={{
          backgroundColor: `${brandColors.primary}10`,
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: `${brandColors.primary}30`
        }}
      >
        <div className="flex items-start gap-2">
          <ImageIcon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: brandColors.primary }} />
          <div className="text-sm" style={{ color: brandColors.primary }}>
            <p className="font-semibold mb-1">Recomendaciones:</p>
            <ul className="text-xs space-y-1" style={{ color: `${brandColors.primary}cc` }}>
              <li>• Formato: PNG, JPG, SVG</li>
              <li>• Tamaño máximo: 10MB</li>
              <li>• Resolución: 300 DPI para mejor calidad</li>
              <li>• Fondo transparente (PNG) recomendado</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
