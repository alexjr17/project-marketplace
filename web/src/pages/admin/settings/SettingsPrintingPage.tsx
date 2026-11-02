import { useState, useEffect } from 'react';
import settingsService from '../../../services/settings.service';
import type { PrintSettings, PaperTemplate, PaperFormat } from '../../../types/settings';
import { PAPER_TEMPLATES, DEFAULT_PRINT_SETTINGS } from '../../../types/settings';
import { Printer, Check, Save, FileText } from 'lucide-react';
import {
  Badge, Button, DescriptionList, Field, FormActions, ImageInput, NumberInput, Page, PageHeader, RadioGroup,
  SettingsSection, Spinner, Switch, toast,
} from '../../../components/ui';

const FORMAT_LABELS: Record<PaperFormat, string> = {
  '58mm': 'Ticket 58mm',
  '80mm': 'Ticket 80mm',
  'letter': 'Carta',
  'a4': 'A4',
  'custom': 'Personalizado',
};

const FONT_LABELS = { small: 'Pequeña', medium: 'Mediana', large: 'Grande' } as const;
const MARGINS = [
  { key: 'top', label: 'Arriba' },
  { key: 'right', label: 'Derecha' },
  { key: 'bottom', label: 'Abajo' },
  { key: 'left', label: 'Izquierda' },
] as const;

