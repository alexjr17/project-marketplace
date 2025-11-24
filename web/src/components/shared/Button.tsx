import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'admin-primary' | 'admin-secondary' | 'admin-danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) => {
  const getBaseStyles = (variant: string) => {
    const isAdmin = variant.startsWith('admin-');
    const rounded = isAdmin ? 'rounded-lg' : 'rounded-xl';
    return `inline-flex items-center justify-center gap-2 font-semibold ${rounded} transition-all disabled:opacity-50 disabled:cursor-not-allowed`;
  };

  const variants = {
    primary: 'bg-gradient-primary text-white hover:shadow-xl hover:shadow-violet-500/50 hover:scale-105',
    secondary: 'bg-secondary text-white hover:bg-secondary-dark hover:shadow-lg hover:shadow-pink-500/30',
    outline: 'border-2 border-violet-300 text-gray-700 hover:border-violet-500 hover:bg-violet-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 hover:shadow-lg',
    'admin-primary': 'bg-blue-600 text-white hover:bg-blue-700',
    'admin-secondary': 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300',
    'admin-danger': 'bg-red-600 text-white hover:bg-red-700',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${getBaseStyles(variant)} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};
