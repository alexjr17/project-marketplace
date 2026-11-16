/**
 * Personalizador → pack familiar: se elige una familia de diseños (Papá, Mamá, Hijo…), se escribe el
 * nombre y la talla de cada integrante y se agregan todas las prendas al carrito de una vez, del color
 * elegido. Solo pinta; la compra la hace useCustomizer.addFamilyPack.
 */
import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Users } from 'lucide-react';
import { Badge, Button, Dialog, EmptyState, Spinner, toast } from '../ui';
import { useCurrency } from '../../hooks/useCurrency';
import type { DesignFamily, DesignImage } from '../../services/design-images.service';
import { assetUrl } from '../../utils/assetUrl';
import { composeNamed, defaultValues } from '../../lib/namedDesign';
import { namedFrom, type CustomizerApi } from './useCustomizer';

interface Member { uid: string; design: DesignImage; values: Record<string, string>; sizeId: number | null }

let seq = 0;
const memberOf = (d: DesignImage): Member => ({ uid: `m${++seq}`, design: d, values: defaultValues(d.textFields ?? []), sizeId: null });

/** Vista previa del diseño con lo escrito (se recompone un momento después de escribir). */
function NamedPreview({ design, values }: { design: DesignImage; values: Record<string, string> }) {
  const [src, setSrc] = useState<string | null>(null);
  const key = JSON.stringify(values);
  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      composeNamed(namedFrom(design, values), 320).then((r) => alive && setSrc(r.url)).catch(() => alive && setSrc(null));
    }, 250);
    return () => { alive = false; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.id, key]);
  return (
    <span className="block w-20 h-20 rounded-lg bg-gray-50 ring-1 ring-gray-200 p-1 flex-shrink-0">
      <img src={src ?? assetUrl(design.thumbnailUrl)} alt={design.name} className="w-full h-full object-contain" />
    </span>
  );
}

export function FamilyPackButton({ api, families }: { api: CustomizerApi; families: DesignFamily[] }) {
  const [open, setOpen] = useState(false);
  if (!families.length || !api.packPlace) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 rounded-xl border border-app-200 bg-app-50/50 p-3 text-left hover:border-app-400 transition-colors">
        <span className="grid place-items-center w-10 h-10 rounded-lg bg-app-600 text-white flex-shrink-0"><Users className="w-5 h-5" /></span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-gray-900">Pack familiar</span>
          <span className="block text-xs text-gray-600">Una prenda para cada uno, con su nombre y su talla, en un solo paso.</span>
        </span>
      </button>
      {open && <FamilyPackDialog api={api} families={families} onClose={() => setOpen(false)} />}
    </>
  );
}

