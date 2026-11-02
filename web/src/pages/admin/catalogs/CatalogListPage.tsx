import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle, Layers, Pencil, Plus, Trash2, XCircle } from 'lucide-react';
import {
  Badge, Button, Dialog, EmptyState, FilterBar, IconButton, Page, PageHeader, Pager, SearchInput, SelectInput,
  StatCard, Table, TableCard, TableMessage, TBody, Td, Th, THead, Tr,
} from '../../../components/ui';

/**
 * Piezas comunes de las 4 pestañas de Atributos (Categorías · Tipos de producto · Tallas · Colores).
 * Así las cuatro pantallas tienen la misma estructura: encabezado, indicadores, filtros, tabla y diálogo.
 */

/** Mensaje legible de un error de la API. */
export const errMsg = (e: unknown, fallback: string) => {
  const m = e instanceof Error ? e.message : '';
  return m ? `${fallback}: ${m}` : fallback;
};

export interface CatalogColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  /** Valor para ordenar; si no hay, la columna no se ordena. */
  sort?: (row: T) => string | number;
  render: (row: T) => ReactNode;
}

type Status = 'all' | 'active' | 'inactive';

export function CatalogListPage<T extends { id: number; isActive: boolean }>({
  icon, title, subtitle, newLabel, noun, rows, columns, searchText, searchPlaceholder, loading, defaultSort,
  onNew, onEdit, onDelete,
}: {
  icon: LucideIcon; title: string; subtitle: string; newLabel: string;
  /** Nombre en plural y minúscula para los textos ("categorías"). */
  noun: string;
  rows: T[]; columns: CatalogColumn<T>[]; searchText: (row: T) => string; searchPlaceholder: string;
  loading?: boolean; defaultSort?: string;
  onNew: () => void; onEdit: (row: T) => void; onDelete: (row: T) => void;
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSort);
  const [desc, setDesc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let list = rows.filter((r) =>
      (status === 'all' || (status === 'active' ? r.isActive : !r.isActive)) &&
      (!t || searchText(r).toLowerCase().includes(t)));
    const col = columns.find((c) => c.key === sortKey);
    if (col?.sort) {
      const get = col.sort;
      list = [...list].sort((a, b) => {
        const va = get(a); const vb = get(b);
        const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es');
        return desc ? -r : r;
      });
    }
    return list;
  }, [rows, q, status, sortKey, desc, columns, searchText]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const active = rows.filter((r) => r.isActive).length;
  const colSpan = columns.length + 2;

  const toggleSort = (key: string) => {
    if (sortKey === key) setDesc((d) => !d);
    else { setSortKey(key); setDesc(false); }
  };
  const resetPage = <V,>(fn: (v: V) => void) => (v: V) => { fn(v); setPage(1); };

  return (
    <Page>
      <PageHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={onNew}>{newLabel}</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={Layers} label="Total" value={rows.length} />
        <StatCard icon={CheckCircle} tone="green" label="Activos" value={active} />
        <StatCard icon={XCircle} tone="gray" label="Inactivos" value={rows.length - active} />
      </div>

      <FilterBar>
        <div className="sm:col-span-2"><SearchInput value={q} onChange={resetPage(setQ)} placeholder={searchPlaceholder} /></div>
        <SelectInput value={status} onChange={(e) => resetPage(setStatus)(e.target.value as Status)} aria-label="Estado">
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </SelectInput>
      </FilterBar>

      <TableCard footer={filtered.length > 0 && (
        <Pager page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
      )}>
        <Table>
          <THead>
            <tr>
              {columns.map((c) => (
                <Th key={c.key} align={c.align}>
                  {c.sort ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className={`inline-flex items-center gap-1 uppercase hover:text-gray-900 ${sortKey === c.key ? 'text-gray-900' : ''}`}>
                      {c.header}
                      {sortKey === c.key ? (desc ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />}
                    </button>
                  ) : c.header}
                </Th>
              ))}
              <Th align="center">Estado</Th>
              <Th align="right">Acciones</Th>
            </tr>
          </THead>
          <TBody>
            {loading && rows.length === 0 ? <TableMessage colSpan={colSpan}>Cargando…</TableMessage>
              : filtered.length === 0 ? (
                <tr><td colSpan={colSpan}>
                  {rows.length === 0 ? (
                    <EmptyState title={`Aún no hay ${noun}`} description={`Usa «${newLabel}» para empezar.`}
                      action={<Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={onNew}>{newLabel}</Button>} />
                  ) : (
                    <EmptyState title="Sin resultados" description="Prueba con otra búsqueda o cambia el filtro de estado." />
                  )}
                </td></tr>
              ) : pageRows.map((r) => (
                <Tr key={r.id} onClick={() => onEdit(r)}>
                  {columns.map((c) => <Td key={c.key} align={c.align}>{c.render(r)}</Td>)}
                  <Td align="center"><Badge tone={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'Activo' : 'Inactivo'}</Badge></Td>
                  <Td align="right" className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <IconButton title="Editar" tone="app" onClick={() => onEdit(r)}><Pencil className="w-4 h-4" /></IconButton>
                    <IconButton title="Eliminar" tone="danger" onClick={() => onDelete(r)}><Trash2 className="w-4 h-4" /></IconButton>
                  </Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>
    </Page>
  );
}

/** Diálogo de crear/editar de un atributo. El formulario de `children` lleva `id={formId}`. */
export function CatalogDialog({ open, onClose, title, description, formId, saving, isEdit, onDelete, children, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; description?: string; formId: string; saving?: boolean;
  isEdit: boolean; onDelete?: () => void; children: ReactNode; size?: 'md' | 'lg';
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      footer={(
        <>
          {isEdit && onDelete && (
            <Button variant="ghost" className="sm:mr-auto text-red-600 hover:text-red-700 hover:bg-red-50" icon={<Trash2 className="w-4 h-4" />} onClick={onDelete}>
              Eliminar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form={formId} isLoading={saving}>{isEdit ? 'Guardar cambios' : 'Crear'}</Button>
        </>
      )}
    >
      {children}
    </Dialog>
  );
}
