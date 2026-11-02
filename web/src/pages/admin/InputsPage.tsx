import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Boxes, AlertTriangle, DollarSign } from 'lucide-react';
import { inputsService, type Input, type InputFilters } from '../../services/inputs.service';
import { inputTypesService, type InputType } from '../../services/input-types.service';
import {
  Page, PageHeader, Button, IconButton, StatCard, Badge, FilterBar, SearchInput, SelectInput, Checkbox, Alert,
  TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, type Tone,
} from '../../components/ui';

/** Costo unitario: hasta 2 decimales (los insumos se miden en metros, kilos…). */
const unitMoney = (n: number | string) => '$' + Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 });
const money = (n: number | string) => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO');
const qty = (n: number | string) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 });

export default function InputsPage() {
  const navigate = useNavigate();
  const [inputs, setInputs] = useState<Input[]>([]);
  const [inputTypes, setInputTypes] = useState<InputType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<InputFilters>({
    inputTypeId: undefined,
    search: '',
    lowStock: false,
  });

  useEffect(() => {
    loadInputTypes();
  }, []);

  useEffect(() => {
    loadInputs();
  }, [filters]);

  const loadInputTypes = async () => {
    try {
      const data = await inputTypesService.getAll();
      const validData = Array.isArray(data) ? data : [];
      setInputTypes(validData.filter((t) => t.isActive));
    } catch (err) {
      setInputTypes([]);
      console.error('Error al cargar tipos de insumo:', err);
    }
  };

  const loadInputs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await inputsService.getAll(filters);
      setInputs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Error al cargar los insumos');
      setInputs([]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (input: Input): { tone: Tone; label: string } => {
    if (Number(input.currentStock) <= Number(input.minStock)) return { tone: 'red', label: 'Stock bajo' };
    if (input.maxStock && Number(input.currentStock) >= Number(input.maxStock)) return { tone: 'yellow', label: 'Stock alto' };
    return { tone: 'green', label: 'Stock OK' };
  };

  const lowStockCount = inputs.filter((i) => Number(i.currentStock) <= Number(i.minStock)).length;
  const stockValue = inputs.reduce((sum, i) => sum + Number(i.currentStock || 0) * Number(i.unitCost || 0), 0);
  const hasFilters = !!filters.inputTypeId || !!filters.search || !!filters.lowStock;
  const pending = loading && inputs.length === 0;
  const open = (input: Input) => navigate(`/admin-panel/inputs/${input.id}`);

  return (
    <Page>
      <PageHeader
        icon={Boxes}
        title="Insumos"
        subtitle="Materiales del inventario y su stock"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/admin-panel/inputs/new')}>Nuevo insumo</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Boxes} label="Insumos" value={pending ? '—' : inputs.length.toLocaleString('es-CO')} hint={hasFilters ? 'Según los filtros' : undefined} />
        <StatCard
          icon={AlertTriangle}
          tone={lowStockCount > 0 ? 'yellow' : 'gray'}
          label="Stock bajo"
          value={pending ? '—' : lowStockCount.toLocaleString('es-CO')}
          hint={pending ? undefined : lowStockCount > 0 ? 'Por debajo del mínimo' : 'Todo en orden'}
          hintTone={lowStockCount > 0 ? 'yellow' : 'gray'}
        />
        <StatCard icon={DollarSign} tone="green" label="Valor en stock" value={pending ? '—' : money(stockValue)} />
      </div>

      <FilterBar>
        <SearchInput value={filters.search || ''} onChange={(v) => setFilters({ ...filters, search: v })} placeholder="Buscar por nombre…" />
        <SelectInput
          aria-label="Tipo de insumo"
          value={filters.inputTypeId || ''}
          onChange={(e) => setFilters({ ...filters, inputTypeId: e.target.value ? parseInt(e.target.value) : undefined })}
        >
          <option value="">Todos los tipos</option>
          {inputTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </SelectInput>
        <div className="flex items-center h-10">
          <Checkbox label="Solo stock bajo" checked={!!filters.lowStock} onChange={(e) => setFilters({ ...filters, lowStock: e.target.checked })} />
        </div>
      </FilterBar>

      {error && <Alert tone="error">{error}</Alert>}

      <TableCard>
        <Table>
          <THead>
            <tr>
              <Th>Insumo</Th>
              <Th>Tipo</Th>
              <Th align="right">Stock actual</Th>
              <Th align="right">Mín. / máx.</Th>
              <Th align="right">Costo unit.</Th>
              <Th align="center">Estado</Th>
              <Th align="right">Acciones</Th>
            </tr>
          </THead>
          <TBody>
            {loading && inputs.length === 0 ? (
              <TableMessage colSpan={7}>Cargando insumos…</TableMessage>
            ) : inputs.length === 0 ? (
              <TableMessage colSpan={7}>{hasFilters ? 'Ningún insumo coincide con los filtros.' : 'No hay insumos registrados.'}</TableMessage>
            ) : (
              inputs.map((input) => {
                const status = getStockStatus(input);
                return (
                  <Tr key={input.id} onClick={() => open(input)}>
                    <Td className="min-w-[200px]">
                      <p className="font-medium text-gray-900">{input.name}</p>
                      {input.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{input.description}</p>}
                    </Td>
                    <Td className="whitespace-nowrap">{input.inputType?.name || '—'}</Td>
                    <Td align="right" className="whitespace-nowrap font-semibold text-gray-900 tabular-nums">
                      {qty(input.currentStock)} <span className="font-normal text-gray-500">{input.unitOfMeasure}</span>
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-gray-500 tabular-nums">{qty(input.minStock)} / {input.maxStock ? qty(input.maxStock) : '∞'}</Td>
                    <Td align="right" className="whitespace-nowrap tabular-nums">{unitMoney(input.unitCost)}</Td>
                    <Td align="center"><Badge tone={status.tone}>{status.label}</Badge></Td>
                    <Td align="right">
                      <IconButton title="Editar" tone="app" onClick={(e) => { e.stopPropagation(); open(input); }}>
                        <Pencil className="w-4 h-4" />
                      </IconButton>
                    </Td>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </TableCard>
    </Page>
  );
}
