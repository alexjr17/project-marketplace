import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_NAV, SETTINGS_NAV, canSee, visibleTabs } from './adminNav';
import type { LucideIcon } from 'lucide-react';

interface Entry { label: string; group: string; path: string; icon: LucideIcon }

/** Buscador de módulos del panel (Ctrl+K / ⌘K): escribe y salta a cualquier pantalla. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    ADMIN_NAV.forEach((s) => s.items.filter((i) => canSee(i, hasPermission)).forEach((i) => {
      if (i.tabs) visibleTabs(i, hasPermission).forEach((t) => out.push({ label: t.label, group: `${s.label ?? 'Panel'} · ${i.label}`, path: t.path, icon: i.icon }));
      else out.push({ label: i.label, group: s.label ?? 'Panel', path: i.path, icon: i.icon });
    }));
    SETTINGS_NAV.filter((i) => canSee(i, hasPermission)).forEach((i) =>
      visibleTabs(i, hasPermission).forEach((t) => out.push({ label: t.label, group: `Configuración · ${i.label}`, path: t.path, icon: i.icon })));
    return out;
  }, [hasPermission]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!t) return entries;
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return entries.filter((e) => norm(`${e.label} ${e.group}`).includes(t));
  }, [entries, q]);

  useEffect(() => { setIdx(0); }, [q, open]);
  useEffect(() => { if (!open) setQ(''); }, [open]);

  if (!open) return null;

  const go = (e?: Entry) => { if (!e) return; navigate(e.path); onClose(); };

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Buscar en el panel">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl animate-fade-in">
        <div className="flex items-center gap-3 border-b border-gray-100 px-4">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); go(results[idx]); }
              else if (e.key === 'Escape') onClose();
            }}
            placeholder="Buscar módulo… (pedidos, tallas, roles)"
            className="h-12 flex-1 bg-transparent text-sm focus:outline-none"
          />
          <kbd className="hidden sm:inline rounded border border-gray-200 px-1.5 text-[10px] text-gray-400">ESC</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2" role="listbox">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-gray-400">Ningún módulo coincide con “{q}”.</li>
          ) : results.map((e, i) => {
            const Icon = e.icon;
            return (
              <li key={e.path + e.label} role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => go(e)}
                className={`mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${i === idx ? 'bg-app-50' : ''}`}>
                <Icon className={`w-4 h-4 ${i === idx ? 'text-app-600' : 'text-gray-400'}`} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">{e.label}</span>
                  <span className="block truncate text-xs text-gray-500">{e.group}</span>
                </span>
                {i === idx && <CornerDownLeft className="w-4 h-4 text-gray-400" />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
