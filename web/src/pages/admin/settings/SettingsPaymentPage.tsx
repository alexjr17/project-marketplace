import { useState } from 'react';
import { useSettings } from '../../../context/SettingsContext';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../../components/shared/Button';
import { Input } from '../../../components/shared/Input';
import { Modal } from '../../../components/shared/Modal';
import type { PaymentMethodConfig, WompiConfig, PickupConfig, NequiConfig, MercadoPagoConfig } from '../../../types/settings';
import { PAYMENT_TYPE_LABELS } from '../../../types/settings';
import {
  CreditCard,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Zap,
  AlertCircle,
  Eye,
  EyeOff,
  Store,
  Smartphone,
  Wallet,
  Copy,
} from 'lucide-react';

export const SettingsPaymentPage = () => {
  const {
    settings,
    updatePaymentSettings,
    addPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    togglePaymentMethod,
  } = useSettings();
  const toast = useToast();

  // Modal states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentMethodConfig | null>(null);

  // Form states
  const [paymentForm, setPaymentForm] = useState<Omit<PaymentMethodConfig, 'id'>>({
    type: 'transfer',
    name: '',
    description: '',
    instructions: '',
    isActive: true,
  });
  const [wompiForm, setWompiForm] = useState<WompiConfig>({
    publicKey: '',
    privateKey: '',
    integrityKey: '',
    eventSecret: '',
    isTestMode: true,
  });
  const [pickupForm, setPickupForm] = useState<PickupConfig>({
    storeName: '',
    address: '',
    city: '',
    scheduleWeekdays: '',
    scheduleWeekends: '',
    phone: '',
    mapUrl: '',
    additionalInfo: '',
  });
  const [nequiForm, setNequiForm] = useState<NequiConfig>({
    phone: '',
    accountHolder: '',
  });
  const [mpForm, setMpForm] = useState<MercadoPagoConfig>({
    publicKey: '',
    accessToken: '',
    isTestMode: true,
  });
  const [showSecrets, setShowSecrets] = useState(false);

  // URL base de la API (para mostrar las URLs de webhook que el comercio debe
  // registrar en el panel de Wompi / Mercado Pago).
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '');
  const wompiWebhookUrl = `${apiBase}/webhooks/wompi`;
  const mpWebhookUrl = `${apiBase}/webhooks/mercadopago`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('URL copiada');
  };

  const handleUpdateTax = (updates: { taxEnabled?: boolean; taxRate?: number; taxIncluded?: boolean }) => {
    updatePaymentSettings({
      taxEnabled: updates.taxEnabled ?? settings.payment?.taxEnabled ?? false,
      taxRate: updates.taxRate ?? settings.payment?.taxRate ?? 0,
      taxIncluded: updates.taxIncluded ?? settings.payment?.taxIncluded ?? false,
    });
    toast.success('Configuración de impuestos actualizada');
  };

  const handleOpenPaymentModal = (method?: PaymentMethodConfig) => {
    if (method) {
      setEditingPayment(method);
      setPaymentForm({
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
      });
      setNequiForm({
        phone: method.nequiConfig?.phone || '',
        accountHolder: method.nequiConfig?.accountHolder || '',
        qrImage: method.nequiConfig?.qrImage,
      });
      setMpForm({
        publicKey: method.mercadoPagoConfig?.publicKey || '',
        accessToken: method.mercadoPagoConfig?.accessToken || '',
        isTestMode: method.mercadoPagoConfig?.isTestMode ?? true,
      });
      if (method.wompiConfig) {
        setWompiForm({
          publicKey: method.wompiConfig.publicKey || '',
          privateKey: method.wompiConfig.privateKey || '',
          integrityKey: method.wompiConfig.integrityKey || '',
          eventSecret: method.wompiConfig.eventSecret || '',
          isTestMode: method.wompiConfig.isTestMode ?? true,
        });
      } else {
        setWompiForm({
          publicKey: '',
          privateKey: '',
          integrityKey: '',
          eventSecret: '',
          isTestMode: true,
        });
      }
      if (method.pickupConfig) {
        setPickupForm({
          storeName: method.pickupConfig.storeName || '',
          address: method.pickupConfig.address || '',
          city: method.pickupConfig.city || '',
          scheduleWeekdays: method.pickupConfig.scheduleWeekdays || '',
          scheduleWeekends: method.pickupConfig.scheduleWeekends || '',
          phone: method.pickupConfig.phone || '',
          mapUrl: method.pickupConfig.mapUrl || '',
          additionalInfo: method.pickupConfig.additionalInfo || '',
        });
      } else {
        setPickupForm({
          storeName: '',
          address: '',
          city: '',
          scheduleWeekdays: '',
          scheduleWeekends: '',
          phone: '',
          mapUrl: '',
          additionalInfo: '',
        });
      }
    } else {
      setEditingPayment(null);
      setPaymentForm({
        type: 'transfer',
        name: '',
        description: '',
        instructions: '',
        isActive: true,
        requireProof: true,
      });
      setWompiForm({
        publicKey: '',
        privateKey: '',
        integrityKey: '',
        eventSecret: '',
        isTestMode: true,
      });
      setNequiForm({ phone: '', accountHolder: '' });
      setMpForm({ publicKey: '', accessToken: '', isTestMode: true });
      setPickupForm({
        storeName: '',
        address: '',
        city: '',
        scheduleWeekdays: '',
        scheduleWeekends: '',
        phone: '',
        mapUrl: '',
        additionalInfo: '',
      });
    }
    setShowSecrets(false);
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async () => {
    const dataToSave = { ...paymentForm };

    if (paymentForm.type === 'wompi') {
      dataToSave.wompiConfig = {
        publicKey: wompiForm.publicKey,
        privateKey: wompiForm.privateKey || undefined,
        integrityKey: wompiForm.integrityKey || undefined,
        eventSecret: wompiForm.eventSecret || undefined,
        isTestMode: wompiForm.isTestMode,
      };
    }

    if (paymentForm.type === 'pickup') {
      dataToSave.pickupConfig = {
        storeName: pickupForm.storeName,
        address: pickupForm.address,
        city: pickupForm.city,
        scheduleWeekdays: pickupForm.scheduleWeekdays,
        scheduleWeekends: pickupForm.scheduleWeekends || undefined,
        phone: pickupForm.phone || undefined,
        mapUrl: pickupForm.mapUrl || undefined,
        additionalInfo: pickupForm.additionalInfo || undefined,
      };
    }

    if (paymentForm.type === 'nequi') {
      dataToSave.nequiConfig = {
        phone: nequiForm.phone,
        accountHolder: nequiForm.accountHolder || undefined,
        qrImage: nequiForm.qrImage || undefined,
      };
    }

    if (paymentForm.type === 'mercadopago') {
      dataToSave.mercadoPagoConfig = {
        publicKey: mpForm.publicKey,
        accessToken: mpForm.accessToken || undefined,
        isTestMode: mpForm.isTestMode,
      };
    }

    try {
      if (editingPayment) {
        await updatePaymentMethod(editingPayment.id, dataToSave);
        toast.success('Método de pago actualizado');
      } else {
        await addPaymentMethod(dataToSave);
        toast.success('Método de pago creado');
      }
      setIsPaymentModalOpen(false);
    } catch (error) {
      console.error('Error guardando método de pago:', error);
      toast.error('Error al guardar el método de pago');
    }
  };

  const handleDeletePayment = (id: string) => {
    if (confirm('¿Eliminar este método de pago?')) {
      deletePaymentMethod(id);
      toast.success('Método de pago eliminado');
    }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-8 h-8 text-orange-500" />
            Configuración de Pagos
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Administra impuestos y métodos de pago
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Impuestos */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-orange-500" />
              Configuración de Impuestos (IVA)
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.payment?.taxEnabled ?? false}
                onChange={(e) => handleUpdateTax({ taxEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              <span className="ms-3 text-sm font-medium text-gray-700">
                {settings.payment?.taxEnabled ? 'Habilitado' : 'Deshabilitado'}
              </span>
            </label>
          </div>

          {!settings.payment?.taxEnabled && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-700">
                <strong>Impuestos deshabilitados.</strong> Los precios se mostrarán sin IVA en POS y tienda online.
                Ideal para negocios pequeños no responsables de IVA.
              </p>
            </div>
          )}

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!settings.payment?.taxEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tasa de Impuesto (%)
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                value={settings.payment?.taxRate ?? 19}
                onChange={(e) => handleUpdateTax({ taxRate: parseFloat(e.target.value) || 0 })}
                disabled={!settings.payment?.taxEnabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                En Colombia el IVA general es del 19%
              </p>
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.payment?.taxIncluded ?? false}
                  onChange={(e) => handleUpdateTax({ taxIncluded: e.target.checked })}
                  disabled={!settings.payment?.taxEnabled}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-700">
                  Los precios ya incluyen impuestos
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Métodos de pago */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-500" />
              Métodos de Pago
            </h3>
            <Button onClick={() => handleOpenPaymentModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Método
            </Button>
          </div>
          <div className="space-y-3">
            {(settings.payment?.methods || []).map((method) => (
              <div
                key={method.id}
                className={`border rounded-lg p-4 ${method.isActive ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${method.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <CreditCard className={`w-5 h-5 ${method.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{method.name}</h4>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {PAYMENT_TYPE_LABELS[method.type]}
                        </span>
                      </div>
                      {method.description && (
                        <p className="text-sm text-gray-500 mt-1">{method.description}</p>
                      )}
                      {method.bankInfo && (
                        <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                          <p><strong>Banco:</strong> {method.bankInfo.bankName}</p>
                          <p><strong>Cuenta:</strong> {method.bankInfo.accountType} - {method.bankInfo.accountNumber}</p>
                          <p><strong>Titular:</strong> {method.bankInfo.accountHolder}</p>
                        </div>
                      )}
                      {method.type === 'wompi' && method.wompiConfig && (
                        <div className="mt-2 text-xs bg-purple-50 p-2 rounded">
                          <div className="flex items-center gap-2">
                            <Zap className="w-3 h-3 text-purple-600" />
                            <span className={`font-medium ${method.wompiConfig.isTestMode ? 'text-yellow-700' : 'text-green-700'}`}>
                              {method.wompiConfig.isTestMode ? 'Modo Prueba' : 'Modo Producción'}
                            </span>
                          </div>
                          {method.wompiConfig.publicKey && (
                            <p className="text-gray-500 mt-1">
                              <strong>Public Key:</strong> {method.wompiConfig.publicKey.slice(0, 20)}...
                            </p>
                          )}
                        </div>
                      )}
                      {method.type === 'pickup' && method.pickupConfig && (
                        <div className="mt-2 text-xs bg-green-50 p-2 rounded">
                          <div className="flex items-center gap-2">
                            <Store className="w-3 h-3 text-green-600" />
                            <span className="font-medium text-green-700">
                              {method.pickupConfig.storeName}
                            </span>
                          </div>
                          <p className="text-gray-500 mt-1">
                            <strong>Dirección:</strong> {method.pickupConfig.address}, {method.pickupConfig.city}
                          </p>
                          <p className="text-gray-500">
                            <strong>Horario:</strong> {method.pickupConfig.scheduleWeekdays}
                          </p>
                        </div>
                      )}
                      {method.type === 'nequi' && method.nequiConfig && (
                        <div className="mt-2 text-xs bg-fuchsia-50 p-2 rounded">
                          <div className="flex items-center gap-2">
                            <Smartphone className="w-3 h-3 text-fuchsia-600" />
                            <span className="font-medium text-fuchsia-700">
                              {method.nequiConfig.phone}
                            </span>
                          </div>
                          {method.nequiConfig.accountHolder && (
                            <p className="text-gray-500 mt-1">
                              <strong>Titular:</strong> {method.nequiConfig.accountHolder}
                            </p>
                          )}
                        </div>
                      )}
                      {method.type === 'mercadopago' && method.mercadoPagoConfig && (
                        <div className="mt-2 text-xs bg-sky-50 p-2 rounded">
                          <div className="flex items-center gap-2">
                            <Wallet className="w-3 h-3 text-sky-600" />
                            <span className={`font-medium ${method.mercadoPagoConfig.isTestMode ? 'text-yellow-700' : 'text-green-700'}`}>
                              {method.mercadoPagoConfig.isTestMode ? 'Modo Prueba' : 'Modo Producción'}
                            </span>
                          </div>
                          {method.mercadoPagoConfig.publicKey && (
                            <p className="text-gray-500 mt-1">
                              <strong>Public Key:</strong> {method.mercadoPagoConfig.publicKey.slice(0, 20)}...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => togglePaymentMethod(method.id)}
                      className={`p-2 rounded-lg ${method.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                      title={method.isActive ? 'Desactivar' : 'Activar'}
                    >
                      {method.isActive ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleOpenPaymentModal(method)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePayment(method.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {(settings.payment?.methods || []).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No hay métodos de pago configurados
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Method Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={editingPayment ? 'Editar Método de Pago' : 'Nuevo Método de Pago'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
            <select
              value={paymentForm.type}
              onChange={(e) => setPaymentForm({ ...paymentForm, type: e.target.value as PaymentMethodConfig['type'] })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              {Object.entries(PAYMENT_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <Input
              value={paymentForm.name}
              onChange={(e) => setPaymentForm({ ...paymentForm, name: e.target.value })}
              placeholder="Ej: Transferencia Bancolombia"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <Input
              value={paymentForm.description}
              onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
              placeholder="Breve descripción del método"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones</label>
            <textarea
              value={paymentForm.instructions}
              onChange={(e) => setPaymentForm({ ...paymentForm, instructions: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              placeholder="Instrucciones para el cliente"
            />
          </div>

          {paymentForm.type === 'wompi' && (
            <div className="bg-purple-50 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-600" />
                  Configuración de Wompi
                </h4>
                <a
                  href="https://comercios.wompi.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-600 hover:underline"
                >
                  Ir a Wompi Dashboard →
                </a>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-yellow-700">
                  <p className="font-medium">Obtén tus credenciales en Wompi</p>
                  <p className="mt-1">
                    1. Ingresa a <strong>comercios.wompi.co</strong><br />
                    2. Ve a <strong>Desarrolladores → Llaves de API</strong><br />
                    3. Copia las llaves según el ambiente (Pruebas o Producción)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="wompiMode"
                    checked={wompiForm.isTestMode}
                    onChange={() => setWompiForm({ ...wompiForm, isTestMode: true })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-sm text-gray-700">Modo Prueba (Sandbox)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="wompiMode"
                    checked={!wompiForm.isTestMode}
                    onChange={() => setWompiForm({ ...wompiForm, isTestMode: false })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-sm text-gray-700">Producción</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Llave Pública (Public Key) *
                </label>
                <Input
                  value={wompiForm.publicKey}
                  onChange={(e) => setWompiForm({ ...wompiForm, publicKey: e.target.value })}
                  placeholder={wompiForm.isTestMode ? 'pub_test_...' : 'pub_prod_...'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {wompiForm.isTestMode
                    ? 'Debe empezar con "pub_test_"'
                    : 'Debe empezar con "pub_prod_"'}
                </p>
              </div>

              {/* URL del webhook (eventos) que se registra en el panel de Wompi */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  URL de eventos (Webhook)
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white border border-purple-200 rounded-lg px-3 py-2 text-gray-700 break-all">
                    {wompiWebhookUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(wompiWebhookUrl)}
                    className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg"
                    title="Copiar URL"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Pégala en Wompi → <strong>Desarrolladores → Eventos / URL de eventos</strong>. Con
                  ella confirmamos automáticamente los pagos aprobados.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowSecrets(!showSecrets)}
                className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700"
              >
                {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showSecrets ? 'Ocultar claves secretas' : 'Mostrar claves secretas (opcional)'}
              </button>

              {showSecrets && (
                <div className="space-y-3 pt-2 border-t border-purple-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Llave de Integridad (Integrity Key)
                    </label>
                    <Input
                      type="password"
                      value={wompiForm.integrityKey}
                      onChange={(e) => setWompiForm({ ...wompiForm, integrityKey: e.target.value })}
                      placeholder="Opcional - para firmar transacciones"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Llave Privada (Private Key)
                    </label>
                    <Input
                      type="password"
                      value={wompiForm.privateKey}
                      onChange={(e) => setWompiForm({ ...wompiForm, privateKey: e.target.value })}
                      placeholder={wompiForm.isTestMode ? 'prv_test_...' : 'prv_prod_...'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Secreto de Eventos (Events Secret)
                    </label>
                    <Input
                      type="password"
                      value={wompiForm.eventSecret}
                      onChange={(e) => setWompiForm({ ...wompiForm, eventSecret: e.target.value })}
                      placeholder="Opcional - para validar webhooks"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {paymentForm.type === 'transfer' && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-gray-900">Información Bancaria</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Banco</label>
                  <Input
                    value={paymentForm.bankInfo?.bankName || ''}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      bankInfo: { ...paymentForm.bankInfo!, bankName: e.target.value }
                    })}
                    placeholder="Bancolombia"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Cuenta</label>
                  <select
                    value={paymentForm.bankInfo?.accountType || 'Ahorros'}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      bankInfo: { ...paymentForm.bankInfo!, accountType: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="Ahorros">Ahorros</option>
                    <option value="Corriente">Corriente</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Número de Cuenta</label>
                  <Input
                    value={paymentForm.bankInfo?.accountNumber || ''}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      bankInfo: { ...paymentForm.bankInfo!, accountNumber: e.target.value }
                    })}
                    placeholder="123-456789-00"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Titular</label>
                  <Input
                    value={paymentForm.bankInfo?.accountHolder || ''}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      bankInfo: { ...paymentForm.bankInfo!, accountHolder: e.target.value }
                    })}
                    placeholder="Nombre del titular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo Doc.</label>
                  <select
                    value={paymentForm.bankInfo?.documentType || 'CC'}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      bankInfo: { ...paymentForm.bankInfo!, documentType: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="CC">CC</option>
                    <option value="NIT">NIT</option>
                    <option value="CE">CE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Número Doc.</label>
                  <Input
                    value={paymentForm.bankInfo?.documentNumber || ''}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      bankInfo: { ...paymentForm.bankInfo!, documentNumber: e.target.value }
                    })}
                    placeholder="123.456.789"
                  />
                </div>
              </div>
            </div>
          )}

          {paymentForm.type === 'pickup' && (
            <div className="bg-green-50 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-green-600" />
                  Configuración del Punto Físico
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nombre de la Tienda *
                  </label>
                  <Input
                    value={pickupForm.storeName}
                    onChange={(e) => setPickupForm({ ...pickupForm, storeName: e.target.value })}
                    placeholder="StylePrint Store"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Dirección *
                  </label>
                  <Input
                    value={pickupForm.address}
                    onChange={(e) => setPickupForm({ ...pickupForm, address: e.target.value })}
                    placeholder="Calle 123 #45-67, Local 101"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Ciudad *
                  </label>
                  <Input
                    value={pickupForm.city}
                    onChange={(e) => setPickupForm({ ...pickupForm, city: e.target.value })}
                    placeholder="Bogotá"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <Input
                    value={pickupForm.phone || ''}
                    onChange={(e) => setPickupForm({ ...pickupForm, phone: e.target.value })}
                    placeholder="+57 300 123 4567"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Horario entre semana *
                  </label>
                  <Input
                    value={pickupForm.scheduleWeekdays}
                    onChange={(e) => setPickupForm({ ...pickupForm, scheduleWeekdays: e.target.value })}
                    placeholder="Lunes a Viernes: 9:00 AM - 6:00 PM"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Horario fines de semana
                  </label>
                  <Input
                    value={pickupForm.scheduleWeekends || ''}
                    onChange={(e) => setPickupForm({ ...pickupForm, scheduleWeekends: e.target.value })}
                    placeholder="Sábados: 10:00 AM - 2:00 PM"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    URL de Google Maps
                  </label>
                  <Input
                    value={pickupForm.mapUrl || ''}
                    onChange={(e) => setPickupForm({ ...pickupForm, mapUrl: e.target.value })}
                    placeholder="https://maps.google.com/..."
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Información adicional
                  </label>
                  <textarea
                    value={pickupForm.additionalInfo || ''}
                    onChange={(e) => setPickupForm({ ...pickupForm, additionalInfo: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                    placeholder="Indicaciones para llegar, parqueadero disponible, etc."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Nequi */}
          {paymentForm.type === 'nequi' && (
            <div className="bg-fuchsia-50 rounded-lg p-4 space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-fuchsia-600" />
                Configuración de Nequi
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Número Nequi *
                  </label>
                  <Input
                    value={nequiForm.phone}
                    onChange={(e) => setNequiForm({ ...nequiForm, phone: e.target.value })}
                    placeholder="300 123 4567"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Titular de la cuenta
                  </label>
                  <Input
                    value={nequiForm.accountHolder || ''}
                    onChange={(e) => setNequiForm({ ...nequiForm, accountHolder: e.target.value })}
                    placeholder="Nombre del titular"
                  />
                </div>
              </div>
              <p className="text-xs text-fuchsia-700">
                El cliente paga a este número y adjunta el comprobante. El pedido queda pendiente
                de verificación hasta que lo apruebes.
              </p>
            </div>
          )}

          {/* Mercado Pago */}
          {paymentForm.type === 'mercadopago' && (
            <div className="bg-sky-50 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-sky-600" />
                  Configuración de Mercado Pago
                </h4>
                <a
                  href="https://www.mercadopago.com.co/developers/panel/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sky-600 hover:underline"
                >
                  Panel de desarrolladores →
                </a>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-yellow-700">
                  <p className="font-medium">Obtén tus credenciales en Mercado Pago</p>
                  <p className="mt-1">
                    1. Entra a <strong>mercadopago.com.co/developers</strong><br />
                    2. Crea una aplicación → <strong>Credenciales</strong><br />
                    3. Copia la <strong>Public Key</strong> y el <strong>Access Token</strong>
                    (de prueba o producción)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mpMode"
                    checked={mpForm.isTestMode}
                    onChange={() => setMpForm({ ...mpForm, isTestMode: true })}
                    className="w-4 h-4 text-sky-600"
                  />
                  <span className="text-sm text-gray-700">Modo Prueba</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mpMode"
                    checked={!mpForm.isTestMode}
                    onChange={() => setMpForm({ ...mpForm, isTestMode: false })}
                    className="w-4 h-4 text-sky-600"
                  />
                  <span className="text-sm text-gray-700">Producción</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Public Key *
                </label>
                <Input
                  value={mpForm.publicKey}
                  onChange={(e) => setMpForm({ ...mpForm, publicKey: e.target.value })}
                  placeholder={mpForm.isTestMode ? 'TEST-...' : 'APP_USR-...'}
                />
              </div>

              {/* URL del webhook (notificaciones) para el panel de Mercado Pago */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  URL de notificaciones (Webhook)
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white border border-sky-200 rounded-lg px-3 py-2 text-gray-700 break-all">
                    {mpWebhookUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(mpWebhookUrl)}
                    className="p-2 text-sky-600 hover:bg-sky-100 rounded-lg"
                    title="Copiar URL"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Pégala en Mercado Pago → <strong>Tu aplicación → Webhooks / Notificaciones</strong>{' '}
                  (evento <em>Pagos</em>).
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowSecrets(!showSecrets)}
                className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700"
              >
                {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showSecrets ? 'Ocultar Access Token' : 'Mostrar Access Token'}
              </button>

              {showSecrets && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Access Token *
                  </label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={mpForm.accessToken || ''}
                    onChange={(e) => setMpForm({ ...mpForm, accessToken: e.target.value })}
                    placeholder={mpForm.isTestMode ? 'TEST-...' : 'APP_USR-...'}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Secreto del servidor. Se usa para crear la preferencia de pago y validar la
                    confirmación. No se muestra en la tienda.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Comprobante para métodos manuales */}
          {(paymentForm.type === 'transfer' ||
            paymentForm.type === 'nequi' ||
            paymentForm.type === 'pickup') && (
            <label className="flex items-start gap-2 cursor-pointer bg-gray-50 rounded-lg p-3">
              <input
                type="checkbox"
                checked={paymentForm.requireProof ?? false}
                onChange={(e) => setPaymentForm({ ...paymentForm, requireProof: e.target.checked })}
                className="w-4 h-4 mt-0.5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">
                Pedir comprobante de pago al cliente
                <span className="block text-xs text-gray-500">
                  El cliente puede adjuntar la captura del pago; el pedido queda pendiente de
                  verificación por el admin.
                </span>
              </span>
            </label>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="admin-secondary" onClick={() => setIsPaymentModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSavePayment} className="flex-1">
              {editingPayment ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
