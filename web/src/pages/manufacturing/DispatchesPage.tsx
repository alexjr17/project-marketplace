import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Truck, Eye } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgDispatch, MfgDispatchStatus } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, IconButton, FilterBar, SearchInput, SelectInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Badge, useConfirm, type Tone,
} from '../../components/ui';
import { matchText } from '../../components/manufacturing/mfgUi';

export const DES_STATUS_META: Record<MfgDispatchStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Borrador', tone: 'gray' },
  CONFIRMED: { label: 'Confirmado', tone: 'green' },
  CANCELLED: { label: 'Anulado', tone: 'red' },
};

export default function DispatchesPage() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [items, setItems] = useState<MfgDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getDispatches(status ? { status } : undefined)); }
    catch { toast.error('No se pudieron cargar los despachos'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  const remove = async (o: MfgDispatch) => {
    if (!(await confirm({ title: `¿Eliminar el despacho ${o.code}?`, message: 'No se puede deshacer.', tone: 'danger' }))) return;
    try { await manufacturingService.deleteDispatch(o.id); toast.success('Despacho eliminado'); load(); }
    catch (e: any) { toast.error(e?.message || 'No se pudo eliminar'); }
  };

  const rows = items.filter((o) => matchText(q, o.code, o.client?.name, o.purchaseOrder?.code));
  const open = (o: MfgDispatch) => navigate(`/manufacturing/dispatches/${o.id}`);

  return (
    <Page>
      <PageHeader
        icon={Truck}
        title="Despachos"
        subtitle="Entrega de producto terminado; descuenta el inventario por lote."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/manufacturing/dispatches/new')}>Nuevo despacho</Button>}
      />

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar despacho o cliente…" />
        <SelectInput value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          {(Object.keys(DES_STATUS_META) as MfgDispatchStatus[]).map((s) => <option key={s} value={s}>{DES_STATUS_META[s].label}</option>)}
        </SelectInput>
      </FilterBar>

      <TableCard>
        <Table>
          <THead><tr><Th>Despacho</Th><Th>Cliente</Th><Th>Pedido</Th><Th align="right">Líneas</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={6}>Cargando…</TableMessage>
              : rows.length === 0 ? <TableMessage colSpan={6}>{items.length || status ? 'Sin despachos para el filtro.' : 'Sin despachos. Crea el primero.'}</TableMessage>
              : rows.map((o) => (
                <Tr key={o.id} onClick={() => open(o)}>
                  <Td className="font-mono font-semibold text-gray-900 whitespace-nowrap">{o.code}</Td>
                  <Td className="text-gray-900">{o.client?.name ?? '—'}</Td>
                  <Td className="font-mono">{o.purchaseOrder?.code ?? '—'}</Td>
                  <Td align="right" className="tabular-nums">{o.items_count ?? o.items?.length ?? 0}</Td>
                  <Td align="center"><Badge tone={DES_STATUS_META[o.status].tone}>{DES_STATUS_META[o.status].label}</Badge></Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <IconButton title="Ver detalle" tone="app" onClick={() => open(o)}><Eye className="w-4 h-4" /></IconButton>
                      {o.status !== 'CONFIRMED' && <IconButton title="Eliminar" tone="danger" onClick={() => remove(o)}><Trash2 className="w-4 h-4" /></IconButton>}
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
