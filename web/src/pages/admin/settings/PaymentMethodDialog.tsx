import { useState } from 'react';
import type { ReactNode } from 'react';
import { Copy, ExternalLink, Eye, EyeOff, Save } from 'lucide-react';
import type { PaymentMethodConfig, WompiConfig, PickupConfig, NequiConfig, MercadoPagoConfig } from '../../../types/settings';
import { PAYMENT_TYPE_LABELS } from '../../../types/settings';
import {
  Alert, Button, Checkbox, Dialog, Field, FormGrid, IconButton, RadioGroup, SelectInput, TextArea, TextInput, toast,
} from '../../../components/ui';

type MethodForm = Omit<PaymentMethodConfig, 'id'>;

// URL base de la API (para mostrar las URLs de webhook que el comercio debe
// registrar en el panel de Wompi / Mercado Pago).
const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '');
const wompiWebhookUrl = `${apiBase}/webhooks/wompi`;
const mpWebhookUrl = `${apiBase}/webhooks/mercadopago`;

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('URL copiada');
};

/** Bloque de un tipo de pago dentro del formulario (título + enlace opcional). */
function Block({ title, link, children }: { title: string; link?: { href: string; label: string }; children: ReactNode }) {
  return (
    <div className="space-y-4 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {link && (
          <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-app-700 hover:underline">
            {link.label} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {children}
    </div>
  );
}

/** URL de webhook en solo lectura con botón copiar. */
function WebhookUrl({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 min-w-0 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-700 break-all">{url}</code>
      <IconButton title="Copiar URL" tone="app" onClick={() => copyToClipboard(url)}><Copy className="w-4 h-4" /></IconButton>
    </div>
  );
}

const modeOptions = (test: string) => [{ value: 'test', label: test }, { value: 'prod', label: 'Producción' }];

/**
 * Crear o editar un método de pago. Se monta al abrir, así que el estado
 * inicial sale del método recibido (o de los valores por defecto si es nuevo).
 */
