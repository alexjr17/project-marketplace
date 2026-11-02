import { useState, useEffect, useCallback } from 'react';
import * as posService from '../../services/pos.service';
import type { ProductSearchResult } from '../../services/pos.service';
import CustomerSelect, { type SelectedCustomer } from './CustomerSelect';
import { Plus, Minus, Trash2, Loader2, Save } from 'lucide-react';
import { Alert, Button, Dialog, Field, IconButton, SearchInput, SelectInput, Spinner, TextArea } from '../ui';

interface EditItem {
  variantId: number;
  name: string;
  price: number;
  quantity: number;
}

interface Props {
  saleId: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditSaleModal({ saleId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [items, setItems] = useState<EditItem[]>([]);
  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'mixed' | 'debe'>('cash');
  const [notes, setNotes] = useState('');

  // Buscador para agregar productos
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const sale: any = await posService.getSaleDetail(saleId);
        setItems((sale.items || []).map((it: any) => ({
          variantId: it.variantId,
          name: it.productName || it.product?.name || 'Producto',
          price: Number(it.unitPrice) || 0,
          quantity: it.quantity || 1,
        })));
        if (sale.posCustomer) {
          setCustomer({ id: sale.posCustomer.id, name: sale.posCustomer.name, phone: sale.posCustomer.phone, cedula: sale.posCustomer.cedula });
        } else if (sale.customerName && sale.customerName !== 'Cliente POS') {
          setCustomer({ name: sale.customerName, phone: sale.customerPhone });
        }
        const pm = sale.paymentMethod;
        setPaymentMethod(['cash', 'transfer', 'mixed', 'debe'].includes(pm) ? pm : 'cash');
        setNotes(sale.notes || '');
      } catch (e: any) {
        setError(e?.response?.data?.message || 'No se pudo cargar la venta');
      } finally {
        setLoading(false);
      }
    })();
  }, [saleId]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 1) { setResults([]); return; }
    setSearching(true);
    try {
      const data = await posService.browseProducts(1, 20, q.trim());
      setResults((data.results || []).filter((r: any) => r.type === 'product') as ProductSearchResult[]);
    } catch { setResults([]); } finally { setSearching(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  const addProduct = (p: ProductSearchResult) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.variantId === p.variantId);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], quantity: copy[i].quantity + 1 };
        return copy;
      }
      return [...prev, { variantId: p.variantId, name: p.name, price: p.price, quantity: 1 }];
    });
    setQuery('');
    setResults([]);
  };

  const setQty = (variantId: number, qty: number) => {
    if (qty <= 0) { setItems((prev) => prev.filter((x) => x.variantId !== variantId)); return; }
    setItems((prev) => prev.map((x) => (x.variantId === variantId ? { ...x, quantity: qty } : x)));
  };

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const money = (n: number) => `$${(n || 0).toLocaleString()}`;

  const handleSave = async () => {
    if (items.length === 0) { setError('La venta debe tener al menos un producto'); return; }
    setSaving(true);
    setError('');
    try {
      await posService.updateSale(saleId, {
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, price: i.price })),
        customerId: customer?.id,
        customerName: customer && !customer.id ? customer.name : undefined,
        customerPhone: customer?.phone || undefined,
        customerCedula: customer?.cedula || undefined,
        paymentMethod,
        notes,
      });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo guardar la venta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Editar venta"
      description="Cambia productos, cliente, método de pago o notas"
      footer={!loading && (
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="lg" icon={<Save className="w-4 h-4" />} onClick={handleSave} isLoading={saving} disabled={items.length === 0}>Guardar</Button>
        </>
      )}
    >
      {loading ? (
        <Spinner label="Cargando venta…" />
      ) : (
        <div className="space-y-5">
          {error && <Alert tone="error">{error}</Alert>}

          {/* Productos */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Productos</p>
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
              {items.map((it) => (
                <div key={it.variantId} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{it.name}</p>
                    <p className="text-xs text-gray-500">{money(it.price)} c/u</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <QtyButton title="Restar" onClick={() => setQty(it.variantId, it.quantity - 1)}><Minus className="w-4 h-4" /></QtyButton>
                    <span className="w-7 text-center text-sm font-semibold text-gray-900">{it.quantity}</span>
                    <QtyButton title="Sumar" onClick={() => setQty(it.variantId, it.quantity + 1)}><Plus className="w-4 h-4" /></QtyButton>
                    <span className="w-20 text-right text-sm font-semibold text-gray-900">{money(it.price * it.quantity)}</span>
                    <IconButton title="Quitar" tone="danger" onClick={() => setQty(it.variantId, 0)}><Trash2 className="w-4 h-4" /></IconButton>
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="text-sm text-gray-400 px-3 py-4 text-center">Sin productos.</p>}
            </div>

            {/* Agregar producto */}
            <div className="relative mt-2">
              <SearchInput value={query} onChange={setQuery} placeholder="Agregar producto…" />
              {(searching || results.length > 0) && query && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                  {searching && <div className="px-3 py-2 text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Buscando…</div>}
                  {!searching && results.map((p) => (
                    <button key={p.variantId} onClick={() => addProduct(p)} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex justify-between gap-3">
                      <span className="text-sm text-gray-900 truncate">{p.name}</span>
                      <span className="text-sm font-semibold text-gray-700">{money(p.price)}</span>
                    </button>
                  ))}
                  {!searching && results.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">Sin resultados</div>}
                </div>
              )}
            </div>
          </div>

          <Field label="Cliente">
            <CustomerSelect value={customer} onChange={setCustomer} />
          </Field>

          <Field label="Método de pago">
            <SelectInput value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="mixed">Mixto</option>
              <option value="debe">Debe (fiado)</option>
            </SelectInput>
          </Field>

          <Field label="Notas">
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Observaciones…" />
          </Field>

          <div className="flex justify-between items-center pt-3 border-t border-gray-200">
            <span className="text-sm text-gray-600">Total</span>
            <span className="text-xl font-bold text-gray-900">{money(total)}</span>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Botón +/- de cantidad (objetivo táctil de 36px). */
function QtyButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
      {children}
    </button>
  );
}
