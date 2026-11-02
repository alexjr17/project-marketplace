import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings } from '../../../context/SettingsContext';
import type {
  ShippingZone,
  ShippingCarrier,
  CarrierZoneRate,
  CarrierApiConfig,
  CarrierIntegrationType,
  RateSyncRecord,
} from '../../../types/settings';
import { CARRIER_CONNECTION_PRESETS } from '../../../types/settings';
import { shippingService, type SyncRatesResult } from '../../../services/shipping.service';
import { COLOMBIA_DEPARTMENTS, citiesOfDepartment } from '../../../data/colombiaGeo';
import {
  Truck, MapPin, Package, Plus, Pencil, Trash2, DollarSign, Check, Plug, Table2, RefreshCw, History, Star,
} from 'lucide-react';
import {
  ActionMenu, Alert, Badge, Button, Card, CardTitle, Checkbox, Dialog, EmptyState, Field, FormActions, FormGrid,
  IconButton, NumberInput, MoneyInput, Page, PageHeader, RadioGroup, SelectInput, Switch, Table, TableCard, TBody, Td,
  TextInput, Th, THead, Tr, TableMessage, toast, useConfirm,
} from '../../../components/ui';
import { ShippingConfigTab } from './shipping/ShippingConfigTab';
import { ConnectionApiForm } from './shipping/ConnectionApiForm';

// Secciones del módulo de Envíos. Cada una es una ruta propia; las pestañas las dibuja el layout.
const SHIPPING_TABS = [
  { id: 'carriers', path: '/admin-panel/shipping/carriers', icon: Truck, title: 'Transportadoras', subtitle: 'Cada transportadora cotiza con su tabla de tarifas o con una conexión API.' },
  { id: 'zones', path: '/admin-panel/shipping/zones', icon: MapPin, title: 'Zonas de envío', subtitle: 'Zonas de cobertura por departamento. Las tarifas se configuran en cada transportadora.' },
  { id: 'connections', path: '/admin-panel/shipping/connections', icon: Plug, title: 'Conexiones', subtitle: 'Cómo cotiza cada transportadora y sincronización de sus tarifas.' },
  { id: 'config', path: '/admin-panel/shipping/config', icon: Package, title: 'Configuración de envíos', subtitle: 'Origen de los paquetes, tiempo de preparación y medidas por defecto.' },
] as const;

type ShippingTab = (typeof SHIPPING_TABS)[number]['id'];

const money = (n: number) => `$${n.toLocaleString('es-CO')}`;

// Conexión API en blanco para una transportadora nueva.
const blankApiConfig = (): CarrierApiConfig => ({
  quoteUrl: '',
  method: 'POST',
  auth: { type: 'apiKey', keyLocation: 'header', keyName: 'Authorization', keyValue: '' },
  headers: {},
  requestTemplate: JSON.stringify(
    {
      origen: '{{origin.city}}',
      destino: '{{destination.city}}',
      departamentoDestino: '{{destination.department}}',
      peso: '{{weight}}',
      valorDeclarado: '{{declaredValue}}',
    },
    null,
    2
  ),
  responseMapping: { costPath: 'data.valor', daysPath: 'data.dias', errorPath: 'message' },
  timeoutMs: 8000,
});

const SOURCE_BADGE: Record<string, { label: string; tone: 'blue' | 'yellow' | 'gray' }> = {
  api: { label: 'API', tone: 'blue' },
  mixed: { label: 'API parcial', tone: 'yellow' },
};
const sourceBadge = (s: string) => SOURCE_BADGE[s] ?? { label: 'Aproximado', tone: 'gray' as const };

