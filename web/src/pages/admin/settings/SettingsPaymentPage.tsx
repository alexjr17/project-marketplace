import { useEffect, useState } from 'react';
import { useSettings } from '../../../context/SettingsContext';
import type { PaymentMethodConfig } from '../../../types/settings';
import { PAYMENT_TYPE_LABELS } from '../../../types/settings';
import { Banknote, CreditCard, Landmark, Pencil, Plus, Save, Smartphone, Store, Trash2, Wallet, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Alert, Badge, Button, EmptyState, Field, FormActions, IconButton, NumberInput, Page, PageHeader, SettingsSection, Switch,
  toast, useConfirm,
} from '../../../components/ui';
import { PaymentMethodDialog } from './PaymentMethodDialog';

const TYPE_ICON: Partial<Record<PaymentMethodConfig['type'], LucideIcon>> = {
  wompi: Zap, pickup: Store, nequi: Smartphone, mercadopago: Wallet, transfer: Landmark, cash: Banknote,
};

/** Resumen de una línea con los datos clave del método (cuenta, ambiente, punto físico…). */
function methodSummary(m: PaymentMethodConfig): string | null {
  if (m.type === 'transfer' && m.bankInfo) return [m.bankInfo.bankName, `${m.bankInfo.accountType} ${m.bankInfo.accountNumber}`, m.bankInfo.accountHolder].filter(Boolean).join(' · ');
  if (m.type === 'wompi' && m.wompiConfig?.publicKey) return `Public Key ${m.wompiConfig.publicKey.slice(0, 20)}…`;
  if (m.type === 'mercadopago' && m.mercadoPagoConfig?.publicKey) return `Public Key ${m.mercadoPagoConfig.publicKey.slice(0, 20)}…`;
  if (m.type === 'pickup' && m.pickupConfig) return `${m.pickupConfig.storeName} · ${m.pickupConfig.address}, ${m.pickupConfig.city} · ${m.pickupConfig.scheduleWeekdays}`;
  if (m.type === 'nequi' && m.nequiConfig) return [m.nequiConfig.phone, m.nequiConfig.accountHolder].filter(Boolean).join(' · ');
  return null;
}

/** Ambiente de las pasarelas en línea (Wompi, Mercado Pago). */
function modeOf(m: PaymentMethodConfig): boolean | null {
  if (m.type === 'wompi' && m.wompiConfig) return m.wompiConfig.isTestMode;
  if (m.type === 'mercadopago' && m.mercadoPagoConfig) return m.mercadoPagoConfig.isTestMode;
  return null;
}

