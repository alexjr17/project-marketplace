import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icono a la izquierda del texto (lucide, w-4 h-4). */
  icon?: ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
}

// primary usa el color de la app (--app-*); el resto son neutros o semánticos.
export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-app-600 text-white hover:bg-app-700 focus-visible:ring-app-500',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:ring-gray-400',
  outline: 'bg-white text-app-700 border border-app-300 hover:bg-app-50 focus-visible:ring-app-500',
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500',
};

export const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', fullWidth = false) =>
  `inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${fullWidth ? 'w-full' : ''}`;

/** Botón estándar de todas las vistas. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon, isLoading = false, fullWidth = false, disabled, className = '', type = 'button', children, ...props }, ref) => (
    <button ref={ref} type={type} className={`${buttonClass(variant, size, fullWidth)} ${className}`} disabled={disabled || isLoading} {...props}>
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

/** Botón de solo icono (acciones de fila de tabla). Siempre con `title` (accesible). */
export function IconButton({ tone = 'default', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'default' | 'danger' | 'app'; title: string }) {
  const tones = {
    default: 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
    app: 'text-gray-500 hover:text-app-700 hover:bg-app-50',
    danger: 'text-gray-500 hover:text-red-600 hover:bg-red-50',
  };
  return <button type="button" aria-label={props.title} className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${tones[tone]} ${className}`} {...props} />;
}
