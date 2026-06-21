import { useState, useEffect } from 'react';
import { X, UserPlus, Save } from 'lucide-react';
import type { SelectedCustomer } from './CustomerSelect';

interface Props {
  isOpen: boolean;
  /** Cliente a editar (si se está completando datos de uno existente/seleccionado). */
  initial?: SelectedCustomer | null;
  onClose: () => void;
  onSave: (customer: SelectedCustomer) => void;
}

const DEFAULT_NAME = 'Consumidor Final';

/**
 * Formulario para registrar/completar un cliente con datos reales
 * (nombre, cédula/NIT, teléfono, email). No persiste por sí mismo: devuelve
 * el cliente y se guarda al cerrar la venta. Se usa tanto en el buscador del
 * POS como en el modal de cobro (botón "editar").
 */
export default function CustomerFormModal({ isOpen, initial, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [cedula, setCedula] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    // Si es el cliente por defecto, empezamos en blanco para capturar datos reales.
    const isDefault = !initial?.id && (initial?.name ?? '') === DEFAULT_NAME;
    setName(isDefault ? '' : (initial?.name ?? ''));
    setCedula(initial?.cedula ?? '');
    setPhone(initial?.phone ?? '');
    setEmail(initial?.email ?? '');
    setError('');
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const isEditing = !!initial?.id;

  const handleSave = () => {
    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    onSave({
      id: initial?.id,
      name: name.trim(),
      cedula: cedula.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-2.5">
            <div className="bg-white/20 rounded-full p-2">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                {isEditing ? 'Editar cliente' : 'Registrar cliente'}
              </h2>
              <p className="text-white/80 text-xs">Datos completos para la venta</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Nombre del cliente"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cédula / NIT</label>
              <input
                type="text"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="123456789"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="3001234567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="cliente@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              {isEditing ? 'Guardar' : 'Registrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
