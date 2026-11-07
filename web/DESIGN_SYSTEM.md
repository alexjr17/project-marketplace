# Estándar de diseño: Vexa Marketplace

Rige **todas** las vistas de las 5 apps: la Tienda pública y el panel (Administración, Punto de Venta, Social Media y Fábrica). Toda vista nueva o modificada lo cumple. Si tocas una vista vieja que no lo cumple, lo que agregues o cambies se hace con el estándar.

Stack: React 19 + TypeScript + Tailwind 3 + lucide-react. Las piezas están en `src/components/ui/` y se importan desde `components/ui`.

---

## 1. Color por aplicación

Cada app tiene **un** color de acento. Se configura en **Ajustes → Apariencia → Colores por aplicación** y se guarda en `appearance.appColors`.

| App | Ruta | Layout | Color por defecto |
|---|---|---|---|
| Tienda | `/` | `Layout` | color de marca primario (`appearance.brandColors.primary`, `#7c3aed` violeta) |
| Administración | `/admin-panel` | `AdminLayout` | `#4f46e5` índigo |
| Punto de Venta | `/pos` | `POSLayout` | `#059669` esmeralda |
| Social Media | `/messaging` | `MessagingLayout` | `#db2777` rosa |
| Fábrica | `/manufacturing` | `ManufacturingLayout` | `#ea580c` naranja |

Cómo funciona:
- Cada layout se envuelve en `<AppTheme app="…">`, que publica la paleta como variables CSS `--app-50 … --app-900`. El color configurado es el tono **600**; los demás se calculan (`src/theme/appTheme.ts`).
- En las vistas el acento se escribe **siempre** con las clases `app-*`: `bg-app-600`, `hover:bg-app-700`, `text-app-700`, `bg-app-50`, `border-app-300`, `ring-app-200`…
- **Prohibido** escribir el acento con un color fijo (`bg-orange-600`, `text-blue-600`, `focus:ring-orange-500`…). Si la app cambia de color, la vista tiene que cambiar sola.

Los colores fijos solo se usan con **significado**, igual en todas las apps:

| Significado | Color | Ejemplos |
|---|---|---|
| Éxito, activo, pagado | `green` / `emerald` | badge "Activo", botón `success` |
| Advertencia, pendiente | `amber` | badge "Pendiente", stock bajo |
| Error, peligro, eliminar | `red` | botón `danger`, mensaje de error |
| Información neutra | `blue` | badge informativo |
| Inactivo, borrador, histórico | `gray` | badge "Inactivo" |

Texto y superficies: fondo de página `gray-100` (panel) o `gray-50` (tienda), tarjetas `white` con borde `gray-200`, texto `gray-900` (títulos), `gray-700` (cuerpo), `gray-500` (secundario) y `gray-400` (ayuda o vacío).

---

## 2. Armazón del panel de Administración

- **La navegación sale de un solo archivo:** `src/components/admin/adminNav.ts`. De ahí salen el menú lateral, las migas, las pestañas de área, el buscador de módulos (Ctrl+K) y el centro de Configuración. Para agregar un módulo se agrega una línea en su sección. No se escriben menús a mano.
- **Menú por áreas de trabajo**, sin acordeones: Resumen · Ventas · Catálogo · Inventario · Compras · Clientes y marketing, y abajo **Configuración**. Se puede contraer a iconos.
- **Pestañas de área:** cuando un ítem tiene `tabs` (por ejemplo Atributos = Categorías · Tipos de producto · Tallas · Colores), el layout dibuja las pestañas arriba del contenido. Cada pestaña es su propia ruta y la página **no** dibuja esas pestañas.
- **Configuración** (`/admin-panel/settings`) es un centro con una tarjeta por grupo: Tienda, Pagos, Envíos, Punto de venta, Equipo y permisos, Componentes. Sus pantallas usan `SettingsSection`.
- **Las migas** (Sección › Ítem › Pestaña) las pone la barra superior. La página no repite la sección en su título.
- **El `<main>` no tiene padding:** cada pantalla va dentro de `<Page>`.
- **Referencia viva:** Configuración → Componentes (`/admin-panel/settings/design-system`) muestra cada componente funcionando.

