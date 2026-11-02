import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { zoneTypesService, type ZoneType } from '../../services/zone-types.service';
import { Pencil, Plus, Scissors } from 'lucide-react';
import {
  Alert, Badge, Button, EmptyState, FilterBar, IconButton, Page, PageHeader, SearchInput,
  Table, TableCard, TableMessage, TBody, Td, Th, THead, Tr,
} from '../../components/ui';

export default function ZoneTypesPage() {
  const navigate = useNavigate();
  const [zoneTypes, setZoneTypes] = useState<ZoneType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    loadZoneTypes();
  }, []);

  const loadZoneTypes = async () => {
    try {
      setLoading(true);
      const data = await zoneTypesService.getAll();
      setZoneTypes(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError('Error al cargar los tipos de zona');
      setZoneTypes([]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? zoneTypes.filter((z) => `${z.name} ${z.slug} ${z.description ?? ''}`.toLowerCase().includes(t)) : zoneTypes;
  }, [zoneTypes, q]);

  const goNew = () => navigate('/admin-panel/zone-types/new');

  return (
    <Page>
      <PageHeader
        icon={Scissors}
        title="Tipos de zona"
        subtitle="Zonas de personalización que usan las plantillas (frente, espalda, mangas…)"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={goNew}>Nuevo tipo de zona</Button>}
      />

      {error && <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={loadZoneTypes}>Reintentar</Button>}>{error}</Alert>}

      <FilterBar>
        <div className="sm:col-span-2"><SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre o slug…" /></div>
      </FilterBar>

      <TableCard>
        <Table>
          <THead>
            <tr>
              <Th align="right">Orden</Th>
              <Th>Nombre</Th>
              <Th>Slug</Th>
              <Th>Descripción</Th>
              <Th align="center">Estado</Th>
              <Th align="right">Acciones</Th>
            </tr>
          </THead>
          <TBody>
            {loading ? <TableMessage colSpan={6}>Cargando tipos de zona…</TableMessage>
              : rows.length === 0 ? (
                <tr><td colSpan={6}>
                  {zoneTypes.length === 0
                    ? <EmptyState title="No hay tipos de zona" description="Crea el primero para usarlo en las plantillas." action={<Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={goNew}>Nuevo tipo de zona</Button>} />
                    : <EmptyState title="Sin resultados" description="Prueba con otra búsqueda." />}
                </td></tr>
              ) : rows.map((z) => (
                <Tr key={z.id} onClick={() => navigate(`/admin-panel/zone-types/${z.id}`)}>
                  <Td align="right" className="tabular-nums w-20">{z.sortOrder}</Td>
                  <Td className="font-medium text-gray-900 whitespace-nowrap">{z.name}</Td>
                  <Td className="font-mono text-xs text-gray-500">{z.slug}</Td>
                  <Td className="text-gray-500 max-w-xs truncate">{z.description || '—'}</Td>
                  <Td align="center"><Badge tone={z.isActive ? 'green' : 'gray'}>{z.isActive ? 'Activo' : 'Inactivo'}</Badge></Td>
                  <Td align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton title="Editar" tone="app" onClick={() => navigate(`/admin-panel/zone-types/${z.id}`)}><Pencil className="w-4 h-4" /></IconButton>
                  </Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>
    </Page>
  );
}
