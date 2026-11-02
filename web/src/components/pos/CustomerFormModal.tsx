import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import type { SelectedCustomer } from './CustomerSelect';
import { Button, Dialog, Field, TextInput } from '../ui';

interface Props {
  isOpen: boolean;
  /** Cliente a editar (si se está completando datos de uno existente/seleccionado). */
  initial?: SelectedCustomer | null;
  onClose: () => void;
  onSave: (customer: SelectedCustomer) => void;
}

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
    // Tomar el nombre tal cual (aunque no esté registrado o sea el por defecto).
    setName(initial?.name ?? '');
    setCedula(initial?.cedula ?? '');
    setPhone(initial?.phone ?? '');
    setEmail(initial?.email ?? '');
    setError('');
  }, [isOpen, initial]);

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

  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSave(); };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      size="sm"
      title={isEditing ? 'Editar cliente' : 'Registrar cliente'}
      description="Datos completos para la venta"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>Cancelar</Button>
          <Button size="lg" icon={<Save className="w-4 h-4" />} onClick={handleSave}>{isEditing ? 'Guardar' : 'Registrar'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre" required error={error || undefined}>
          <TextInput
            autoFocus
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            onKeyDown={onEnter}
            placeholder="Nombre del cliente"
            error={!!error}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cédula / NIT">
            <TextInput value={cedula} onChange={(e) => setCedula(e.target.value)} onKeyDown={onEnter} placeholder="123456789" />
          </Field>
          <Field label="Teléfono">
            <TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={onEnter} placeholder="3001234567" />
          </Field>
        </div>
        <Field label="Email">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter} placeholder="cliente@email.com" />
        </Field>
      </div>
    </Dialog>
  );
}
