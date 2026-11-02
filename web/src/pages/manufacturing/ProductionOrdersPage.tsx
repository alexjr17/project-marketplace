import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ClipboardList, Eye } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgProductionOrder, MfgOrderStatus } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, IconButton, FilterBar, SearchInput, SelectInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Badge, Thumb, useConfirm, type Tone,
} from '../../components/ui';
import { MarketBadge, matchText } from '../../components/manufacturing/mfgUi';

export const STATUS_META: Record<MfgOrderStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Borrador', tone: 'gray' },
  PROGRAMMED: { label: 'Programada', tone: 'blue' },
  IN_PROCESS: { label: 'En proceso', tone: 'yellow' },
  COMPLETED: { label: 'Completada', tone: 'green' },
  CANCELLED: { label: 'Cancelada', tone: 'red' },
};

export default function ProductionOrdersPage() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [items, setItems] = useState<MfgProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getProductionOrders(status ? { status } : undefined)); }
    catch { toast.error('No se pudieron cargar las órdenes'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  const remove = async (o: MfgProductionOrder) => {
    if (!(await confirm({ title: `¿Eliminar la orden ${o.code}?`, message: 'Se borran sus líneas y etapas. No se puede deshacer.', tone: 'danger' }))) return;
    try { await manufacturingService.deleteProductionOrder(o.id); toast.success('Orden eliminada'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  const rows = items.filter((o) => matchText(q, o.code, o.internalCode, o.reference?.code, o.reference?.name));
  const goNew = () => navigate('/manufacturing/orders/new');

  return (
    <Page>
      <PageHeader
        icon={ClipboardList}
        title="Órdenes de producción"
        subtitle="Crea órdenes y sigue su avance por etapas."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={goNew}>Nueva orden</Button>}
      />

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por orden o referencia…" />
        <SelectInput value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          {(Object.keys(STATUS_META) as MfgOrderStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </SelectInput>
      </FilterBar>

      <TableCard>
        <Table>
          <THead><tr><Th>Orden</Th><Th>Referencia</Th><Th align="center">Mercado</Th><Th>Entrega estimada</Th><Th align="right">Líneas</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={7}>Cargando…</TableMessage>
              : rows.length === 0 ? <TableMessage colSpan={7}>{items.length || status ? 'Sin órdenes para el filtro.' : 'Sin órdenes. Crea la primera.'}</TableMessage>
              : rows.map((o) => (
                <Tr key={o.id} onClick={() => navigate(`/manufacturing/orders/${o.id}`)}>
                  <Td className="whitespace-nowrap">
                    <span className="font-mono font-semibold text-gray-900">{o.code}</span>
                    {o.internalCode && <span className="block text-xs text-gray-400">{o.internalCode}</span>}
                  </Td>
                  <Td>
                    {o.reference ? (
                      <span className="flex items-center gap-3 min-w-0">
                        <Thumb src={o.reference.imagePath} size="sm" />
                        <span className="min-w-0"><span className="block font-mono text-xs text-gray-500">{o.reference.code}</span><span className="block truncate text-gray-900">{o.reference.name}</span></span>
                      </span>
                    ) : '—'}
                  </Td>
                  <Td align="center"><MarketBadge market={o.market} /></Td>
                  <Td className="whitespace-nowrap">{o.estimatedDeliveryAt?.slice(0, 10) ?? '—'}</Td>
                  <Td align="right" className="tabular-nums">{o.items_count ?? o.items?.length ?? 0}</Td>
                  <Td align="center"><Badge tone={STATUS_META[o.status].tone}>{STATUS_META[o.status].label}</Badge></Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <IconButton title="Ver detalle" tone="app" onClick={() => navigate(`/manufacturing/orders/${o.id}`)}><Eye className="w-4 h-4" /></IconButton>
                      <IconButton title="Eliminar" tone="danger" onClick={() => remove(o)}><Trash2 className="w-4 h-4" /></IconButton>
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
