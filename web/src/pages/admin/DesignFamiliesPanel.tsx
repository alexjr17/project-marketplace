/**
 * Admin → Imágenes de diseño → Familias: grupos de diseños que van juntos (Papá, Mamá, Hijo…) para el
 * pack familiar del personalizador. Cada diseño lleva su rol y el orden en que aparece.
 */
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import {
  Badge, Button, Dialog, EmptyState, Field, FormGrid, IconButton, SearchInput, Spinner, Switch, TextInput, toast, useConfirm,
} from '../../components/ui';
import { errorMessage } from '../../lib/http';
import { designFamiliesService, type DesignFamily, type DesignImage } from '../../services/design-images.service';
import { assetUrl } from '../../utils/assetUrl';

type Member = { id: number; role: string };
const ROLES = ['Papá', 'Mamá', 'Hijo', 'Hija', 'Bebé', 'Abuelo', 'Abuela', 'Mascota'];

export function DesignFamiliesPanel({ designs, seasons, onChanged }: { designs: DesignImage[]; seasons: string[]; onChanged: () => void }) {
  const confirm = useConfirm();
  const [families, setFamilies] = useState<DesignFamily[] | null>(null);
  const [editing, setEditing] = useState<DesignFamily | 'new' | null>(null);

  const load = () => designFamiliesService.adminList().then(setFamilies).catch((e) => { setFamilies([]); toast.error(errorMessage(e, 'No se pudieron cargar las familias')); });
  useEffect(() => { void load(); }, []);

  const remove = async (f: DesignFamily) => {
    if (!(await confirm({ title: `¿Eliminar la familia "${f.name}"?`, message: 'Los diseños se quedan en la galería, sin familia.', tone: 'danger' }))) return;
    try {
      await designFamiliesService.remove(f.id);
      toast.success('Familia eliminada');
      void load();
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo eliminar'));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Grupos de diseños para el pack familiar: el cliente elige la familia y pone el nombre y la talla de cada uno.</p>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>Nueva familia</Button>
      </div>
      {families === null ? <Spinner label="Cargando familias…" /> : !families.length ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState icon={Users} title="Aún no hay familias" description="Crea una con los diseños de Papá, Mamá, Hijo… (por ejemplo, la de Navidad)."
            action={<Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>Nueva familia</Button>} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {families.map((f) => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex -space-x-3 mb-2">
                {f.designs.slice(0, 6).map((d) => <img key={d.id} src={assetUrl(d.thumbnailUrl)} alt="" className="w-12 h-12 rounded-lg bg-gray-50 ring-2 ring-white object-contain" />)}
              </div>
              <div className="flex items-start gap-1">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{f.name}</p>
                  <p className="text-xs text-gray-500 truncate">{f.designs.map((d) => d.familyRole || d.name).join(' · ') || 'Sin diseños'}</p>
                  <div className="mt-1 flex gap-1">
                    {f.season && <Badge tone="app">{f.season}</Badge>}
                    {!f.isActive && <Badge>Inactiva</Badge>}
                  </div>
                </div>
                <IconButton title="Editar" tone="app" className="!p-1.5" onClick={() => setEditing(f)}><Pencil className="w-4 h-4" /></IconButton>
                <IconButton title="Eliminar" tone="danger" className="!p-1.5" onClick={() => remove(f)}><Trash2 className="w-4 h-4" /></IconButton>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <FamilyDialog family={editing === 'new' ? null : editing} designs={designs} seasons={seasons}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); onChanged(); }} />
      )}
    </div>
  );
}

