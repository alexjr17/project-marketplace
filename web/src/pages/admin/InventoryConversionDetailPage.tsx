import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRightLeft, Trash2, Send, CheckCircle, XCircle, Plus, Package, Boxes, X, Calendar, DollarSign } from 'lucide-react';
import {
  Page, PageHeader, Button, IconButton, Badge, Card, StatCard, DescriptionList, Alert, Spinner, EmptyState,
  TableCard, Table, THead, TBody, Th, Tr, Td, useConfirm, toast,
} from '../../components/ui';
import { inventoryConversionsService, type InventoryConversion } from '../../services/inventory-conversions.service';
import { inputsService } from '../../services/inputs.service';
import { getVariants, type ProductVariant } from '../../services/variants.service';
import { CONVERSION_STATUS, formatCOP } from './InventoryConversionShared';
import { AddInputDialog, AddOutputDialog, variantLabel, type InputBase, type InputVariantOption } from './InventoryConversionAddDialogs';
import { errorMessage } from '../../lib/http';

const LIST = '/admin-panel/inventory-conversions';
const qty = (n: number) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 });

export default function InventoryConversionDetailPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { id } = useParams<{ id: string }>();

  const [conversion, setConversion] = useState<InventoryConversion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Opciones de los selectores
  const [inputOptions, setInputOptions] = useState<InputBase[]>([]);
  const [variantOptions, setVariantOptions] = useState<ProductVariant[]>([]);

  const [showAddInputModal, setShowAddInputModal] = useState(false);
  const [showAddOutputModal, setShowAddOutputModal] = useState(false);

  // Formularios para agregar ítems
  const [inputSearch, setInputSearch] = useState('');
  const [outputSearch, setOutputSearch] = useState('');
  const [selectedInputBase, setSelectedInputBase] = useState<InputBase | null>(null);
  const [selectedInputVariant, setSelectedInputVariant] = useState<InputVariantOption | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [inputQuantity, setInputQuantity] = useState<number>(1);
  const [outputQuantity, setOutputQuantity] = useState<number>(1);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id || isNaN(Number(id))) {
      toast.error('ID de conversión inválido');
      navigate(LIST);
      return;
    }

    try {
      setLoading(true);
      const [inputsData, variantsData] = await Promise.all([inputsService.getAll({}), getVariants()]);

      setInputOptions(
        inputsData.map((input) => ({
          id: input.id,
          code: input.code,
          name: input.name,
          unitOfMeasure: input.unitOfMeasure,
          hasVariants: input.inputType?.hasVariants || false,
          variants: input.variants || [],
        }))
      );
      setVariantOptions(variantsData);

      const conversionData = await inventoryConversionsService.getConversionById(Number(id));
      setConversion(conversionData);
    } catch {
      toast.error('Error al cargar datos');
      navigate(LIST);
    } finally {
      setLoading(false);
    }
  };

  const closeAddInput = () => {
    setShowAddInputModal(false);
    setSelectedInputBase(null);
    setSelectedInputVariant(null);
    setInputSearch('');
    setInputQuantity(1);
  };

  const closeAddOutput = () => {
    setShowAddOutputModal(false);
    setSelectedVariant(null);
    setOutputSearch('');
    setOutputQuantity(1);
  };

  const handleAddInput = async () => {
    if (!conversion || !selectedInputVariant) {
      toast.error('Selecciona una variante de insumo');
      return;
    }
    if (inputQuantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }
    if (inputQuantity > selectedInputVariant.currentStock) {
      toast.error(`Stock insuficiente. Disponible: ${selectedInputVariant.currentStock}`);
      return;
    }

    try {
      setSaving(true);
      const updated = await inventoryConversionsService.addInputItem(conversion.id, {
        inputVariantId: selectedInputVariant.id,
        quantity: inputQuantity,
      });
      setConversion(updated);
      closeAddInput();
      toast.success('Insumo agregado');
    } catch (error) {
      toast.error(errorMessage(error, 'Error al agregar insumo'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveInput = async (itemId: number) => {
    if (!conversion) return;
    try {
      const updated = await inventoryConversionsService.removeInputItem(conversion.id, itemId);
      setConversion(updated);
      toast.success('Insumo eliminado');
    } catch (error) {
      toast.error(errorMessage(error, 'Error al eliminar'));
    }
  };

  const handleAddOutput = async () => {
    if (!conversion || !selectedVariant) return;
    if (outputQuantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    try {
      setSaving(true);
      const updated = await inventoryConversionsService.addOutputItem(conversion.id, {
        variantId: selectedVariant.id,
        quantity: outputQuantity,
      });
      setConversion(updated);
      closeAddOutput();
      toast.success('Producto agregado');
    } catch (error) {
      toast.error(errorMessage(error, 'Error al agregar producto'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOutput = async (itemId: number) => {
    if (!conversion) return;
    try {
      const updated = await inventoryConversionsService.removeOutputItem(conversion.id, itemId);
      setConversion(updated);
      toast.success('Producto eliminado');
    } catch (error) {
      toast.error(errorMessage(error, 'Error al eliminar'));
    }
  };

  const handleSubmit = async () => {
    if (!conversion) return;
    try {
      setSaving(true);
      const updated = await inventoryConversionsService.submitForApproval(conversion.id);
      setConversion(updated);
      toast.success('Conversión enviada a aprobación');
    } catch (error) {
      toast.error(errorMessage(error, 'Error al enviar'));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!conversion) return;
    const ok = await confirm({
      title: '¿Aprobar la conversión?',
      message: (
        <ul className="space-y-1">
          <li className="flex items-center gap-2"><Boxes className="w-4 h-4 text-gray-400" />Se descontarán {conversion.inputItems.length} insumos del inventario.</li>
          <li className="flex items-center gap-2"><Package className="w-4 h-4 text-gray-400" />Se agregarán {conversion.outputItems.reduce((sum, i) => sum + i.quantity, 0)} unidades al stock de productos.</li>
        </ul>
      ),
      confirmText: 'Aprobar',
    });
    if (!ok) return;
    try {
      setSaving(true);
      const updated = await inventoryConversionsService.approveConversion(conversion.id);
      setConversion(updated);
      toast.success('Conversión aprobada: inventario actualizado');
    } catch (error) {
      toast.error(errorMessage(error, 'Error al aprobar'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!conversion) return;
    const ok = await confirm({
      title: '¿Cancelar esta conversión?',
      message: 'Esta acción no se puede deshacer.',
      tone: 'danger',
      confirmText: 'Cancelar conversión',
      cancelText: 'Volver',
    });
    if (!ok) return;
    try {
      setSaving(true);
      const updated = await inventoryConversionsService.cancelConversion(conversion.id);
      setConversion(updated);
      toast.success('Conversión cancelada');
    } catch (error) {
      toast.error(errorMessage(error, 'Error al cancelar'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!conversion) return;
    const ok = await confirm({ title: '¿Eliminar esta conversión?', message: 'Esta acción no se puede deshacer.', tone: 'danger' });
    if (!ok) return;
    try {
      setSaving(true);
      await inventoryConversionsService.deleteConversion(conversion.id);
      toast.success('Conversión eliminada');
      navigate(LIST);
    } catch (error) {
      toast.error(errorMessage(error, 'Error al eliminar'));
    } finally {
      setSaving(false);
    }
  };

  const filteredInputs = inputOptions.filter((i) => {
    if (!inputSearch) return true;
    const term = inputSearch.toLowerCase();
    return i.code.toLowerCase().includes(term) || i.name.toLowerCase().includes(term);
  });

  const filteredVariants = variantOptions.filter((v) => {
    if (!outputSearch) return true;
    const term = outputSearch.toLowerCase();
    const l = variantLabel(v);
    return (
      v.sku.toLowerCase().includes(term) ||
      l.product.toLowerCase().includes(term) ||
      (!!l.color && l.color.toLowerCase().includes(term)) ||
      (!!l.size && l.size.toLowerCase().includes(term))
    );
  });

  if (loading) {
    return <Page><Spinner label="Cargando conversión…" /></Page>;
  }

  if (!conversion) {
    return (
      <Page>
        <PageHeader icon={ArrowRightLeft} backTo={LIST} title="Conversión" />
        <Card><EmptyState title="Conversión no encontrada" /></Card>
      </Page>
    );
  }

  const isManual = conversion.conversionType === 'MANUAL';
  const isEditable = conversion.status === 'DRAFT';
  const canSubmit = isEditable && conversion.inputItems.length > 0 && conversion.outputItems.length > 0;
  // Totales por unidad (suma de cantidades), no el número de renglones.
  const inputUnits = conversion.inputItems.reduce((s, i) => s + Number(i.quantity), 0);
  const outputUnits = conversion.outputItems.reduce((s, i) => s + Number(i.quantity), 0);
  // Por qué aún no se puede enviar a aprobación.
  const submitHint =
    conversion.inputItems.length === 0 && conversion.outputItems.length === 0
      ? 'Agrega al menos un insumo a consumir y un producto a generar.'
      : conversion.inputItems.length === 0
        ? 'Agrega al menos un insumo a consumir.'
        : conversion.outputItems.length === 0
          ? 'Agrega al menos un producto a generar.'
          : '';
  const canApprove = conversion.status === 'PENDING';
  const canCancel = conversion.status !== 'APPROVED' && conversion.status !== 'CANCELLED';
  const canDelete = conversion.status === 'DRAFT' || conversion.status === 'CANCELLED';
  const canEditItems = isEditable && isManual;
  const status = CONVERSION_STATUS[conversion.status];

  return (
    <Page>
      <PageHeader
        icon={ArrowRightLeft}
        backTo={LIST}
        title={
          <span className="flex items-center gap-3">
            {conversion.conversionNumber}
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        }
        subtitle={conversion.description || 'Sin descripción'}
        actions={
          <>
            {canDelete && (
              <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" icon={<Trash2 className="w-4 h-4" />} onClick={handleDelete} disabled={saving}>
                Eliminar
              </Button>
            )}
            {canCancel && (
              <Button variant="secondary" icon={<XCircle className="w-4 h-4" />} onClick={handleCancel} disabled={saving}>Cancelar</Button>
            )}
            {isEditable && (
              <Button icon={<Send className="w-4 h-4" />} onClick={handleSubmit} disabled={saving || !canSubmit} title={canSubmit ? 'Enviar a aprobación' : submitHint}>
                Enviar a aprobación
              </Button>
            )}
            {canApprove && (
              <Button variant="success" icon={<CheckCircle className="w-4 h-4" />} onClick={handleApprove} disabled={saving}>Aprobar</Button>
            )}
          </>
        }
      />

      {isEditable && submitHint && <Alert tone="warning">{submitHint}</Alert>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Calendar} tone="gray" label="Fecha" value={new Date(conversion.conversionDate).toLocaleDateString('es-CO')} />
        <StatCard icon={Boxes} label="Insumos a consumir" value={`${qty(inputUnits)} unid.`} hint={`${conversion.inputItems.length} ítem(s)`} />
        <StatCard icon={Package} tone="blue" label="Productos a generar" value={`${qty(outputUnits)} unid.`} hint={`${conversion.outputItems.length} ítem(s)`} />
        {isManual && <StatCard icon={DollarSign} tone="green" label="Costo total" value={formatCOP(conversion.totalInputCost)} />}
      </div>

      <Card>
        <DescriptionList
          cols={3}
          items={[
            { label: 'Tipo', value: isManual ? 'Manual' : <Badge tone="app">Desde plantilla</Badge> },
            ...(conversion.template ? [{ label: 'Plantilla', value: `${conversion.template.name} (${conversion.template.sku})` }] : []),
            { label: 'Descripción', value: conversion.description || null },
            ...(conversion.notes ? [{ label: 'Notas', value: conversion.notes, full: true }] : []),
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {/* Insumos a consumir */}
        <section className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Boxes className="w-5 h-5 text-app-600" />Insumos a consumir</h2>
            {canEditItems && <Button size="sm" variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddInputModal(true)}>Agregar</Button>}
          </div>
          <TableCard
            footer={conversion.inputItems.length > 0 && isManual ? (
              <div className="flex justify-between text-sm"><span className="text-gray-500">Total insumos</span><span className="font-bold text-gray-900">{formatCOP(conversion.totalInputCost)}</span></div>
            ) : undefined}
          >
            {conversion.inputItems.length === 0 ? (
              <EmptyState icon={Boxes} title="No hay insumos agregados" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <Th>Insumo</Th>
                    <Th align="right">Requiere</Th>
                    <Th align="right">Disponible</Th>
                    {isManual && <Th align="right">Costo</Th>}
                    {canEditItems && <Th align="right" aria-label="Acciones" />}
                  </tr>
                </THead>
                <TBody>
                  {conversion.inputItems.map((item) => {
                    const label = [item.colorName, item.sizeName].filter(Boolean).join(' / ');
                    const insufficient = item.availableStock !== undefined && item.availableStock < item.quantity;
                    return (
                      <Tr key={item.id}>
                        <Td className="min-w-[180px]">
                          <p className="font-medium text-gray-900">{item.inputName}{label && <span className="font-normal text-gray-500"> · {label}</span>}</p>
                          <p className="text-xs text-gray-500 font-mono">{item.variantSku || item.inputCode}</p>
                        </Td>
                        <Td align="right" className="whitespace-nowrap tabular-nums">{qty(item.quantity)} <span className="text-gray-500">{item.unitOfMeasure}</span></Td>
                        <Td align="right" className="whitespace-nowrap">
                          {item.availableStock === undefined ? <span className="text-gray-400">—</span>
                            : <Badge tone={insufficient ? 'red' : 'green'}>{qty(item.availableStock)}{insufficient && ' · insuficiente'}</Badge>}
                        </Td>
                        {isManual && <Td align="right" className="whitespace-nowrap font-medium text-gray-900">{formatCOP(item.totalCost)}</Td>}
                        {canEditItems && (
                          <Td align="right"><IconButton title="Quitar insumo" tone="danger" onClick={() => handleRemoveInput(item.id)}><X className="w-4 h-4" /></IconButton></Td>
                        )}
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </TableCard>
        </section>

        {/* Productos a generar */}
        <section className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Package className="w-5 h-5 text-app-600" />Productos a generar</h2>
            {canEditItems && <Button size="sm" variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddOutputModal(true)}>Agregar</Button>}
          </div>
          <TableCard
            footer={conversion.outputItems.length > 0 && isManual ? (
              <div className="flex justify-between text-sm"><span className="text-gray-500">Valor total</span><span className="font-bold text-gray-900">{formatCOP(conversion.totalOutputCost)}</span></div>
            ) : undefined}
          >
            {conversion.outputItems.length === 0 ? (
              <EmptyState icon={Package} title="No hay productos agregados" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <Th>Producto</Th>
                    <Th align="right">Cantidad</Th>
                    {isManual && <Th align="right">Valor</Th>}
                    {canEditItems && <Th align="right" aria-label="Acciones" />}
                  </tr>
                </THead>
                <TBody>
                  {conversion.outputItems.map((item) => (
                    <Tr key={item.id}>
                      <Td className="min-w-[180px]">
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <p className="text-xs text-gray-500"><span className="font-mono">{item.variantSku}</span>{item.colorName && ` · ${item.colorName}`}{item.sizeName && ` · ${item.sizeName}`}</p>
                      </Td>
                      <Td align="right" className="whitespace-nowrap tabular-nums">{qty(item.quantity)} unid.</Td>
                      {isManual && <Td align="right" className="whitespace-nowrap font-medium text-gray-900">{formatCOP(item.totalValue)}</Td>}
                      {canEditItems && (
                        <Td align="right"><IconButton title="Quitar producto" tone="danger" onClick={() => handleRemoveOutput(item.id)}><X className="w-4 h-4" /></IconButton></Td>
                      )}
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </TableCard>
        </section>
      </div>

      <AddInputDialog
        open={showAddInputModal}
        onClose={closeAddInput}
        inputs={filteredInputs}
        search={inputSearch}
        onSearch={setInputSearch}
        base={selectedInputBase}
        onBase={setSelectedInputBase}
        variant={selectedInputVariant}
        onVariant={setSelectedInputVariant}
        quantity={inputQuantity}
        onQuantity={setInputQuantity}
        showCost={isManual}
        saving={saving}
        onConfirm={handleAddInput}
      />

      <AddOutputDialog
        open={showAddOutputModal}
        onClose={closeAddOutput}
        variants={filteredVariants}
        search={outputSearch}
        onSearch={setOutputSearch}
        selected={selectedVariant}
        onSelect={setSelectedVariant}
        quantity={outputQuantity}
        onQuantity={setOutputQuantity}
        saving={saving}
        onConfirm={handleAddOutput}
      />
    </Page>
  );
}
