import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/** Encabezado de un bloque de la portada: título, subtítulo y "Ver todo →" opcional. */
export function SectionHeader({ title, subtitle, to, linkLabel = 'Ver todo', children }: {
  title: ReactNode;
  subtitle?: ReactNode;
  to?: string;
  linkLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div className="min-w-0">
        <h2 className="text-lg md:text-xl font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {children}
      {to && (
        <Link to={to} className="flex-shrink-0 inline-flex items-center gap-1 text-sm font-medium text-app-700 hover:text-app-800 group">
          {linkLabel}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}
    </div>
  );
}

/** Contenedor estándar de un bloque de la portada (centrado, con aire vertical). */
export function HomeBlock({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`py-5 md:py-7 ${className}`}>
      <div className="max-w-7xl mx-auto px-3 md:px-6">{children}</div>
    </section>
  );
}
