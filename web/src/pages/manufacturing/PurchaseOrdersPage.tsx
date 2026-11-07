import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ShoppingCart, Eye } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgPurchaseOrder, MfgPurchaseStatus } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, IconButton, FilterBar, SearchInput, SelectInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Badge, useConfirm, type Tone,
} from '../../components/ui';
import { MarketBadge, matchText } from '../../components/manufacturing/mfgUi';

import { errorMessage } from '../../lib/http';
export const PED_STATUS_META: Record<MfgPurchaseStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Borrador', tone: 'gray' },
  APPROVED: { label: 'Aprobado', tone: 'blue' },
  IN_PRODUCTION: { label: 'En producción', tone: 'yellow' },
  DELIVERED: { label: 'Entregado', tone: 'green' },
  CANCELLED: { label: 'Cancelado', tone: 'red' },
};

export default function PurchaseOrdersPage() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [items, setItems] = useState<MfgPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getPurchaseOrders(status ? { status } : undefined)); }
    catch { toast.error('No se pudieron cargar los pedidos'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  const remove = async (o: MfgPurchaseOrder) => {
    if (!(await confirm({ title: `¿Eliminar el pedido ${o.code}?`, message: 'No se puede deshacer.', tone: 'danger' }))) return;
    try { await manufacturingService.deletePurchaseOrder(o.id); toast.success('Pedido eliminado'); load(); }
    catch (e) { toast.error(errorMessage(e, 'No se pudo eliminar')); }
  };

  const rows = items.filter((o) => matchText(q, o.code, o.client?.name, o.collection?.name));
  const open = (o: MfgPurchaseOrder) => navigate(`/manufacturing/purchase-orders/${o.id}`);

  return (
    <Page>
      <PageHeader
        icon={ShoppingCart}
        title="Pedidos"
        subtitle="Pedidos de clientes. Desde un pedido se genera la producción."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/manufacturing/purchase-orders/new')}>Nuevo pedido</Button>}
      />

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar pedido o cliente…" />
        <SelectInput value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          {(Object.keys(PED_STATUS_META) as MfgPurchaseStatus[]).map((s) => <option key={s} value={s}>{PED_STATUS_META[s].label}</option>)}
        </SelectInput>
      </FilterBar>

      <TableCard>
        <Table>
          <THead><tr><Th>Pedido</Th><Th>Cliente</Th><Th>Colección</Th><Th align="center">Mercado</Th><Th>Entrega</Th><Th align="right">Líneas</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={8}>Cargando…</TableMessage>
              : rows.length === 0 ? <TableMessage colSpan={8}>{items.length || status ? 'Sin pedidos para el filtro.' : 'Sin pedidos. Crea el primero.'}</TableMessage>
              : rows.map((o) => (
                <Tr key={o.id} onClick={() => open(o)}>
                  <Td className="font-mono font-semibold text-gray-900 whitespace-nowrap">{o.code}</Td>
                  <Td className="text-gray-900">{o.client?.name ?? '—'}</Td>
                  <Td>{o.collection?.name ?? '—'}</Td>
                  <Td align="center"><MarketBadge market={o.market} /></Td>
                  <Td className="whitespace-nowrap">{o.deliveryDate?.slice(0, 10) ?? '—'}</Td>
                  <Td align="right" className="tabular-nums">{o.items_count ?? o.items?.length ?? 0}</Td>
                  <Td align="center"><Badge tone={PED_STATUS_META[o.status].tone}>{PED_STATUS_META[o.status].label}</Badge></Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <IconButton title="Ver detalle" tone="app" onClick={() => open(o)}><Eye className="w-4 h-4" /></IconButton>
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
