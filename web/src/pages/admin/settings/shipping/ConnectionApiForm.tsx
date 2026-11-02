import type { CarrierApiConfig } from '../../../../types/settings';
import { CARRIER_CONNECTION_PRESETS } from '../../../../types/settings';
import { Alert, Checkbox, Field, FormGrid, SelectInput, TextArea, TextInput, toast } from '../../../../components/ui';

interface Props {
  api: CarrierApiConfig;
  setApi: (api: CarrierApiConfig) => void;
  preset: string;
  setPreset: (id: string) => void;
  carrierCode: string;
  setCarrierCode: (code: string) => void;
}

const VARS = ['origin.city', 'destination.city', 'destination.department', 'weight', 'declaredValue', 'length', 'width', 'height', 'units'];

/** Campos de la conexión API de una transportadora (plantilla, URL, autenticación, request y mapeo). */
export function ConnectionApiForm({ api, setApi, preset, setPreset, carrierCode, setCarrierCode }: Props) {
  const setAuth = (patch: Partial<CarrierApiConfig['auth']>) => setApi({ ...api, auth: { ...api.auth, ...patch } });
  const setMap = (patch: Partial<CarrierApiConfig['responseMapping']>) =>
    setApi({ ...api, responseMapping: { ...api.responseMapping, ...patch } });

  const applyPreset = (id: string) => {
    const p = CARRIER_CONNECTION_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(p.id);
    const next: CarrierApiConfig = JSON.parse(JSON.stringify(p.config));
    // Conservar la credencial ya escrita: aplicar una plantilla no debe borrar el token del usuario.
    if (api.auth?.keyValue || api.auth?.password) next.auth = api.auth;
    setApi(next);
    toast.success(`Plantilla "${p.label}" aplicada`);
  };

  return (
    <div className="space-y-4">
      <Field
        label="Plantilla de conexión"
        hint={CARRIER_CONNECTION_PRESETS.find((p) => p.id === preset)?.description ||
          'Rellena la estructura típica. Debes ajustar la URL, las credenciales y los nombres de los campos con la documentación del proveedor.'}
      >
        <SelectInput value={preset} onChange={(e) => applyPreset(e.target.value)}>
          {CARRIER_CONNECTION_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </SelectInput>
      </Field>

      <Field
        label="Código de esta transportadora en la API"
        hint={<>Identifica a esta transportadora dentro del agregador. Se inserta en la plantilla del request como <code>{'{{carrier}}'}</code>, así cada transportadora cotiza con su propio código.</>}
      >
        <TextInput value={carrierCode} onChange={(e) => setCarrierCode(e.target.value)} placeholder="ej. serviEntrega, tcc, interRapidisimo, coordinadora" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Field label="URL de cotización" required className="sm:col-span-3">
          <TextInput value={api.quoteUrl} onChange={(e) => setApi({ ...api, quoteUrl: e.target.value })} placeholder="https://api.transportadora.com/cotizar" />
        </Field>
        <Field label="Método">
          <SelectInput value={api.method} onChange={(e) => setApi({ ...api, method: e.target.value as 'GET' | 'POST' })}>
            <option value="POST">POST</option>
            <option value="GET">GET</option>
          </SelectInput>
        </Field>
      </div>

      <FormGrid cols={3}>
        <Field label="Autenticación">
          <SelectInput value={api.auth.type} onChange={(e) => setAuth({ type: e.target.value as typeof api.auth.type })}>
            <option value="none">Ninguna</option>
            <option value="apiKey">API Key</option>
            <option value="bearer">Bearer Token</option>
            <option value="basic">Usuario / Contraseña</option>
          </SelectInput>
        </Field>

        {api.auth.type === 'apiKey' && (
          <>
            <Field label="Ubicación / nombre">
              <div className="flex gap-2">
                <SelectInput value={api.auth.keyLocation || 'header'} onChange={(e) => setAuth({ keyLocation: e.target.value as 'header' | 'query' })} className="w-28 flex-shrink-0">
                  <option value="header">Header</option>
                  <option value="query">Query</option>
                </SelectInput>
                <TextInput value={api.auth.keyName || ''} onChange={(e) => setAuth({ keyName: e.target.value })} placeholder="Authorization" />
              </div>
            </Field>
            <Field label="Credencial">
              <TextInput type="password" autoComplete="new-password" value={api.auth.keyValue || ''} onChange={(e) => setAuth({ keyValue: e.target.value })} placeholder="token / api key" />
            </Field>
          </>
        )}

        {api.auth.type === 'bearer' && (
          <Field label="Token" className="md:col-span-2">
            <TextInput type="password" autoComplete="new-password" value={api.auth.keyValue || ''} onChange={(e) => setAuth({ keyValue: e.target.value })} placeholder="Bearer token" />
          </Field>
        )}

        {api.auth.type === 'basic' && (
          <>
            <Field label="Usuario">
              <TextInput value={api.auth.username || ''} onChange={(e) => setAuth({ username: e.target.value })} />
            </Field>
            <Field label="Contraseña">
              <TextInput type="password" value={api.auth.password || ''} onChange={(e) => setAuth({ password: e.target.value })} />
            </Field>
          </>
        )}
      </FormGrid>

      <Field
        label="Plantilla del request (JSON)"
        hint={<>Variables: {VARS.map((v, i) => <span key={v}>{i > 0 && ', '}<code>{`{{${v}}}`}</code></span>)}.</>}
      >
        <TextArea rows={8} value={api.requestTemplate} onChange={(e) => setApi({ ...api, requestTemplate: e.target.value })} className="font-mono text-xs" />
      </Field>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Mapeo de la respuesta</p>
        <FormGrid cols={3}>
          <Field label="Ruta del costo" required>
            <TextInput value={api.responseMapping.costPath} onChange={(e) => setMap({ costPath: e.target.value })} placeholder="data.0.valorFlete" />
          </Field>
          <Field label="Ruta de días">
            <TextInput value={api.responseMapping.daysPath || ''} onChange={(e) => setMap({ daysPath: e.target.value })} placeholder="data.0.tiempoEntrega" />
          </Field>
          <Field label="Ruta de error">
            <TextInput value={api.responseMapping.errorPath || ''} onChange={(e) => setMap({ errorPath: e.target.value })} placeholder="message" />
          </Field>
        </FormGrid>
        <Checkbox
          className="mt-3"
          label='El costo llega como texto ("12.500")'
          checked={!!api.responseMapping.costIsString}
          onChange={(e) => setMap({ costIsString: e.target.checked })}
        />
      </div>

      <Alert tone="info">
        Los datos de la API son <strong>opcionales</strong>. Si los dejas vacíos puedes guardar igual y el botón Sincronizar generará tarifas aproximadas. Complétalos cuando tengas la URL y la API key de tu proveedor.
      </Alert>
    </div>
  );
}
