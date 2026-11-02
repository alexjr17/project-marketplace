import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import type { PackageDefaults, ShippingOrigin, ShippingSettings } from '../../../../types/settings';
import { Button, Field, FormActions, FormGrid, NumberInput, SettingsSection, TextInput, toast } from '../../../../components/ui';

interface Props {
  shipping: ShippingSettings;
  onSave: (data: Partial<ShippingSettings>) => Promise<void>;
}

/** Pestaña Configuración de Envíos: origen, tiempo de preparación y paquete por defecto. Un solo Guardar al final. */
export function ShippingConfigTab({ shipping, onSave }: Props) {
  const [origin, setOrigin] = useState<ShippingOrigin>(shipping.origin);
  const [handlingTime, setHandlingTime] = useState<number>(shipping.handlingTime);
  const [pkg, setPkg] = useState<PackageDefaults>(shipping.packageDefaults);
  const [saving, setSaving] = useState(false);

  // Si los ajustes cambian (carga inicial o después de guardar), el borrador se alinea.
  useEffect(() => {
    setOrigin(shipping.origin);
    setHandlingTime(shipping.handlingTime);
    setPkg(shipping.packageDefaults);
  }, [shipping.origin, shipping.handlingTime, shipping.packageDefaults]);

  const dirty =
    JSON.stringify(origin) !== JSON.stringify(shipping.origin) ||
    handlingTime !== shipping.handlingTime ||
    JSON.stringify(pkg) !== JSON.stringify(shipping.packageDefaults);

  const setO = (k: keyof ShippingOrigin, v: string) => setOrigin((o) => ({ ...o, [k]: v }));

  const reset = () => {
    setOrigin(shipping.origin);
    setHandlingTime(shipping.handlingTime);
    setPkg(shipping.packageDefaults);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ origin, handlingTime, packageDefaults: pkg });
      toast.success('Configuración de envíos guardada');
    } catch (e) {
      toast.error(e instanceof Error ? `No se pudo guardar: ${e.message}` : 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SettingsSection title="Origen de envío" description="Dirección desde donde salen todos los paquetes (tu bodega o taller). Se usa para cotizar y en las guías.">
        <FormGrid>
          <Field label="Nombre de la empresa" required>
            <TextInput value={origin.companyName} onChange={(e) => setO('companyName', e.target.value)} placeholder="Mi Empresa SAS" />
          </Field>
          <Field label="Persona de contacto" required>
            <TextInput value={origin.contactName} onChange={(e) => setO('contactName', e.target.value)} placeholder="Juan Pérez" />
          </Field>
          <Field label="Teléfono" required>
            <TextInput value={origin.phone} onChange={(e) => setO('phone', e.target.value)} placeholder="+57 300 123 4567" />
          </Field>
          <Field label="Código postal">
            <TextInput value={origin.postalCode || ''} onChange={(e) => setO('postalCode', e.target.value)} placeholder="110111" />
          </Field>
          <Field label="Dirección" required className="md:col-span-2">
            <TextInput value={origin.address} onChange={(e) => setO('address', e.target.value)} placeholder="Calle 123 #45-67, Bodega 5" />
          </Field>
          <Field label="Ciudad" required>
            <TextInput value={origin.city} onChange={(e) => setO('city', e.target.value)} placeholder="Bogotá" />
          </Field>
          <Field label="Departamento" required>
            <TextInput value={origin.state} onChange={(e) => setO('state', e.target.value)} placeholder="Cundinamarca" />
          </Field>
        </FormGrid>
      </SettingsSection>

      <SettingsSection title="Tiempo de preparación" description="Días hábiles que tardas en alistar un pedido antes de entregarlo a la transportadora. Se suma a los días de entrega.">
        <Field label="Días hábiles para preparar un pedido" className="max-w-xs">
          <NumberInput min="0" step="1" suffix="días" value={handlingTime} onChange={(e) => setHandlingTime(parseInt(e.target.value) || 0)} />
        </Field>
      </SettingsSection>

      <SettingsSection title="Paquete por defecto" description="Medidas y peso que se usan para estimar el peso volumétrico cuando el producto no los tiene. El factor volumétrico se configura en cada transportadora.">
        <FormGrid cols={4}>
          <Field label="Largo">
            <NumberInput min="1" suffix="cm" value={pkg.defaultLength} onChange={(e) => setPkg({ ...pkg, defaultLength: parseFloat(e.target.value) || 1 })} />
          </Field>
          <Field label="Ancho">
            <NumberInput min="1" suffix="cm" value={pkg.defaultWidth} onChange={(e) => setPkg({ ...pkg, defaultWidth: parseFloat(e.target.value) || 1 })} />
          </Field>
          <Field label="Alto">
            <NumberInput min="1" suffix="cm" value={pkg.defaultHeight} onChange={(e) => setPkg({ ...pkg, defaultHeight: parseFloat(e.target.value) || 1 })} />
          </Field>
          <Field label="Peso por ítem">
            <NumberInput min="0.01" step="0.01" suffix="kg" value={pkg.defaultWeightPerItem} onChange={(e) => setPkg({ ...pkg, defaultWeightPerItem: parseFloat(e.target.value) || 0.1 })} />
          </Field>
        </FormGrid>
      </SettingsSection>

      <FormActions sticky>
        <Button variant="secondary" onClick={reset} disabled={!dirty || saving}>Descartar cambios</Button>
        <Button icon={<Save className="w-4 h-4" />} isLoading={saving} disabled={!dirty} onClick={save}>Guardar cambios</Button>
      </FormActions>
    </div>
  );
}
