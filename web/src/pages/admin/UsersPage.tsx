import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, ChevronRight, UserCheck, UserX, Users } from 'lucide-react';
import { useUsers } from '../../context/UsersContext';
import type { User } from '../../types/user';
import {
  Page, PageHeader, StatCard, FilterBar, SearchInput, RadioGroup, IconButton, Avatar,
  TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, Badge, Pager,
} from '../../components/ui';
import { fmtDate } from './orderUi';

type StatusFilter = 'all' | 'active' | 'inactive';
type SortKey = 'name' | 'createdAt';

/** Clientes registrados en la tienda. Cada fila lleva al detalle del cliente. */
export const UsersPage = () => {
  const navigate = useNavigate();
  const { users } = useUsers();
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = users.filter((u) =>
      (statusFilter === 'all' || u.status === statusFilter) &&
      (!t || [u.name, u.email, u.phone, u.address?.city, u.cedula].some((v) => v?.toLowerCase().includes(t))));
    if (!sort) return list;
    const val = (u: User) => (sort.key === 'name' ? u.name.toLowerCase() : new Date(u.createdAt).getTime());
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      const r = x < y ? -1 : x > y ? 1 : 0;
      return sort.desc ? -r : r;
    });
  }, [users, q, statusFilter, sort]);

  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  const toggleSort = (key: SortKey) => setSort((s) => ({ key, desc: s?.key === key ? !s.desc : false }));
  const view = (u: User) => navigate(`/admin-panel/users/${u.id}`);

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === 'active').length,
    inactive: users.filter((u) => u.status === 'inactive').length,
  };

  const sortBtn = (k: SortKey, label: string) => (
    <button type="button" onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 uppercase hover:text-gray-900 ${sort?.key === k ? 'text-gray-900' : ''}`}>
      {label}<ArrowUpDown className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <Page>
      <PageHeader icon={Users} title="Clientes" subtitle="Clientes registrados en la tienda" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Clientes" value={stats.total.toLocaleString('es-CO')} />
        <StatCard icon={UserCheck} tone="green" label="Activos" value={stats.active} />
        <StatCard icon={UserX} tone="gray" label="Inactivos" value={stats.inactive} />
      </div>

      <FilterBar>
        <div className="sm:col-span-2"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por nombre, email, teléfono o ciudad…" /></div>
        <div className="sm:col-span-2 flex items-center">
          <RadioGroup<StatusFilter>
            variant="segmented"
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[{ value: 'all', label: 'Todos' }, { value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }]}
          />
        </div>
      </FilterBar>

      <TableCard footer={rows.length > 0 && <Pager page={page} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />}>
        <Table>
          <THead>
            <tr>
              <Th>{sortBtn('name', 'Cliente')}</Th>
              <Th>Teléfono</Th>
              <Th>Ciudad</Th>
              <Th>{sortBtn('createdAt', 'Registro')}</Th>
              <Th align="center">Estado</Th>
              <Th align="right" aria-label="Acciones" />
            </tr>
          </THead>
          <TBody>
            {visible.length === 0 ? (
              <TableMessage colSpan={6}>
                {q || statusFilter !== 'all' ? 'Ningún cliente coincide con la búsqueda o el filtro.' : 'Los clientes aparecerán aquí cuando se registren.'}
              </TableMessage>
            ) : visible.map((u) => (
              <Tr key={u.id} onClick={() => view(u)}>
                <Td>
                  <span className="flex items-center gap-3">
                    <Avatar name={u.name} />
                    <span className="min-w-0">
                      <span className="block font-medium text-gray-900 truncate">{u.name}</span>
                      <span className="block text-xs text-gray-500 truncate">{u.email}</span>
                    </span>
                  </span>
                </Td>
                <Td className="whitespace-nowrap">{u.phone || <span className="text-gray-400">—</span>}</Td>
                <Td>{u.address?.city || <span className="text-gray-400">—</span>}</Td>
                <Td className="whitespace-nowrap">{fmtDate(u.createdAt)}</Td>
                <Td align="center"><Badge tone={u.status === 'active' ? 'green' : 'gray'}>{u.status === 'active' ? 'Activo' : 'Inactivo'}</Badge></Td>
                <Td align="right">
                  <IconButton title="Ver cliente" tone="app" onClick={(e) => { e.stopPropagation(); view(u); }}><ChevronRight className="w-4 h-4" /></IconButton>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableCard>
    </Page>
  );
};
