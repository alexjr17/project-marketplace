import { useState, useEffect } from 'react';
import { errorMessage } from '../../lib/http';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Plus, PackageX, DollarSign } from 'lucide-react';
import {
  Page, PageHeader, Button, StatCard, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, toast,
} from '../../components/ui';
import * as returnsService from '../../services/purchase-returns.service';
import type { PurchaseReturn, PurchaseReturnStats } from '../../services/purchase-returns.service';

const money = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO');
const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-CO');

export default function PurchaseReturnsPage() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [stats, setStats] = useState<PurchaseReturnStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([returnsService.getReturns(), returnsService.getStats()]);
      setReturns(list);
      setStats(st);
    } catch (error) {
      toast.error(errorMessage(error, 'Error al cargar devoluciones'));
    } finally {
      setLoading(false);
    }
  };

  const create = () => navigate('/admin-panel/purchase-returns/new');

  return (
    <Page>
      <PageHeader
        icon={RotateCcw}
        title="Devoluciones de compra"
        subtitle="Devuelve al proveedor el stock recibido en una orden de compra"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={create}>Nueva devolución</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={PackageX} label="Devoluciones" value={(stats?.total ?? 0).toLocaleString('es-CO')} />
        <StatCard icon={DollarSign} tone="green" label="Valor devuelto" value={money(stats?.totalValue ?? 0)} />
      </div>

      <TableCard>
        <Table>
          <THead>
            <tr>
              <Th>Devolución</Th>
              <Th>Orden de compra</Th>
              <Th>Proveedor</Th>
              <Th>Motivo</Th>
              <Th align="right">Total</Th>
              <Th align="right">Fecha</Th>
            </tr>
          </THead>
          <TBody>
            {loading ? (
              <TableMessage colSpan={6}>Cargando devoluciones…</TableMessage>
            ) : returns.length === 0 ? (
              <TableMessage colSpan={6}>
                <span className="flex flex-col items-center gap-3">
                  <span>No hay devoluciones registradas.</span>
                  <Button size="sm" variant="outline" icon={<Plus className="w-4 h-4" />} onClick={create}>Nueva devolución</Button>
                </span>
              </TableMessage>
            ) : (
              returns.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-mono font-medium text-gray-900 whitespace-nowrap">{r.returnNumber}</Td>
                  <Td className="whitespace-nowrap">
                    {r.purchaseOrder ? (
                      <button type="button" onClick={() => navigate(`/admin-panel/purchase-orders/${r.purchaseOrderId}`)} className="font-mono text-app-700 hover:underline">
                        {r.purchaseOrder.orderNumber}
                      </button>
                    ) : '—'}
                  </Td>
                  <Td>{r.supplier?.name ?? '—'}</Td>
                  <Td className="text-gray-600 max-w-xs truncate" title={r.reason}>{r.reason}</Td>
                  <Td align="right" className="font-medium text-gray-900 whitespace-nowrap tabular-nums">{money(r.total)}</Td>
                  <Td align="right" className="text-gray-600 whitespace-nowrap">{fmtDate(r.createdAt)}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableCard>
    </Page>
  );
}