## 3. Anatomía de una pantalla del panel

```tsx
import { Page, PageHeader, Button, StatCard, FilterBar, SearchInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, Badge, IconButton, useConfirm } from '../../components/ui';
import toast from '../../lib/toast';

<Page>
  <PageHeader
    icon={Truck}
    title="Proveedores"
    subtitle="Gestión de proveedores"
    actions={<Button icon={<Plus className="w-4 h-4" />} onClick={create}>Nuevo proveedor</Button>}
  />

  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">        {/* indicadores (opcional) */}
    <StatCard icon={Building2} label="Total" value={stats.total} />
    <StatCard icon={CheckCircle} tone="green" label="Activos" value={stats.active} />
  </div>

  <FilterBar>                                                     {/* filtros (opcional) */}
    <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre, NIT…" />
  </FilterBar>

  <TableCard footer={<Pagination … />}>
    <Table>
      <THead><tr><Th>Nombre</Th><Th align="right">Total</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
      <TBody>
        {loading ? <TableMessage colSpan={4}>Cargando…</TableMessage>
          : rows.length === 0 ? <TableMessage colSpan={4}>Sin proveedores.</TableMessage>
          : rows.map((r) => (
            <Tr key={r.id}>
              <Td className="font-medium text-gray-900">{r.name}</Td>
              <Td align="right">{money(r.total)}</Td>
              <Td align="center"><Badge tone={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'Activo' : 'Inactivo'}</Badge></Td>
              <Td align="right">
                <IconButton title="Editar" tone="app" onClick={() => edit(r)}><Pencil className="w-4 h-4" /></IconButton>
                <IconButton title="Eliminar" tone="danger" onClick={() => remove(r)}><Trash2 className="w-4 h-4" /></IconButton>
              </Td>
            </Tr>
          ))}
      </TBody>
    </Table>
  </TableCard>
</Page>
```

Reglas:
1. **`<Page>`** es el contenedor de toda pantalla del panel: da el padding (`p-4 md:p-6`) y la separación (`space-y-5`). Los layouts no agregan padding propio.
2. **`<PageHeader>`** siempre: icono de la app, título `h1`, subtítulo corto y acciones a la derecha, con la principal al final. Las pantallas de detalle o formulario llevan `backTo` (flecha Volver). No se escriben `h1` a mano.
3. **Un solo botón `primary` por zona visible** (el "Nuevo…" del encabezado o el "Guardar" del formulario). Lo demás es `secondary`, `outline` o `ghost`.
4. Orden de bloques: encabezado → indicadores → filtros → contenido (tabla o tarjetas).

---

## 4. Botones (`Button`, `IconButton`)

| Variante | Uso |
|---|---|
| `primary` | acción principal: Nuevo, Guardar, Confirmar (color de la app) |
| `secondary` | Cancelar, Volver, acciones secundarias (blanco con borde) |
| `outline` | acción secundaria destacada (borde del color de la app) |
| `ghost` | acciones terciarias dentro de tarjetas o barras |
| `danger` | Eliminar, Anular, acciones irreversibles |
| `success` | aprobar o cerrar positivo (Aprobar pedido, Cerrar caja) |

- Tamaños: `sm` (h-8, en tarjetas y barras), `md` (h-10, por defecto) y `lg` (h-12, solo en tienda y POS táctil).
- Icono con `icon={<Plus className="w-4 h-4" />}`. Mientras guarda: `isLoading`, que deshabilita el botón y muestra el spinner.
- Acciones de fila de tabla: `IconButton` con `title` (obligatorio) y `tone` (`app` editar o ver, `danger` eliminar).
- Texto en infinitivo o sustantivo corto, con mayúscula inicial: "Nuevo proveedor", "Guardar", "Eliminar".
- Pie de formulario: `<FormActions>` con Cancelar (`secondary`) y luego la acción principal, alineados a la derecha. En celular quedan apilados con la acción principal arriba.

---

## 5. Formularios

