import { useState, useEffect } from 'react';
import { errorMessage } from '../../lib/http';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Layers, Minus, Plus, Printer, Tags } from 'lucide-react';
import * as variantsService from '../../services/variants.service';
import * as barcodeService from '../../services/barcode.service';
import { getLabelTemplates } from '../../services/label-templates.service';
import type { ProductVariant } from '../../services/variants.service';
import type { LabelTemplate } from '../../types/label-template';
import {
  Button, Card, Dialog, EmptyState, Field, Page, PageHeader, SelectInput, Spinner, StatCard, TableCard, toast,
} from '../../components/ui';

interface VariantPrintItem extends ProductVariant {
  quantity: number;
}

const BACK = '/admin-panel/products';

export default function BarcodePrintPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const [variants, setVariants] = useState<VariantPrintItem[]>([]);
  const [labelTemplates, setLabelTemplates] = useState<LabelTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    if (productId) {
      loadVariants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const loadVariants = async () => {
    try {
      setLoading(true);

      // Cargar variantes y plantillas en paralelo
      const [variantsData, templatesData] = await Promise.all([
        variantsService.getVariants({ productId: parseInt(productId!) }),
        getLabelTemplates(false)
      ]);

      // Inicializar cantidad en 1 para cada variante
      setVariants(variantsData.map(v => ({ ...v, quantity: 1 })));

      // Filtrar plantillas activas
      const activeTemplates = templatesData.filter(t => t.isActive);
      setLabelTemplates(activeTemplates);

      // Seleccionar plantilla por defecto (siempre debe haber una)
      const defaultTemplate = activeTemplates.find(t => t.isDefault);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate.id);
      } else if (activeTemplates.length > 0) {
        setSelectedTemplate(activeTemplates[0].id);
      }
    } catch (error) {
      toast.error('Error al cargar variantes: ' + errorMessage(error));
      navigate(BACK);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (variantId: number, newQuantity: number) => {
    if (newQuantity < 0) return;
    setVariants(prev => prev.map(v => (v.id === variantId ? { ...v, quantity: newQuantity } : v)));
  };

  const setAll = (q: number) => setVariants(prev => prev.map(v => ({ ...v, quantity: q })));

  const handlePrint = async () => {
    const itemsToPrint = variants.filter(v => v.quantity > 0);

    if (itemsToPrint.length === 0) {
      toast.error('Selecciona al menos una variante para imprimir');
      return;
    }

    try {
      setPrinting(true);
      const printData = itemsToPrint.map(v => ({ variantId: v.id, quantity: v.quantity }));

      // Generar las etiquetas con la plantilla seleccionada
      const pdfBlob = await barcodeService.generateBarcodeLabels(
        printData,
        selectedTemplate! // Siempre debe haber una plantilla seleccionada
      );

      const url = window.URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(url);
      setShowPreviewModal(true);

      toast.success('Etiquetas generadas exitosamente');
    } catch (error) {
      console.error('Error generating labels:', error);
      toast.error('Error al generar etiquetas: ' + errorMessage(error));
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfPreviewUrl) return;
    const link = document.createElement('a');
    link.href = pdfPreviewUrl;
    link.download = `etiquetas-${variants[0]?.product.name || 'producto'}.pdf`;
    link.click();
    toast.success('PDF descargado exitosamente');
  };

  const handleClosePreview = () => {
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
    setShowPreviewModal(false);
  };

  const totalLabels = variants.reduce((sum, v) => sum + v.quantity, 0);

  if (loading) {
    return <Page><Spinner label="Cargando variantes…" /></Page>;
  }

  if (variants.length === 0) {
    return (
      <Page>
        <PageHeader icon={Printer} title="Imprimir etiquetas" subtitle="Códigos de barras por variante" backTo={BACK} />
        <Card>
          <EmptyState
            icon={Printer}
            title="No hay variantes para este producto"
            description="Primero genera las variantes (menú ⋮ del producto) para poder imprimir códigos de barras."
            action={<Button variant="secondary" onClick={() => navigate(BACK)}>Volver a productos</Button>}
          />
        </Card>
      </Page>
    );
  }

  const productName = variants[0]?.product.name;

  // Matriz color × talla
  const colors = new Map<string, { name: string; hexCode: string }>();
  const sizes = new Map<string, string>();
  variants.forEach((variant) => {
    if (variant.color) colors.set(variant.color.name, { name: variant.color.name, hexCode: variant.color.hexCode });
    if (variant.size) sizes.set(variant.size.abbreviation, variant.size.abbreviation);
  });
  const colorsArr = Array.from(colors.values());
  const sizesArr = Array.from(sizes.keys());
  const findVariant = (colorName: string, sizeName: string) =>
    variants.find((v) => v.color?.name === colorName && v.size?.abbreviation === sizeName);

  return (
    <Page>
      <PageHeader
        icon={Printer}
        title="Imprimir etiquetas"
        subtitle={productName}
        backTo={BACK}
        actions={(
          <Button icon={<Printer className="w-4 h-4" />} onClick={handlePrint} isLoading={printing} disabled={totalLabels === 0}>
            Vista previa ({totalLabels})
          </Button>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
        <StatCard icon={Layers} label="Variantes" value={variants.length} />
        <StatCard icon={Tags} tone="green" label="Etiquetas a imprimir" value={totalLabels} />
        <Card className="flex items-center">
          <Field label="Plantilla de etiqueta" className="w-full">
            <SelectInput value={selectedTemplate || ''} onChange={(e) => setSelectedTemplate(e.target.value ? Number(e.target.value) : null)}>
              {labelTemplates.map(template => (
                <option key={template.id} value={template.id}>{template.name}{template.isDefault && ' (por defecto)'}</option>
              ))}
            </SelectInput>
          </Field>
        </Card>
      </div>

      <TableCard footer={(
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>Ajusta cuántas etiquetas imprimir por variante.</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAll(0)}>Poner todo en 0</Button>
            <Button size="sm" variant="ghost" onClick={() => setAll(1)}>Una por variante</Button>
          </div>
        </div>
      )}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">Color / Talla</th>
              {sizesArr.map((size) => (
                <th key={size} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[130px]">{size}</th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {colorsArr.map((color) => {
              const rowTotal = sizesArr.reduce((sum, size) => sum + (findVariant(color.name, size)?.quantity ?? 0), 0);
              return (
                <tr key={color.name}>
                  <td className="px-4 py-3 sticky left-0 bg-white">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: color.hexCode }} />
                      <span className="font-medium text-gray-900">{color.name}</span>
                    </div>
                  </td>
                  {sizesArr.map((size) => {
                    const variant = findVariant(color.name, size);
                    if (!variant) return <td key={size} className="px-3 py-3 text-center text-gray-300">—</td>;
                    return (
                      <td key={size} className={`px-3 py-3 ${variant.quantity > 0 ? 'bg-app-50/60' : ''}`}>
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="inline-flex items-center rounded-lg border border-gray-300 bg-white">
                            <button type="button" title="Quitar una" aria-label="Quitar una" onClick={() => updateQuantity(variant.id, variant.quantity - 1)}
                              disabled={variant.quantity === 0} className="p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input type="number" min="0" value={variant.quantity} aria-label={`Cantidad ${color.name} ${size}`}
                              onChange={(e) => updateQuantity(variant.id, parseInt(e.target.value) || 0)}
                              className="w-12 h-7 text-center text-sm font-semibold border-x border-gray-200 focus:outline-none focus:bg-app-50 [appearance:textfield]" />
                            <button type="button" title="Agregar una" aria-label="Agregar una" onClick={() => updateQuantity(variant.id, variant.quantity + 1)}
                              className="p-1.5 text-gray-500 hover:text-app-700">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="text-[11px] text-gray-500 text-center leading-tight">
                            <div className="font-mono text-gray-700">{variant.barcode || 'Sin código'}</div>
                            <div>Stock {variant.stock} · ${variant.finalPrice.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">{rowTotal}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td className="px-4 py-3 text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50">Total por talla</td>
              {sizesArr.map((size) => {
                const colTotal = colorsArr.reduce((sum, color) => sum + (findVariant(color.name, size)?.quantity ?? 0), 0);
                return <td key={size} className="px-3 py-3 text-center font-semibold text-gray-900 tabular-nums">{colTotal}</td>;
              })}
              <td className="px-4 py-3 text-right font-bold text-app-700 tabular-nums">{totalLabels}</td>
            </tr>
          </tfoot>
        </table>
      </TableCard>

      <Dialog
        open={showPreviewModal && !!pdfPreviewUrl}
        onClose={handleClosePreview}
        title="Vista previa de etiquetas"
        description={`${totalLabels} etiquetas · ${productName}`}
        size="xl"
        footer={(
          <>
            <Button variant="secondary" onClick={handleClosePreview}>Cerrar</Button>
            <Button icon={<Download className="w-4 h-4" />} onClick={handleDownloadPdf}>Descargar PDF</Button>
          </>
        )}
      >
        {pdfPreviewUrl && (
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100" style={{ height: '65vh' }}>
            <iframe src={pdfPreviewUrl} className="w-full h-full" title="Vista previa del PDF" />
          </div>
        )}
      </Dialog>
    </Page>
  );
}
