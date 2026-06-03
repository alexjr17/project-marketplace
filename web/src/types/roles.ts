// Sistema de Roles y Permisos
// Rol 0: Super Administrador (único, no se puede crear más)
// Rol 1: Usuario Normal (solo acceso público, permisos fijos)
// Rol 2+: Roles personalizados con permisos configurables

// Permisos disponibles en el sistema.
// Modelo GRANULAR: un permiso por cada ítem del menú (lo que ve cada rol).
export type Permission =
  // Acceso a aplicaciones (selector "Cambiar a")
  | 'store.access'
  | 'admin.access'
  | 'messaging.access'
  // Social Media (módulos = pestañas)
  | 'messaging.inbox'
  | 'messaging.posts'
  | 'messaging.pages'
  | 'messaging.knowledge'
  | 'messaging.channels'
  // POS (operaciones de la app)
  | 'pos.access'
  | 'pos.create_sale'
  | 'pos.view_sales'
  | 'pos.cancel_sale'
  | 'pos.cash_register'
  | 'pos.open_close_session'
  | 'pos.view_reports'
  // ===== Administración — un permiso por ítem del menú =====
  | 'dashboard.view'
  // Ventas
  | 'orders.view'              // Pedidos
  | 'reviews.view'             // Reseñas
  | 'payments.view'            // Pagos
  // Envíos
  | 'shipping.carriers'        // Transportadoras
  | 'shipping.zones'           // Zonas y Tarifas
  | 'shipping.connections'     // Conexiones
  | 'shipping.config'          // Configuración de envíos
  | 'shipping.dispatch'        // Despachos
  // Punto de Venta (admin)
  | 'variants.view'            // Variantes
  // Catálogo
  | 'products.view'            // Productos
  | 'templates.view'           // Plantillas/Modelos
  | 'categories.view'          // Categorías
  | 'product_types.view'       // Tipos de Producto
  | 'sizes.view'               // Tallas
  | 'colors.view'              // Colores
  // Producción
  | 'zone_types.view'          // Tipos de Zona
  | 'design_images.view'       // Imágenes de Diseño
  // Inventario
  | 'inputs.view'              // Insumos
  | 'input_types.view'         // Tipos de Insumo
  // Compras
  | 'suppliers.view'           // Proveedores
  | 'purchase_orders.view'     // Órdenes de Compra
  | 'purchase_returns.view'    // Devoluciones
  | 'conversions.view'         // Conversiones
  | 'inventory_counts.view'    // Conteo Físico
  | 'inventory_movements.view' // Movimientos
  // Usuarios
  | 'users.view'               // Clientes
  | 'admins.view'              // Administradores
  | 'roles.view'               // Roles y Permisos
  // Configuración
  | 'settings.general'
  | 'settings.appearance'
  | 'settings.home'
  | 'settings.catalog'
  | 'settings.payment'
  | 'settings.legal'
  | 'settings.printing'        // Impresión
  | 'settings.label_templates';// Plantillas de Etiquetas

// Módulos (grupos del editor = secciones del menú)
export type AdminModule =
  | 'apps'
  | 'messaging'
  | 'pos'
  | 'dashboard'
  | 'sales'
  | 'shipping'
  | 'catalog'
  | 'production'
  | 'supplies'
  | 'purchases'
  | 'users'
  | 'settings';