```tsx
<Card>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <Field label="Nombre" required error={errors.name}><TextInput value={name} onChange={…} /></Field>
    <Field label="Estado"><SelectInput value={status} onChange={…}>…</SelectInput></Field>
    <Field label="Notas" hint="Visible solo para el equipo." className="md:col-span-2"><TextArea rows={3} … /></Field>
  </div>
  <FormActions>
    <Button variant="secondary" onClick={cancel}>Cancelar</Button>
    <Button isLoading={saving} onClick={save}>Guardar</Button>
  </FormActions>
</Card>
```

- Campos con `Field` + `TextInput`, `SelectInput`, `TextArea` o `Checkbox` (o `fieldClass()` si hace falta un input especial). Así todos comparten borde, radio, tamaño y foco del color de la app.
- Etiqueta arriba; los obligatorios con `required` (asterisco). La ayuda va con `hint` y el error con `error`, debajo del campo.
- Rejilla `grid grid-cols-1 md:grid-cols-2 gap-4` (o `md:grid-cols-3`). Los campos largos ocupan la fila (`md:col-span-2`).
- Formulario corto (≤ 6 campos): en un `Modal`. Formulario largo: pantalla propia con `PageHeader backTo` y una o varias `Card` con `CardTitle` por bloque.
- Validar antes de enviar y avisar con `toast.error`. El backend vuelve a validar.

---

## 6. Tablas y listados

- Siempre `TableCard` + `Table` / `THead` / `TBody` / `Th` / `Tr` / `Td`. Sirven tal cual con `@tanstack/react-table` (se pintan las celdas con `flexRender` dentro de `Th`/`Td`).
- Alineación: texto a la izquierda; números y dinero `align="right"`; estados `align="center"`; acciones `align="right"`.
- Cargando y vacío: `TableMessage`. Una lista vacía en tarjetas usa `EmptyState`.
- Estados con `Badge` y los tonos de la sección 1. No inventar colores de estado por pantalla.
- Paginación con `components/common/Pagination` en el `footer` del `TableCard`.
- En celular la tabla hace scroll horizontal dentro de la tarjeta (`TableCard` ya lo hace). La página nunca hace scroll horizontal.

---

## 7. Modales, confirmaciones y avisos

- **Modal**: `components/shared/Modal` (`Modal` en `components/ui`). Título en `gray-900`; los botones al pie con `FormActions`.
- **Confirmar**: nunca `window.confirm()`. Se usa
  ```tsx
  const confirm = useConfirm();
  if (!(await confirm({ title: '¿Eliminar el proveedor?', message: 'No se puede deshacer.', tone: 'danger' }))) return;
  ```
  Eliminar, anular y todo lo irreversible pide confirmación con `tone: 'danger'`.
- **Avisos**: un solo sistema, `lib/toast` (`toast.success`, `toast.error`, `toast.info`, `toast.warning`), que pinta `ToastProvider`. También sirve `useToast()` del contexto. **No** usar `react-hot-toast` (no hay `<Toaster/>` montado: sus avisos no se ven).
- Mensajes cortos y concretos: "Proveedor creado", "No se pudo guardar: el NIT ya existe".

---

## 8. Cargando y vacíos

- Pantalla o bloque cargando: `<Spinner label="Cargando…" />` (color de la app).
- Sin datos: `EmptyState` con título, descripción y, si aplica, el botón para crear el primero.

---

## 9. Tienda pública

La tienda usa el mismo kit. Su color de app es el **color de marca primario**, así que los botones `primary` de la tienda salen en el color de la marca.

- Identidad de marca: el **gradiente** (`brandColors.primary → secondary → accent`) se reserva para el hero y los CTA grandes de portada. Va con estilo en línea desde `useSettings()`, nunca con `violet` o `pink` fijos.
- Encabezado de cada página de la tienda: `components/shared/PageHeader` (fondo blanco, línea inferior, migas Inicio › sección anterior › página, título, subtítulo y acciones a la derecha). Mismo ancho y márgenes que el encabezado de la tienda (`max-w-7xl px-3 md:px-6`). Sin gradiente.
- Fondo `gray-50`; contenido centrado en `max-w-7xl mx-auto px-4`.
- Tarjeta de producto: `bg-white rounded-xl border border-gray-200 overflow-hidden`, imagen arriba con proporción fija, nombre `font-medium text-gray-900` y precio `font-semibold text-gray-900`. En hover solo sombra (`hover:shadow-md`), sin escalar.
- Botones de compra: `Button` `primary` `lg` y `fullWidth` en móvil.

