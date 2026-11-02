import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Boxes, Check, Save, Trash2 } from 'lucide-react';
import { inputsService, type CreateInputDto, type UpdateInputDto, type Input } from '../../services/inputs.service';
import { inputTypesService, type InputType } from '../../services/input-types.service';
import { catalogsService, type Color } from '../../services/catalogs.service';
import {
  Page, PageHeader, Button, Badge, Card, CardTitle, Field, TextInput, TextArea, SelectInput, NumberInput, MoneyInput,
  FormGrid, FormActions, Alert, Spinner, Tabs, useConfirm, toast,
} from '../../components/ui';
import { InputVariantsPanel } from './InputVariantsPanel';

const LIST = '/admin-panel/inputs';

const UNITS: [string, string][] = [
  ['unidad', 'Unidad'], ['metro', 'Metro'], ['centimetro', 'Centímetro'], ['litro', 'Litro'], ['mililitro', 'Mililitro'],
  ['kilogramo', 'Kilogramo'], ['gramo', 'Gramo'], ['rollo', 'Rollo'], ['hoja', 'Hoja'], ['pliego', 'Pliego'],
  ['caja', 'Caja'], ['paquete', 'Paquete'], ['par', 'Par'], ['docena', 'Docena'],
];

type FieldErrors = Partial<Record<'code' | 'name' | 'inputTypeId' | 'unitOfMeasure' | 'colorIds' | 'sizeIds', string>>;

