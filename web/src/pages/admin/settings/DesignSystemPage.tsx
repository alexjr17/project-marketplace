import { useState } from 'react';
import type { ReactNode } from 'react';
import { Box, CheckCircle, DollarSign, Download, Eye, Package, Palette, Pencil, Plus, Save, Trash2, TrendingUp } from 'lucide-react';
import {
  ActionMenu, Alert, Avatar, Badge, Button, Card, CardTitle, Checkbox, ColorInput, Combobox, DateInput, DescriptionList,
  Dialog, Drawer, EmptyState, Field, FileDrop, FileList, FilterBar, FormActions, FormGrid, IconButton, ImageGallery,
  ImageInput, MoneyInput, NumberInput, Page, PageHeader, Pager, RadioGroup, SearchInput, SelectInput, SettingsSection,
  Skeleton, Spinner, StatCard, Switch, Table, TableCard, Tabs, TBody, Td, TextArea, TextInput, Th, THead, Thumb, Timeline,
  Tr, toast, useConfirm,
} from '../../../components/ui';

/** Un bloque del catálogo: nombre del componente, para qué sirve y el ejemplo vivo. */
function Example({ name, use, children }: { name: string; use: string; children: ReactNode }) {
  return (
    <Card>
      <div className="mb-4">
        <h3 className="font-mono text-sm font-semibold text-app-700">{name}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{use}</p>
      </div>
      {children}
    </Card>
  );
}

const PRODUCTS = [
  { id: 1, name: 'Camiseta básica', sku: 'CAM-001', price: 35000, stock: 42, active: true },
  { id: 2, name: 'Buzo con capota', sku: 'BUZ-014', price: 89000, stock: 3, active: true },
  { id: 3, name: 'Gorra bordada', sku: 'GOR-007', price: 28000, stock: 0, active: false },
];
const money = (n: number) => '$' + n.toLocaleString('es-CO');