function FamilyPackDialog({ api, families, onClose }: { api: CustomizerApi; families: DesignFamily[]; onClose: () => void }) {
  const { format } = useCurrency();
  const [family, setFamily] = useState<DesignFamily | null>(families.length === 1 ? families[0] : null);
  const [members, setMembers] = useState<Member[]>(() => (families.length === 1 ? families[0].designs.map(memberOf) : []));
  const sizes = api.template?.sizes ?? [];
  const zone = api.packPlace?.zone;
  const unit = (api.template?.basePrice ?? 0) + (zone?.price ?? 0);

  const pick = (f: DesignFamily) => { setFamily(f); setMembers(f.designs.map(memberOf)); };
  const patch = (uid: string, p: Partial<Member>) => setMembers((list) => list.map((m) => (m.uid === uid ? { ...m, ...p } : m)));
  const missing = useMemo(() => members.filter((m) => !m.sizeId || (m.design.textFields ?? []).some((f) => !(m.values[f.key] ?? '').trim())), [members]);

  const submit = async () => {
    if (!members.length) return;
    if (missing.length) { toast.warning('Escribe el nombre y elige la talla de cada integrante'); return; }
    const done = await api.addFamilyPack(members.map((m) => ({ design: m.design, values: m.values, sizeId: m.sizeId! })));
    if (done) onClose();
  };

  return (
    <Dialog
      open onClose={onClose} size="xl"
      title={family ? family.name : 'Pack familiar'}
      description={family
        ? `Todas en ${api.color?.name?.toLowerCase() ?? 'el color elegido'}, con el diseño en ${zone?.name.toLowerCase() ?? 'el frente'}. Escribe el nombre y la talla de cada uno.`
        : 'Elige el diseño de la familia.'}
      footer={family ? (
        <>
          <Button variant="secondary" onClick={() => (families.length > 1 ? setFamily(null) : onClose())}>{families.length > 1 ? 'Otra familia' : 'Cancelar'}</Button>
          <Button onClick={submit} isLoading={api.saving} disabled={!members.length}>
            Agregar {members.length} {members.length === 1 ? 'prenda' : 'prendas'} · {format(unit * members.length)}
          </Button>
        </>
      ) : undefined}
    >
      {!family ? (
        families.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {families.map((f) => (
              <button key={f.id} type="button" onClick={() => pick(f)}
                className="rounded-xl border border-gray-200 p-3 text-left hover:border-app-400 hover:bg-app-50/40 transition-colors">
                <span className="flex -space-x-3 mb-2">
                  {f.designs.slice(0, 5).map((d) => (
                    <img key={d.id} src={assetUrl(d.thumbnailUrl)} alt="" className="w-14 h-14 rounded-lg bg-white ring-2 ring-white object-contain" />
                  ))}
                </span>
                <span className="block text-sm font-semibold text-gray-900">{f.name}</span>
                <span className="block text-xs text-gray-500">{f.designs.map((d) => d.familyRole || d.name).join(' · ')}</span>
              </button>
            ))}
          </div>
        ) : <EmptyState icon={Users} title="No hay familias de diseños" />
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const role = m.design.familyRole || m.design.name;
            return (
              <div key={m.uid} className="flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-xl border border-gray-200 p-2.5">
                <NamedPreview design={m.design} values={m.values} />
                <div className="flex-1 min-w-[12rem] space-y-1.5">
                  <p className="text-sm font-semibold text-gray-900">{role}</p>
                  {(m.design.textFields ?? []).map((f) => (
                    <label key={f.key} className="block">
                      <span className="sr-only">{f.label} de {role}</span>
                      <input
                        value={m.values[f.key] ?? ''} maxLength={f.maxLength} placeholder={f.label} aria-label={`${f.label} de ${role}`}
                        onChange={(e) => patch(m.uid, { values: { ...m.values, [f.key]: e.target.value } })}
                        className="w-full h-9 rounded-lg border border-gray-300 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-400"
                      />
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-1.5" role="radiogroup" aria-label={`Talla de ${role}`}>
                  {sizes.map((s) => (
                    <button key={s.id} type="button" role="radio" aria-checked={m.sizeId === s.id} title={s.name} onClick={() => patch(m.uid, { sizeId: s.id })}
                      className={`min-w-[2.4rem] h-9 px-2 rounded-lg border text-xs font-semibold ${m.sizeId === s.id ? 'border-app-600 bg-app-50 text-app-700' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}>
                      {s.abbreviation}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" title={`Otro: ${role}`} aria-label={`Agregar otro ${role}`}
                    onClick={() => setMembers((list) => { const i = list.findIndex((x) => x.uid === m.uid); const next = [...list]; next.splice(i + 1, 0, memberOf(m.design)); return next; })}
                    className="grid place-items-center w-8 h-8 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"><Plus className="w-4 h-4" /></button>
                  <button type="button" title={`Quitar: ${role}`} aria-label={`Quitar ${role}`} onClick={() => setMembers((list) => list.filter((x) => x.uid !== m.uid))}
                    className="grid place-items-center w-8 h-8 rounded-lg border border-gray-300 text-gray-600 hover:bg-red-50 hover:text-red-600"><Minus className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
          {!members.length && <p className="text-sm text-gray-500 py-4 text-center">Agrega al menos un integrante.</p>}
          {members.length > 0 && missing.length > 0 && (
            <p className="text-xs text-amber-700">Falta {missing.length === 1 ? '1 integrante' : `${missing.length} integrantes`} por completar (nombre y talla).</p>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {family.designs.map((d) => (
              <button key={d.id} type="button" onClick={() => setMembers((list) => [...list, memberOf(d)])}
                className="h-8 px-2.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-700 hover:border-app-400 hover:bg-app-50">
                + {d.familyRole || d.name}
              </button>
            ))}
            <Badge tone="gray" className="ml-auto">Cada prenda {format(unit)} aprox.</Badge>
          </div>
        </div>
      )}
      {api.saving && <div className="absolute inset-0 grid place-items-center bg-white/60"><Spinner label="Preparando las prendas…" /></div>}
    </Dialog>
  );
}
