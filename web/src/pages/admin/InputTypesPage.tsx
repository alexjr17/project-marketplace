import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Tags } from 'lucide-react';
import { inputTypesService, type InputType } from '../../services/input-types.service';
import {
  Page, PageHeader, Button, IconButton, Badge, Alert, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
} from '../../components/ui';

export default function InputTypesPage() {
  const navigate = useNavigate();
  const [inputTypes, setInputTypes] = useState<InputType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInputTypes();
  }, []);

  const loadInputTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await inputTypesService.getAll();
      setInputTypes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Error al cargar los tipos de insumo');
      setInputTypes([]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const open = (t: InputType) => navigate(`/admin-panel/input-types/${t.id}`);

  return (
    <Page>
      <PageHeader
        icon={Tags}
        title="Tipos de insumo"
        subtitle="Categorías para agrupar los insumos del inventario"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/admin-panel/input-types/new')}>Nuevo tipo</Button>}
      />

      {error && <Alert tone="error">{error}</Alert>}

      <TableCard>
        <Table>
          <THead>
            <tr>
              <Th>Nombre</Th>
              <Th>Descripción</Th>
              <Th align="right">Orden</Th>
              <Th align="center">Estado</Th>
              <Th align="right">Acciones</Th>
            </tr>
          </THead>
          <TBody>
            {loading ? (
              <TableMessage colSpan={5}>Cargando tipos de insumo…</TableMessage>
            ) : inputTypes.length === 0 ? (
              <TableMessage colSpan={5}>No hay tipos de insumo registrados.</TableMessage>
            ) : (
              inputTypes.map((t) => (
                <Tr key={t.id} onClick={() => open(t)}>
                  <Td className="whitespace-nowrap">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">#{t.id}</p>
                  </Td>
                  <Td className="max-w-xs truncate text-gray-500">{t.description || '—'}</Td>
                  <Td align="right" className="tabular-nums">{t.sortOrder}</Td>
                  <Td align="center"><Badge tone={t.isActive ? 'green' : 'gray'}>{t.isActive ? 'Activo' : 'Inactivo'}</Badge></Td>
                  <Td align="right">
                    <IconButton title="Editar" tone="app" onClick={(e) => { e.stopPropagation(); open(t); }}>
                      <Pencil className="w-4 h-4" />
                    </IconButton>
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableCard>
    </Page>
  );
}