### Portada (excepción) y marca de la tienda

La portada (`/`, `components/home/pro`) tiene su propio estilo, separado del kit del panel, para que la tienda se sienta como una marca y no como un software de gestión. El catálogo, el producto, el carrito y el checkout siguen con el kit.

- **Colores de marca** (Ajustes → Apariencia; tema "TOCLEX (Carbón y lima)"): `brandColors.primary` es el color de la tienda (`app-*`: botones, bloques oscuros), `brandColors.accent` es el acento (`bg-accent` / `text-accent-ink`) y el fondo es el "papel" (`bg-paper`). TOCLEX: carbón `#1F1D1E`, grafito `#747474`, lima `#ABD04C`, papel `#F3F3EE`.
- **El acento va solo en detalles:** insignias de descuento, pestaña activa, subrayados, contador del carrito, flechas. Nunca como texto sobre fondo claro (el lima sobre blanco no se lee); sobre él va `text-accent-ink`.
- **Tipografía:** Inter (cargada en `index.html`). Titulares de la portada con `font-poster font-bold tracking-[-0.035em] uppercase`.
- **Logo:** Ajustes → General → Logo (encabezado) y "Logo para fondo oscuro" (pie). Un logotipo ancho (ícono + nombre) se muestra solo; un ícono va con el nombre. El favicon sale de `general.favicon`. Los archivos de TOCLEX están en `public/brand/`.
- **Encabezado y pie:** el encabezado usa `appearance.headerBgColor` (papel si es blanco) y el pie `appearance.footerBgColor` (oscuro, textos claros).
- **Estructura de la portada:** colección destacada (hero) → tira de temáticas → productos con pestañas → compra por temática → "Personaliza la tuya" (prenda 3D) → lookbook → tipos de prenda → reseñas.
- **Temáticas:** salen de las etiquetas de los productos (`GET /api/catalogs/tags/stats`) y el catálogo filtra con `?tag=`. Para que una temática aparezca, basta con poner la etiqueta en minúsculas en sus productos (`anime`, `celebridades`…).
- **Movimiento:** scroll suave (Lenis) y animaciones con GSAP solo en la portada; con "reducir movimiento" se apagan. La prenda 3D (`Shirt3D`, Three.js) se carga aparte y se pausa fuera de pantalla.
- **Fotos:** `public/home/*.webp` son provisionales de Unsplash (ver `components/home/pro/photos.ts`); se cambian por fotos propias.
---

## 10. Tipografía, espacios e iconos

- Fuente `Inter` (`font-sans`). Títulos: `h1` 2xl bold (lo pone `PageHeader`), título de bloque `text-base font-semibold` (`CardTitle`), cuerpo `text-sm`, ayuda `text-xs`.
- Radios: `rounded-lg` (botones, inputs), `rounded-xl` (tarjetas, tablas, modales), `rounded-full` (badges, avatares).
- Sombras: las tarjetas del panel **no** llevan sombra (solo borde); los modales y menús flotantes `shadow-xl`.
- Iconos: solo `lucide-react`. Tamaños `w-4 h-4` (botones, tablas), `w-5 h-5` (tarjetas, menú) y `w-6 h-6` (encabezado de página).
- Espaciado entre bloques `space-y-5` o `gap-4`; dentro de tarjetas `p-4 md:p-5`.

---

## 11. Catálogo de componentes (`components/ui`)