export const SettingsPrintingPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsService.getPrintingSettings();
      setSettings({ ...DEFAULT_PRINT_SETTINGS, ...data });
    } catch (error) {
      console.error('Error loading printing settings:', error);
      // Usar los valores por defecto si falla
      setSettings(DEFAULT_PRINT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsService.updatePrintingSettings(settings);
      toast.success('Configuración de impresión guardada');
    } catch (error) {
      console.error('Error saving printing settings:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectTemplate = (template: PaperTemplate) => {
    setSettings({
      ...settings,
      selectedTemplateId: template.id,
      ticketFormat: template.format,
      ticketWidth: template.width,
      ticketHeight: template.height,
    });
  };

  const header = <PageHeader icon={Printer} title="Impresión" subtitle="Formato de papel y contenido de los tickets de venta del POS" />;
  if (loading) return <Page>{header}<Spinner label="Cargando configuración…" /></Page>;

  const templates = PAPER_TEMPLATES.filter(t => t.format === '58mm' || t.format === '80mm' || t.format === 'letter');
  const headerParts = [
    settings.showLogo && 'Logo',
    (settings.showStoreName ?? true) && 'Nombre',
    (settings.showNit ?? true) && 'NIT',
  ].filter(Boolean) as string[];
  const otherParts = [settings.showQR && 'QR', settings.showPreviewModal && 'Vista previa'].filter(Boolean) as string[];

  return (
    <Page>
      {header}

      <div>
        <SettingsSection title="Formato del ticket" description="El papel que usa tu impresora de tickets. Define cómo se genera el PDF de la factura.">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {templates.map((template) => {
              const active = settings.selectedTemplateId === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelectTemplate(template)}
                  aria-pressed={active}
                  className={`relative flex flex-col rounded-lg border p-4 text-left transition-colors ${active ? 'border-app-500 ring-1 ring-app-500' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    {active
                      ? <span className="w-5 h-5 rounded-full bg-app-600 text-white flex items-center justify-center"><Check className="w-3.5 h-3.5" /></span>
                      : <span className="w-5 h-5 rounded-full border border-gray-300" />}
                    {template.recommended && <Badge tone="green">Recomendado</Badge>}
                  </div>
                  <div className="flex justify-center mb-3">
                    {template.format === 'letter' ? (
                      <div className="flex w-14 h-[72px] flex-col items-center justify-center rounded border border-gray-300 bg-gray-50">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-[10px] text-gray-400 font-mono mt-1">Carta</span>
                      </div>
                    ) : (
                      <div className={`flex items-center justify-center rounded border border-gray-300 bg-gray-50 ${template.format === '58mm' ? 'w-10 h-20' : 'w-14 h-24'}`}>
                        <span className="text-[10px] text-gray-400 font-mono">{template.width}mm</span>
                      </div>
                    )}
                  </div>
                  <p className="font-medium text-gray-900 text-center">{template.name}</p>
                  <p className="text-xs text-gray-500 text-center mt-1">{template.description}</p>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-600 mb-1">Impresoras compatibles</p>
                    <div className="flex flex-wrap gap-1">
                      {template.compatiblePrinters.slice(0, 3).map((printer, idx) => (
                        <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{printer}</span>
                      ))}
                      {template.compatiblePrinters.length > 3 && <span className="text-xs text-gray-400">+{template.compatiblePrinters.length - 3} más</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </SettingsSection>

        <SettingsSection
          title="Logo y encabezado"
          description="Un logo propio para el ticket. Si tu logo ya incluye el nombre o el NIT, oculta esos textos para no duplicarlos."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Logo del ticket" hint={settings.ticketLogo ? 'Recomendado: PNG transparente, máx. 500×200 px.' : 'Si no subes uno, se usa el logo general de la tienda (si está configurado).'}>
              <ImageInput value={settings.ticketLogo} onChange={(v) => setSettings({ ...settings, ticketLogo: v || '' })} ratio="landscape" maxSizeMB={1} />
            </Field>
            <div className="space-y-4">
              <Switch checked={settings.showLogo} onChange={(v) => setSettings({ ...settings, showLogo: v })} label="Mostrar logo" description="Incluir el logo en el encabezado." />
              <Switch checked={settings.showStoreName ?? true} onChange={(v) => setSettings({ ...settings, showStoreName: v })} label="Mostrar nombre" description="Nombre de la empresa." />
              <Switch checked={settings.showNit ?? true} onChange={(v) => setSettings({ ...settings, showNit: v })} label="Mostrar NIT" description="NIT y datos fiscales." />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Otras opciones" description="Contenido adicional, vista previa y tamaño del texto.">
          <Switch checked={settings.showQR} onChange={(v) => setSettings({ ...settings, showQR: v })} label="Mostrar código QR" description="Incluir un código QR con la información de la venta." />
          <Switch checked={settings.showPreviewModal ?? true} onChange={(v) => setSettings({ ...settings, showPreviewModal: v })} label="Vista previa al imprimir" description="Mostrar la vista previa del PDF antes de imprimir." />
          <Field label="Tamaño de fuente">
            <RadioGroup
              variant="segmented"
              value={settings.fontSize}
              onChange={(fontSize) => setSettings({ ...settings, fontSize })}
              options={[{ value: 'small', label: 'Pequeño' }, { value: 'medium', label: 'Mediano' }, { value: 'large', label: 'Grande' }]}
            />
          </Field>
          <Field label="Márgenes del ticket" hint="En milímetros, de 0 a 20.">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {MARGINS.map((m) => (
                <div key={m.key}>
                  <span className="block text-xs text-gray-500 mb-1">{m.label}</span>
                  <NumberInput
                    min="0"
                    max="20"
                    suffix="mm"
                    value={settings.ticketMargins[m.key]}
                    onChange={(e) => setSettings({ ...settings, ticketMargins: { ...settings.ticketMargins, [m.key]: parseInt(e.target.value) || 0 } })}
                  />
                </div>
              ))}
            </div>
          </Field>
        </SettingsSection>

        <SettingsSection title="Resumen" description="Así quedará configurado el ticket.">
          <DescriptionList
            cols={3}
            items={[
              {
                label: 'Formato',
                value: (
                  <>
                    <span className="font-medium">{FORMAT_LABELS[settings.ticketFormat]}</span>
                    <span className="block text-xs text-gray-500">
                      {settings.ticketFormat === 'letter' ? `${settings.ticketWidth}×279 mm (hoja carta)` : `${settings.ticketWidth} mm de ancho`}
                    </span>
                  </>
                ),
              },
              {
                label: 'Encabezado',
                value: headerParts.length ? <div className="flex flex-wrap gap-1">{headerParts.map((p) => <Badge key={p} tone="app">{p}</Badge>)}</div> : 'Sin encabezado',
              },
              {
                label: 'Otras opciones',
                value: (
                  <div className="flex flex-wrap gap-1">
                    {otherParts.map((p) => <Badge key={p} tone="blue">{p}</Badge>)}
                    <Badge>Fuente {FONT_LABELS[settings.fontSize].toLowerCase()}</Badge>
                  </div>
                ),
              },
            ]}
          />
        </SettingsSection>
      </div>

      <FormActions sticky>
        <Button onClick={handleSave} isLoading={saving} icon={<Save className="w-4 h-4" />}>Guardar cambios</Button>
      </FormActions>
    </Page>
  );
};