function FamilyDialog({ family, designs, seasons, onClose, onSaved }: {
  family: DesignFamily | null; designs: DesignImage[]; seasons: string[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(family?.name ?? '');
  const [season, setSeason] = useState(family?.season ?? 'navidad');
  const [active, setActive] = useState(family?.isActive ?? true);
  const [members, setMembers] = useState<Member[]>(family?.designs.map((d) => ({ id: d.id, role: d.familyRole ?? '' })) ?? []);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const byId = new Map(designs.map((d) => [d.id, d]));
  const chosen = new Set(members.map((m) => m.id));
  // Primero los que llevan nombre y los de la temporada.
  const options = designs
    .filter((d) => !chosen.has(d.id) && (!q.trim() || d.name.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => Number(!!b.textFields?.length) - Number(!!a.textFields?.length) || Number(b.season === season) - Number(a.season === season));

  const move = (i: number, d: number) => setMembers((l) => { const n = [...l]; const [x] = n.splice(i, 1); n.splice(Math.max(0, Math.min(n.length, i + d)), 0, x); return n; });

  const save = async () => {
    if (!name.trim()) { toast.error('Ponle un nombre a la familia'); return; }
    setSaving(true);
    try {
      const data = { name: name.trim(), season: season.trim() || null, isActive: active, designs: members.map((m) => ({ id: m.id, role: m.role.trim() || null })) };
      if (family) await designFamiliesService.update(family.id, data);
      else await designFamiliesService.create(data);
      toast.success('Familia guardada');
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo guardar la familia'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} size="xl" title={family ? 'Editar familia' : 'Nueva familia'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save} isLoading={saving}>Guardar</Button></>}>
      <div className="space-y-4">
        <FormGrid>
          <Field label="Nombre" required htmlFor="fam-name"><TextInput id="fam-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Familia Reno navideña" maxLength={120} /></Field>
          <Field label="Temporada" htmlFor="fam-season">
            <TextInput id="fam-season" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="navidad" list="fam-seasons" />
            <datalist id="fam-seasons">{[...new Set(['navidad', ...seasons])].map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
        </FormGrid>
        <Switch checked={active} onChange={setActive} label="Activa" description="Solo las familias activas salen en el personalizador." />

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Integrantes ({members.length})</p>
          {!members.length && <p className="text-sm text-gray-500">Elige abajo los diseños de la familia.</p>}
          <ul className="space-y-1.5">
            {members.map((m, i) => {
              const d = byId.get(m.id);
              return (
                <li key={m.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-1.5">
                  {d && <img src={assetUrl(d.thumbnailUrl)} alt="" className="w-10 h-10 rounded bg-gray-50 object-contain" />}
                  <span className="min-w-0 flex-1 text-sm text-gray-900 truncate">{d?.name ?? `#${m.id}`}{d && !d.textFields?.length && <span className="ml-1 text-xs text-amber-700">(sin nombre editable)</span>}</span>
                  <input value={m.role} list="fam-roles" placeholder="Rol (Papá…)" aria-label={`Rol de ${d?.name ?? m.id}`} maxLength={40}
                    onChange={(e) => setMembers((l) => l.map((x) => (x.id === m.id ? { ...x, role: e.target.value } : x)))}
                    className="w-32 h-8 rounded-lg border border-gray-300 px-2 text-sm" />
                  <IconButton title="Subir" className="!p-1.5" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="w-4 h-4" /></IconButton>
                  <IconButton title="Bajar" className="!p-1.5" disabled={i === members.length - 1} onClick={() => move(i, 1)}><ArrowDown className="w-4 h-4" /></IconButton>
                  <IconButton title="Quitar de la familia" tone="danger" className="!p-1.5" onClick={() => setMembers((l) => l.filter((x) => x.id !== m.id))}><X className="w-4 h-4" /></IconButton>
                </li>
              );
            })}
          </ul>
          <datalist id="fam-roles">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-gray-700">Agregar diseños</p>
            <SearchInput value={q} onChange={setQ} placeholder="Buscar diseño…" className="w-56" />
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
            {options.map((d) => (
              <button key={d.id} type="button" title={d.name} onClick={() => setMembers((l) => [...l, { id: d.id, role: d.familyRole ?? ROLES[l.length] ?? '' }])}
                className="relative aspect-square rounded-lg border border-gray-200 bg-gray-50 p-1 hover:border-app-400">
                <img src={assetUrl(d.thumbnailUrl)} alt={d.name} className="w-full h-full object-contain" loading="lazy" />
                {!!d.textFields?.length && <span className="absolute bottom-0.5 left-0.5 right-0.5 rounded bg-white/90 text-[9px] font-semibold text-app-700 truncate">Con nombre</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