| Componente | Para qué |
|---|---|
| `Page`, `PageHeader` | Contenedor y encabezado de toda pantalla del panel (icono, título, subtítulo, `backTo`, `actions`). |
| `Card`, `CardTitle` | Bloques de contenido. Una tarjeta = un tema. |
| `StatCard` | Indicadores compactos (máx. 4 por fila, `grid grid-cols-2 lg:grid-cols-4 gap-3`): etiqueta + icono pequeño arriba, valor, nota opcional (`hint`, `hintTone`). El valor llega **formateado**: dinero `$37.667` (es-CO, sin decimales en COP), nunca `$37666.67`. Con `to` la tarjeta lleva al listado. Nunca se arman tarjetas de indicadores a mano. |
| `Button`, `IconButton`, `ActionMenu` | Acciones. Más de 2 acciones por fila → `ActionMenu` (⋮). |
| `Field` | Etiqueta + campo + ayuda/error. Envuelve a todos los inputs. |
| `TextInput`, `TextArea`, `SelectInput` | Texto y listas cortas (≤ 10 opciones). |
| `NumberInput`, `MoneyInput`, `AddonInput` | Números, dinero con símbolo y campos con unidad (`suffix="kg"`, `"%"`, `"x"`). |
| `DateInput`, `ColorInput` | Fechas y colores (muestra + hex). |
| `Combobox` | Listas largas con búsqueda (clientes, productos, insumos); `multiple` para varios. |
| `Switch` | Activar o desactivar opciones (configuración, "publicado", "activo"). |
| `Checkbox`, `RadioGroup` | Marcar en listas; opciones excluyentes (`list`, `cards` o `segmented`). |
| `FormGrid`, `FormActions` | Rejilla de campos (1 a 4 columnas) y pie con los botones (`sticky` en formularios largos). |
| `SettingsSection` | Bloque de Configuración: título y descripción a la izquierda, controles a la derecha. |
| `ImageInput` | Una imagen del registro (logo, foto, banner): subir, arrastrar o pegar enlace; cambiar y quitar. Valor: URL o data URL. |
| `ImageGallery` | Varias imágenes: la primera es la portada; se pueden mover y quitar. |
| `FileDrop`, `FileList` | Archivos para importar o adjuntar (Excel, PDF), con validación de tipo y tamaño. |
| `Thumb`, `Avatar` | Miniatura de imagen en tablas; avatar de persona con iniciales. |
| `FilterBar`, `SearchInput` | Filtros de un listado. |
| `TableCard`, `Table`, `THead`, `TBody`, `Th`, `Tr`, `Td`, `TableMessage`, `Pager` | Listados y paginación. |
| `Badge` | Estados con los tonos fijos de la sección 1. |
| `Tabs` | Dividir una pantalla grande (detalle de pedido: Resumen · Productos · Pagos · Envío · Historial). |
| `DescriptionList`, `Timeline` | Datos de un registro en pantallas de detalle; historial de eventos. |
| `Dialog` (`Modal`), `Drawer` | Formularios cortos; ver o editar sin salir del listado. |
| `useConfirm`, `toast`, `Alert` | Confirmar; avisos flotantes; mensajes dentro de la página. |
| `EmptyState`, `Spinner`, `Skeleton` | Vacío y carga. |

Reglas de uso:
- **Listado → detalle:** el listado navega al detalle, o abre un `Drawer` si el registro es simple. El detalle usa `PageHeader backTo`, `Tabs` si tiene varias secciones y `DescriptionList` para los datos.
- **Crear o editar:** hasta 6 campos en un `Dialog`; más campos en una pantalla propia con tarjetas por tema y `FormActions sticky`.
- **Imágenes:** siempre `ImageInput` o `ImageGallery`, nunca `<input type="file">` suelto. Archivos: `FileDrop`.
- **Tarjetas limpias:** borde `gray-200`, sin sombra, sin fondos de color, un título por tarjeta y nada de tarjetas dentro de tarjetas.

## 12. Checklist antes de terminar una vista

- [ ] Está dentro de `<Page>` con `<PageHeader>` (panel) y no tiene `h1` a mano.
- [ ] El acento usa `app-*`; ningún `orange-*`, `blue-*` o `violet-*` fijo como color principal.
- [ ] Botones con `Button` o `IconButton`; un solo `primary` por zona; los de solo icono llevan `title`.
- [ ] Campos con `Field` + inputs del kit; los obligatorios llevan `required`.
- [ ] Tablas con `TableCard`/`Th`/`Td`; números a la derecha; estados con `Badge`.
- [ ] Confirmaciones con `useConfirm` y avisos con `lib/toast` (nada de `confirm()` ni `react-hot-toast`).
- [ ] Se ve bien en celular: nada desborda y las tablas hacen scroll dentro de su tarjeta.
- [ ] `npx tsc -p tsconfig.app.json --noEmit` no suma errores nuevos en los archivos tocados.