export const SettingsShippingPage = () => {
  const {
    settings,
    updateShippingSettings,
    addShippingZone,
    updateShippingZone,
    deleteShippingZone,
    addCarrier,
    updateCarrier,
    deleteCarrier,
    updateCarrierZoneRate,
    addCarrierZoneRate,
  } = useSettings();
  const confirm = useConfirm();
  const location = useLocation();

  // Sección activa según la ruta (/admin-panel/settings/shipping cae en Transportadoras).
  const activeTab: ShippingTab =
    (SHIPPING_TABS.find((t) => location.pathname.startsWith(t.path))?.id as ShippingTab) ?? 'carriers';
  const tabMeta = SHIPPING_TABS.find((t) => t.id === activeTab)!;

  // Modal states
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [isCarrierModalOpen, setIsCarrierModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [editingCarrier, setEditingCarrier] = useState<ShippingCarrier | null>(null);
  const [editingCarrierRates, setEditingCarrierRates] = useState<ShippingCarrier | null>(null);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);

  // Form states
  const [zoneForm, setZoneForm] = useState<Omit<ShippingZone, 'id'>>({
    name: '',
    department: '',
    cities: [],
    isActive: true,
  });
  const [carrierForm, setCarrierForm] = useState<Omit<ShippingCarrier, 'id'>>({
    name: '',
    code: '',
    trackingUrlTemplate: '',
    isActive: true,
    volumetricFactor: 5000,
    zoneRates: [],
  });
  const [rateForm, setRateForm] = useState<CarrierZoneRate>({
    zoneId: '',
    baseCost: 0,
    costPerKg: 0,
    estimatedDays: { min: 1, max: 3 },
  });

  // Conexiones: transportadora seleccionada y su config editable.
  const [connCarrierId, setConnCarrierId] = useState<string | null>(null);
  const [connType, setConnType] = useState<CarrierIntegrationType>('table');
  const [connApi, setConnApi] = useState<CarrierApiConfig>(blankApiConfig());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProposal, setSyncProposal] = useState<SyncRatesResult | null>(null);
  const [connApiCarrierCode, setConnApiCarrierCode] = useState('');
  // Plantilla base seleccionada: SIEMPRE una de las dos ('carrier' | 'envia').
  const [connApiPreset, setConnApiPreset] = useState<string>('carrier');

  // Zone handlers
  const handleOpenZoneModal = (zone?: ShippingZone) => {
    if (zone) {
      setEditingZone(zone);
      setZoneForm({
        name: zone.name,
        department: zone.department || '',
        cities: zone.cities,
        isActive: zone.isActive,
      });
    } else {
      setEditingZone(null);
      setZoneForm({ name: '', department: '', cities: [], isActive: true });
    }
    setIsZoneModalOpen(true);
  };

  const handleSaveZone = () => {
    if (!zoneForm.department) {
      toast.error('Selecciona un departamento');
      return;
    }
    if (zoneForm.cities.length === 0) {
      toast.error('Selecciona al menos una ciudad');
      return;
    }
    if (editingZone) {
      updateShippingZone(editingZone.id, zoneForm);
      toast.success('Zona actualizada');
    } else {
      addShippingZone(zoneForm);
      toast.success('Zona creada');
    }
    setIsZoneModalOpen(false);
  };

  const handleDeleteZone = async (zone: ShippingZone) => {
    const ok = await confirm({
      title: '¿Eliminar esta zona de envío?',
      message: `"${zone.name}" dejará de estar disponible para cotizar envíos.`,
      tone: 'danger',
    });
    if (!ok) return;
    deleteShippingZone(zone.id);
    toast.success('Zona eliminada');
  };

  // Carrier handlers
  const handleOpenCarrierModal = (carrier?: ShippingCarrier) => {
    if (carrier) {
      setEditingCarrier(carrier);
      setCarrierForm({
        name: carrier.name,
        code: carrier.code,
        trackingUrlTemplate: carrier.trackingUrlTemplate || '',
        isActive: carrier.isActive,
        volumetricFactor: carrier.volumetricFactor,
        integrationType: carrier.integrationType,
        apiConfig: carrier.apiConfig,
        zoneRates: carrier.zoneRates,
      });
    } else {
      setEditingCarrier(null);
      setCarrierForm({
        name: '',
        code: '',
        trackingUrlTemplate: '',
        isActive: true,
        volumetricFactor: 5000,
        zoneRates: [],
      });
    }
    setIsCarrierModalOpen(true);
  };

  const handleSaveCarrier = () => {
    if (editingCarrier) {
      updateCarrier(editingCarrier.id, carrierForm);
      toast.success('Transportadora actualizada');
    } else {
      const initialRates: CarrierZoneRate[] = settings.shipping.zones.map((zone) => ({
        zoneId: zone.id,
        baseCost: 10000,
        costPerKg: 2000,
        estimatedDays: { min: 2, max: 5 },
      }));
      addCarrier({ ...carrierForm, integrationType: 'table', zoneRates: initialRates });
      toast.success('Transportadora creada');
    }
    setIsCarrierModalOpen(false);
  };

  const handleDeleteCarrier = async (carrier: ShippingCarrier): Promise<boolean> => {
    const ok = await confirm({
      title: '¿Eliminar esta transportadora?',
      message: `Se borrarán "${carrier.name}" y sus tarifas. No se puede deshacer.`,
      tone: 'danger',
    });
    if (!ok) return false;
    deleteCarrier(carrier.id);
    if (connCarrierId === carrier.id) setConnCarrierId(null);
    toast.success('Transportadora eliminada');
    return true;
  };

  const handleSetDefaultCarrier = (id: string) => {
    updateShippingSettings({ defaultCarrierId: id });
    toast.success('Transportadora predeterminada actualizada');
  };

  // Rate handlers
  const handleOpenRatesModal = (carrier: ShippingCarrier) => setEditingCarrierRates(carrier);
  const handleCloseRatesModal = () => setEditingCarrierRates(null);

  const handleOpenRateForm = (rate?: CarrierZoneRate) => {
    if (rate) {
      setRateForm(rate);
    } else {
      const existingZoneIds = editingCarrierRates?.zoneRates.map((r) => r.zoneId) || [];
      const availableZone = settings.shipping.zones.find((z) => !existingZoneIds.includes(z.id));
      setRateForm({
        zoneId: availableZone?.id || '',
        baseCost: 10000,
        costPerKg: 2000,
        estimatedDays: { min: 2, max: 5 },
      });
    }
    setIsRateModalOpen(true);
  };

  const handleSaveRate = () => {
    if (!editingCarrierRates) return;

    const existingRate = editingCarrierRates.zoneRates.find((r) => r.zoneId === rateForm.zoneId);
    if (existingRate) {
      updateCarrierZoneRate(editingCarrierRates.id, rateForm.zoneId, rateForm);
    } else {
      addCarrierZoneRate(editingCarrierRates.id, rateForm);
    }

    setEditingCarrierRates((prev) => {
      if (!prev) return null;
      const existingIdx = prev.zoneRates.findIndex((r) => r.zoneId === rateForm.zoneId);
      if (existingIdx >= 0) {
        const newRates = [...prev.zoneRates];
        newRates[existingIdx] = rateForm;
        return { ...prev, zoneRates: newRates };
      }
      return { ...prev, zoneRates: [...prev.zoneRates, rateForm] };
    });

    setIsRateModalOpen(false);
    toast.success('Tarifa actualizada');
  };

  // Connection handlers
  const handleSelectConnCarrier = (carrier: ShippingCarrier) => {
    setConnCarrierId(carrier.id);
    setConnType(carrier.integrationType ?? 'table');
    setConnApi(carrier.apiConfig ?? blankApiConfig());
    setConnApiCarrierCode(carrier.apiCarrierCode ?? '');
    // Detecta qué plantilla está aplicada (Envía vs API propia) por la URL.
    setConnApiPreset(
      (carrier.apiConfig?.quoteUrl || '').includes('envia.com') ? 'envia' : 'carrier'
    );
  };

  // Al entrar a Conexiones, preselecciona la transportadora predeterminada.
  useEffect(() => {
    if (activeTab !== 'connections' || connCarrierId) return;
    const carriers = settings.shipping.carriers;
    const def = carriers.find((c) => c.id === settings.shipping.defaultCarrierId) ?? carriers[0];
    if (def) handleSelectConnCarrier(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Elegir "Conexión API": si aún no hay URL configurada, parte de una plantilla base.
  const handleChangeConnType = (type: CarrierIntegrationType) => {
    setConnType(type);
    if (type === 'api' && !connApi.quoteUrl) {
      const preset = CARRIER_CONNECTION_PRESETS.find((p) => p.id === connApiPreset)
        ?? CARRIER_CONNECTION_PRESETS[0];
      const next: CarrierApiConfig = JSON.parse(JSON.stringify(preset.config));
      if (connApi.auth?.keyValue || connApi.auth?.password) next.auth = connApi.auth;
      setConnApiPreset(preset.id);
      setConnApi(next);
    }
  };

  const handleSaveConnection = () => {
    const carrier = settings.shipping.carriers.find((c) => c.id === connCarrierId);
    if (!carrier) return;

    // Los datos de la API son opcionales: se puede guardar una conexión
    // sin completar (mientras tanto Sincronizar usa tarifas aproximadas).
    // Solo se valida el JSON de la plantilla si se escribió algo.
    if (connType === 'api' && connApi.requestTemplate.trim()) {
      try {
        JSON.parse(connApi.requestTemplate);
      } catch {
        toast.error('La plantilla del request no es un JSON válido');
        return;
      }
    }

    const { id: _id, ...rest } = carrier;
    updateCarrier(carrier.id, {
      ...rest,
      integrationType: connType,
      apiConfig: connType === 'api' ? connApi : carrier.apiConfig,
      apiCarrierCode: connApiCarrierCode,
    });
    toast.success('Conexión guardada');
  };

  // Sincroniza las tarifas: trae una propuesta y la muestra como vista previa.
  const handleSyncRates = async () => {
    if (!connCarrier) return;
    setIsSyncing(true);
    try {
      const result = await shippingService.syncRates({
        zones: settings.shipping.zones.map((z) => ({ id: z.id, name: z.name, cities: z.cities })),
        apiConfig: connType === 'api' ? connApi : undefined,
        origin: settings.shipping.origin,
        packageDefaults: settings.shipping.packageDefaults,
        carrierCode: connApiCarrierCode,
      });
      setSyncProposal(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al sincronizar tarifas');
    } finally {
      setIsSyncing(false);
    }
  };

  // Aplica la propuesta a las tarifas de la transportadora y la registra.
  const handleApplyProposal = () => {
    if (!connCarrier || !syncProposal) return;

    const merged: CarrierZoneRate[] = [...connCarrier.zoneRates];
    syncProposal.rates.forEach((pr) => {
      const idx = merged.findIndex((r) => r.zoneId === pr.zoneId);
      const prev = idx >= 0 ? merged[idx] : undefined;
      const next: CarrierZoneRate = {
        ...pr,
        freeShippingThreshold: prev?.freeShippingThreshold,
        maxWeight: prev?.maxWeight,
      };
      if (idx >= 0) merged[idx] = next;
      else merged.push(next);
    });

    const record: RateSyncRecord = {
      id: `sync-${Date.now()}`,
      syncedAt: syncProposal.syncedAt,
      source: syncProposal.source,
      zonesUpdated: syncProposal.rates.length,
      rates: syncProposal.rates,
    };

    const { id: _id, ...rest } = connCarrier;
    updateCarrier(connCarrier.id, {
      ...rest,
      zoneRates: merged,
      rateSyncHistory: [record, ...(connCarrier.rateSyncHistory ?? [])].slice(0, 20),
    });
    toast.success(`Tarifas actualizadas (${syncProposal.rates.length} zonas)`);
    setSyncProposal(null);
  };

  const getZoneName = (zoneId: string) =>
    settings.shipping.zones.find((z) => z.id === zoneId)?.name || 'Zona desconocida';

  const connCarrier = settings.shipping.carriers.find((c) => c.id === connCarrierId) || null;
  const { carriers, zones } = settings.shipping;

  const headerAction =
    activeTab === 'carriers' ? (
      <Button icon={<Plus className="w-4 h-4" />} onClick={() => handleOpenCarrierModal()}>Nueva transportadora</Button>
    ) : activeTab === 'zones' ? (
      <Button icon={<Plus className="w-4 h-4" />} onClick={() => handleOpenZoneModal()}>Nueva zona</Button>
    ) : undefined;

  return (
    <Page>
      <PageHeader icon={tabMeta.icon} title={tabMeta.title} subtitle={tabMeta.subtitle} actions={headerAction} />

      {/* ============ TRANSPORTADORAS ============ */}
      {activeTab === 'carriers' && (
        <TableCard>
          <Table>
            <THead>
              <tr>
                <Th>Transportadora</Th>
                <Th>Cotiza con</Th>
                <Th align="right">Tarifas</Th>
                <Th align="center">Estado</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </THead>
            <TBody>
              {carriers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={Truck}
                      title="Aún no hay transportadoras"
                      description="Crea la primera para poder cotizar y despachar envíos."
                      action={<Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => handleOpenCarrierModal()}>Nueva transportadora</Button>}
                    />
                  </td>
                </tr>
              ) : (
                carriers.map((carrier) => {
                  const isApi = carrier.integrationType === 'api';
                  const isDefault = settings.shipping.defaultCarrierId === carrier.id;
                  return (
                    <Tr key={carrier.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-lg bg-app-50 text-app-600 flex items-center justify-center flex-shrink-0">
                            <Truck className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 flex items-center gap-2">
                              {carrier.name}
                              {isDefault && <Badge tone="app"><Star className="w-3 h-3" /> Principal</Badge>}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">{carrier.code}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={isApi ? 'blue' : 'gray'}>
                          {isApi ? <Plug className="w-3 h-3" /> : <Table2 className="w-3 h-3" />}
                          {isApi ? 'Conexión API' : 'Tabla de tarifas'}
                        </Badge>
                      </Td>
                      <Td align="right">{carrier.zoneRates.length}</Td>
                      <Td align="center">
                        <Badge tone={carrier.isActive ? 'green' : 'gray'}>{carrier.isActive ? 'Activa' : 'Inactiva'}</Badge>
                      </Td>
                      <Td align="right" className="whitespace-nowrap">
                        <IconButton title="Configurar tarifas" tone="app" onClick={() => handleOpenRatesModal(carrier)}>
                          <DollarSign className="w-4 h-4" />
                        </IconButton>
                        <IconButton title="Editar" tone="app" onClick={() => handleOpenCarrierModal(carrier)}>
                          <Pencil className="w-4 h-4" />
                        </IconButton>
                        <ActionMenu
                          items={[
                            { label: 'Marcar como principal', icon: <Check className="w-4 h-4" />, onClick: () => handleSetDefaultCarrier(carrier.id), hidden: isDefault },
                            { label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => { handleDeleteCarrier(carrier); } },
                          ]}
                        />
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableCard>
      )}

      {/* ============ ZONAS ============ */}
      {activeTab === 'zones' && (
        <TableCard>
          <Table>
            <THead>
              <tr>
                <Th>Zona</Th>
                <Th>Departamento</Th>
                <Th>Ciudades</Th>
                <Th align="center">Estado</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </THead>
            <TBody>
              {zones.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={MapPin}
                      title="Aún no hay zonas de envío"
                      description="Crea una zona por departamento y elige sus ciudades."
                      action={<Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => handleOpenZoneModal()}>Nueva zona</Button>}
                    />
                  </td>
                </tr>
              ) : (
                zones.map((zone) => (
                  <Tr key={zone.id}>
                    <Td className="font-medium text-gray-900 whitespace-nowrap">{zone.name}</Td>
                    <Td className="whitespace-nowrap">{zone.department || <span className="text-gray-400">—</span>}</Td>
                    <Td>
                      {zone.cities.length > 0 ? (
                        <div className="max-w-md">
                          <p className="text-gray-900">{zone.cities.length} {zone.cities.length === 1 ? 'ciudad' : 'ciudades'}</p>
                          <p className="text-xs text-gray-500 truncate" title={zone.cities.join(', ')}>{zone.cities.join(', ')}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">Sin ciudades</span>
                      )}
                    </Td>
                    <Td align="center">
                      <Badge tone={zone.isActive ? 'green' : 'gray'}>{zone.isActive ? 'Activa' : 'Inactiva'}</Badge>
                    </Td>
                    <Td align="right" className="whitespace-nowrap">
                      <IconButton title="Editar" tone="app" onClick={() => handleOpenZoneModal(zone)}>
                        <Pencil className="w-4 h-4" />
                      </IconButton>
                      <IconButton title="Eliminar" tone="danger" onClick={() => handleDeleteZone(zone)}>
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </TableCard>
      )}

      {/* ============ CONEXIONES ============ */}
      {activeTab === 'connections' && (
        carriers.length === 0 ? (
          <Card>
            <EmptyState icon={Plug} title="No hay transportadoras" description="Crea una transportadora primero para configurar su conexión." />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* Lista de transportadoras */}
            <Card padded={false}>
              <p className="px-4 pt-4 pb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Transportadoras</p>
              <ul className="divide-y divide-gray-100">
                {carriers.map((carrier) => {
                  const isSel = connCarrierId === carrier.id;
                  const isApi = carrier.integrationType === 'api';
                  return (
                    <li key={carrier.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectConnCarrier(carrier)}
                        className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm transition-colors border-l-2 ${
                          isSel ? 'border-app-600 bg-app-50 text-app-700 font-medium' : 'border-transparent text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate">{carrier.name}</span>
                        <Badge tone={isApi ? 'blue' : 'gray'}>{isApi ? 'API' : 'Tabla'}</Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {/* Editor de conexión */}
            <div className="lg:col-span-2 space-y-5">
              {!connCarrier ? (
                <Card>
                  <EmptyState icon={Plug} title="Selecciona una transportadora" description="Elige una de la lista para configurar su conexión." />
                </Card>
              ) : (
                <>
                  <Card>
                    <CardTitle icon={Plug}>Conexión de {connCarrier.name}</CardTitle>
                    <div className="space-y-5">
                      <Field label="Modo de cotización">
                        <RadioGroup
                          variant="cards"
                          value={connType}
                          onChange={handleChangeConnType}
                          options={[
                            { value: 'table', label: 'Tabla de tarifas', description: 'Calcula con las tarifas por zona y peso. Sin internet.' },
                            { value: 'api', label: 'Conexión API', description: 'Cotiza en vivo con la API de la transportadora.' },
                          ]}
                        />
                      </Field>

                      {connType === 'api' ? (
                        <div className="border-t border-gray-100 pt-5">
                          <ConnectionApiForm
                            api={connApi}
                            setApi={setConnApi}
                            preset={connApiPreset}
                            setPreset={setConnApiPreset}
                            carrierCode={connApiCarrierCode}
                            setCarrierCode={setConnApiCarrierCode}
                          />
                        </div>
                      ) : (
                        <Alert tone="info">
                          Esta transportadora cotizará con su tabla de tarifas. Configúrala en Transportadoras → Configurar tarifas.
                        </Alert>
                      )}
                    </div>
                    <FormActions>
                      <Button onClick={handleSaveConnection}>Guardar conexión</Button>
                    </FormActions>
                  </Card>

                  {/* Sincronización de tarifas */}
                  <Card>
                    <CardTitle
                      icon={RefreshCw}
                      actions={
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />}
                          onClick={handleSyncRates}
                          disabled={isSyncing || zones.length === 0}
                        >
                          {isSyncing ? 'Sincronizando…' : 'Sincronizar'}
                        </Button>
                      }
                    >
                      Sincronizar tarifas
                    </CardTitle>
                    <p className="text-sm text-gray-500 -mt-2">
                      Trae las tarifas {connType === 'api' ? 'desde la API' : 'aproximadas'} y revísalas antes de aplicarlas.
                    </p>
                    {zones.length === 0 && (
                      <div className="mt-3">
                        <Alert tone="warning">Crea al menos una zona en Zonas de envío para poder sincronizar.</Alert>
                      </div>
                    )}

                    {connCarrier.rateSyncHistory && connCarrier.rateSyncHistory.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <History className="w-3.5 h-3.5" />
                          Registro de sincronizaciones
                        </p>
                        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg max-h-52 overflow-y-auto">
                          {connCarrier.rateSyncHistory.map((rec) => {
                            const b = sourceBadge(rec.source);
                            return (
                              <li key={rec.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                <span className="text-gray-700">
                                  {new Date(rec.syncedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                                <span className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">{rec.zonesUpdated} zonas</span>
                                  <Badge tone={b.tone}>{b.label}</Badge>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </Card>
                </>
              )}
            </div>
          </div>
        )
      )}

      {/* ============ CONFIGURACIÓN ============ */}
      {activeTab === 'config' && (
        <ShippingConfigTab shipping={settings.shipping} onSave={updateShippingSettings} />
      )}

      {/* Zona */}
      <Dialog
        open={isZoneModalOpen}
        onClose={() => setIsZoneModalOpen(false)}
        title={editingZone ? 'Editar zona de envío' : 'Nueva zona de envío'}
        description="Una zona agrupa las ciudades de un departamento con la misma tarifa."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsZoneModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveZone}>{editingZone ? 'Guardar' : 'Crear zona'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormGrid>
            <Field label="Departamento" required>
              <SelectInput
                value={zoneForm.department || ''}
                onChange={(e) => {
                  const dept = e.target.value;
                  setZoneForm({ ...zoneForm, department: dept, name: zoneForm.name || dept, cities: [] });
                }}
              >
                <option value="">Selecciona un departamento</option>
                {COLOMBIA_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </SelectInput>
            </Field>
            <Field label="Nombre de la zona" required>
              <TextInput value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="Ej: Sucre" />
            </Field>
          </FormGrid>

          {zoneForm.department && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">
                  Ciudades <span className="text-red-500">*</span>{' '}
                  <span className="font-normal text-gray-500">({zoneForm.cities.length} seleccionadas)</span>
                </span>
                <div className="flex gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setZoneForm({ ...zoneForm, cities: [...citiesOfDepartment(zoneForm.department!)] })}
                    className="text-app-700 hover:underline"
                  >
                    Todas
                  </button>
                  <button type="button" onClick={() => setZoneForm({ ...zoneForm, cities: [] })} className="text-gray-500 hover:underline">
                    Ninguna
                  </button>
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {citiesOfDepartment(zoneForm.department).map((city) => (
                  <Checkbox
                    key={city}
                    label={city}
                    checked={zoneForm.cities.includes(city)}
                    onChange={(e) =>
                      setZoneForm({
                        ...zoneForm,
                        cities: e.target.checked ? [...zoneForm.cities, city] : zoneForm.cities.filter((c) => c !== city),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          <Switch
            checked={zoneForm.isActive}
            onChange={(v) => setZoneForm({ ...zoneForm, isActive: v })}
            label="Zona activa"
            description="Las zonas inactivas no se usan para cotizar."
          />
        </div>
      </Dialog>

      {/* Transportadora */}
      <Dialog
        open={isCarrierModalOpen}
        onClose={() => setIsCarrierModalOpen(false)}
        title={editingCarrier ? 'Editar transportadora' : 'Nueva transportadora'}
        footer={
          <>
            {editingCarrier && (
              <Button
                variant="ghost"
                className="sm:mr-auto text-red-600 hover:bg-red-50 hover:text-red-700"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={async () => { if (await handleDeleteCarrier(editingCarrier)) setIsCarrierModalOpen(false); }}
              >
                Eliminar
              </Button>
            )}
            <Button variant="secondary" onClick={() => setIsCarrierModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCarrier}>{editingCarrier ? 'Guardar' : 'Crear transportadora'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormGrid>
            <Field label="Nombre" required>
              <TextInput value={carrierForm.name} onChange={(e) => setCarrierForm({ ...carrierForm, name: e.target.value })} placeholder="Ej: Servientrega" />
            </Field>
            <Field label="Código" required>
              <TextInput value={carrierForm.code} onChange={(e) => setCarrierForm({ ...carrierForm, code: e.target.value.toUpperCase() })} placeholder="Ej: SERVI" className="font-mono" />
            </Field>
          </FormGrid>
          <Field label="URL de rastreo" hint={<>Usa <code>{'{tracking}'}</code> donde va el número de guía.</>}>
            <TextInput
              value={carrierForm.trackingUrlTemplate}
              onChange={(e) => setCarrierForm({ ...carrierForm, trackingUrlTemplate: e.target.value })}
              placeholder="https://ejemplo.com/rastreo?guia={tracking}"
            />
          </Field>
          <Switch
            checked={carrierForm.isActive}
            onChange={(v) => setCarrierForm({ ...carrierForm, isActive: v })}
            label="Transportadora activa"
            description="Solo las activas se ofrecen al cotizar y despachar."
          />

          {editingCarrier && (
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Transportadora principal</p>
                <p className="text-xs text-gray-500">Se usa por defecto al cotizar y despachar.</p>
              </div>
              {settings.shipping.defaultCarrierId === editingCarrier.id ? (
                <Badge tone="green"><Check className="w-3 h-3" /> Es la principal</Badge>
              ) : (
                <Button size="sm" variant="secondary" icon={<Check className="w-4 h-4" />} onClick={() => handleSetDefaultCarrier(editingCarrier.id)}>
                  Marcar como principal
                </Button>
              )}
            </div>
          )}
        </div>
      </Dialog>

      {/* Tarifas de la transportadora */}
      <Dialog
        open={!!editingCarrierRates}
        onClose={handleCloseRatesModal}
        title={`Tarifas de ${editingCarrierRates?.name || ''}`}
        description="Costo de envío para cada zona geográfica."
        size="lg"
        footer={
          <>
            {zones.length > (editingCarrierRates?.zoneRates.length || 0) && (
              <Button variant="secondary" className="sm:mr-auto" icon={<Plus className="w-4 h-4" />} onClick={() => handleOpenRateForm()}>
                Agregar tarifa para zona
              </Button>
            )}
            <Button onClick={handleCloseRatesModal}>Cerrar</Button>
          </>
        }
      >
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <Table>
            <THead>
              <tr>
                <Th>Zona</Th>
                <Th align="right">Base</Th>
                <Th align="right">Por kg</Th>
                <Th align="right">Días</Th>
                <Th align="right">Gratis desde</Th>
                <Th align="right"><span className="sr-only">Acciones</span></Th>
              </tr>
            </THead>
            <TBody>
              {(editingCarrierRates?.zoneRates.length ?? 0) === 0 ? (
                <TableMessage colSpan={6}>Esta transportadora aún no tiene tarifas.</TableMessage>
              ) : (
                editingCarrierRates?.zoneRates.map((rate) => (
                  <Tr key={rate.zoneId}>
                    <Td className="font-medium text-gray-900">{getZoneName(rate.zoneId)}</Td>
                    <Td align="right">{money(rate.baseCost)}</Td>
                    <Td align="right">{money(rate.costPerKg)}</Td>
                    <Td align="right" className="whitespace-nowrap">{rate.estimatedDays.min}–{rate.estimatedDays.max}</Td>
                    <Td align="right">{rate.freeShippingThreshold ? money(rate.freeShippingThreshold) : <span className="text-gray-400">—</span>}</Td>
                    <Td align="right">
                      <IconButton title="Editar tarifa" tone="app" onClick={() => handleOpenRateForm(rate)}>
                        <Pencil className="w-4 h-4" />
                      </IconButton>
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Dialog>

      {/* Editar tarifa */}
      <Dialog
        open={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        title="Editar tarifa"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsRateModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveRate}>Guardar tarifa</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Zona">
            <SelectInput
              value={rateForm.zoneId}
              onChange={(e) => setRateForm({ ...rateForm, zoneId: e.target.value })}
              disabled={editingCarrierRates?.zoneRates.some((r) => r.zoneId === rateForm.zoneId)}
            >
              <option value="">Seleccionar zona</option>
              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
            </SelectInput>
          </Field>
          <FormGrid>
            <Field label="Costo base" required>
              <MoneyInput step="1" value={rateForm.baseCost} onChange={(e) => setRateForm({ ...rateForm, baseCost: parseFloat(e.target.value) || 0 })} />
            </Field>
            <Field label="Costo por kg" required>
              <MoneyInput step="1" value={rateForm.costPerKg} onChange={(e) => setRateForm({ ...rateForm, costPerKg: parseFloat(e.target.value) || 0 })} />
            </Field>
            <Field label="Días mínimos">
              <NumberInput
                min="0"
                suffix="días"
                value={rateForm.estimatedDays.min}
                onChange={(e) => setRateForm({ ...rateForm, estimatedDays: { ...rateForm.estimatedDays, min: parseInt(e.target.value) || 0 } })}
              />
            </Field>
            <Field label="Días máximos">
              <NumberInput
                min="0"
                suffix="días"
                value={rateForm.estimatedDays.max}
                onChange={(e) => setRateForm({ ...rateForm, estimatedDays: { ...rateForm.estimatedDays, max: parseInt(e.target.value) || 0 } })}
              />
            </Field>
            <Field label="Envío gratis desde" hint="Opcional. Valor del pedido.">
              <MoneyInput
                step="1"
                value={rateForm.freeShippingThreshold || ''}
                onChange={(e) => setRateForm({ ...rateForm, freeShippingThreshold: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Opcional"
              />
            </Field>
            <Field label="Peso máximo">
              <NumberInput
                min="0"
                suffix="kg"
                value={rateForm.maxWeight || ''}
                onChange={(e) => setRateForm({ ...rateForm, maxWeight: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Sin límite"
              />
            </Field>
          </FormGrid>
        </div>
      </Dialog>

      {/* Vista previa de tarifas sincronizadas */}
      <Dialog
        open={!!syncProposal}
        onClose={() => setSyncProposal(null)}
        title="Vista previa de tarifas"
        description={syncProposal ? `Tarifas ${
          syncProposal.source === 'api' ? 'traídas de la API' : syncProposal.source === 'mixed' ? '(API + aproximadas)' : 'aproximadas'
        }. Revísalas y decide si aplicarlas a ${connCarrier?.name ?? ''}.` : undefined}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSyncProposal(null)}>No aplicar</Button>
            <Button onClick={handleApplyProposal}>Aplicar tarifas</Button>
          </>
        }
      >
        {syncProposal && (
          <div className="space-y-4">
            {syncProposal.errors.length > 0 && (
              <Alert tone="warning">
                {syncProposal.errors.map((err, i) => <div key={i}>{err}</div>)}
              </Alert>
            )}
            <div className="border border-gray-200 rounded-lg overflow-x-auto">
              <Table>
                <THead>
                  <tr>
                    <Th>Zona</Th>
                    <Th align="right">Tarifa actual</Th>
                    <Th align="right">Tarifa nueva</Th>
                  </tr>
                </THead>
                <TBody>
                  {syncProposal.rates.map((nr) => {
                    const cur = connCarrier?.zoneRates.find((r) => r.zoneId === nr.zoneId);
                    const diff = cur ? nr.baseCost - cur.baseCost : 0;
                    return (
                      <Tr key={nr.zoneId}>
                        <Td className="text-gray-900">{getZoneName(nr.zoneId)}</Td>
                        <Td align="right" className="text-gray-500 whitespace-nowrap">
                          {cur ? `${money(cur.baseCost)} + ${money(cur.costPerKg)}/kg` : <Badge tone="blue">Nueva</Badge>}
                        </Td>
                        <Td align="right" className="font-medium text-gray-900 whitespace-nowrap">
                          {money(nr.baseCost)} + {money(nr.costPerKg)}/kg
                          {cur && diff !== 0 && (
                            <span className={`ml-2 text-xs ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {diff > 0 ? '▲' : '▼'} {money(Math.abs(diff))}
                            </span>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          </div>
        )}
      </Dialog>
    </Page>
  );
};
