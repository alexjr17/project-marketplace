import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSettings } from '../../../context/SettingsContext';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../../components/shared/Button';
import { Input } from '../../../components/shared/Input';
import { Modal } from '../../../components/shared/Modal';
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
  Truck,
  MapPin,
  Clock,
  Package,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  Check,
  Plug,
  Table2,
  RefreshCw,
  History,
} from 'lucide-react';

// Pestañas del módulo de Envíos. Cada una es una ruta propia.
const SHIPPING_TABS = [
  { id: 'carriers', label: 'Transportadoras', path: '/admin-panel/shipping/carriers', icon: Truck },
  { id: 'zones', label: 'Zonas y Tarifas', path: '/admin-panel/shipping/zones', icon: MapPin },
  { id: 'connections', label: 'Conexiones', path: '/admin-panel/shipping/connections', icon: Plug },
  { id: 'config', label: 'Configuración', path: '/admin-panel/shipping/config', icon: Package },
] as const;

type ShippingTab = (typeof SHIPPING_TABS)[number]['id'];

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
  const toast = useToast();
  const location = useLocation();

  // Pestaña activa según la ruta.
  const activeTab: ShippingTab =
    (SHIPPING_TABS.find((t) => location.pathname.startsWith(t.path))?.id as ShippingTab) ?? 'carriers';

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

  const handleDeleteZone = (id: string) => {
    if (confirm('¿Eliminar esta zona de envío?')) {
      deleteShippingZone(id);
      toast.success('Zona eliminada');
    }
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

  const handleDeleteCarrier = (id: string) => {
    if (confirm('¿Eliminar esta transportadora?')) {
      deleteCarrier(id);
      if (connCarrierId === id) setConnCarrierId(null);
      toast.success('Transportadora eliminada');
    }
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
  };

  // Al entrar a Conexiones, preselecciona la transportadora predeterminada.
  useEffect(() => {
    if (activeTab !== 'connections' || connCarrierId) return;
    const carriers = settings.shipping.carriers;
    const def = carriers.find((c) => c.id === settings.shipping.defaultCarrierId) ?? carriers[0];
    if (def) handleSelectConnCarrier(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Truck className="w-8 h-8 text-orange-500" />
          Envíos
        </h1>
        <p className="text-gray-600 mt-1 text-sm">
          Transportadoras, zonas, tarifas y conexiones para calcular el costo de envío.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-6">
        {SHIPPING_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* ============ TAB: TRANSPORTADORAS ============ */}
      {activeTab === 'carriers' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-500" />
                Transportadoras
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Cada transportadora cotiza por tabla de tarifas o por conexión API.
              </p>
            </div>
            <Button onClick={() => handleOpenCarrierModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Transportadora
            </Button>
          </div>
          <div className="space-y-3">
            {settings.shipping.carriers.map((carrier) => {
              const isApi = carrier.integrationType === 'api';
              return (
                <div
                  key={carrier.id}
                  className={`border rounded-lg p-4 ${
                    carrier.isActive ? 'border-gray-200' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <Truck className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-gray-900">{carrier.name}</h4>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                            {carrier.code}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                              isApi ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {isApi ? <Plug className="w-3 h-3" /> : <Table2 className="w-3 h-3" />}
                            {isApi ? 'API' : 'Tabla'}
                          </span>
                          {settings.shipping.defaultCarrierId === carrier.id && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              Predeterminada
                            </span>
                          )}
                          {!carrier.isActive && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                              Inactiva
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span>Factor vol: {carrier.volumetricFactor}</span>
                          <span>{carrier.zoneRates.length} tarifas configuradas</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                      <button
                        onClick={() => handleOpenRatesModal(carrier)}
                        className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg"
                        title="Configurar tarifas"
                      >
                        <DollarSign className="w-4 h-4" />
                      </button>
                      {settings.shipping.defaultCarrierId !== carrier.id && carrier.isActive && (
                        <button
                          onClick={() => handleSetDefaultCarrier(carrier.id)}
                          className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg"
                          title="Establecer como predeterminada"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenCarrierModal(carrier)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCarrier(carrier.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {settings.shipping.carriers.length === 0 && (
              <div className="text-center py-8 text-gray-500">No hay transportadoras configuradas</div>
            )}
          </div>
        </div>
      )}

      {/* ============ TAB: ZONAS Y TARIFAS ============ */}
      {activeTab === 'zones' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-500" />
                  Zonas Geográficas
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Define las zonas de cobertura. Las tarifas se configuran por transportadora.
                </p>
              </div>
              <Button onClick={() => handleOpenZoneModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Zona
              </Button>
            </div>
            <div className="space-y-3">
              {settings.shipping.zones.map((zone) => (
                <div
                  key={zone.id}
                  className={`border rounded-lg p-4 ${
                    zone.isActive ? 'border-gray-200' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-gray-900">{zone.name}</h4>
                        {zone.department && (
                          <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded">
                            {zone.department}
                          </span>
                        )}
                        {!zone.isActive && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                            Inactiva
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {zone.cities.length > 0
                          ? `${zone.cities.length} ciudades: ${zone.cities.join(', ')}`
                          : 'Sin ciudades'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenZoneModal(zone)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteZone(zone.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {settings.shipping.zones.length === 0 && (
                <div className="text-center py-8 text-gray-500">No hay zonas de envío configuradas</div>
              )}
            </div>
          </div>

          {/* Tarifas por transportadora */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-1">
              <DollarSign className="w-5 h-5 text-orange-500" />
              Tarifas por Transportadora
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Costo base + costo por kg para cada zona (modo Tabla o respaldo de las API).
            </p>
            <div className="space-y-3">
              {settings.shipping.carriers.map((carrier) => (
                <div key={carrier.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{carrier.name}</h4>
                      <span className="text-xs text-gray-500">
                        {carrier.zoneRates.length} tarifas
                      </span>
                    </div>
                    <Button variant="admin-secondary" onClick={() => handleOpenRatesModal(carrier)}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar tarifas
                    </Button>
                  </div>
                  {carrier.zoneRates.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {carrier.zoneRates.map((rate) => (
                        <div key={rate.zoneId} className="bg-gray-50 rounded px-3 py-2 text-xs">
                          <div className="font-medium text-gray-700">{getZoneName(rate.zoneId)}</div>
                          <div className="text-gray-500 mt-0.5">
                            Base: ${rate.baseCost.toLocaleString()} • +$
                            {rate.costPerKg.toLocaleString()}/kg • {rate.estimatedDays.min}-
                            {rate.estimatedDays.max} días
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {settings.shipping.carriers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Crea una transportadora en la pestaña Transportadoras
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ TAB: CONEXIONES ============ */}
      {activeTab === 'connections' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de transportadoras */}
          <div className="bg-white rounded-lg shadow-sm p-4 lg:col-span-1">
            <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">
              Transportadoras
            </h3>
            <div className="space-y-2">
              {settings.shipping.carriers.map((carrier) => {
                const isSel = connCarrierId === carrier.id;
                const isApi = carrier.integrationType === 'api';
                return (
                  <button
                    key={carrier.id}
                    onClick={() => handleSelectConnCarrier(carrier)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                      isSel ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{carrier.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          isApi ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {isApi ? 'API' : 'Tabla'}
                      </span>
                    </div>
                  </button>
                );
              })}
              {settings.shipping.carriers.length === 0 && (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No hay transportadoras. Créalas primero.
                </p>
              )}
            </div>
          </div>

          {/* Editor de conexión */}
          <div className="bg-white rounded-lg shadow-sm p-6 lg:col-span-2">
            {!connCarrier ? (
              <div className="text-center py-16 text-gray-500">
                <Plug className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                Selecciona una transportadora para configurar su conexión
              </div>
            ) : (
              <div className="space-y-5">
                <h3 className="text-lg font-bold text-gray-900">
                  Conexión de {connCarrier.name}
                </h3>

                {/* Tipo de integración */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Modo de cotización
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setConnType('table')}
                      className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${
                        connType === 'table'
                          ? 'border-orange-400 bg-orange-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-medium text-gray-900">
                        <Table2 className="w-4 h-4" />
                        Tabla de tarifas
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Calcula con las tarifas por zona y peso. Sin internet.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConnType('api')}
                      className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${
                        connType === 'api'
                          ? 'border-orange-400 bg-orange-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-medium text-gray-900">
                        <Plug className="w-4 h-4" />
                        Conexión API
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Cotiza en vivo con la API de la transportadora.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Formulario API */}
                {connType === 'api' && (
                  <div className="space-y-4 border-t border-gray-100 pt-4">
                    {/* Plantilla de conexión */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Plantilla de conexión
                      </label>
                      <select
                        value=""
                        onChange={(e) => {
                          const preset = CARRIER_CONNECTION_PRESETS.find((p) => p.id === e.target.value);
                          if (preset) {
                            const next: CarrierApiConfig = JSON.parse(JSON.stringify(preset.config));
                            // Conservar la credencial ya escrita: aplicar una
                            // plantilla no debe borrar el token del usuario.
                            if (connApi.auth?.keyValue || connApi.auth?.password) {
                              next.auth = connApi.auth;
                            }
                            setConnApi(next);
                            toast.success(`Plantilla "${preset.label}" aplicada`);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Aplicar una plantilla base…</option>
                        {CARRIER_CONNECTION_PRESETS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Rellena la estructura típica. Debes ajustar la URL, las credenciales y los
                        nombres de los campos con la documentación del proveedor.
                      </p>
                    </div>

                    {/* Código de ESTA transportadora dentro de la API */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Código de esta transportadora en la API
                      </label>
                      <Input
                        value={connApiCarrierCode}
                        onChange={(e) => setConnApiCarrierCode(e.target.value)}
                        placeholder="ej. serviEntrega, tcc, interRapidisimo, coordinadora"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Identifica a esta transportadora dentro del agregador. Se inserta en la
                        plantilla del request como <code>{'{{carrier}}'}</code> — así cada
                        transportadora cotiza con su propio código.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          URL de cotización *
                        </label>
                        <Input
                          value={connApi.quoteUrl}
                          onChange={(e) => setConnApi({ ...connApi, quoteUrl: e.target.value })}
                          placeholder="https://api.transportadora.com/cotizar"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
                        <select
                          value={connApi.method}
                          onChange={(e) =>
                            setConnApi({ ...connApi, method: e.target.value as 'GET' | 'POST' })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="POST">POST</option>
                          <option value="GET">GET</option>
                        </select>
                      </div>
                    </div>

                    {/* Autenticación */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Autenticación
                        </label>
                        <select
                          value={connApi.auth.type}
                          onChange={(e) =>
                            setConnApi({
                              ...connApi,
                              auth: { ...connApi.auth, type: e.target.value as typeof connApi.auth.type },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="none">Ninguna</option>
                          <option value="apiKey">API Key</option>
                          <option value="bearer">Bearer Token</option>
                          <option value="basic">Usuario / Contraseña</option>
                        </select>
                      </div>

                      {connApi.auth.type === 'apiKey' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Ubicación / Nombre
                            </label>
                            <div className="flex gap-2">
                              <select
                                value={connApi.auth.keyLocation || 'header'}
                                onChange={(e) =>
                                  setConnApi({
                                    ...connApi,
                                    auth: {
                                      ...connApi.auth,
                                      keyLocation: e.target.value as 'header' | 'query',
                                    },
                                  })
                                }
                                className="px-2 py-2 border border-gray-300 rounded-lg text-sm"
                              >
                                <option value="header">Header</option>
                                <option value="query">Query</option>
                              </select>
                              <Input
                                value={connApi.auth.keyName || ''}
                                onChange={(e) =>
                                  setConnApi({
                                    ...connApi,
                                    auth: { ...connApi.auth, keyName: e.target.value },
                                  })
                                }
                                placeholder="Authorization"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Credencial
                            </label>
                            <Input
                              value={connApi.auth.keyValue || ''}
                              onChange={(e) =>
                                setConnApi({
                                  ...connApi,
                                  auth: { ...connApi.auth, keyValue: e.target.value },
                                })
                              }
                              placeholder="token / api key"
                            />
                          </div>
                        </>
                      )}

                      {connApi.auth.type === 'bearer' && (
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Token
                          </label>
                          <Input
                            value={connApi.auth.keyValue || ''}
                            onChange={(e) =>
                              setConnApi({
                                ...connApi,
                                auth: { ...connApi.auth, keyValue: e.target.value },
                              })
                            }
                            placeholder="Bearer token"
                          />
                        </div>
                      )}

                      {connApi.auth.type === 'basic' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Usuario
                            </label>
                            <Input
                              value={connApi.auth.username || ''}
                              onChange={(e) =>
                                setConnApi({
                                  ...connApi,
                                  auth: { ...connApi.auth, username: e.target.value },
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Contraseña
                            </label>
                            <Input
                              type="password"
                              value={connApi.auth.password || ''}
                              onChange={(e) =>
                                setConnApi({
                                  ...connApi,
                                  auth: { ...connApi.auth, password: e.target.value },
                                })
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Plantilla de request */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Plantilla del request (JSON)
                      </label>
                      <textarea
                        value={connApi.requestTemplate}
                        onChange={(e) => setConnApi({ ...connApi, requestTemplate: e.target.value })}
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-orange-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Variables: <code>{'{{origin.city}}'}</code>,{' '}
                        <code>{'{{destination.city}}'}</code>,{' '}
                        <code>{'{{destination.department}}'}</code>, <code>{'{{weight}}'}</code>,{' '}
                        <code>{'{{declaredValue}}'}</code>, <code>{'{{length}}'}</code>,{' '}
                        <code>{'{{width}}'}</code>, <code>{'{{height}}'}</code>,{' '}
                        <code>{'{{units}}'}</code>.
                      </p>
                    </div>

                    {/* Mapeo de respuesta */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mapeo de la respuesta
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <span className="text-xs text-gray-500">Ruta del costo *</span>
                          <Input
                            value={connApi.responseMapping.costPath}
                            onChange={(e) =>
                              setConnApi({
                                ...connApi,
                                responseMapping: {
                                  ...connApi.responseMapping,
                                  costPath: e.target.value,
                                },
                              })
                            }
                            placeholder="data.0.valorFlete"
                          />
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Ruta de días</span>
                          <Input
                            value={connApi.responseMapping.daysPath || ''}
                            onChange={(e) =>
                              setConnApi({
                                ...connApi,
                                responseMapping: {
                                  ...connApi.responseMapping,
                                  daysPath: e.target.value,
                                },
                              })
                            }
                            placeholder="data.0.tiempoEntrega"
                          />
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Ruta de error</span>
                          <Input
                            value={connApi.responseMapping.errorPath || ''}
                            onChange={(e) =>
                              setConnApi({
                                ...connApi,
                                responseMapping: {
                                  ...connApi.responseMapping,
                                  errorPath: e.target.value,
                                },
                              })
                            }
                            placeholder="message"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!connApi.responseMapping.costIsString}
                          onChange={(e) =>
                            setConnApi({
                              ...connApi,
                              responseMapping: {
                                ...connApi.responseMapping,
                                costIsString: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm text-gray-700">
                          El costo llega como texto ("12.500")
                        </span>
                      </label>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                      Los datos de la API son <strong>opcionales</strong>. Si los dejas vacíos
                      puedes guardar igual y el botón Sincronizar generará tarifas aproximadas.
                      Complétalos cuando tengas la URL y la API key de tu proveedor.
                    </div>
                  </div>
                )}

                {connType === 'table' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
                    Esta transportadora cotizará con su tabla de tarifas. Configúrala en la pestaña
                    "Zonas y Tarifas".
                  </div>
                )}

                {/* Sincronización de tarifas */}
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-orange-500" />
                        Sincronizar tarifas
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Trae las tarifas {connType === 'api' ? 'desde la API' : 'aproximadas'} y
                        revísalas antes de aplicarlas.
                      </p>
                    </div>
                    <Button
                      variant="admin-secondary"
                      onClick={handleSyncRates}
                      disabled={isSyncing || settings.shipping.zones.length === 0}
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                    </Button>
                  </div>

                  {settings.shipping.zones.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                      Crea al menos una zona en "Zonas y Tarifas" para poder sincronizar.
                    </p>
                  )}

                  {/* Registro de sincronizaciones */}
                  {connCarrier.rateSyncHistory && connCarrier.rateSyncHistory.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <History className="w-3.5 h-3.5" />
                        Registro de sincronizaciones
                      </p>
                      <div className="space-y-1.5 max-h-52 overflow-y-auto">
                        {connCarrier.rateSyncHistory.map((rec) => (
                          <div
                            key={rec.id}
                            className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2"
                          >
                            <span className="text-gray-700">
                              {new Date(rec.syncedAt).toLocaleString('es-CO', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">{rec.zonesUpdated} zonas</span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded ${
                                  rec.source === 'api'
                                    ? 'bg-blue-100 text-blue-700'
                                    : rec.source === 'mixed'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-purple-100 text-purple-700'
                                }`}
                              >
                                {rec.source === 'api'
                                  ? 'API'
                                  : rec.source === 'mixed'
                                    ? 'API parcial'
                                    : 'Aproximado'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-100">
                  <Button onClick={handleSaveConnection}>Guardar conexión</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ TAB: CONFIGURACIÓN ============ */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Origen de Envío */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-500" />
              Origen de Envío
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Dirección desde donde salen todos los paquetes (tu bodega o taller).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la Empresa *
                </label>
                <Input
                  value={settings.shipping.origin.companyName}
                  onChange={(e) =>
                    updateShippingSettings({
                      origin: { ...settings.shipping.origin, companyName: e.target.value },
                    })
                  }
                  placeholder="Mi Empresa SAS"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Persona de Contacto *
                </label>
                <Input
                  value={settings.shipping.origin.contactName}
                  onChange={(e) =>
                    updateShippingSettings({
                      origin: { ...settings.shipping.origin, contactName: e.target.value },
                    })
                  }
                  placeholder="Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
                <Input
                  value={settings.shipping.origin.phone}
                  onChange={(e) =>
                    updateShippingSettings({
                      origin: { ...settings.shipping.origin, phone: e.target.value },
                    })
                  }
                  placeholder="+57 300 123 4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código Postal
                </label>
                <Input
                  value={settings.shipping.origin.postalCode || ''}
                  onChange={(e) =>
                    updateShippingSettings({
                      origin: { ...settings.shipping.origin, postalCode: e.target.value },
                    })
                  }
                  placeholder="110111"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label>
                <Input
                  value={settings.shipping.origin.address}
                  onChange={(e) =>
                    updateShippingSettings({
                      origin: { ...settings.shipping.origin, address: e.target.value },
                    })
                  }
                  placeholder="Calle 123 #45-67, Bodega 5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad *</label>
                <Input
                  value={settings.shipping.origin.city}
                  onChange={(e) =>
                    updateShippingSettings({
                      origin: { ...settings.shipping.origin, city: e.target.value },
                    })
                  }
                  placeholder="Bogotá"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Departamento *
                </label>
                <Input
                  value={settings.shipping.origin.state}
                  onChange={(e) =>
                    updateShippingSettings({
                      origin: { ...settings.shipping.origin, state: e.target.value },
                    })
                  }
                  placeholder="Cundinamarca"
                />
              </div>
            </div>
          </div>

          {/* Tiempo de Preparación */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Tiempo de Preparación
            </h3>
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Días hábiles para preparar un pedido
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  value={settings.shipping.handlingTime}
                  onChange={(e) =>
                    updateShippingSettings({ handlingTime: parseInt(e.target.value) || 0 })
                  }
                  className="w-24"
                />
                <span className="text-gray-500">días</span>
              </div>
            </div>
          </div>

          {/* Configuración de Paquetes */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              Configuración de Paquetes
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Valores por defecto para calcular el costo de envío basado en peso y volumen.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Largo (cm)</label>
                <Input
                  type="number"
                  min="1"
                  value={settings.shipping.packageDefaults.defaultLength}
                  onChange={(e) =>
                    updateShippingSettings({
                      packageDefaults: {
                        ...settings.shipping.packageDefaults,
                        defaultLength: parseFloat(e.target.value) || 1,
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ancho (cm)</label>
                <Input
                  type="number"
                  min="1"
                  value={settings.shipping.packageDefaults.defaultWidth}
                  onChange={(e) =>
                    updateShippingSettings({
                      packageDefaults: {
                        ...settings.shipping.packageDefaults,
                        defaultWidth: parseFloat(e.target.value) || 1,
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Alto (cm)</label>
                <Input
                  type="number"
                  min="1"
                  value={settings.shipping.packageDefaults.defaultHeight}
                  onChange={(e) =>
                    updateShippingSettings({
                      packageDefaults: {
                        ...settings.shipping.packageDefaults,
                        defaultHeight: parseFloat(e.target.value) || 1,
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Peso/item (kg)
                </label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={settings.shipping.packageDefaults.defaultWeightPerItem}
                  onChange={(e) =>
                    updateShippingSettings({
                      packageDefaults: {
                        ...settings.shipping.packageDefaults,
                        defaultWeightPerItem: parseFloat(e.target.value) || 0.1,
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Factor Vol.</label>
                <Input
                  type="number"
                  min="1000"
                  value={settings.shipping.packageDefaults.volumetricDivisor}
                  onChange={(e) =>
                    updateShippingSettings({
                      packageDefaults: {
                        ...settings.shipping.packageDefaults,
                        volumetricDivisor: parseInt(e.target.value) || 5000,
                      },
                    })
                  }
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Peso volumétrico = (Largo x Ancho x Alto) / Factor. Se usa el mayor entre peso real y
              volumétrico.
            </p>
          </div>
        </div>
      )}

      {/* Zone Modal */}
      <Modal
        isOpen={isZoneModalOpen}
        onClose={() => setIsZoneModalOpen(false)}
        title={editingZone ? 'Editar Zona Geográfica' : 'Nueva Zona Geográfica'}
      >
        <div className="space-y-4">
          {/* Departamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Departamento *</label>
            <select
              value={zoneForm.department || ''}
              onChange={(e) => {
                const dept = e.target.value;
                setZoneForm({
                  ...zoneForm,
                  department: dept,
                  name: zoneForm.name || dept,
                  cities: [],
                });
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Selecciona un departamento</option>
              {COLOMBIA_DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Nombre de la zona */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la zona *
            </label>
            <Input
              value={zoneForm.name}
              onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
              placeholder="Ej: Sucre"
            />
          </div>

          {/* Ciudades del departamento */}
          {zoneForm.department && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">
                  Ciudades ({zoneForm.cities.length} seleccionadas)
                </label>
                <div className="flex gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setZoneForm({ ...zoneForm, cities: [...citiesOfDepartment(zoneForm.department!)] })
                    }
                    className="text-orange-600 hover:underline"
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoneForm({ ...zoneForm, cities: [] })}
                    className="text-gray-500 hover:underline"
                  >
                    Ninguna
                  </button>
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-2 grid grid-cols-2 gap-1">
                {citiesOfDepartment(zoneForm.department).map((city) => (
                  <label
                    key={city}
                    className="flex items-center gap-2 text-sm cursor-pointer px-1 py-0.5 hover:bg-gray-50 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={zoneForm.cities.includes(city)}
                      onChange={(e) =>
                        setZoneForm({
                          ...zoneForm,
                          cities: e.target.checked
                            ? [...zoneForm.cities, city]
                            : zoneForm.cities.filter((c) => c !== city),
                        })
                      }
                      className="w-4 h-4 text-orange-600 rounded"
                    />
                    {city}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Zona activa */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={zoneForm.isActive}
                onChange={(e) => setZoneForm({ ...zoneForm, isActive: e.target.checked })}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Zona activa</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="admin-secondary" onClick={() => setIsZoneModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSaveZone} className="flex-1">
              {editingZone ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Carrier Modal */}
      <Modal
        isOpen={isCarrierModalOpen}
        onClose={() => setIsCarrierModalOpen(false)}
        title={editingCarrier ? 'Editar Transportadora' : 'Nueva Transportadora'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <Input
                value={carrierForm.name}
                onChange={(e) => setCarrierForm({ ...carrierForm, name: e.target.value })}
                placeholder="Ej: Servientrega"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
              <Input
                value={carrierForm.code}
                onChange={(e) => setCarrierForm({ ...carrierForm, code: e.target.value.toUpperCase() })}
                placeholder="Ej: SERVI"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Factor Volumétrico</label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min="1000"
                value={carrierForm.volumetricFactor}
                onChange={(e) =>
                  setCarrierForm({ ...carrierForm, volumetricFactor: parseInt(e.target.value) || 5000 })
                }
                className="w-32"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCarrierForm({ ...carrierForm, volumetricFactor: 5000 })}
                  className={`px-3 py-1 text-xs rounded ${
                    carrierForm.volumetricFactor === 5000
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  5000 (Aéreo)
                </button>
                <button
                  type="button"
                  onClick={() => setCarrierForm({ ...carrierForm, volumetricFactor: 6000 })}
                  className={`px-3 py-1 text-xs rounded ${
                    carrierForm.volumetricFactor === 6000
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  6000 (Terrestre)
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL de Rastreo</label>
            <Input
              value={carrierForm.trackingUrlTemplate}
              onChange={(e) => setCarrierForm({ ...carrierForm, trackingUrlTemplate: e.target.value })}
              placeholder="https://ejemplo.com/rastreo?guia={tracking}"
            />
            <p className="text-xs text-gray-500 mt-1">Usa {'{tracking}'} donde va el número de guía</p>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={carrierForm.isActive}
                onChange={(e) => setCarrierForm({ ...carrierForm, isActive: e.target.checked })}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Transportadora activa</span>
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="admin-secondary"
              onClick={() => setIsCarrierModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveCarrier} className="flex-1">
              {editingCarrier ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Carrier Rates Modal */}
      <Modal
        isOpen={!!editingCarrierRates}
        onClose={handleCloseRatesModal}
        title={`Tarifas de ${editingCarrierRates?.name || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Configura las tarifas de envío para cada zona geográfica.
          </p>

          <div className="space-y-2">
            {editingCarrierRates?.zoneRates.map((rate) => (
              <div
                key={rate.zoneId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{getZoneName(rate.zoneId)}</div>
                  <div className="text-sm text-gray-500">
                    Base: ${rate.baseCost.toLocaleString()} • +${rate.costPerKg.toLocaleString()}/kg •
                    {rate.estimatedDays.min}-{rate.estimatedDays.max} días
                    {rate.freeShippingThreshold &&
                      ` • Gratis desde $${rate.freeShippingThreshold.toLocaleString()}`}
                  </div>
                </div>
                <button
                  onClick={() => handleOpenRateForm(rate)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {settings.shipping.zones.length > (editingCarrierRates?.zoneRates.length || 0) && (
            <Button variant="admin-secondary" onClick={() => handleOpenRateForm()} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Tarifa para Zona
            </Button>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={handleCloseRatesModal}>Cerrar</Button>
          </div>
        </div>
      </Modal>

      {/* Rate Edit Modal */}
      <Modal
        isOpen={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        title="Editar Tarifa"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
            <select
              value={rateForm.zoneId}
              onChange={(e) => setRateForm({ ...rateForm, zoneId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              disabled={editingCarrierRates?.zoneRates.some((r) => r.zoneId === rateForm.zoneId)}
            >
              <option value="">Seleccionar zona</option>
              {settings.shipping.zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo Base *</label>
              <Input
                type="number"
                min="0"
                value={rateForm.baseCost}
                onChange={(e) => setRateForm({ ...rateForm, baseCost: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo por kg *</label>
              <Input
                type="number"
                min="0"
                value={rateForm.costPerKg}
                onChange={(e) =>
                  setRateForm({ ...rateForm, costPerKg: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Días Mínimos</label>
              <Input
                type="number"
                min="0"
                value={rateForm.estimatedDays.min}
                onChange={(e) =>
                  setRateForm({
                    ...rateForm,
                    estimatedDays: { ...rateForm.estimatedDays, min: parseInt(e.target.value) || 0 },
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Días Máximos</label>
              <Input
                type="number"
                min="0"
                value={rateForm.estimatedDays.max}
                onChange={(e) =>
                  setRateForm({
                    ...rateForm,
                    estimatedDays: { ...rateForm.estimatedDays, max: parseInt(e.target.value) || 0 },
                  })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Envío Gratis Desde
              </label>
              <Input
                type="number"
                min="0"
                value={rateForm.freeShippingThreshold || ''}
                onChange={(e) =>
                  setRateForm({
                    ...rateForm,
                    freeShippingThreshold: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Peso Máximo (kg)
              </label>
              <Input
                type="number"
                min="0"
                value={rateForm.maxWeight || ''}
                onChange={(e) =>
                  setRateForm({
                    ...rateForm,
                    maxWeight: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                placeholder="Sin límite"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="admin-secondary" onClick={() => setIsRateModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSaveRate} className="flex-1">
              Guardar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Vista previa de tarifas sincronizadas */}
      <Modal
        isOpen={!!syncProposal}
        onClose={() => setSyncProposal(null)}
        title="Vista previa de tarifas"
        size="lg"
      >
        {syncProposal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Tarifas{' '}
              {syncProposal.source === 'api'
                ? 'traídas de la API'
                : syncProposal.source === 'mixed'
                  ? '(API + aproximadas)'
                  : 'aproximadas'}
              . Revísalas y decide si aplicarlas a {connCarrier?.name}.
            </p>

            {syncProposal.errors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 space-y-0.5">
                {syncProposal.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            )}

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Zona</th>
                    <th className="text-right px-3 py-2 font-medium">Tarifa actual</th>
                    <th className="text-right px-3 py-2 font-medium">Tarifa nueva</th>
                  </tr>
                </thead>
                <tbody>
                  {syncProposal.rates.map((nr) => {
                    const cur = connCarrier?.zoneRates.find((r) => r.zoneId === nr.zoneId);
                    const diff = cur ? nr.baseCost - cur.baseCost : 0;
                    return (
                      <tr key={nr.zoneId} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-900">{getZoneName(nr.zoneId)}</td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {cur
                            ? `$${cur.baseCost.toLocaleString()} + $${cur.costPerKg.toLocaleString()}/kg`
                            : '— nueva —'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">
                          ${nr.baseCost.toLocaleString()} + ${nr.costPerKg.toLocaleString()}/kg
                          {cur && diff !== 0 && (
                            <span
                              className={`ml-2 text-xs ${diff > 0 ? 'text-red-500' : 'text-green-600'}`}
                            >
                              {diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toLocaleString()}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="admin-secondary"
                onClick={() => setSyncProposal(null)}
                className="flex-1"
              >
                No aplicar
              </Button>
              <Button onClick={handleApplyProposal} className="flex-1">
                Aplicar tarifas
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
