import { useState } from 'react';
import { Save, Store } from 'lucide-react';
import { useSettings } from '../../../context/SettingsContext';
import { CURRENCY_OPTIONS } from '../../../types/settings';
import type { TaxRegime } from '../../../types/settings';
import {
  Button, DateInput, Field, FormActions, FormGrid, ImageInput, NumberInput, Page, PageHeader, SelectInput,
  SettingsSection, Switch, TextArea, TextInput, toast,
} from '../../../components/ui';

// Opciones de régimen tributario
const TAX_REGIME_OPTIONS: { value: TaxRegime; label: string; description: string }[] = [
  { value: 'responsable_iva', label: 'Responsable de IVA', description: 'Grandes contribuyentes y empresas que superan el umbral de ingresos' },
  { value: 'no_responsable', label: 'No Responsable de IVA', description: 'Persona natural o jurídica con ingresos menores al umbral' },
  { value: 'regimen_simple', label: 'Régimen Simple de Tributación (RST)', description: 'Régimen opcional con tarifa unificada de impuestos' },
];

export const SettingsGeneralPage = () => {
  const { settings, updateGeneralSettings } = useSettings();
  const [generalForm, setGeneralForm] = useState(settings.general);
  const [showInvoiceResolution, setShowInvoiceResolution] = useState(!!settings.general.fiscal?.invoiceResolution);
  const [saving, setSaving] = useState(false);

  const fiscal = generalForm.fiscal;
  const setFiscal = (patch: Partial<NonNullable<typeof fiscal>>) =>
    setGeneralForm({ ...generalForm, fiscal: { ...generalForm.fiscal, ...patch } });
  const setSocial = (patch: Partial<typeof generalForm.socialLinks>) =>
    setGeneralForm({ ...generalForm, socialLinks: { ...generalForm.socialLinks, ...patch } });

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      await updateGeneralSettings(generalForm);
      toast.success('Configuración general guardada');
    } catch {
      toast.error('No se pudo guardar la configuración general');
    } finally {
      setSaving(false);
    }
  };

  const regime = TAX_REGIME_OPTIONS.find((o) => o.value === fiscal?.taxRegime);

  return (
    <Page>
      <PageHeader icon={Store} title="General" subtitle="Información básica de la tienda, contacto y datos fiscales" />

      <div>
        <SettingsSection title="Información del sitio" description="Nombre, slogan y moneda con los que se presenta la tienda.">
          <FormGrid>
            <Field label="Nombre del sitio" required>
              <TextInput value={generalForm.siteName} onChange={(e) => setGeneralForm({ ...generalForm, siteName: e.target.value })} placeholder="Mi Tienda" />
            </Field>
            <Field label="Slogan" hint="Aparece debajo del nombre en el encabezado.">
              <TextInput value={generalForm.slogan || ''} onChange={(e) => setGeneralForm({ ...generalForm, slogan: e.target.value })} placeholder="Tu Estilo, Tu Diseño" />
            </Field>
            <Field label="Moneda">
              <SelectInput
                value={generalForm.currency}
                onChange={(e) => {
                  const currency = CURRENCY_OPTIONS.find((c) => c.code === e.target.value);
                  setGeneralForm({ ...generalForm, currency: e.target.value, currencySymbol: currency?.symbol || '$' });
                }}
              >
                {CURRENCY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>)}
              </SelectInput>
            </Field>
            <Field label="Descripción" className="md:col-span-2">
              <TextArea rows={2} value={generalForm.siteDescription} onChange={(e) => setGeneralForm({ ...generalForm, siteDescription: e.target.value })} placeholder="Descripción breve de tu tienda" />
            </Field>
          </FormGrid>
        </SettingsSection>

        <SettingsSection title="Logo" description="PNG transparente. Si es un logotipo ancho (ícono + nombre) se muestra solo; si es un ícono, va junto al nombre de la tienda.">
          <FormGrid>
            <Field label="Logo" hint="Para el encabezado, sobre fondo claro.">
              <ImageInput value={generalForm.logo} onChange={(logo) => setGeneralForm({ ...generalForm, logo })} ratio="landscape" maxSizeMB={1} />
            </Field>
            <Field label="Logo para fondo oscuro" hint="Versión clara para el pie de página. Si no la subes, se usa el logo normal.">
              <ImageInput value={generalForm.logoOnDark} onChange={(logoOnDark) => setGeneralForm({ ...generalForm, logoOnDark })} ratio="landscape" maxSizeMB={1} />
            </Field>
          </FormGrid>
        </SettingsSection>

        <SettingsSection title="Contacto" description="Datos que ven los clientes para comunicarse con la tienda.">
          <FormGrid>
            <Field label="Correo de contacto">
              <TextInput type="email" value={generalForm.contactEmail} onChange={(e) => setGeneralForm({ ...generalForm, contactEmail: e.target.value })} placeholder="contacto@ejemplo.com" />
            </Field>
            <Field label="Teléfono">
              <TextInput value={generalForm.contactPhone} onChange={(e) => setGeneralForm({ ...generalForm, contactPhone: e.target.value })} placeholder="+57 300 123 4567" />
            </Field>
            <Field label="Dirección" className="md:col-span-2">
              <TextInput value={generalForm.address} onChange={(e) => setGeneralForm({ ...generalForm, address: e.target.value })} placeholder="Calle 123 #45-67" />
            </Field>
            <Field label="Ciudad">
              <TextInput value={generalForm.city} onChange={(e) => setGeneralForm({ ...generalForm, city: e.target.value })} placeholder="Bogotá" />
            </Field>
            <Field label="País">
              <TextInput value={generalForm.country} onChange={(e) => setGeneralForm({ ...generalForm, country: e.target.value })} placeholder="Colombia" />
            </Field>
          </FormGrid>
        </SettingsSection>

        <SettingsSection title="Redes sociales" description="Enlaces que aparecen en el pie de la tienda. Deja vacío lo que no uses.">
          <FormGrid>
            <Field label="Facebook">
              <TextInput value={generalForm.socialLinks.facebook || ''} onChange={(e) => setSocial({ facebook: e.target.value })} placeholder="https://facebook.com/tu-pagina" />
            </Field>
            <Field label="Instagram">
              <TextInput value={generalForm.socialLinks.instagram || ''} onChange={(e) => setSocial({ instagram: e.target.value })} placeholder="https://instagram.com/tu-perfil" />
            </Field>
            <Field label="WhatsApp" hint="Número con indicativo, sin espacios.">
              <TextInput value={generalForm.socialLinks.whatsapp || ''} onChange={(e) => setSocial({ whatsapp: e.target.value })} placeholder="+573001234567" />
            </Field>
          </FormGrid>
        </SettingsSection>

        <SettingsSection title="Información fiscal" description="Datos tributarios que aparecen en tickets y facturas.">
          <FormGrid>
            <Field label="NIT / Identificación tributaria" hint="Incluye el dígito de verificación.">
              <TextInput value={fiscal?.nit || ''} onChange={(e) => setFiscal({ nit: e.target.value })} placeholder="901.234.567-8" />
            </Field>
            <Field label="Régimen tributario" hint={regime?.description}>
              <SelectInput value={fiscal?.taxRegime || ''} onChange={(e) => setFiscal({ taxRegime: e.target.value as TaxRegime })}>
                <option value="">Seleccionar régimen</option>
                {TAX_REGIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
            </Field>
            <Field label="Razón social" hint="Nombre legal de la empresa (si es diferente al nombre comercial)." className="md:col-span-2">
              <TextInput value={fiscal?.legalName || ''} onChange={(e) => setFiscal({ legalName: e.target.value })} placeholder="Mi Empresa S.A.S." />
            </Field>
          </FormGrid>
        </SettingsSection>

        <SettingsSection title="Resolución de facturación DIAN" description="Opcional. Solo si emites factura electrónica autorizada por la DIAN.">
          <Switch
            checked={showInvoiceResolution}
            onChange={setShowInvoiceResolution}
            label="Mostrar datos de la resolución"
            description="Número, fecha, prefijo y rango autorizado."
          />
          {showInvoiceResolution && (
            <FormGrid>
              <Field label="Número de resolución">
                <TextInput value={fiscal?.invoiceResolution || ''} onChange={(e) => setFiscal({ invoiceResolution: e.target.value })} placeholder="18760000001234" />
              </Field>
              <Field label="Fecha de resolución">
                <DateInput value={fiscal?.invoiceResolutionDate || ''} onChange={(e) => setFiscal({ invoiceResolutionDate: e.target.value })} />
              </Field>
              <Field label="Prefijo de facturación">
                <TextInput value={fiscal?.invoicePrefix || ''} onChange={(e) => setFiscal({ invoicePrefix: e.target.value })} placeholder="FE" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rango desde">
                  <NumberInput value={fiscal?.invoiceRangeFrom || ''} onChange={(e) => setFiscal({ invoiceRangeFrom: Number(e.target.value) || undefined })} placeholder="1" />
                </Field>
                <Field label="Rango hasta">
                  <NumberInput value={fiscal?.invoiceRangeTo || ''} onChange={(e) => setFiscal({ invoiceRangeTo: Number(e.target.value) || undefined })} placeholder="100000" />
                </Field>
              </div>
            </FormGrid>
          )}
        </SettingsSection>
      </div>

      <FormActions sticky>
        <Button isLoading={saving} onClick={handleSaveGeneral} icon={<Save className="w-4 h-4" />}>Guardar cambios</Button>
      </FormActions>
    </Page>
  );
};
