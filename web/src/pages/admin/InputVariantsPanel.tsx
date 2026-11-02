import { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Grid3X3, Palette, Plus, RefreshCw, Ruler, X } from 'lucide-react';
import { Badge, Card, CardTitle, Drawer, EmptyState, IconButton, Spinner, type Tone } from '../../components/ui';
import { inputsService, type Input, type InputVariant, type InputVariantMovement } from '../../services/inputs.service';
type Size = { id: number; name: string; abbreviation: string };

const MOVEMENT_TYPES: Record<string, { label: string; tone: Tone; icon: 'in' | 'out' | 'adjust' }> = {
  ENTRADA: { label: 'Entrada', tone: 'green', icon: 'in' },
  SALIDA: { label: 'Salida', tone: 'red', icon: 'out' },
  AJUSTE: { label: 'Ajuste', tone: 'yellow', icon: 'adjust' },
  RESERVA: { label: 'Reserva', tone: 'blue', icon: 'out' },
  LIBERACION: { label: 'Liberación', tone: 'blue', icon: 'in' },
  DEVOLUCION: { label: 'Devolución', tone: 'blue', icon: 'in' },
  MERMA: { label: 'Merma', tone: 'gray', icon: 'out' },
};
const movementInfo = (type: string) => MOVEMENT_TYPES[type] || { label: type, tone: 'gray' as Tone, icon: 'adjust' as const };

const chip = 'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-gray-300 bg-white text-xs text-gray-700 hover:border-app-400 hover:text-app-700 disabled:opacity-50';

