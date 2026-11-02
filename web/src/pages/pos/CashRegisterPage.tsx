import { useState } from 'react';
import { DollarSign, Clock, TrendingUp, Wallet, Lock, Receipt } from 'lucide-react';
import { Alert, Badge, Button, Card, CardTitle, DescriptionList, Dialog, Field, MoneyInput, Page, PageHeader, Spinner, StatCard, TextArea } from '../../components/ui';
import { usePOS } from '../../context/POSContext';
import { useToast } from '../../context/ToastContext';
import * as cashRegisterService from '../../services/cash-register.service';
import OpenSessionPrompt from '../../components/pos/OpenSessionPrompt';
import PosReports from '../../components/pos/PosReports';

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
    return <Spinner label="Validando sesión de caja…" className="py-24" />;
  }

  if (!currentSession) {
    return (
      <Page>
        <PageHeader icon={Wallet} title="Caja" subtitle="Sesión de caja y arqueo" />
        <OpenSessionPrompt
          title="Sin sesión de caja"
          message="Abre una sesión de caja para gestionar el efectivo"
        />
      </Page>
    );
  }

  const cancelClose = () => {
    setShowCloseModal(false);
    setFinalCash('');
    setNotes('');
  };

  return (
    <Page>
      <PageHeader
        icon={Wallet}
        title="Caja"
        subtitle={`Sesión activa en ${currentSession.cashRegister?.name ?? 'caja'}`}
        actions={
          <Button variant="danger" size="lg" icon={<Lock className="w-4 h-4" />} onClick={() => setShowCloseModal(true)}>
            Cerrar sesión de caja
          </Button>
        }
      />

      {/* Indicadores de la sesión */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Clock} tone="blue" label="Apertura" value={<span className="text-lg">{formatDate(currentSession.openedAt)}</span>} />
        <StatCard icon={DollarSign} tone="gray" label="Efectivo inicial" value={formatCurrency(Number(currentSession.initialCash))} />
        <StatCard icon={Receipt} label="Ventas realizadas" value={currentSession.salesCount} hint={`venta${currentSession.salesCount !== 1 ? 's' : ''} en la sesión`} />
        <StatCard icon={TrendingUp} tone="green" label="Total vendido" value={formatCurrency(Number(currentSession.totalSales))} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Efectivo esperado */}
        <Card>
          <CardTitle icon={Wallet}>Efectivo esperado en caja</CardTitle>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(expectedCash)}</p>
          <p className="text-sm text-gray-500 mt-1">Efectivo inicial + total de ventas</p>
        </Card>

        {/* Detalles */}
        <div className="lg:col-span-2">
          <Card>
            <CardTitle>Detalles de la sesión</CardTitle>
            <DescriptionList
              cols={2}
              items={[
                { label: 'Caja registradora', value: currentSession.cashRegister?.name },
                { label: 'Ubicación', value: currentSession.cashRegister?.location },
                { label: 'Cajero', value: currentSession.seller?.name },
                { label: 'Estado', value: <Badge tone="green">Abierta</Badge> },
              ]}
            />
          </Card>
        </div>
      </div>

      {/* Reportes / gráficas de ventas */}
      <PosReports />

      {/* Cierre de caja (arqueo) */}
      <Dialog
        open={showCloseModal}
        onClose={() => !isClosing && cancelClose()}
        title="Cerrar sesión de caja"
        description="Realiza el arqueo de caja"
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={cancelClose} disabled={isClosing}>Cancelar</Button>
            <Button variant="danger" size="lg" onClick={handleCloseSession} isLoading={isClosing} disabled={!finalCash}>
              {isClosing ? 'Cerrando…' : 'Cerrar sesión'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Efectivo esperado</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(expectedCash)}</p>
            <div className="text-xs text-gray-500 mt-2 flex gap-4">
              <span>Inicial: {formatCurrency(Number(currentSession.initialCash))}</span>
              <span>Ventas: {formatCurrency(Number(currentSession.totalSales))}</span>
            </div>
          </div>

          <Field label="Efectivo contado" required hint="Ingresa el monto total de efectivo que hay en la caja">
            <MoneyInput
              value={finalCash}
              onChange={(e) => setFinalCash(e.target.value)}
              placeholder="0"
              autoFocus
              className="h-12 text-lg font-semibold"
            />
          </Field>

          {finalCash && (
            <Alert
              tone={difference === 0 ? 'success' : difference > 0 ? 'info' : 'error'}
              title={difference === 0 ? 'Caja cuadrada' : difference > 0 ? 'Sobrante' : 'Faltante'}
            >
              <span className="text-lg font-bold">{formatCurrency(Math.abs(difference))}</span>
            </Alert>
          )}

          <Field label="Notas" hint="Opcional">
            <TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Agrega cualquier observación sobre el cierre…"
            />
          </Field>
        </div>
      </Dialog>
    </Page>
  );
}
