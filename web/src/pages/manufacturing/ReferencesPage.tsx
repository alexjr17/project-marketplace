import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Shirt, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgReference } from '../../types/manufacturing';

export default function ReferencesPage() {
  const [items, setItems] = useState<MfgReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async (term?: string) => {
    setLoading(true);
    try { setItems(await manufacturingService.getReferences(term)); }
    catch { toast.error('No se pudieron cargar las referencias'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Búsqueda con debounce simple.
  useEffect(() => {
    const t = setTimeout(() => load(search.trim() || undefined), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const remove = async (r: MfgReference) => {
    if (!confirm(`¿Eliminar la referencia "${r.code} — ${r.name}"?\nSe borrará también su ficha técnica.`)) return;
    try { await manufacturingService.deleteReference(r.id); toast.success('Referencia eliminada'); load(search.trim() || undefined); }
    catch { toast.error('No se pudo eliminar'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><Shirt className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Referencias</h1>
            <p className="text-sm text-gray-500">Modelos que se producen, con su ficha técnica (colores, tallas y materiales).</p>
          </div>
        </div>
        <Link to="/manufacturing/references/new" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> Nueva referencia
        </Link>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código o nombre…" className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Colores</th>
              <th className="px-4 py-3 font-medium">Tallas</th>
              <th className="px-4 py-3 font-medium">Materiales</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Sin referencias. Crea la primera.</td></tr>
            ) : items.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-gray-700">{r.code}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-3 text-gray-600">{r.garmentType?.name || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {r.colors.slice(0, 5).map((c) => (
                      <span key={c.id} title={c.color?.name} className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: c.color?.hexCode }} />
                    ))}
                    {r.colors.length > 5 && <span className="text-xs text-gray-400">+{r.colors.length - 5}</span>}
                    {r.colors.length === 0 && <span className="text-gray-400">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{r.sizes.map((s) => s.size?.abbreviation).filter(Boolean).join(', ') || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{r.materials.length}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/manufacturing/references/${r.id}`} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Pencil className="w-4 h-4" /></Link>
                    <button onClick={() => remove(r)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
