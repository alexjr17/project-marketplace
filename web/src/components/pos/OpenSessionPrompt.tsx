import React, { useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { usePOS } from '../../context/POSContext';
import * as cashRegisterService from '../../services/cash-register.service';
import { Button, Card, Dialog, EmptyState, Field, MoneyInput, SelectInput, TextArea } from '../ui';

interface OpenSessionPromptProps {
  title?: string;
  message?: string;
}

export default function OpenSessionPrompt({
  title = 'Sin sesión activa',
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
  const handleOpenSession = async (e?: React.FormEvent) => {
    e?.preventDefault();

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

      showToast('Sesión abierta exitosamente', 'success');
      await loadSession();
      setShowOpenSession(false);
      setSelectedCashRegister(null);
      setInitialCash('');
      setNotes('');
    } catch (error: any) {
      console.error('Error opening session:', error);
      showToast(error?.message || 'Error al abrir sesión', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <Card>
        <EmptyState
          icon={Lock}
          title={title}
          description={message}
          action={
            <Button size="lg" icon={<Plus className="w-5 h-5" />} onClick={handleOpenSessionModal}>
              Abrir sesión de caja
            </Button>
          }
        />
      </Card>

      <Dialog
        open={showOpenSession}
        onClose={() => !isLoading && setShowOpenSession(false)}
        title="Abrir sesión de caja"
        description="Elige la caja y registra el efectivo con el que empiezas"
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={() => setShowOpenSession(false)} disabled={isLoading}>Cancelar</Button>
            <Button size="lg" type="submit" form="pos-open-session" isLoading={isLoading} disabled={!selectedCashRegister}>
              {isLoading ? 'Abriendo…' : 'Abrir sesión'}
            </Button>
          </>
        }
      >
        <form id="pos-open-session" onSubmit={handleOpenSession} className="space-y-4">
          <Field label="Caja registradora" required error={cashRegisters.length === 0 ? 'No hay cajas registradoras disponibles' : undefined}>
            <SelectInput
              value={selectedCashRegister || ''}
              onChange={(e) => setSelectedCashRegister(Number(e.target.value))}
              required
            >
              <option value="">Seleccionar caja…</option>
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
            </SelectInput>
          </Field>

          <Field label="Efectivo inicial" required>
            <MoneyInput
              value={initialCash}
              onChange={(e) => setInitialCash(e.target.value)}
              placeholder="0"
              step="100"
              required
            />
          </Field>

          <Field label="Notas" hint="Opcional">
            <TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notas sobre el inicio de la sesión…"
            />
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