export function PaymentMethodDialog({ method, onClose, onSave }: {
  method: PaymentMethodConfig | null;
  onClose: () => void;
  onSave: (data: MethodForm) => Promise<void>;
}) {
  const [form, setForm] = useState<MethodForm>(() => method ? {
    type: method.type,
    name: method.name,
    description: method.description || '',
    instructions: method.instructions || '',
    isActive: method.isActive,
    requireProof: method.requireProof ?? false,
    bankInfo: method.bankInfo,
    wompiConfig: method.wompiConfig,
    pickupConfig: method.pickupConfig,
    nequiConfig: method.nequiConfig,
    mercadoPagoConfig: method.mercadoPagoConfig,
  } : { type: 'transfer', name: '', description: '', instructions: '', isActive: true, requireProof: true });

  const [wompi, setWompi] = useState<WompiConfig>({
    publicKey: method?.wompiConfig?.publicKey || '',
    privateKey: method?.wompiConfig?.privateKey || '',
    integrityKey: method?.wompiConfig?.integrityKey || '',
    eventSecret: method?.wompiConfig?.eventSecret || '',
    isTestMode: method?.wompiConfig?.isTestMode ?? true,
  });
  const [pickup, setPickup] = useState<PickupConfig>({
    storeName: method?.pickupConfig?.storeName || '',
    address: method?.pickupConfig?.address || '',
    city: method?.pickupConfig?.city || '',
    scheduleWeekdays: method?.pickupConfig?.scheduleWeekdays || '',
    scheduleWeekends: method?.pickupConfig?.scheduleWeekends || '',
    phone: method?.pickupConfig?.phone || '',
    mapUrl: method?.pickupConfig?.mapUrl || '',
    additionalInfo: method?.pickupConfig?.additionalInfo || '',
  });
  const [nequi, setNequi] = useState<NequiConfig>({
    phone: method?.nequiConfig?.phone || '',
    accountHolder: method?.nequiConfig?.accountHolder || '',
    qrImage: method?.nequiConfig?.qrImage,
  });
  const [mp, setMp] = useState<MercadoPagoConfig>({
    publicKey: method?.mercadoPagoConfig?.publicKey || '',
    accessToken: method?.mercadoPagoConfig?.accessToken || '',
    isTestMode: method?.mercadoPagoConfig?.isTestMode ?? true,
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);

  const setBank = (patch: Partial<NonNullable<MethodForm['bankInfo']>>) =>
    setForm({ ...form, bankInfo: { ...form.bankInfo!, ...patch } });

  const save = async () => {
    const data = { ...form };
    if (form.type === 'wompi') {
      data.wompiConfig = {
        publicKey: wompi.publicKey,
        privateKey: wompi.privateKey || undefined,
        integrityKey: wompi.integrityKey || undefined,
        eventSecret: wompi.eventSecret || undefined,
        isTestMode: wompi.isTestMode,
      };
    }
    if (form.type === 'pickup') {
      data.pickupConfig = {
        storeName: pickup.storeName,
        address: pickup.address,
        city: pickup.city,
        scheduleWeekdays: pickup.scheduleWeekdays,
        scheduleWeekends: pickup.scheduleWeekends || undefined,
        phone: pickup.phone || undefined,
        mapUrl: pickup.mapUrl || undefined,
        additionalInfo: pickup.additionalInfo || undefined,
      };
    }
    if (form.type === 'nequi') {
      data.nequiConfig = { phone: nequi.phone, accountHolder: nequi.accountHolder || undefined, qrImage: nequi.qrImage || undefined };
    }
    if (form.type === 'mercadopago') {
      data.mercadoPagoConfig = { publicKey: mp.publicKey, accessToken: mp.accessToken || undefined, isTestMode: mp.isTestMode };
    }
    setSaving(true);
    try { await onSave(data); } finally { setSaving(false); }
  };

  const manual = form.type === 'transfer' || form.type === 'nequi' || form.type === 'pickup';

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={method ? 'Editar método de pago' : 'Nuevo método de pago'}
      description="Así lo verá el cliente al pagar en la tienda."
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button icon={<Save className="w-4 h-4" />} isLoading={saving} onClick={save}>{method ? 'Guardar' : 'Crear método'}</Button>
      </>}
    >
      <div className="space-y-4">
        <FormGrid>
          <Field label="Tipo" required htmlFor="pm-type">
            <SelectInput id="pm-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PaymentMethodConfig['type'] })}>
              {Object.entries(PAYMENT_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </SelectInput>
          </Field>
          <Field label="Nombre" required htmlFor="pm-name">
            <TextInput id="pm-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Transferencia Bancolombia" />
          </Field>
          <Field label="Descripción" htmlFor="pm-desc" className="md:col-span-2">
            <TextInput id="pm-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Breve descripción del método" />
          </Field>
          <Field label="Instrucciones para el cliente" htmlFor="pm-instr" className="md:col-span-2">
            <TextArea id="pm-instr" rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Qué debe hacer el cliente para pagar" />
          </Field>
        </FormGrid>

        {form.type === 'wompi' && (
          <Block title="Credenciales de Wompi" link={{ href: 'https://comercios.wompi.co', label: 'Ir a Wompi' }}>
            <Alert tone="warning" title="Obtén tus credenciales en Wompi">
              Ingresa a <strong>comercios.wompi.co</strong> → <strong>Desarrolladores → Llaves de API</strong> y copia las llaves del ambiente (Pruebas o Producción).
            </Alert>
            <Field label="Ambiente">
              <RadioGroup variant="segmented" value={wompi.isTestMode ? 'test' : 'prod'} onChange={(v) => setWompi({ ...wompi, isTestMode: v === 'test' })} options={modeOptions('Prueba (Sandbox)')} />
            </Field>
            <Field label="Llave pública (Public Key)" required htmlFor="wompi-pub" hint={wompi.isTestMode ? 'Debe empezar con "pub_test_"' : 'Debe empezar con "pub_prod_"'}>
              <TextInput id="wompi-pub" value={wompi.publicKey} onChange={(e) => setWompi({ ...wompi, publicKey: e.target.value })} placeholder={wompi.isTestMode ? 'pub_test_...' : 'pub_prod_...'} />
            </Field>
            <Field label="URL de eventos (Webhook)" hint={<>Pégala en Wompi → <strong>Desarrolladores → Eventos / URL de eventos</strong>. Con ella confirmamos automáticamente los pagos aprobados.</>}>
              <WebhookUrl url={wompiWebhookUrl} />
            </Field>
            <Button variant="ghost" size="sm" icon={showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} onClick={() => setShowSecrets(!showSecrets)}>
              {showSecrets ? 'Ocultar claves secretas' : 'Mostrar claves secretas (opcional)'}
            </Button>
            {showSecrets && (
              <FormGrid>
                <Field label="Llave de integridad (Integrity Key)" htmlFor="wompi-int">
                  <TextInput id="wompi-int" type="password" value={wompi.integrityKey} onChange={(e) => setWompi({ ...wompi, integrityKey: e.target.value })} placeholder="Opcional: firma las transacciones" />
                </Field>
                <Field label="Llave privada (Private Key)" htmlFor="wompi-prv">
                  <TextInput id="wompi-prv" type="password" value={wompi.privateKey} onChange={(e) => setWompi({ ...wompi, privateKey: e.target.value })} placeholder={wompi.isTestMode ? 'prv_test_...' : 'prv_prod_...'} />
                </Field>
                <Field label="Secreto de eventos (Events Secret)" htmlFor="wompi-evt" className="md:col-span-2">
                  <TextInput id="wompi-evt" type="password" value={wompi.eventSecret} onChange={(e) => setWompi({ ...wompi, eventSecret: e.target.value })} placeholder="Opcional: valida los webhooks" />
                </Field>
              </FormGrid>
            )}
          </Block>
        )}

        {form.type === 'transfer' && (
          <Block title="Información bancaria">
            <FormGrid>
              <Field label="Banco" htmlFor="bank-name">
                <TextInput id="bank-name" value={form.bankInfo?.bankName || ''} onChange={(e) => setBank({ bankName: e.target.value })} placeholder="Bancolombia" />
              </Field>
              <Field label="Tipo de cuenta" htmlFor="bank-type">
                <SelectInput id="bank-type" value={form.bankInfo?.accountType || 'Ahorros'} onChange={(e) => setBank({ accountType: e.target.value })}>
                  <option value="Ahorros">Ahorros</option>
                  <option value="Corriente">Corriente</option>
                </SelectInput>
              </Field>
              <Field label="Número de cuenta" htmlFor="bank-num">
                <TextInput id="bank-num" value={form.bankInfo?.accountNumber || ''} onChange={(e) => setBank({ accountNumber: e.target.value })} placeholder="123-456789-00" />
              </Field>
              <Field label="Titular" htmlFor="bank-holder">
                <TextInput id="bank-holder" value={form.bankInfo?.accountHolder || ''} onChange={(e) => setBank({ accountHolder: e.target.value })} placeholder="Nombre del titular" />
              </Field>
              <Field label="Tipo de documento" htmlFor="bank-doctype">
                <SelectInput id="bank-doctype" value={form.bankInfo?.documentType || 'CC'} onChange={(e) => setBank({ documentType: e.target.value })}>
                  <option value="CC">CC</option>
                  <option value="NIT">NIT</option>
                  <option value="CE">CE</option>
                </SelectInput>
              </Field>
              <Field label="Número de documento" htmlFor="bank-docnum">
                <TextInput id="bank-docnum" value={form.bankInfo?.documentNumber || ''} onChange={(e) => setBank({ documentNumber: e.target.value })} placeholder="123.456.789" />
              </Field>
            </FormGrid>
          </Block>
        )}

        {form.type === 'pickup' && (
          <Block title="Punto físico">
            <FormGrid>
              <Field label="Nombre de la tienda" required htmlFor="pk-store" className="md:col-span-2">
                <TextInput id="pk-store" value={pickup.storeName} onChange={(e) => setPickup({ ...pickup, storeName: e.target.value })} placeholder="StylePrint Store" />
              </Field>
              <Field label="Dirección" required htmlFor="pk-address" className="md:col-span-2">
                <TextInput id="pk-address" value={pickup.address} onChange={(e) => setPickup({ ...pickup, address: e.target.value })} placeholder="Calle 123 #45-67, Local 101" />
              </Field>
              <Field label="Ciudad" required htmlFor="pk-city">
                <TextInput id="pk-city" value={pickup.city} onChange={(e) => setPickup({ ...pickup, city: e.target.value })} placeholder="Bogotá" />
              </Field>
              <Field label="Teléfono" htmlFor="pk-phone">
                <TextInput id="pk-phone" value={pickup.phone || ''} onChange={(e) => setPickup({ ...pickup, phone: e.target.value })} placeholder="+57 300 123 4567" />
              </Field>
              <Field label="Horario entre semana" required htmlFor="pk-week">
                <TextInput id="pk-week" value={pickup.scheduleWeekdays} onChange={(e) => setPickup({ ...pickup, scheduleWeekdays: e.target.value })} placeholder="Lunes a viernes: 9:00 a. m. - 6:00 p. m." />
              </Field>
              <Field label="Horario fines de semana" htmlFor="pk-weekend">
                <TextInput id="pk-weekend" value={pickup.scheduleWeekends || ''} onChange={(e) => setPickup({ ...pickup, scheduleWeekends: e.target.value })} placeholder="Sábados: 10:00 a. m. - 2:00 p. m." />
              </Field>
              <Field label="Enlace de Google Maps" htmlFor="pk-map" className="md:col-span-2">
                <TextInput id="pk-map" value={pickup.mapUrl || ''} onChange={(e) => setPickup({ ...pickup, mapUrl: e.target.value })} placeholder="https://maps.google.com/..." />
              </Field>
              <Field label="Información adicional" htmlFor="pk-info" className="md:col-span-2">
                <TextArea id="pk-info" rows={2} value={pickup.additionalInfo || ''} onChange={(e) => setPickup({ ...pickup, additionalInfo: e.target.value })} placeholder="Indicaciones para llegar, parqueadero disponible, etc." />
              </Field>
            </FormGrid>
          </Block>
        )}

        {form.type === 'nequi' && (
          <Block title="Cuenta Nequi">
            <FormGrid>
              <Field label="Número Nequi" required htmlFor="nq-phone">
                <TextInput id="nq-phone" value={nequi.phone} onChange={(e) => setNequi({ ...nequi, phone: e.target.value })} placeholder="300 123 4567" />
              </Field>
              <Field label="Titular de la cuenta" htmlFor="nq-holder">
                <TextInput id="nq-holder" value={nequi.accountHolder || ''} onChange={(e) => setNequi({ ...nequi, accountHolder: e.target.value })} placeholder="Nombre del titular" />
              </Field>
            </FormGrid>
            <p className="text-xs text-gray-500">El cliente paga a este número y adjunta el comprobante. El pedido queda pendiente de verificación hasta que lo apruebes.</p>
          </Block>
        )}

        {form.type === 'mercadopago' && (
          <Block title="Credenciales de Mercado Pago" link={{ href: 'https://www.mercadopago.com.co/developers/panel/app', label: 'Panel de desarrolladores' }}>
            <Alert tone="warning" title="Obtén tus credenciales en Mercado Pago">
              Entra a <strong>mercadopago.com.co/developers</strong>, crea una aplicación → <strong>Credenciales</strong> y copia la <strong>Public Key</strong> y el <strong>Access Token</strong> (de prueba o producción).
            </Alert>
            <Field label="Ambiente">
              <RadioGroup variant="segmented" value={mp.isTestMode ? 'test' : 'prod'} onChange={(v) => setMp({ ...mp, isTestMode: v === 'test' })} options={modeOptions('Prueba')} />
            </Field>
            <Field label="Public Key" required htmlFor="mp-pub">
              <TextInput id="mp-pub" value={mp.publicKey} onChange={(e) => setMp({ ...mp, publicKey: e.target.value })} placeholder={mp.isTestMode ? 'TEST-...' : 'APP_USR-...'} />
            </Field>
            <Field label="URL de notificaciones (Webhook)" hint={<>Pégala en Mercado Pago → <strong>Tu aplicación → Webhooks / Notificaciones</strong> (evento <em>Pagos</em>).</>}>
              <WebhookUrl url={mpWebhookUrl} />
            </Field>
            <Button variant="ghost" size="sm" icon={showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} onClick={() => setShowSecrets(!showSecrets)}>
              {showSecrets ? 'Ocultar Access Token' : 'Mostrar Access Token'}
            </Button>
            {showSecrets && (
              <Field label="Access Token" required htmlFor="mp-token" hint="Secreto del servidor. Se usa para crear la preferencia de pago y validar la confirmación. No se muestra en la tienda.">
                <TextInput id="mp-token" type="password" autoComplete="new-password" value={mp.accessToken || ''} onChange={(e) => setMp({ ...mp, accessToken: e.target.value })} placeholder={mp.isTestMode ? 'TEST-...' : 'APP_USR-...'} />
              </Field>
            )}
          </Block>
        )}

        {manual && (
          <div className="border-t border-gray-100 pt-4">
            <Checkbox
              checked={form.requireProof ?? false}
              onChange={(e) => setForm({ ...form, requireProof: e.target.checked })}
              label="Pedir comprobante de pago al cliente"
              description="El cliente puede adjuntar la captura del pago; el pedido queda pendiente de verificación por el admin."
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