/** Impuestos y métodos de pago de la tienda y el POS. */
export const SettingsPaymentPage = () => {
  const { settings, updatePaymentSettings, addPaymentMethod, updatePaymentMethod, deletePaymentMethod, togglePaymentMethod } = useSettings();
  const confirm = useConfirm();

  const loadTax = () => ({
    taxEnabled: settings.payment?.taxEnabled ?? false,
    taxRate: settings.payment?.taxRate ?? 19,
    taxIncluded: settings.payment?.taxIncluded ?? false,
  });
  const [tax, setTax] = useState(loadTax);
  const [savingTax, setSavingTax] = useState(false);
  useEffect(() => { setTax(loadTax()); }, [settings.payment?.taxEnabled, settings.payment?.taxRate, settings.payment?.taxIncluded]); // eslint-disable-line react-hooks/exhaustive-deps

  // null = cerrado; 'new' = nuevo; objeto = editar
  const [dialog, setDialog] = useState<PaymentMethodConfig | 'new' | null>(null);
  const methods = settings.payment?.methods || [];

  const saveTax = async () => {
    setSavingTax(true);
    try {
      await updatePaymentSettings(tax);
      toast.success('Configuración de impuestos actualizada');
    } catch {
      toast.error('No se pudo guardar la configuración de impuestos');
    } finally {
      setSavingTax(false);
    }
  };

  const saveMethod = async (data: Omit<PaymentMethodConfig, 'id'>) => {
    try {
      if (dialog && dialog !== 'new') {
        await updatePaymentMethod(dialog.id, data);
        toast.success('Método de pago actualizado');
      } else {
        await addPaymentMethod(data);
        toast.success('Método de pago creado');
      }
      setDialog(null);
    } catch (error) {
      console.error('Error guardando método de pago:', error);
      toast.error('Error al guardar el método de pago');
    }
  };

  const removeMethod = async (m: PaymentMethodConfig) => {
    if (!(await confirm({ title: `¿Eliminar "${m.name}"?`, message: 'Los clientes dejarán de verlo al pagar. No se puede deshacer.', tone: 'danger' }))) return;
    try {
      await deletePaymentMethod(m.id);
      toast.success('Método de pago eliminado');
    } catch {
      toast.error('No se pudo eliminar el método de pago');
    }
  };

  const toggleMethod = async (m: PaymentMethodConfig) => {
    try {
      await togglePaymentMethod(m.id);
    } catch {
      toast.error('No se pudo cambiar el estado del método');
    }
  };

  const taxDirty = JSON.stringify(tax) !== JSON.stringify(loadTax());

  return (
    <Page>
      <PageHeader
        icon={CreditCard}
        title="Pagos"
        subtitle="Impuestos y métodos de pago de la tienda en línea y el punto de venta"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setDialog('new')}>Nuevo método</Button>}
      />

      <div>
        <SettingsSection title="Impuestos (IVA)" description="Cómo se calcula y se muestra el IVA en el POS y en la tienda.">
          <Switch checked={tax.taxEnabled} onChange={(v) => setTax({ ...tax, taxEnabled: v })} label="Cobrar impuestos" description="Actívalo si tu negocio es responsable de IVA." />
          {!tax.taxEnabled ? (
            <Alert tone="info" title="Impuestos deshabilitados">Los precios se mostrarán sin IVA en el POS y la tienda. Ideal para negocios no responsables de IVA.</Alert>
          ) : (
            <>
              <Field label="Tasa de impuesto" htmlFor="tax-rate" hint="En Colombia el IVA general es del 19 %.">
                <NumberInput id="tax-rate" min="0" max="100" suffix="%" className="max-w-[8rem]" value={tax.taxRate}
                  onChange={(e) => setTax({ ...tax, taxRate: parseFloat(e.target.value) || 0 })} />
              </Field>
              <Switch checked={tax.taxIncluded} onChange={(v) => setTax({ ...tax, taxIncluded: v })} label="Los precios ya incluyen impuestos" description="Si está apagado, el IVA se suma al precio al cobrar." />
            </>
          )}
          <FormActions>
            {taxDirty && <Button variant="secondary" onClick={() => setTax(loadTax())} disabled={savingTax}>Descartar</Button>}
            <Button icon={<Save className="w-4 h-4" />} isLoading={savingTax} disabled={!taxDirty} onClick={saveTax}>Guardar impuestos</Button>
          </FormActions>
        </SettingsSection>

        <SettingsSection title="Métodos de pago" description="Opciones que el cliente ve al pagar. Apágalos para ocultarlos sin perder su configuración.">
          {methods.length === 0 ? (
            <EmptyState icon={CreditCard} title="No hay métodos de pago configurados" description="Crea el primero para empezar a cobrar."
              action={<Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setDialog('new')}>Nuevo método</Button>} />
          ) : (
            <ul className="-my-4 divide-y divide-gray-100">
              {methods.map((m) => {
                const Icon = TYPE_ICON[m.type] ?? CreditCard;
                const summary = methodSummary(m);
                const test = modeOf(m);
                return (
                  <li key={m.id} className="flex items-start gap-3 py-4">
                    <span className={`p-2 rounded-lg flex-shrink-0 ${m.isActive ? 'bg-app-50 text-app-600' : 'bg-gray-100 text-gray-400'}`}><Icon className="w-5 h-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`font-medium ${m.isActive ? 'text-gray-900' : 'text-gray-500'}`}>{m.name}</p>
                        <Badge tone="gray">{PAYMENT_TYPE_LABELS[m.type]}</Badge>
                        {test !== null && <Badge tone={test ? 'yellow' : 'green'}>{test ? 'Modo prueba' : 'Producción'}</Badge>}
                      </div>
                      {m.description && <p className="text-sm text-gray-500 mt-0.5">{m.description}</p>}
                      {summary && <p className="text-xs text-gray-500 mt-1 break-words">{summary}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span title={m.isActive ? 'Desactivar' : 'Activar'} className="mr-1"><Switch checked={m.isActive} onChange={() => toggleMethod(m)} /></span>
                      <IconButton title="Editar" tone="app" onClick={() => setDialog(m)}><Pencil className="w-4 h-4" /></IconButton>
                      <IconButton title="Eliminar" tone="danger" onClick={() => removeMethod(m)}><Trash2 className="w-4 h-4" /></IconButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SettingsSection>
      </div>

      {dialog && (
        <PaymentMethodDialog
          key={dialog === 'new' ? 'new' : dialog.id}
          method={dialog === 'new' ? null : dialog}
          onClose={() => setDialog(null)}
          onSave={saveMethod}
        />
      )}
    </Page>
  );
};