/** Pestaña Variantes del insumo: colores, tallas, matriz de stock y movimientos por variante. */
export function InputVariantsPanel({ input, sizes, availableColors, availableSizes, savingColor, savingSize, onAddColor, onRemoveColor, onAddSize, onRemoveSize }: {
  input: Input;
  /** Tallas de las columnas de la matriz. */
  sizes: Size[];
  /** Colores que aún no tiene el insumo. */
  availableColors: { id: number; name: string; hexCode: string }[];
  /** Tallas del tipo que aún no tiene el insumo. */
  availableSizes: Size[];
  savingColor: boolean;
  savingSize: boolean;
  onAddColor: (colorId: number) => void;
  onRemoveColor: (colorId: number) => void;
  onAddSize: (sizeId: number) => void;
  onRemoveSize: (sizeId: number) => void;
}) {
  const [selectedVariant, setSelectedVariant] = useState<InputVariant | null>(null);
  const [movements, setMovements] = useState<InputVariantMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const getVariant = (colorId: number, sizeId: number) => input.variants?.find((v) => v.colorId === colorId && v.sizeId === sizeId);
  const totalStock = (input.variants || []).reduce((sum, v) => sum + Number(v.currentStock), 0);

  const loadVariantMovements = async (variant: InputVariant) => {
    setSelectedVariant(variant);
    setLoadingMovements(true);
    try {
      const data = await inputsService.getVariantMovements(variant.id, 20);
      setMovements(data);
    } catch (err) {
      console.error('Error loading movements:', err);
      setMovements([]);
    } finally {
      setLoadingMovements(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      {/* Matriz de stock */}
      <Card className="lg:col-span-2 min-w-0">
        <CardTitle icon={Grid3X3} actions={<span className="text-sm text-gray-500 tabular-nums">Total {totalStock.toLocaleString('es-CO')} {input.unitOfMeasure}</span>}>
          Stock por variante
        </CardTitle>
        {input.variants && input.variants.length > 0 ? (
          <>
            <div className="overflow-x-auto -mx-4 md:-mx-5">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y border-gray-200">
                  <tr>
                    <th className="px-4 md:px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Color</th>
                    {sizes.map((size) => (
                      <th key={size.id} className="px-2 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{size.abbreviation}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {input.inputColors?.map((ic) => (
                    <tr key={ic.id}>
                      <td className="px-4 md:px-5 py-2 whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full border border-gray-300" style={{ backgroundColor: ic.color.hexCode }} />
                          <span className="text-gray-800">{ic.color.name}</span>
                        </span>
                      </td>
                      {sizes.map((size) => {
                        const variant = getVariant(ic.colorId, size.id);
                        const stock = variant ? Number(variant.currentStock) : 0;
                        const isSelected = !!variant && selectedVariant?.id === variant.id;
                        return (
                          <td key={size.id} className="px-2 py-2 text-center">
                            <button
                              type="button"
                              disabled={!variant}
                              onClick={() => variant && loadVariantMovements(variant)}
                              title={variant ? 'Ver movimientos' : 'Sin variante'}
                              className={`min-w-[40px] h-7 px-2 rounded-md text-xs font-semibold tabular-nums transition-colors ${
                                isSelected ? 'ring-2 ring-app-500 bg-app-50 text-app-700'
                                  : stock > 0 ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {stock}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-3">El stock se actualiza al recibir órdenes de compra. Toca una celda para ver sus movimientos.</p>
          </>
        ) : (
          <EmptyState icon={Grid3X3} title="Sin variantes" description="Agrega colores y tallas para generar las variantes." />
        )}
      </Card>

      <div className="space-y-5">
        {/* Colores */}
        <Card>
          <CardTitle icon={Palette}>Colores</CardTitle>
          {input.inputColors && input.inputColors.length > 0 ? (
            <ul className="divide-y divide-gray-100 -my-1 mb-3">
              {input.inputColors.map((ic) => (
                <li key={ic.id} className="flex items-center justify-between py-1.5">
                  <span className="flex items-center gap-2 text-sm text-gray-800">
                    <span className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: ic.color.hexCode }} />
                    {ic.color.name}
                  </span>
                  <IconButton title="Quitar color" tone="danger" disabled={savingColor} onClick={() => onRemoveColor(ic.colorId)}><X className="w-4 h-4" /></IconButton>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-400 mb-3">Sin colores asignados</p>}
          {availableColors.length > 0 && (
            <>
              <p className="text-xs font-medium text-gray-500 mb-2">Agregar color</p>
              <div className="flex flex-wrap gap-1.5">
                {availableColors.map((color) => (
                  <button key={color.id} type="button" disabled={savingColor} onClick={() => onAddColor(color.id)} className={chip}>
                    <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: color.hexCode }} />
                    {color.name}
                    <Plus className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Tallas */}
        <Card>
          <CardTitle icon={Ruler}>Tallas</CardTitle>
          {input.inputSizes && input.inputSizes.length > 0 ? (
            <ul className="divide-y divide-gray-100 -my-1 mb-3">
              {input.inputSizes.map((is) => (
                <li key={is.id} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-800">{is.size.name} <span className="text-xs text-gray-500">({is.size.abbreviation})</span></span>
                  <IconButton title="Quitar talla" tone="danger" disabled={savingSize} onClick={() => onRemoveSize(is.sizeId)}><X className="w-4 h-4" /></IconButton>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-400 mb-3">Sin tallas asignadas</p>}
          {availableSizes.length > 0 && (
            <>
              <p className="text-xs font-medium text-gray-500 mb-2">Agregar talla</p>
              <div className="flex flex-wrap gap-1.5">
                {availableSizes.map((size) => (
                  <button key={size.id} type="button" disabled={savingSize} onClick={() => onAddSize(size.id)} className={chip}>
                    {size.name}
                    <Plus className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Movimientos de la variante */}
      <Drawer
        open={!!selectedVariant}
        onClose={() => setSelectedVariant(null)}
        title="Movimientos"
        description={selectedVariant ? `${selectedVariant.color?.name || 'Sin color'} · ${selectedVariant.size?.abbreviation || 'Sin talla'} · stock ${Number(selectedVariant.currentStock)}` : undefined}
      >
        {loadingMovements ? (
          <Spinner label="Cargando movimientos…" />
        ) : movements.length === 0 ? (
          <EmptyState title="Sin movimientos registrados" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {movements.map((mov) => {
              const info = movementInfo(mov.movementType);
              const q = Number(mov.quantity);
              return (
                <li key={mov.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5">
                    {info.icon === 'in' && <ArrowDownCircle className="w-4 h-4 text-green-600" />}
                    {info.icon === 'out' && <ArrowUpCircle className="w-4 h-4 text-red-600" />}
                    {info.icon === 'adjust' && <RefreshCw className="w-4 h-4 text-amber-600" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={info.tone}>{info.label}</Badge>
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">{q > 0 ? '+' : ''}{q}</span>
                    </div>
                    {mov.reason && <p className="text-sm text-gray-600 mt-1 truncate" title={mov.reason}>{mov.reason}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(mov.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Stock</p>
                    <p className="text-sm font-medium text-gray-900 tabular-nums">{Number(mov.newStock)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Drawer>
    </div>
  );
}
