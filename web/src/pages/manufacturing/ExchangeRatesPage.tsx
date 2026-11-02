import { useEffect, useState } from 'react';
import { Plus, Trash2, DollarSign, CheckCircle2 } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgExchangeRate } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, IconButton, Card, CardTitle, StatCard, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Field, MoneyInput, DateInput, Badge, useConfirm,
} from '../../components/ui';

const money = (n: number) => '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 2 });

export default function ExchangeRatesPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<MfgExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [rate, setRate] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getExchangeRates()); }
    catch { toast.error('No se pudo cargar la tasa de cambio'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (rate === '' || Number(rate) <= 0) { toast.error('Ingresa la tasa (COP por USD)'); return; }
    setSaving(true);
    try {
      await manufacturingService.createExchangeRate({ rate: Number(rate), effectiveDate: date || null });
      toast.success('Tasa registrada'); setRate(''); setDate(''); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (r: MfgExchangeRate) => {
    if (!(await confirm({ title: '¿Eliminar esta tasa?', message: `${money(Number(r.rate))} por USD${r.effectiveDate ? ` del ${r.effectiveDate}` : ''}.`, tone: 'danger' }))) return;
    try { await manufacturingService.deleteExchangeRate(r.id); toast.success('Tasa eliminada'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  const current = items.find((r) => r.isActive);

  return (
    <Page>
      <PageHeader icon={DollarSign} title="Tasa de cambio" subtitle="COP por USD. La activa se usa para los precios de exportación." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <StatCard
          icon={CheckCircle2}
          tone={current ? 'green' : 'yellow'}
          label="Tasa activa"
          value={current ? money(Number(current.rate)) : 'Sin tasa'}
          hint={current ? (current.effectiveDate ? `Vigente desde ${current.effectiveDate}` : 'COP por 1 USD') : 'Registra una para calcular precios en USD'}
        />
        <Card className="lg:col-span-2">
          <CardTitle>Registrar nueva tasa</CardTitle>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <Field label="Tasa (COP por 1 USD)" required className="sm:w-56">
              <MoneyInput value={rate} onChange={(e) => setRate(e.target.value)} placeholder="4000" onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
            </Field>
            <Field label="Fecha" className="sm:w-48"><DateInput value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Button icon={<Plus className="w-4 h-4" />} isLoading={saving} onClick={save}>Registrar tasa</Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">La nueva tasa queda activa y la anterior pasa a histórica.</p>
        </Card>
      </div>

      <TableCard>
        <Table>
          <THead><tr><Th align="right">Tasa (COP/USD)</Th><Th>Fecha</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={4}>Cargando…</TableMessage>
              : items.length === 0 ? <TableMessage colSpan={4}>Sin tasas. Registra la primera.</TableMessage>
              : items.map((r) => (
                <Tr key={r.id}>
                  <Td align="right" className="font-semibold text-gray-900 tabular-nums">{money(Number(r.rate))}</Td>
                  <Td>{r.effectiveDate ?? '—'}</Td>
                  <Td align="center"><Badge tone={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'Activa' : 'Histórica'}</Badge></Td>
                  <Td align="right"><IconButton title="Eliminar" tone="danger" onClick={() => remove(r)}><Trash2 className="w-4 h-4" /></IconButton></Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>
    </Page>
  );
}
