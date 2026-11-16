/**
 * Estudio → personalizable → familia navideña: se elige una familia de diseños (Papá, Mamá, Hijo…) y se
 * escribe el nombre de cada integrante. Cada uno sale en la prenda con su diseño y su nombre; la
 * plantilla "Navidad en familia" los pone en fila (y el video, uno por escena).
 */
import { Minus, Plus, Users } from 'lucide-react';
import { Switch } from '../ui';
import type { DesignFamily, DesignImage } from '../../services/design-images.service';
import { assetUrl } from '../../utils/assetUrl';
import { defaultValues } from '../../lib/namedDesign';
import type { FamilyPlan } from './pieces';

let seq = 0;
const memberOf = (d: DesignImage): FamilyPlan['members'][number] => ({
  key: `m${Date.now().toString(36)}${++seq}`, designId: d.id, role: d.familyRole || d.name, values: defaultValues(d.textFields ?? []),
});
/** La familia completa, un integrante por diseño. */
const familyPlanOf = (f: DesignFamily): FamilyPlan => ({ familyId: f.id, members: f.designs.map(memberOf) });

export function FamilyPanel({ families, value, onChange }: { families: DesignFamily[]; value: FamilyPlan | null; onChange: (v: FamilyPlan | null) => void }) {
  if (!families.length) return null;
  const family = value ? families.find((f) => f.id === value.familyId) ?? null : null;
  const designOf = (id: number) => family?.designs.find((d) => d.id === id);
  const setMember = (key: string, values: Record<string, string>) =>
    value && onChange({ ...value, members: value.members.map((m) => (m.key === key ? { ...m, values: { ...m.values, ...values } } : m)) });

  return (
    <section className="mt-4 rounded-xl border border-gray-200 p-3" aria-label="Familia navideña">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Users className="w-4 h-4 text-app-600" />Familia (pack navideño)</h3>
      <div className="mt-2">
        <Switch checked={!!value} onChange={(v) => onChange(v ? familyPlanOf(families[0]) : null)}
          label="Mostrar una familia" description="Cada integrante con su diseño y su nombre en esta prenda. Usa la plantilla «Navidad en familia»." />
      </div>
      {value && (
        <div className="mt-3 space-y-2">
          {families.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Familia de diseños">
              {families.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={f.id === value.familyId} onClick={() => onChange(familyPlanOf(f))}
                  className={`h-8 px-2.5 rounded-lg border text-xs font-medium ${f.id === value.familyId ? 'border-app-600 bg-app-50 text-app-700' : 'border-gray-300 text-gray-700'}`}>
                  {f.name}
                </button>
              ))}
            </div>
          )}
          <ul className="space-y-1.5">
            {value.members.map((m) => {
              const d = designOf(m.designId);
              return (
                <li key={m.key} className="flex items-center gap-2 rounded-lg border border-gray-200 p-1.5">
                  {d && <img src={assetUrl(d.thumbnailUrl)} alt="" className="w-10 h-10 rounded bg-gray-50 object-contain flex-shrink-0" />}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-semibold text-gray-800">{m.role}</p>
                    {(d?.textFields ?? []).map((f) => (
                      <input key={f.key} value={m.values[f.key] ?? ''} maxLength={f.maxLength} placeholder={f.label} aria-label={`${f.label} de ${m.role}`}
                        onChange={(e) => setMember(m.key, { [f.key]: e.target.value })}
                        className="w-full h-8 rounded-md border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-200" />
                    ))}
                  </div>
                  <button type="button" title={`Quitar ${m.role}`} aria-label={`Quitar ${m.role}`} disabled={value.members.length < 2}
                    onClick={() => onChange({ ...value, members: value.members.filter((x) => x.key !== m.key) })}
                    className="grid place-items-center w-7 h-7 rounded-md border border-gray-300 text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Minus className="w-3.5 h-3.5" /></button>
                </li>
              );
            })}
          </ul>
          {family && value.members.length < 6 && (
            <div className="flex flex-wrap gap-1.5">
              {family.designs.map((d) => (
                <button key={d.id} type="button" onClick={() => onChange({ ...value, members: [...value.members, memberOf(d)] })}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-dashed border-gray-300 text-xs text-gray-700 hover:border-app-400 hover:bg-app-50">
                  <Plus className="w-3 h-3" />{d.familyRole || d.name}
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-500">Hasta 6 integrantes. Salen en el orden de la lista.</p>
        </div>
      )}
    </section>
  );
}
