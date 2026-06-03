import { useState } from 'react';
import { DollarSign, Clock, TrendingUp, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { useToast } from '../../context/ToastContext';
import * as cashRegisterService from '../../services/cash-register.service';
import OpenSessionPrompt from '../../components/pos/OpenSessionPrompt';

export default function CashRegisterPage() {
  const { currentSession, loadSession, isLoadingSession } = usePOS();
  const { showToast } = useToast();
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [finalCash, setFinalCash] = useState('');
  const [notes, setNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  // Calculate expected cash
  const expectedCash = currentSession
    ? Number(currentSession.initialCash) + Number(currentSession.totalSales)
    : 0;

  // Calculate difference
  const difference = finalCash ? parseFloat(finalCash) - expectedCash : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(date));
  };

  const handleCloseSession = async () => {
    if (!currentSession) return;

    if (!finalCash || parseFloat(finalCash) < 0) {
      showToast('Ingresa el monto de efectivo contado', 'error');
      return;
    }

    try {
      setIsClosing(true);
      await cashRegisterService.closeSession(currentSession.id, {
        finalCash: parseFloat(finalCash),
        notes: notes.trim() || undefined,
      });

      showToast('Sesión cerrada exitosamente', 'success');
      setShowCloseModal(false);
      setFinalCash('');
      setNotes('');
      await loadSession(); // Reload to clear session
    } catch (error: any) {
      console.error('Error closing session:', error);
      showToast(error.response?.data?.message || 'Error al cerrar la sesión', 'error');
    } finally {
      setIsClosing(false);
    }
  };

  // Mientras se valida si hay sesión abierta, mostrar un cargando (evita el
  // flash de "Sin Sesión" antes de tener la respuesta del servidor).
  if (isLoadingSession) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm">Validando sesión de caja…</p>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <OpenSessionPrompt
        title="Sin Sesion de Caja"
        message="Abre una sesion de caja para gestionar el efectivo"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Caja</h1>
          <p className="text-gray-600 mt-1">
            Sesión activa en {currentSession.cashRegister?.name}
          </p>
        </div>
        <button
          onClick={() => setShowCloseModal(true)}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
        >
          Cerrar Sesión de Caja
        </button>
      </div>

      {/* Session Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Opening Time */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600">Hora de Apertura</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {formatDate(currentSession.openedAt)}
          </p>
        </div>

        {/* Initial Cash */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600">Efectivo Inicial</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {formatCurrency(Number(currentSession.initialCash))}
          </p>
        </div>

        {/* Sales Count */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600">Ventas Realizadas</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {currentSession.salesCount} venta{currentSession.salesCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Total Sales */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600">Total Vendido</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {formatCurrency(Number(currentSession.totalSales))}
          </p>
        </div>
      </div>

      {/* Expected Cash */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-800 mb-1">Efectivo Esperado en Caja</p>
            <p className="text-3xl font-bold text-green-900">
              {formatCurrency(expectedCash)}
            </p>
            <p className="text-sm text-green-700 mt-2">
              Efectivo inicial + Total de ventas
            </p>
          </div>
          <div className="p-4 bg-white rounded-full">
            <DollarSign className="w-12 h-12 text-green-600" />
          </div>
        </div>
      </div>

      {/* Session Details */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Detalles de la Sesión
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Caja Registradora</p>
            <p className="font-medium text-gray-900">
              {currentSession.cashRegister?.name}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Ubicación</p>
            <p className="font-medium text-gray-900">
              {currentSession.cashRegister?.location}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Cajero</p>
            <p className="font-medium text-gray-900">{currentSession.seller?.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Estado</p>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
              Abierta
            </span>
          </div>
        </div>
      </div>

      {/* Close Session Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Cerrar Sesión de Caja</h2>
              <p className="text-sm text-gray-600 mt-1">Realiza el arqueo de caja</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Expected Cash */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Efectivo Esperado
                </p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatCurrency(expectedCash)}
                </p>
                <div className="text-xs text-blue-700 mt-2 space-y-1">
                  <p>Inicial: {formatCurrency(Number(currentSession.initialCash))}</p>
                  <p>Ventas: {formatCurrency(Number(currentSession.totalSales))}</p>
                </div>
              </div>

              {/* Final Cash Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Efectivo Contado <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <input
                    type="number"
                    value={finalCash}
                    onChange={(e) => setFinalCash(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    step="0.01"
                    min="0"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Ingresa el monto total de efectivo que hay en la caja
                </p>
              </div>

              {/* Difference Display */}
              {finalCash && (
                <div
                  className={`rounded-lg p-4 ${
                    difference === 0
                      ? 'bg-green-50 border border-green-200'
                      : difference > 0
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {difference === 0 ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle
                        className={`w-5 h-5 ${
                          difference > 0 ? 'text-blue-600' : 'text-red-600'
                        }`}
                      />
                    )}
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          difference === 0
                            ? 'text-green-900'
                            : difference > 0
                            ? 'text-blue-900'
                            : 'text-red-900'
                        }`}
                      >
                        {difference === 0
                          ? 'Caja cuadrada'
                          : difference > 0
                          ? 'Sobrante'
                          : 'Faltante'}
                      </p>
                      <p
                        className={`text-lg font-bold ${
                          difference === 0
                            ? 'text-green-900'
                            : difference > 0
                            ? 'text-blue-900'
                            : 'text-red-900'
                        }`}
                      >
                        {formatCurrency(Math.abs(difference))}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Agrega cualquier observación sobre el cierre..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowCloseModal(false);
                  setFinalCash('');
                  setNotes('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                disabled={isClosing}
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseSession}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={isClosing || !finalCash}
              >
                {isClosing ? 'Cerrando...' : 'Cerrar Sesión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
