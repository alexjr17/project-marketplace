import { Link } from 'react-router-dom';
import { ChevronRight, PackageCheck, Shirt, Upload } from 'lucide-react';
import { buttonClass } from '../ui';
import { HomeBlock, SectionHeader } from './SectionHeader';

const STEPS = [
  { icon: Shirt, title: 'Elige tu prenda', text: 'Camisetas, hoodies, tazas y más, en la talla y el color que quieras.' },
  { icon: Upload, title: 'Sube tu diseño', text: 'Tu imagen, logo o frase. Ajusta la posición y el tamaño en el editor.' },
  { icon: PackageCheck, title: 'Recíbelo en casa', text: 'Lo estampamos con calidad profesional y te lo enviamos.' },
];

/** "Personaliza en 3 pasos" (solo si el personalizador está activo). */
export function HowItWorks({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <HomeBlock>
      <SectionHeader title={title} subtitle={subtitle}>
        <Link to="/customize" className={`${buttonClass('primary', 'md')} gap-1.5 flex-shrink-0 hidden sm:inline-flex`}>
          Empezar
          <ChevronRight className="w-4 h-4" />
        </Link>
      </SectionHeader>
      <ol className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 flex md:flex-col items-start gap-3 min-w-0">
            <span className="relative w-11 h-11 rounded-lg bg-app-50 text-app-600 flex items-center justify-center flex-shrink-0">
              <s.icon className="w-5 h-5" />
              <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-app-600 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white">
                {i + 1}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-gray-900 text-sm">{s.title}</span>
              <span className="block text-sm text-gray-500 mt-0.5">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      {/* En celular el botón va abajo, a todo el ancho */}
      <Link to="/customize" className={`${buttonClass('primary', 'lg', true)} gap-2 mt-3 sm:hidden`}>
        Empezar a diseñar
        <ChevronRight className="w-4 h-4" />
      </Link>
    </HomeBlock>
  );
}
