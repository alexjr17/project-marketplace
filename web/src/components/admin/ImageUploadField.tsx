import { Field, ImageInput } from '../ui';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** Se conserva por compatibilidad; el enlace se pega en el modo "Usar un enlace" de ImageInput. */
  placeholder?: string;
  /** Proporción de la vista previa (por defecto horizontal). */
  ratio?: 'square' | 'landscape' | 'portrait';
}

/**
 * Campo de una imagen (archivo o enlace) con etiqueta. Se apoya en ImageInput del kit:
 * el valor es una URL o un data URL, máx. 5 MB.
 */
export const ImageUploadField = ({ label, value, onChange, required = false, ratio = 'landscape' }: ImageUploadFieldProps) => (
  <Field label={label || undefined} required={required}>
    <ImageInput value={value} onChange={onChange} ratio={ratio} maxSizeMB={5} />
  </Field>
);
