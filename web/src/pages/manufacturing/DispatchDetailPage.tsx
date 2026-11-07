import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, Ban, Truck } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgDispatch, MfgDispatchItem } from '../../types/manufacturing';
import { DES_STATUS_META } from './DispatchesPage';
import {
  Page, PageHeader, Button, Card, CardTitle, Badge, DescriptionList, Field, TextInput, DateInput, FormActions, Thumb, Spinner, EmptyState, useConfirm,
} from '../../components/ui';
import QtyMatrix from '../../components/manufacturing/QtyMatrix';

import { errorMessage } from '../../lib/http';
const TYPE_LABEL: Record<string, string> = { VENTA: 'Venta', CONSIGNACION: 'Consignación', TRASLADO: 'Traslado', MUESTRA: 'Muestra' };

export default function DispatchDetailPage() {
  const { id } = useParams();
  const ask = useConfirm();
  const dispatchId = Number(id);
  const [d, setD] = useState<MfgDispatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Remisión / facturación (editable).
  const [bill, setBill] = useState({ shipmentNumber: '', invoiceNumber: '', invoicedAt: '' });

  const load = async () => {
    setLoading(true);
    try {
      const dd = await manufacturingService.getDispatch(dispatchId);
      setD(dd);
      setBill({ shipmentNumber: dd.shipmentNumber ?? '', invoiceNumber: dd.invoiceNumber ?? '', invoicedAt: dd.invoicedAt ?? '' });
    }
    catch { toast.error('No se pudo cargar el despacho'); }
    finally { setLoading(false); }
  };

  const saveBilling = async () => {
    setBusy(true);
    try {
      const dd = await manufacturingService.updateDispatchBilling(dispatchId, {
        shipmentNumber: bill.shipmentNumber.trim() || null,
        invoiceNumber: bill.invoiceNumber.trim() || null,
        invoicedAt: bill.invoicedAt || null,
      });
      setD(dd); toast.success('Facturación guardada');
    } catch (e) { toast.error(errorMessage(e, 'No se pudo guardar')); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dispatchId]);

  const groups = useMemo(() => {
    if (!d) return [];
    const byRef = new Map<number, { ref: MfgDispatchItem['reference']; items: MfgDispatchItem[] }>();
    d.items.forEach((it) => {
      if (!byRef.has(it.referenceId)) byRef.set(it.referenceId, { ref: it.reference, items: [] });
      byRef.get(it.referenceId)!.items.push(it);
    });
    return [...byRef.values()].map(({ ref, items }) => {
      const colors = new Map<number, { name: string; hex: string }>();
      const sizes = new Map<number, { abbr: string; sort: number }>();
      const cell = new Map<string, number>();
      items.forEach((it) => {
        if (it.color) colors.set(it.colorId, { name: it.color.name, hex: it.color.hexCode });
        if (it.size) sizes.set(it.sizeId, { abbr: it.size.abbreviation, sort: it.size.sortOrder });
        cell.set(`${it.sizeId}-${it.colorId}`, it.quantity);
      });
      return {
        ref,
        S: [...sizes.entries()].sort((a, b) => a[1].sort - b[1].sort),
        C: [...colors.entries()],
        cell,
        total: items.reduce((t, it) => t + it.quantity, 0),
      };
    });
  }, [d]);

  const confirmDispatch = async () => {
    if (!(await ask({ title: '¿Confirmar el despacho?', message: 'Se descontará el inventario de producto terminado.', confirmText: 'Confirmar' }))) return;
    setBusy(true);
    try { setD(await manufacturingService.confirmDispatch(dispatchId)); toast.success('Despacho confirmado'); }
    catch (e) { toast.error(errorMessage(e, 'No se pudo confirmar')); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!(await ask({ title: '¿Anular el despacho?', message: 'Si estaba confirmado, se devuelve el inventario.', confirmText: 'Anular', tone: 'danger' }))) return;
    setBusy(true);
    try { setD(await manufacturingService.cancelDispatch(dispatchId)); toast.success('Despacho anulado'); }
    catch (e) { toast.error(errorMessage(e, 'No se pudo anular')); }
    finally { setBusy(false); }
  };

  if (loading) return <Page><Spinner label="Cargando…" /></Page>;
  if (!d) return <Page><PageHeader icon={Truck} title="Despacho" backTo="/manufacturing/dispatches" /><Card><EmptyState title="Despacho no encontrado" /></Card></Page>;

  const total = d.items.reduce((t, it) => t + it.quantity, 0);

  return (
    <Page>
      <PageHeader
        icon={Truck}
        backTo="/manufacturing/dispatches"
        title={<span className="inline-flex items-center gap-3"><span className="font-mono">{d.code}</span><Badge tone={DES_STATUS_META[d.status].tone}>{DES_STATUS_META[d.status].label}</Badge></span>}
        subtitle={d.client?.name ?? 'Sin cliente'}
        actions={<>
          {d.status !== 'CANCELLED' && (
            <Button variant={d.status === 'CONFIRMED' ? 'danger' : 'secondary'} icon={<Ban className="w-4 h-4" />} disabled={busy} onClick={cancel}>
              {d.status === 'CONFIRMED' ? 'Anular (devolver stock)' : 'Anular'}
            </Button>
          )}
          {d.status === 'DRAFT' && <Button variant="success" icon={<Check className="w-4 h-4" />} isLoading={busy} onClick={confirmDispatch}>Confirmar despacho</Button>}
        </>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardTitle>Datos del despacho</CardTitle>
            <DescriptionList cols={3} items={[
              { label: 'Tipo', value: TYPE_LABEL[d.type] ?? d.type },
              { label: 'Bodega', value: d.warehouse?.name },
              { label: 'Pedido', value: d.purchaseOrder ? <Link to={`/manufacturing/purchase-orders/${d.purchaseOrderId}`} className="font-mono text-app-700 hover:underline">{d.purchaseOrder.code}</Link> : null },
              { label: 'Total', value: <span className="tabular-nums">{total.toLocaleString('es-CO')} und</span> },
              ...(d.notes ? [{ label: 'Notas', value: d.notes, full: true }] : []),
            ]} />
          </Card>

          {groups.map((g) => (
            <Card key={g.ref?.id}>
              <div className="flex items-center gap-3 mb-4">
                <Thumb src={g.ref?.imagePath} alt={g.ref?.name} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate"><span className="font-mono text-gray-500 mr-1">{g.ref?.code}</span>{g.ref?.name}</p>
                  <p className="text-xs text-gray-500 tabular-nums">{g.total.toLocaleString('es-CO')} und</p>
                </div>
              </div>
              <QtyMatrix
                totals
                sizes={g.S.map(([sid, s]) => ({ id: sid, label: s.abbr }))}
                colors={g.C.map(([cid, c]) => ({ id: cid, name: c.name, hex: c.hex }))}
                get={(sid, cid) => g.cell.get(`${sid}-${cid}`) ?? 0}
              />
            </Card>
          ))}
        </div>

        {d.status !== 'CANCELLED' && (
          <Card>
            <CardTitle>Remisión y facturación</CardTitle>
            <div className="space-y-4">
              <Field label="N° remisión"><TextInput value={bill.shipmentNumber} onChange={(e) => setBill({ ...bill, shipmentNumber: e.target.value })} /></Field>
              <Field label="N° factura"><TextInput value={bill.invoiceNumber} onChange={(e) => setBill({ ...bill, invoiceNumber: e.target.value })} /></Field>
              <Field label="Fecha de facturación"><DateInput value={bill.invoicedAt} onChange={(e) => setBill({ ...bill, invoicedAt: e.target.value })} /></Field>
            </div>
            <FormActions><Button variant="outline" isLoading={busy} onClick={saveBilling}>Guardar facturación</Button></FormActions>
          </Card>
        )}
      </div>
    </Page>
  );
}