/** Referencia del estándar de diseño (web/DESIGN_SYSTEM.md) con cada componente funcionando. */
export function DesignSystemPage() {
  const confirm = useConfirm();
  const [tab, setTab] = useState<'forms' | 'media' | 'data' | 'feedback'>('forms');
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [sw, setSw] = useState(true);
  const [radio, setRadio] = useState<'nat' | 'exp'>('nat');
  const [seg, setSeg] = useState<'dia' | 'semana' | 'mes'>('semana');
  const [combo, setCombo] = useState<number | null>(null);
  const [multi, setMulti] = useState<number[]>([1]);
  const [color, setColor] = useState('#4f46e5');
  const [img, setImg] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const options = PRODUCTS.map((p) => ({ value: p.id, label: p.name, hint: p.sku }));

  return (
    <Page>
      <PageHeader
        icon={Palette}
        title="Componentes"
        subtitle="Estándar de diseño del proyecto. Úsalo como referencia al crear o modificar pantallas."
        actions={<><Button variant="secondary" icon={<Download className="w-4 h-4" />}>Secundario</Button><Button icon={<Plus className="w-4 h-4" />}>Acción principal</Button></>}
      />

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'forms', label: 'Botones y formularios' },
        { value: 'media', label: 'Imágenes y archivos' },
        { value: 'data', label: 'Datos y tablas' },
        { value: 'feedback', label: 'Avisos y ventanas' },
      ]} />

      {tab === 'forms' && (
        <div className="space-y-5">
          <Example name="Button · IconButton · ActionMenu" use="Un solo primary por zona. Acciones de fila con IconButton (con title) o ActionMenu si son más de dos.">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button><Button variant="success">Success</Button><Button variant="danger">Danger</Button>
              <Button isLoading>Guardando</Button><Button disabled>Deshabilitado</Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" icon={<Plus className="w-4 h-4" />}>Pequeño</Button><Button size="lg">Grande</Button>
              <span className="mx-2 h-6 w-px bg-gray-200" />
              <IconButton title="Ver" tone="app"><Eye className="w-4 h-4" /></IconButton>
              <IconButton title="Editar" tone="app"><Pencil className="w-4 h-4" /></IconButton>
              <IconButton title="Eliminar" tone="danger"><Trash2 className="w-4 h-4" /></IconButton>
              <ActionMenu items={[
                { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: () => toast.info('Editar') },
                { label: 'Duplicar', icon: <Box className="w-4 h-4" />, onClick: () => toast.info('Duplicar') },
                { label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => toast.error('Eliminar') },
              ]} />
            </div>
          </Example>

          <Example name="Field + inputs" use="Etiqueta arriba, * en obligatorios, ayuda o error debajo. Todos comparten alto (h-10), borde y foco del color de la app.">
            <FormGrid cols={3}>
              <Field label="Nombre" required htmlFor="ds-name"><TextInput id="ds-name" placeholder="Camiseta básica" /></Field>
              <Field label="Con error" required error="El código ya existe"><TextInput defaultValue="CAM-001" error /></Field>
              <Field label="Deshabilitado" hint="Se calcula solo."><TextInput value="Automático" disabled readOnly /></Field>
              <Field label="Precio (MoneyInput)"><MoneyInput placeholder="0" /></Field>
              <Field label="Factor (NumberInput)"><NumberInput step="0.01" suffix="x" placeholder="2.0" /></Field>
              <Field label="Fecha (DateInput)"><DateInput /></Field>
              <Field label="Lista corta (SelectInput)"><SelectInput><option>Nacional</option><option>Exportación</option></SelectInput></Field>
              <Field label="Lista larga (Combobox)" hint="Con búsqueda."><Combobox options={options} value={combo} onChange={setCombo} placeholder="Buscar producto…" /></Field>
              <Field label="Varios (Combobox multiple)"><Combobox multiple options={options} value={multi} onChange={setMulti} /></Field>
              <Field label="Color (ColorInput)"><ColorInput value={color} onChange={setColor} /></Field>
              <Field label="Notas (TextArea)" className="md:col-span-2"><TextArea placeholder="Visible solo para el equipo" /></Field>
            </FormGrid>
          </Example>

          <Example name="Switch · Checkbox · RadioGroup" use="Switch para activar opciones de configuración; Checkbox para marcar en listas; RadioGroup para opciones excluyentes.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Switch checked={sw} onChange={setSw} label="Publicar en la tienda" description="Los clientes podrán ver y comprar el producto." />
                <Checkbox label="Producto destacado" description="Aparece en la portada." defaultChecked />
                <RadioGroup variant="segmented" value={seg} onChange={setSeg} options={[{ value: 'dia', label: 'Día' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mes' }]} />
              </div>
              <RadioGroup variant="cards" value={radio} onChange={setRadio} options={[
                { value: 'nat', label: 'Nacional', description: 'Precios en pesos.' },
                { value: 'exp', label: 'Exportación', description: 'Precios en dólares con la tasa activa.' },
              ]} />
            </div>
          </Example>

          <Example name="SettingsSection · FormActions" use="Pantallas de Configuración: título y explicación a la izquierda, controles a la derecha. Pie con Cancelar + Guardar.">
            <SettingsSection title="Datos del negocio" description="Aparecen en facturas, correos y el pie de la tienda.">
              <FormGrid>
                <Field label="Razón social" required><TextInput defaultValue="StylePrint S.A.S." /></Field>
                <Field label="NIT" required><TextInput defaultValue="901.234.567-8" /></Field>
              </FormGrid>
            </SettingsSection>
            <FormActions><Button variant="secondary">Cancelar</Button><Button icon={<Save className="w-4 h-4" />} onClick={() => toast.success('Cambios guardados')}>Guardar</Button></FormActions>
          </Example>
        </div>
      )}

      {tab === 'media' && (
        <div className="space-y-5">
          <Example name="ImageInput" use="Una imagen del registro (logo, foto, banner). Sube, arrastra o pega un enlace; reemplazar y quitar al pasar el mouse.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <Field label="Cuadrada (producto)"><ImageInput value={img} onChange={setImg} /></Field>
              <Field label="Horizontal (banner)"><ImageInput value={img} onChange={setImg} ratio="landscape" /></Field>
              <Field label="Vertical"><ImageInput value={img} onChange={setImg} ratio="portrait" allowUrl={false} /></Field>
            </div>
          </Example>
          <Example name="ImageGallery" use="Varias imágenes (galería de producto). La primera es la portada; se pueden mover, marcar como portada y quitar.">
            <ImageGallery value={gallery} onChange={setGallery} max={8} />
          </Example>
          <Example name="FileDrop · FileList" use="Archivos para importar o adjuntar (Excel, PDF). Valida tipo y tamaño antes de entregarlos.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileDrop multiple accept=".xlsx,.csv,application/pdf" maxSizeMB={5} onFiles={(f) => setFiles((p) => [...p, ...f])} />
              <div className="space-y-3">
                <FileDrop compact accept=".xlsx" title="Importar Excel" onFiles={(f) => setFiles((p) => [...p, ...f])} />
                <FileList files={files} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />
              </div>
            </div>
          </Example>
          <Example name="Thumb · Avatar" use="Miniaturas en tablas (con respaldo si no hay imagen) y avatares de personas con iniciales.">
            <div className="flex items-center gap-4">
              <Thumb src={img || null} size="sm" /><Thumb src={img || null} /><Thumb src={img || null} size="lg" />
              <span className="mx-2 h-8 w-px bg-gray-200" />
              <Avatar name="Ana Gómez" size="sm" /><Avatar name="Carlos Ruiz" /><Avatar name="Laura Pérez" size="lg" />
            </div>
          </Example>
        </div>
      )}

      {tab === 'data' && (
        <div className="space-y-5">
          <Example name="StatCard" use="Indicadores compactos (máx. 4 por fila): etiqueta + icono arriba, valor formateado, nota opcional con color. Con `to` la tarjeta lleva al listado filtrado.">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={Package} label="Total productos" value="3" hint="2 con stock bajo" hintTone="yellow" to="#" />
              <StatCard icon={CheckCircle} tone="green" label="En stock" value="3" hint="de 3 productos" />
              <StatCard icon={DollarSign} tone="blue" label="Precio promedio" value={money(37667)} />
              <StatCard icon={TrendingUp} tone="purple" label="Destacados" value="1" />
            </div>
          </Example>
          <Example name="FilterBar · SearchInput · TableCard · Pager · Badge" use="Listado estándar: filtros arriba, tabla en tarjeta, números a la derecha, estados con Badge, acciones a la derecha y paginación al pie.">
            <div className="space-y-3">
              <FilterBar actions={<Button variant="ghost" onClick={() => setQ('')}>Limpiar</Button>}>
                <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre o SKU…" />
                <SelectInput defaultValue=""><option value="">Todos los estados</option><option>Activos</option><option>Inactivos</option></SelectInput>
              </FilterBar>
              <TableCard footer={<Pager page={page} pageSize={10} total={3} onPage={setPage} onPageSize={() => {}} />}>
                <Table>
                  <THead><tr><Th>Producto</Th><Th align="right">Precio</Th><Th align="right">Stock</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
                  <TBody>
                    {PRODUCTS.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase())).map((p) => (
                      <Tr key={p.id}>
                        <Td><div className="flex items-center gap-3"><Thumb size="sm" /><div><p className="font-medium text-gray-900">{p.name}</p><p className="text-xs text-gray-500">{p.sku}</p></div></div></Td>
                        <Td align="right">{money(p.price)}</Td>
                        <Td align="right"><span className={p.stock === 0 ? 'text-red-600 font-medium' : p.stock < 5 ? 'text-amber-700 font-medium' : ''}>{p.stock}</span></Td>
                        <Td align="center"><Badge tone={p.active ? 'green' : 'gray'}>{p.active ? 'Activo' : 'Inactivo'}</Badge></Td>
                        <Td align="right" className="whitespace-nowrap"><IconButton title="Editar" tone="app"><Pencil className="w-4 h-4" /></IconButton><IconButton title="Eliminar" tone="danger"><Trash2 className="w-4 h-4" /></IconButton></Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </TableCard>
            </div>
          </Example>
          <Example name="Badge" use="Estados con significado fijo en todas las apps.">
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">Activo · Pagado</Badge><Badge tone="yellow">Pendiente</Badge><Badge tone="red">Cancelado</Badge>
              <Badge tone="blue">En camino</Badge><Badge tone="gray">Inactivo · Borrador</Badge><Badge tone="app">Destacado</Badge>
            </div>
          </Example>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Example name="CardTitle · DescriptionList" use="Pantallas de detalle: datos en pares etiqueta / valor.">
              <CardTitle icon={Package} actions={<Button size="sm" variant="ghost" icon={<Pencil className="w-4 h-4" />}>Editar</Button>}>Datos del pedido</CardTitle>
              <DescriptionList items={[
                { label: 'Cliente', value: 'Ana Gómez' }, { label: 'Documento', value: 'CC 1.020.304.050' },
                { label: 'Total', value: money(124000) }, { label: 'Estado', value: <Badge tone="yellow">Pendiente</Badge> },
                { label: 'Dirección', value: 'Calle 123 #45-67, Bogotá', full: true },
              ]} />
            </Example>
            <Example name="Timeline" use="Historial de un registro (estados de un pedido, movimientos).">
              <Timeline items={[
                { title: 'Pedido entregado', meta: 'Hoy, 10:42 · Servientrega', tone: 'green' },
                { title: 'Enviado', meta: 'Ayer, 16:05', description: 'Guía 7001234567' },
                { title: 'Pago confirmado', meta: '30 oct, 09:12 · Wompi' },
                { title: 'Pedido creado', meta: '30 oct, 09:10', tone: 'gray' },
              ]} />
            </Example>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Example name="EmptyState" use="Listas sin datos o sin resultados.">
              <EmptyState title="Aún no hay proveedores" description="Crea el primero para registrar compras." action={<Button size="sm" icon={<Plus className="w-4 h-4" />}>Nuevo proveedor</Button>} />
            </Example>
            <Example name="Spinner" use="Carga de una pantalla o bloque."><Spinner label="Cargando…" /></Example>
            <Example name="Skeleton" use="Carga con la forma del contenido.">
              <div className="space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-24 w-full" /></div>
            </Example>
          </div>
        </div>
      )}

      {tab === 'feedback' && (
        <div className="space-y-5">
          <Example name="toast (lib/toast)" use="Avisos flotantes tras una acción. Único sistema de avisos de la app.">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => toast.success('Producto guardado')}>Éxito</Button>
              <Button variant="secondary" onClick={() => toast.error('No se pudo guardar: el SKU ya existe')}>Error</Button>
              <Button variant="secondary" onClick={() => toast.warning('Quedan 3 unidades')}>Advertencia</Button>
              <Button variant="secondary" onClick={() => toast.info('Sincronizando inventario…')}>Info</Button>
            </div>
          </Example>
          <Example name="Alert" use="Mensajes dentro de la página que el usuario debe leer antes de seguir.">
            <div className="space-y-3">
              <Alert tone="info" title="Precios en dólares">Los grupos de exportación usan la tasa activa ($4.000).</Alert>
              <Alert tone="success">La importación terminó: 120 productos actualizados.</Alert>
              <Alert tone="warning" title="Sin tasa de cambio activa" action={<Button size="sm" variant="secondary">Registrar tasa</Button>}>No se pueden calcular los precios de exportación.</Alert>
              <Alert tone="error" title="No se pudo conectar con Servientrega">Revisa las credenciales en Configuración → Envíos.</Alert>
            </div>
          </Example>
          <Example name="useConfirm · Dialog · Drawer" use="Confirmar antes de eliminar (nunca window.confirm). Dialog para formularios cortos; Drawer para ver o editar sin salir del listado.">
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={async () => {
                if (await confirm({ title: '¿Eliminar el producto?', message: 'Se quitará de la tienda. No se puede deshacer.', tone: 'danger' })) toast.success('Producto eliminado');
              }}>Eliminar (confirmar)</Button>
              <Button variant="secondary" onClick={() => setDialog(true)}>Abrir Dialog</Button>
              <Button variant="secondary" onClick={() => setDrawer(true)}>Abrir Drawer</Button>
            </div>
          </Example>
        </div>
      )}

      <Dialog open={dialog} onClose={() => setDialog(false)} title="Nueva talla" description="Se agrega al catálogo de atributos."
        footer={<><Button variant="secondary" onClick={() => setDialog(false)}>Cancelar</Button><Button onClick={() => { setDialog(false); toast.success('Talla creada'); }}>Crear talla</Button></>}>
        <FormGrid><Field label="Nombre" required><TextInput placeholder="Mediana" /></Field><Field label="Abreviatura" required><TextInput placeholder="M" /></Field></FormGrid>
      </Dialog>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Camiseta básica" description="CAM-001"
        footer={<><Button variant="secondary" onClick={() => setDrawer(false)}>Cerrar</Button><Button onClick={() => setDrawer(false)}>Guardar</Button></>}>
        <div className="space-y-4">
          <ImageInput value={img} onChange={setImg} />
          <Field label="Nombre" required><TextInput defaultValue="Camiseta básica" /></Field>
          <Field label="Precio"><MoneyInput defaultValue={35000} /></Field>
          <Switch checked={sw} onChange={setSw} label="Publicado" />
        </div>
      </Drawer>
    </Page>
  );
}
