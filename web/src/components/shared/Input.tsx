import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { fieldClass } from '../ui/Form';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

/** @deprecated Usar `Field` + `TextInput` de `components/ui`. Mismo aspecto que el estándar. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}{props.required && <span className="text-red-500"> *</span>}</label>}
      <input ref={ref} className={`${fieldClass(!!error)} ${className}`} {...props} />
      {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : helperText && <p className="text-xs text-gray-500 mt-1">{helperText}</p>}
    </div>
  ),
);

Input.displayName = 'Input';
