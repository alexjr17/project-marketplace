import { useState, useEffect, useCallback } from 'react';
import * as posService from '../../services/pos.service';
import type { ProductSearchResult } from '../../services/pos.service';
import CustomerSelect, { type SelectedCustomer } from './CustomerSelect';
import { X, Plus, Minus, Trash2, Search, Loader2, Save } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">Editar venta</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center text-gray-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : (
          <div className="p-5 space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

            {/* Productos */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Productos</h3>
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.variantId} className="flex items-center justify-between gap-2 border border-gray-100 rounded-lg p-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{it.name}</p>
                      <p className="text-xs text-gray-500">{money(it.price)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => setQty(it.variantId, it.quantity - 1)} className="p-1 rounded border border-gray-300 hover:bg-gray-100"><Minus className="w-3.5 h-3.5" /></button>
                      <span className="w-7 text-center text-sm font-medium">{it.quantity}</span>
                      <button onClick={() => setQty(it.variantId, it.quantity + 1)} className="p-1 rounded border border-gray-300 hover:bg-gray-100"><Plus className="w-3.5 h-3.5" /></button>
                      <span className="w-16 text-right text-sm font-semibold">{money(it.price * it.quantity)}</span>
                      <button onClick={() => setQty(it.variantId, 0)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <p className="text-sm text-gray-400 py-2">Sin productos.</p>}
              </div>

              {/* Agregar producto */}
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Agregar producto..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                {(searching || results.length > 0) && query && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {searching && <div className="px-3 py-2 text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Buscando...</div>}
                    {!searching && results.map((p) => (
                      <button key={p.variantId} onClick={() => addProduct(p)} className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0 flex justify-between">
                        <span className="text-sm text-gray-900 truncate">{p.name}</span>
                        <span className="text-sm font-semibold text-gray-700">{money(p.price)}</span>
                      </button>
                    ))}
                    {!searching && results.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">Sin resultados</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Cliente */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Cliente</h3>
              <CustomerSelect value={customer} onChange={setCustomer} />
            </div>

            {/* Método de pago */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Método de pago</h3>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="mixed">Mixto</option>
                <option value="debe">Debe (fiado)</option>
              </select>
            </div>

            {/* Notas */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Notas</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Observaciones..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-gray-600">Total:</span>
              <span className="text-xl font-bold text-gray-900">{money(total)}</span>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} disabled={saving} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancelar</button>
              <button onClick={handleSave} disabled={saving || items.length === 0} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
