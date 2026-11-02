import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Shirt } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgReference } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, IconButton, FilterBar, SearchInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Thumb, useConfirm,
} from '../../components/ui';
import { ActiveBadge } from '../../components/manufacturing/mfgUi';

export default function ReferencesPage() {
  const confirm = useConfirm();
  const navigate = useNavigate();
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
    if (!(await confirm({ title: `¿Eliminar la referencia "${r.code} — ${r.name}"?`, message: 'Se borrará también su ficha técnica.', tone: 'danger' }))) return;
    try { await manufacturingService.deleteReference(r.id); toast.success('Referencia eliminada'); load(search.trim() || undefined); }
    catch { toast.error('No se pudo eliminar'); }
  };

  const edit = (r: MfgReference) => navigate(`/manufacturing/references/${r.id}`);

  return (
    <Page>
      <PageHeader
        icon={Shirt}
        title="Referencias"
        subtitle="Modelos que se producen, con su ficha técnica (colores, tallas y materiales)."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/manufacturing/references/new')}>Nueva referencia</Button>}
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por código o nombre…" />
      </FilterBar>

      <TableCard>
        <Table>
          <THead><tr><Th>Referencia</Th><Th>Tipo</Th><Th>Colores</Th><Th>Tallas</Th><Th align="right">Materiales</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={7}>Cargando…</TableMessage>
              : items.length === 0 ? <TableMessage colSpan={7}>{search ? 'Sin resultados para la búsqueda.' : 'Sin referencias. Crea la primera.'}</TableMessage>
              : items.map((r) => (
                <Tr key={r.id} onClick={() => edit(r)}>
                  <Td>
                    <span className="flex items-center gap-3 min-w-0">
                      <Thumb src={r.imagePath} alt={r.name} size="sm" />
                      <span className="min-w-0"><span className="block font-mono text-xs text-gray-500">{r.code}</span><span className="block truncate font-medium text-gray-900">{r.name}</span></span>
                    </span>
                  </Td>
                  <Td>{r.garmentType?.name || '—'}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      {r.colors.slice(0, 5).map((c) => (
                        <span key={c.id} title={c.color?.name} className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: c.color?.hexCode }} />
                      ))}
                      {r.colors.length > 5 && <span className="text-xs text-gray-400">+{r.colors.length - 5}</span>}
                      {r.colors.length === 0 && <span className="text-gray-400">—</span>}
                    </div>
                  </Td>
                  <Td className="text-gray-600">{r.sizes.map((s) => s.size?.abbreviation).filter(Boolean).join(', ') || '—'}</Td>
                  <Td align="right" className="tabular-nums">{r.materials.length}</Td>
                  <Td align="center"><ActiveBadge active={r.isActive} female /></Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <IconButton title="Editar" tone="app" onClick={() => edit(r)}><Pencil className="w-4 h-4" /></IconButton>
                      <IconButton title="Eliminar" tone="danger" onClick={() => remove(r)}><Trash2 className="w-4 h-4" /></IconButton>
                    </div>
                  </Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>
    </Page>
  );
}
