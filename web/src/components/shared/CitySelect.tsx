import { useEffect, useState } from 'react';
import { COLOMBIA_GEO } from '../../data/colombiaGeo';

/** Países disponibles (la tienda opera en Colombia). */
export const COUNTRIES = ['Colombia'];

const baseCls =
  'w-full px-4 py-2 border-2 border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-500 transition-all';

const departmentOfCity = (city: string) =>
  COLOMBIA_GEO.find((d) => d.cities.includes(city))?.department || '';

/**
 * Selects dependientes Departamento → Ciudad, alimentados por COLOMBIA_GEO.
 * Devuelve la ciudad y su departamento (útil para cotizar el envío por zona).
 */
export function CitySelect({
  city,
  onChange,
  error,
  required,
}: {
  city: string;
  onChange: (city: string, department: string) => void;
  error?: string;
  required?: boolean;
}) {
  const [dept, setDept] = useState(() => departmentOfCity(city));

  // Si la ciudad llega desde fuera (p. ej. una dirección guardada), sincroniza el dpto.
  useEffect(() => {
    const d = departmentOfCity(city);
    if (d && d !== dept) setDept(d);
  }, [city]); // eslint-disable-line react-hooks/exhaustive-deps

  const cities = COLOMBIA_GEO.find((d) => d.department === dept)?.cities || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Departamento{required && ' *'}
        </label>
        <select
          value={dept}
          onChange={(e) => { setDept(e.target.value); onChange('', e.target.value); }}
          className={baseCls}
        >
          <option value="">Selecciona…</option>
          {COLOMBIA_GEO.map((d) => (
            <option key={d.department} value={d.department}>{d.department}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ciudad{required && ' *'}
        </label>
        <select
          value={city}
          onChange={(e) => onChange(e.target.value, dept)}
          disabled={!dept}
          className={`${baseCls} disabled:bg-gray-100 disabled:text-gray-400`}
        >
          <option value="">{dept ? 'Selecciona…' : 'Elige departamento'}</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    </div>
  );
}

/** Select simple de país. */
export function CountrySelect({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (country: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        País{required && ' *'}
      </label>
      <select value={value || 'Colombia'} onChange={(e) => onChange(e.target.value)} className={baseCls}>
        {COUNTRIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}
