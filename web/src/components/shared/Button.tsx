import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Button as UiButton, type ButtonVariant } from '../ui/Button';

/**
 * @deprecated Usar `Button` de `components/ui` (ver DESIGN_SYSTEM.md).
 * Se conserva para las pantallas que aún lo importan: sus variantes viejas se
 * traducen a las del estándar, así todas se ven igual.
 */
type LegacyVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'admin-primary' | 'admin-secondary' | 'admin-danger' | 'admin-orange' | 'admin-outline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: LegacyVariant;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
}

const MAP: Record<LegacyVariant, ButtonVariant> = {
  primary: 'primary',
  secondary: 'outline',
  outline: 'secondary',
  danger: 'danger',
  'admin-primary': 'primary',
  'admin-orange': 'primary',
  'admin-secondary': 'secondary',
  'admin-outline': 'secondary',
  'admin-danger': 'danger',
};

export const Button = ({ variant = 'primary', type = 'button', ...props }: ButtonProps) => (
  <UiButton variant={MAP[variant] ?? 'primary'} type={type} {...props} />
);
