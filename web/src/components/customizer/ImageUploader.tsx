import { Upload, Image as ImageIcon } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';

interface ImageUploaderProps {
  onImageUpload: (imageData: string) => void;
  isUploading?: boolean;
}

export const ImageUploader = ({ onImageUpload, isUploading = false }: ImageUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida');
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Máximo 5MB');
      return;
    }

    // Leer archivo como base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      onImageUpload(imageData);

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
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-lg transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <ImageIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Recomendaciones:</p>
            <ul className="text-xs space-y-1 text-blue-700">
              <li>• Formato: PNG, JPG, SVG</li>
              <li>• Tamaño máximo: 5MB</li>
              <li>• Resolución: 300 DPI para mejor calidad</li>
              <li>• Fondo transparente (PNG) recomendado</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
