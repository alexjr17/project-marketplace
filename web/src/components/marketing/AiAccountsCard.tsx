/**
 * Cuentas de IA del estudio de contenido: Groq (textos) y las cuentas de Hugging Face con su cuota
 * de GPU del día (las mismas de Modelos 3D).
 */
import { useCallback, useEffect, useState } from 'react';
import { Cpu, RefreshCw } from 'lucide-react';
import { Badge, Card, CardTitle, IconButton, toast } from '../ui';
import { errorMessage } from '../../lib/http';
import { marketingService } from '../../services/marketing.service';
import type { HfAccounts } from '../../services/mannequinModels.service';

const dur = (s: number) => {
  const m = Math.floor(Math.max(0, s) / 60), r = Math.max(0, Math.round(s)) % 60;
  return m ? (r ? `${m} min ${r} s` : `${m} min`) : `${r} s`;
};

export function AiAccountsCard() {
  const [data, setData] = useState<(HfAccounts & { groq?: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    try {
      setData(await marketingService.accounts(fresh));
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo consultar las cuentas de IA'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardTitle
        icon={Cpu}
        actions={<IconButton title="Consultar de nuevo" onClick={() => load(true)} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></IconButton>}
      >
        Cuentas de IA
      </CardTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900">Groq · textos</p>
            {data && <Badge tone={data.groq ? 'green' : 'yellow'}>{data.groq ? 'Activa' : 'Sin llave'}</Badge>}
          </div>
          <p className="mt-2 text-xs text-gray-500">{data?.groq ? 'Escribe los textos, el llamado a la acción y los hashtags.' : 'Sin GROQ_API_KEY los textos salen de plantillas.'}</p>
        </div>
        {(data?.accounts ?? []).map((a) => {
          const pct = a.base ? Math.round((a.left / a.base) * 100) : 0;
          return (
            <div key={a.account} className="rounded-xl border border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900 truncate">HF {a.account}{a.user ? ` · ${a.user}` : ''}</p>
                <Badge tone={!a.ok ? 'red' : a.left >= 90 ? 'green' : 'gray'}>{!a.ok ? 'Sin conexión' : a.left >= 90 ? 'Disponible' : 'Sin tiempo hoy'}</Badge>
              </div>
              <p className="mt-2 text-lg font-semibold text-gray-900 tabular-nums">{dur(a.left)} <span className="text-sm font-normal text-gray-500">de {dur(a.base)}</span></p>
              <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={a.base} aria-valuenow={a.left} aria-label={`GPU de la cuenta ${a.account}`}>
                <div className="h-full rounded-full bg-app-600" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">{a.runsLeft} de {a.runsLimit} usos{a.resetsAt ? ` · se renueva ${new Date(a.resetsAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}` : ''}</p>
            </div>
          );
        })}
        {loading && !data && [1, 2, 3, 4, 5].map((i) => <div key={i} className="h-24 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />)}
      </div>
    </Card>
  );
}
