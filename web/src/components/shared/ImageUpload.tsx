import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  value?: string;
  onChange: (imageData: string | undefined) => void;
  label?: string;
  hint?: string;
  maxSizeMB?: number;
  aspectRatio?: 'square' | 'landscape' | 'auto';
}

export const ImageUpload = ({
  value,
  onChange,
  label = 'Imagen',
  hint,
  maxSizeMB = 2,
  aspectRatio = 'auto',
}: ImageUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError(null);

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen');
      return;
    }

    // Validar tamaño
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      setError(`El archivo es muy grande. Máximo ${maxSizeMB}MB`);
      return;
    }

    // Convertir a base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onChange(result);
    };
    reader.onerror = () => {
      setError('Error al leer el archivo');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemove = () => {
    onChange(undefined);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const aspectClasses = {
    square: 'aspect-square',
    landscape: 'aspect-video',
    auto: '',
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}

      {value ? (
        // Preview con imagen
        <div className="relative inline-block">
          <div
            className={`relative overflow-hidden rounded-lg border-2 border-gray-200 bg-gray-50 ${aspectClasses[aspectRatio]}`}
            style={{ maxWidth: '200px' }}
          >
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
            title="Eliminar imagen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        // Dropzone
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragging
              ? 'border-app-500 bg-app-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-2">
            {isDragging ? (
              <Upload className="w-8 h-8 text-app-500" />
            ) : (
              <ImageIcon className="w-8 h-8 text-gray-400" />
            )}
            <div className="text-sm">
              <span className="font-medium text-app-600">Clic para subir</span>
              {' '}o arrastra y suelta
            </div>
            <p className="text-xs text-gray-500">
              PNG, JPG hasta {maxSizeMB}MB
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
};
