import React, { useState } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { usePOS } from '../../context/POSContext';
import * as cashRegisterService from '../../services/cash-register.service';

interface OpenSessionPromptProps {
  title?: string;
  message?: string;
}

export default function OpenSessionPrompt({
  title = 'Sin Sesión Activa',
  message = 'Debes abrir una sesión de caja para continuar'
}: OpenSessionPromptProps) {
  const { showToast } = useToast();
  const { loadSession } = usePOS();

  const [showOpenSession, setShowOpenSession] = useState(false);
  const [cashRegisters, setCashRegisters] = useState<any[]>([]);
  const [selectedCashRegister, setSelectedCashRegister] = useState<number | null>(null);
  const [initialCash, setInitialCash] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load cash registers when opening session modal
  const handleOpenSessionModal = async () => {
    try {
      const registers = await cashRegisterService.getCashRegisters(true);
      setCashRegisters(registers);
      setShowOpenSession(true);
    } catch (error) {
      console.error('Error loading cash registers:', error);
      showToast('Error al cargar cajas registradoras', 'error');
    }
  };

  // Open session
  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCashRegister || !initialCash) {
      showToast('Por favor complete todos los campos', 'error');
      return;
    }

    try {
      setIsLoading(true);
      await cashRegisterService.openSession(selectedCashRegister, {
        initialCash: parseFloat(initialCash),
        notes,
      });

      showToast('Sesion abierta exitosamente', 'success');
      await loadSession();
      setShowOpenSession(false);
      setSelectedCashRegister(null);
      setInitialCash('');
      setNotes('');
    } catch (error: any) {
      console.error('Error opening session:', error);
      showToast(error.response?.data?.message || 'Error al abrir sesion', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
        <AlertCircle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <button
          onClick={handleOpenSessionModal}
          className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Abrir Sesion de Caja
        </button>
      </div>

      {/* Open Session Modal */}
      {showOpenSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Abrir Sesion de Caja
            </h3>

            <form onSubmit={handleOpenSession}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Caja Registradora
                  </label>
                  <select
                    value={selectedCashRegister || ''}
                    onChange={(e) => setSelectedCashRegister(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Seleccionar caja...</option>
                    {cashRegisters.map((register) => (
                      <option
                        key={register.id}
                        value={register.id}
                        disabled={register.cashSessions && register.cashSessions.length > 0}
                      >
                        {register.name} - {register.location}
                        {register.cashSessions && register.cashSessions.length > 0 && ' (En uso)'}
                      </option>
                    ))}
                  </select>
                  {cashRegisters.length === 0 && (
                    <p className="text-sm text-red-500 mt-1">
                      No hay cajas registradoras disponibles
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Efectivo Inicial
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={initialCash}
                      onChange={(e) => setInitialCash(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="0"
                      min="0"
                      step="100"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas (Opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                    placeholder="Notas sobre el inicio de la sesion..."
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowOpenSession(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  disabled={isLoading || !selectedCashRegister}
                >
                  {isLoading ? 'Abriendo...' : 'Abrir Sesion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