export default function InputDetailPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { id } = useParams<{ id: string }>();
  const isEditing = id !== 'new';

  const [inputTypes, setInputTypes] = useState<InputType[]>([]);
  const [availableColors, setAvailableColors] = useState<Color[]>([]);
  const [currentInput, setCurrentInput] = useState<Input | null>(null);
  const [selectedInputType, setSelectedInputType] = useState<InputType | null>(null);
  const [tab, setTab] = useState<'data' | 'variants'>('data');

  const [formData, setFormData] = useState<CreateInputDto>({
    code: '',
    inputTypeId: 0,
    name: '',
    description: '',
    unitOfMeasure: 'unidad',
    minStock: 0,
    maxStock: undefined,
    unitCost: 0,
    supplier: '',
    supplierCode: '',
    notes: '',
    colorIds: [],
    sizeIds: [],
  });

  const [loading, setLoading] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
  const [savingSize, setSavingSize] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    loadInitialData();
  }, [id]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [typesData, colorsData] = await Promise.all([
        inputTypesService.getAll(),
        catalogsService.getColors(),
      ]);

      const validTypes = Array.isArray(typesData) ? typesData.filter((t) => t.isActive) : [];
      setInputTypes(validTypes);
      setAvailableColors(colorsData.filter((c) => c.isActive));

      if (isEditing) {
        const data = await inputsService.getById(parseInt(id!));
        setCurrentInput(data);
        setFormData({
          code: data.code,
          inputTypeId: data.inputTypeId,
          name: data.name,
          description: data.description || '',
          unitOfMeasure: data.unitOfMeasure,
          minStock: Number(data.minStock),
          maxStock: data.maxStock ? Number(data.maxStock) : undefined,
          unitCost: Number(data.unitCost),
          supplier: data.supplier || '',
          supplierCode: data.supplierCode || '',
          notes: data.notes || '',
          colorIds: data.inputColors?.map((ic) => ic.colorId) || [],
        });

        const inputType = validTypes.find((t) => t.id === data.inputTypeId);
        setSelectedInputType(inputType || null);
      }
    } catch (err) {
      setError('Error al cargar datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fail = (field: keyof FieldErrors, msg: string) => {
    setErrors({ [field]: msg });
    setTab('data');
    toast.error(msg);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!formData.code.trim()) return fail('code', 'El código es requerido');
    if (!formData.name.trim()) return fail('name', 'El nombre es requerido');
    if (!formData.inputTypeId || formData.inputTypeId === 0) return fail('inputTypeId', 'Debe seleccionar un tipo de insumo');
    if (!formData.unitOfMeasure.trim()) return fail('unitOfMeasure', 'La unidad de medida es requerida');

    // Si el tipo tiene variantes y es nuevo, debe seleccionar al menos un color y una talla
    if (!isEditing && selectedInputType?.hasVariants) {
      if (!formData.colorIds || formData.colorIds.length === 0) return fail('colorIds', 'Debe seleccionar al menos un color para insumos con variantes');
      if (!formData.sizeIds || formData.sizeIds.length === 0) return fail('sizeIds', 'Debe seleccionar al menos una talla para insumos con variantes');
    }
    setErrors({});

    try {
      setLoading(true);
      setError(null);

      if (isEditing) {
        const updateData: UpdateInputDto = {
          code: formData.code,
          inputTypeId: formData.inputTypeId,
          name: formData.name,
          description: formData.description || undefined,
          unitOfMeasure: formData.unitOfMeasure,
          minStock: formData.minStock,
          maxStock: formData.maxStock,
          unitCost: formData.unitCost,
          supplier: formData.supplier || undefined,
          supplierCode: formData.supplierCode || undefined,
          notes: formData.notes || undefined,
        };
        await inputsService.update(parseInt(id!), updateData);
      } else {
        await inputsService.create(formData);
      }

      toast.success('Insumo guardado correctamente');
      navigate(LIST);
    } catch (err) {
      setError('Error al guardar el insumo');
      toast.error('No se pudo guardar el insumo');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({ title: '¿Eliminar este insumo?', message: 'No se puede deshacer.', tone: 'danger' });
    if (!ok) return;

    try {
      setLoading(true);
      await inputsService.delete(parseInt(id!));
      toast.success('Insumo eliminado');
      navigate(LIST);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al eliminar el insumo';
      setError(msg);
      toast.error(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /** Cambio de un campo numérico: vacío → 0 (o undefined para el máximo). */
  const setNumber = (name: 'minStock' | 'maxStock' | 'unitCost', value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value === '' ? (name === 'maxStock' ? undefined : 0) : Number(value) }));
  };

  const setInputType = (value: string) => {
    const typeId = parseInt(value);
    setSelectedInputType(inputTypes.find((t) => t.id === typeId) || null);
    setFormData((prev) => ({ ...prev, inputTypeId: value === '' ? 0 : Number(value) }));
  };

  const toggleColor = (colorId: number) => {
    setFormData((prev) => ({
      ...prev,
      colorIds: prev.colorIds?.includes(colorId) ? prev.colorIds.filter((cid) => cid !== colorId) : [...(prev.colorIds || []), colorId],
    }));
  };

  const toggleSize = (sizeId: number) => {
    setFormData((prev) => ({
      ...prev,
      sizeIds: prev.sizeIds?.includes(sizeId) ? prev.sizeIds.filter((sid) => sid !== sizeId) : [...(prev.sizeIds || []), sizeId],
    }));
  };

  const handleAddColor = async (colorId: number) => {
    if (!currentInput) return;
    try {
      setSavingColor(true);
      const updated = await inputsService.addColor(currentInput.id, colorId);
      setCurrentInput(updated);
      toast.success('Color agregado');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al agregar color');
    } finally {
      setSavingColor(false);
    }
  };

  const handleRemoveColor = async (colorId: number) => {
    if (!currentInput) return;
    const ok = await confirm({
      title: '¿Quitar este color?',
      message: 'Se eliminarán las variantes asociadas si no tienen stock.',
      tone: 'danger',
      confirmText: 'Quitar',
    });
    if (!ok) return;
    try {
      setSavingColor(true);
      const updated = await inputsService.removeColor(currentInput.id, colorId);
      setCurrentInput(updated);
      toast.success('Color eliminado');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al eliminar color');
    } finally {
      setSavingColor(false);
    }
  };

  const handleAddSize = async (sizeId: number) => {
    if (!currentInput) return;
    try {
      setSavingSize(true);
      const updated = await inputsService.addSize(currentInput.id, sizeId);
      setCurrentInput(updated);
      toast.success('Talla agregada');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al agregar talla');
    } finally {
      setSavingSize(false);
    }
  };

  const handleRemoveSize = async (sizeId: number) => {
    if (!currentInput) return;
    const ok = await confirm({
      title: '¿Quitar esta talla?',
      message: 'Se eliminarán las variantes asociadas si no tienen stock.',
      tone: 'danger',
      confirmText: 'Quitar',
    });
    if (!ok) return;
    try {
      setSavingSize(true);
      const updated = await inputsService.removeSize(currentInput.id, sizeId);
      setCurrentInput(updated);
      toast.success('Talla eliminada');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al eliminar talla');
    } finally {
      setSavingSize(false);
    }
  };

  // Colores aún no asignados
  const assignedColorIds = currentInput?.inputColors?.map((ic) => ic.colorId) || [];
  const colorsToAdd = availableColors.filter((c) => !assignedColorIds.includes(c.id));

  // Tallas del tipo aún no asignadas
  const assignedSizeIds = currentInput?.inputSizes?.map((is) => is.sizeId) || [];
  const typeSizes = selectedInputType?.inputTypeSizes?.map((its) => its.size) || currentInput?.inputType?.inputTypeSizes?.map((its) => its.size) || [];
  const sizesToAdd = typeSizes.filter((s) => !assignedSizeIds.includes(s.id));

  // Tallas de la matriz: las del insumo; al crear, las del tipo
  const sizes = currentInput?.inputSizes && currentInput.inputSizes.length > 0 ? currentInput.inputSizes.map((is) => is.size) : typeSizes;

  if (loading && isEditing && !currentInput) {
    return <Page><Spinner label="Cargando insumo…" /></Page>;
  }

  const hasVariants = selectedInputType?.hasVariants || currentInput?.inputType?.hasVariants;
  const showVariantsTab = isEditing && !!hasVariants && !!currentInput;
  const colorCount = formData.colorIds?.length || 0;
  const sizeCount = formData.sizeIds?.length || 0;

  const pill = (on: boolean) =>
    `inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm transition-colors ${on ? 'border-app-500 bg-app-50 text-app-700 font-medium' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}`;

  return (
    <Page>
      <PageHeader
        icon={Boxes}
        backTo={LIST}
        title={isEditing ? (currentInput?.name || 'Insumo') : 'Nuevo insumo'}
        subtitle={
          isEditing && currentInput
            ? <span className="inline-flex flex-wrap items-center gap-2"><span className="font-mono">{currentInput.code}</span>· {currentInput.inputType?.name}{hasVariants && <Badge tone="blue">Con variantes</Badge>}</span>
            : 'Crea un insumo para el inventario'
        }
      />

      {error && <Alert tone="error">{error}</Alert>}

      {showVariantsTab && (
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'data', label: 'Datos' },
            { value: 'variants', label: 'Variantes y stock', count: currentInput?.variants?.length ?? 0 },
          ]}
        />
      )}

      {showVariantsTab && tab === 'variants' && currentInput ? (
        <InputVariantsPanel
          input={currentInput}
          sizes={sizes}
          availableColors={colorsToAdd}
          availableSizes={sizesToAdd}
          savingColor={savingColor}
          savingSize={savingSize}
          onAddColor={handleAddColor}
          onRemoveColor={handleRemoveColor}
          onAddSize={handleAddSize}
          onRemoveSize={handleRemoveSize}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Card>
            <CardTitle>Identificación</CardTitle>
            <FormGrid cols={2}>
              <Field label="Código" required error={errors.code}>
                <TextInput value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="Ej: CAM-BASE-001" error={!!errors.code} />
              </Field>
              <Field label="Tipo de insumo" required error={errors.inputTypeId} hint={isEditing ? 'El tipo no se puede cambiar.' : undefined}>
                <SelectInput value={formData.inputTypeId} onChange={(e) => setInputType(e.target.value)} disabled={isEditing} error={!!errors.inputTypeId}>
                  <option value={0}>Seleccionar tipo…</option>
                  {inputTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name} {type.hasVariants ? '(con variantes)' : ''}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Nombre" required error={errors.name} className="md:col-span-2">
                <TextInput value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Camiseta cuello redondo, Tinta sublimación" error={!!errors.name} />
              </Field>
              <Field label="Descripción" className="md:col-span-2">
                <TextArea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Características del insumo…" />
              </Field>
            </FormGrid>
          </Card>

          <Card>
            <CardTitle>Costo y stock</CardTitle>
            <FormGrid cols={4}>
              <Field label="Unidad de medida" required error={errors.unitOfMeasure}>
                <SelectInput value={formData.unitOfMeasure} onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}>
                  {UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </SelectInput>
              </Field>
              <Field label="Costo unitario" required>
                <MoneyInput value={formData.unitCost} onChange={(e) => setNumber('unitCost', e.target.value)} />
              </Field>
              <Field label="Stock mínimo" hint="Por debajo se marca stock bajo.">
                <NumberInput min="0" step="0.01" value={formData.minStock} onChange={(e) => setNumber('minStock', e.target.value)} suffix={formData.unitOfMeasure} />
              </Field>
              <Field label="Stock máximo" hint="Opcional.">
                <NumberInput min="0" step="0.01" value={formData.maxStock || ''} onChange={(e) => setNumber('maxStock', e.target.value)} suffix={formData.unitOfMeasure} />
              </Field>
            </FormGrid>
          </Card>

          {/* Colores y tallas para un insumo nuevo con variantes */}
          {!isEditing && hasVariants && (
            <Card>
              <CardTitle>Colores y tallas</CardTitle>
              <div className="space-y-5">
                <Field label="Colores" required error={errors.colorIds} hint={`${colorCount} seleccionado${colorCount !== 1 ? 's' : ''}`}>
                  {availableColors.length === 0 ? (
                    <p className="text-sm text-gray-400">No hay colores disponibles</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableColors.map((color) => {
                        const on = formData.colorIds?.includes(color.id) || false;
                        return (
                          <button key={color.id} type="button" aria-pressed={on} onClick={() => toggleColor(color.id)} className={pill(on)}>
                            <span className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: color.hexCode }} />
                            {color.name}
                            {on && <Check className="w-3.5 h-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Field>
                <Field label="Tallas" required error={errors.sizeIds} hint={`${sizeCount} seleccionada${sizeCount !== 1 ? 's' : ''} · salen del tipo de insumo`}>
                  {sizes.length === 0 ? (
                    <p className="text-sm text-gray-400">El tipo de insumo no tiene tallas asignadas</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((size) => {
                        const on = formData.sizeIds?.includes(size.id) || false;
                        return (
                          <button key={size.id} type="button" aria-pressed={on} title={size.name} onClick={() => toggleSize(size.id)} className={pill(on)}>
                            {on && <Check className="w-3.5 h-3.5" />}
                            {size.abbreviation}
                            <span className={`text-xs ${on ? 'text-app-600' : 'text-gray-400'}`}>{size.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Field>
                {colorCount > 0 && sizeCount > 0 && (
                  <Alert tone="info">
                    Se crearán <b>{colorCount * sizeCount} variantes</b> automáticamente ({colorCount} colores × {sizeCount} tallas).
                  </Alert>
                )}
              </div>
            </Card>
          )}

          <FormActions sticky>
            {isEditing && (
              <Button variant="ghost" className="sm:mr-auto text-red-600 hover:bg-red-50 hover:text-red-700" icon={<Trash2 className="w-4 h-4" />} onClick={handleDelete} disabled={loading}>
                Eliminar
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate(LIST)}>Cancelar</Button>
            <Button type="submit" icon={<Save className="w-4 h-4" />} isLoading={loading}>Guardar</Button>
          </FormActions>
        </form>
      )}
    </Page>
  );
}