// Interfaz de Rol
export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean; // true = no se puede editar ni eliminar (rol 0 y 1)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Roles del sistema (predefinidos)
export const SYSTEM_ROLES: Role[] = [
  {
    id: 0,
    name: 'Super Administrador',
    description: 'Acceso total al sistema. Solo puede existir uno.',
    permissions: [
      'store.access', 'admin.access', 'messaging.access',
      'messaging.inbox', 'messaging.posts', 'messaging.pages', 'messaging.knowledge', 'messaging.channels',
      'pos.access', 'pos.create_sale', 'pos.view_sales', 'pos.cancel_sale',
      'pos.cash_register', 'pos.open_close_session', 'pos.view_reports',
      'dashboard.view',
      'orders.view', 'reviews.view', 'payments.view',
      'shipping.carriers', 'shipping.zones', 'shipping.connections', 'shipping.config', 'shipping.dispatch',
      'variants.view',
      'products.view', 'templates.view', 'categories.view', 'product_types.view', 'sizes.view', 'colors.view',
      'zone_types.view', 'design_images.view',
      'inputs.view', 'input_types.view',
      'suppliers.view', 'purchase_orders.view', 'purchase_returns.view',
      'conversions.view', 'inventory_counts.view', 'inventory_movements.view',
      'users.view', 'admins.view', 'roles.view',
      'settings.general', 'settings.appearance', 'settings.home', 'settings.catalog',
      'settings.payment', 'settings.legal', 'settings.printing', 'settings.label_templates',
    ],
    isSystem: true,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 1,
    name: 'Usuario',
    description: 'Usuario normal. Solo acceso a páginas públicas.',
    permissions: [], // Sin permisos de admin
    isSystem: true,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

// Grupos de permisos para la UI
export const PERMISSION_GROUPS: {
  module: AdminModule;
  label: string;
  permissions: { id: Permission; label: string; description?: string }[];
}[] = [
  {
    module: 'dashboard',
    label: 'Dashboard',
    permissions: [
      { id: 'dashboard.view', label: 'Dashboard', description: 'Panel principal' },
    ],
  },
  {
    module: 'sales',
    label: 'Ventas',
    permissions: [
      { id: 'orders.view', label: 'Pedidos', description: 'Listar pedidos y detalles' },
      { id: 'reviews.view', label: 'Reseñas', description: 'Reseñas de productos' },
      { id: 'payments.view', label: 'Pagos', description: 'Pagos de pedidos' },
    ],
  },
  {
    module: 'shipping',
    label: 'Envíos',
    permissions: [
      { id: 'shipping.carriers', label: 'Transportadoras', description: 'Transportadoras conectadas' },
      { id: 'shipping.zones', label: 'Zonas y Tarifas', description: 'Zonas y tarifas de envío' },
      { id: 'shipping.connections', label: 'Conexiones', description: 'Conexiones de transportadoras' },
      { id: 'shipping.config', label: 'Configuración', description: 'Configuración de envíos' },
      { id: 'shipping.dispatch', label: 'Despachos', description: 'Despachos de pedidos' },
    ],
  },
  {
    module: 'catalog',
    label: 'Catálogo',
    permissions: [
      { id: 'products.view', label: 'Productos', description: 'Productos del catálogo' },
      { id: 'variants.view', label: 'Variantes', description: 'Variantes de productos' },
      { id: 'templates.view', label: 'Plantillas/Modelos', description: 'Plantillas y modelos' },
      { id: 'categories.view', label: 'Categorías', description: 'Categorías de productos' },
      { id: 'product_types.view', label: 'Tipos de Producto', description: 'Tipos de producto' },
      { id: 'sizes.view', label: 'Tallas', description: 'Tallas' },
      { id: 'colors.view', label: 'Colores', description: 'Colores' },
    ],
  },
  {
    module: 'production',
    label: 'Producción',
    permissions: [
      { id: 'zone_types.view', label: 'Tipos de Zona', description: 'Tipos de zona de diseño' },
      { id: 'design_images.view', label: 'Imágenes de Diseño', description: 'Catálogo de imágenes' },
    ],
  },
  {
    module: 'supplies',
    label: 'Inventario',
    permissions: [
      { id: 'inputs.view', label: 'Insumos', description: 'Insumos y materiales' },
      { id: 'input_types.view', label: 'Tipos de Insumo', description: 'Clasificación de insumos' },
    ],
  },
  {
    module: 'purchases',
    label: 'Compras',
    permissions: [
      { id: 'suppliers.view', label: 'Proveedores', description: 'Proveedores' },
      { id: 'purchase_orders.view', label: 'Órdenes de Compra', description: 'Órdenes de compra' },
      { id: 'purchase_returns.view', label: 'Devoluciones', description: 'Devoluciones a proveedores' },
      { id: 'conversions.view', label: 'Conversiones', description: 'Conversiones de inventario' },
      { id: 'inventory_counts.view', label: 'Conteo Físico', description: 'Conteos físicos' },
      { id: 'inventory_movements.view', label: 'Movimientos', description: 'Movimientos de inventario' },
    ],
  },
  {
    module: 'users',
    label: 'Usuarios',
    permissions: [
      { id: 'users.view', label: 'Clientes', description: 'Usuarios registrados' },
      { id: 'admins.view', label: 'Administradores', description: 'Administradores del sistema' },
      { id: 'roles.view', label: 'Roles y Permisos', description: 'Roles y permisos' },
    ],
  },
  {
    module: 'settings',
    label: 'Configuración',
    permissions: [
      { id: 'settings.general', label: 'General', description: 'Nombre, logo, contacto' },
      { id: 'settings.appearance', label: 'Apariencia', description: 'Colores y estilos' },
      { id: 'settings.home', label: 'Página de inicio', description: 'Secciones y contenido' },
      { id: 'settings.catalog', label: 'Catálogo', description: 'Filtros y ordenamiento' },
      { id: 'settings.payment', label: 'Pagos', description: 'Métodos de pago' },
      { id: 'settings.legal', label: 'Legal', description: 'Términos y políticas' },
      { id: 'settings.printing', label: 'Impresión', description: 'Configuración de impresión' },
      { id: 'settings.label_templates', label: 'Plantillas de Etiquetas', description: 'Plantillas de etiquetas' },
    ],
  },
  {
    module: 'messaging',
    label: 'Social Media',
    permissions: [
      { id: 'messaging.inbox', label: 'Bandeja de entrada', description: 'Ver y responder conversaciones' },
      { id: 'messaging.posts', label: 'Publicaciones', description: 'Crear y publicar en redes' },
      { id: 'messaging.pages', label: 'Páginas', description: 'Páginas y cuentas conectadas' },
      { id: 'messaging.knowledge', label: 'Entrenar IA', description: 'Base de conocimiento del bot' },
      { id: 'messaging.channels', label: 'Canales', description: 'Configurar canales conectados' },
    ],
  },
];

// Aplicaciones de alto nivel (selector "Cambiar a"). Cada app tiene un permiso
// de acceso y agrupa los módulos de permisos que le pertenecen. El editor de
// roles muestra primero las apps y, al seleccionar una, carga sus permisos.
export const APPLICATIONS: {
  id: string;
  name: string;
  description: string;
  access: { id: Permission; label: string; description: string };
  modules: AdminModule[];
}[] = [
  {
    id: 'store',
    name: 'Tienda',
    description: 'Tienda pública en línea',
    access: { id: 'store.access', label: 'Acceso a la Tienda', description: 'Navegar y comprar en la tienda' },
    modules: [],
  },
  {
    id: 'pos',
    name: 'Punto de Venta',
    description: 'Caja registradora y ventas',
    access: { id: 'pos.access', label: 'Acceso al Punto de Venta', description: 'Entrar al POS' },
    modules: ['pos'],
  },
  {
    id: 'admin',
    name: 'Administración',
    description: 'Panel de gestión del negocio',
    access: { id: 'admin.access', label: 'Acceso a Administración', description: 'Entrar al panel de administración' },
    modules: ['dashboard', 'sales', 'shipping', 'catalog', 'production', 'supplies', 'purchases', 'users', 'settings'],
  },
  {
    id: 'messaging',
    name: 'Social Media',
    description: 'Inbox, canales y publicaciones',
    access: { id: 'messaging.access', label: 'Acceso a Social Media', description: 'Entrar a Social Media' },
    modules: ['messaging'],
  },
];

// Helper: permisos que pertenecen a una aplicación (acceso + módulos)
export const getAppPermissions = (appId: string): Permission[] => {
  const app = APPLICATIONS.find((a) => a.id === appId);
  if (!app) return [];
  const modulePerms = PERMISSION_GROUPS
    .filter((g) => app.modules.includes(g.module))
    .flatMap((g) => g.permissions.map((p) => p.id));
  return [app.access.id, ...modulePerms];
};

// Helper: Obtener todos los permisos
export const ALL_PERMISSIONS: Permission[] = [
  ...APPLICATIONS.map((a) => a.access.id),
  ...PERMISSION_GROUPS.flatMap((group) => group.permissions.map((p) => p.id)),
];

// Helper: Verificar si un rol tiene un permiso
export const hasPermission = (role: Role | null, permission: Permission): boolean => {
  if (!role) return false;
  // Super admin siempre tiene todos los permisos
  if (role.id === 0) return true;
  return role.permissions.includes(permission);
};

// Helper: Verificar si un rol tiene acceso a un módulo
export const hasModuleAccess = (role: Role | null, module: AdminModule): boolean => {
  if (!role) return false;
  // Super admin siempre tiene acceso
  if (role.id === 0) return true;
  // Usuario normal nunca tiene acceso al admin
  if (role.id === 1) return false;

  const moduleGroup = PERMISSION_GROUPS.find(g => g.module === module);
  if (!moduleGroup) return false;

  // Tiene acceso si tiene al menos un permiso del módulo
  return moduleGroup.permissions.some(p => role.permissions.includes(p.id));
};

// Helper: Verificar si puede acceder al panel admin
export const canAccessAdmin = (role: Role | null): boolean => {
  if (!role) return false;
  // Rol 0 siempre puede
  if (role.id === 0) return true;
  // Rol 1 nunca puede
  if (role.id === 1) return false;
  // Otros roles: si tienen al menos un permiso
  return role.permissions.length > 0;
};
