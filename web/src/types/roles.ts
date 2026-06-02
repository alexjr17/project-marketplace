// Sistema de Roles y Permisos
// Rol 0: Super Administrador (único, no se puede crear más)
// Rol 1: Usuario Normal (solo acceso público, permisos fijos)
// Rol 2+: Roles personalizados con permisos configurables

// Permisos disponibles en el sistema
export type Permission =
  // Acceso a aplicaciones (selector "Cambiar a")
  | 'store.access'
  | 'admin.access'
  | 'messaging.access'
  // Dashboard
  | 'dashboard.view'
  // Productos
  | 'products.view'
  | 'products.create'
  | 'products.edit'
  | 'products.delete'
  // Catálogos (tallas, colores, tipos, categorías)
  | 'catalogs.view'
  | 'catalogs.manage'
  // Pedidos
  | 'orders.view'
  | 'orders.manage'
  | 'orders.delete'
  // Usuarios
  | 'users.view'
  | 'users.edit'
  | 'users.delete'
  // Administradores
  | 'admins.view'
  | 'admins.create'
  | 'admins.edit'
  | 'admins.delete'
  // Roles
  | 'roles.view'
  | 'roles.create'
  | 'roles.edit'
  | 'roles.delete'
  // Configuración
  | 'settings.general'
  | 'settings.appearance'
  | 'settings.home'
  | 'settings.catalog'
  | 'settings.payment'
  | 'settings.legal'
  // Inventario y Compras
  | 'inventory.view'
  | 'inventory.manage'
  // Envíos
  | 'shipping.view'
  | 'shipping.manage'
  // POS (punto de venta)
  | 'pos.access'
  | 'pos.create_sale'
  | 'pos.view_sales'
  | 'pos.cancel_sale'
  | 'pos.cash_register'
  | 'pos.open_close_session'
  | 'pos.view_reports';

// Módulos del panel administrativo
export type AdminModule =
  | 'apps'
  | 'messaging'
  | 'dashboard'
  | 'products'
  | 'catalogs'
  | 'orders'
  | 'users'
  | 'admins'
  | 'roles'
  | 'settings'
  | 'inventory'
  | 'shipping'
  | 'pos';

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
      'dashboard.view',
      'products.view', 'products.create', 'products.edit', 'products.delete',
      'catalogs.view', 'catalogs.manage',
      'orders.view', 'orders.manage', 'orders.delete',
      'users.view', 'users.edit', 'users.delete',
      'admins.view', 'admins.create', 'admins.edit', 'admins.delete',
      'roles.view', 'roles.create', 'roles.edit', 'roles.delete',
      'settings.general', 'settings.appearance', 'settings.home',
      'settings.catalog', 'settings.payment', 'settings.legal',
      'inventory.view', 'inventory.manage',
      'shipping.view', 'shipping.manage',
      'pos.access', 'pos.create_sale', 'pos.view_sales', 'pos.cancel_sale',
      'pos.cash_register', 'pos.open_close_session', 'pos.view_reports',
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
    module: 'apps',
    label: 'Aplicaciones (selector "Cambiar a")',
    permissions: [
      { id: 'store.access', label: 'Tienda', description: 'Navegar la tienda pública' },
      { id: 'pos.access', label: 'Punto de Venta', description: 'Acceder al POS' },
      { id: 'admin.access', label: 'Administración', description: 'Acceder al panel de administración' },
      { id: 'messaging.access', label: 'Social Media', description: 'Inbox, canales y publicaciones' },
    ],
  },
  {
    module: 'dashboard',
    label: 'Dashboard',
    permissions: [
      { id: 'dashboard.view', label: 'Ver dashboard', description: 'Acceso al panel principal' },
    ],
  },
  {
    module: 'orders',
    label: 'Ventas y Pedidos',
    permissions: [
      { id: 'orders.view', label: 'Ver pedidos', description: 'Listar pedidos, reseñas y detalles' },
      { id: 'orders.manage', label: 'Gestionar pedidos', description: 'Cambiar estados y despachos' },
      { id: 'orders.delete', label: 'Eliminar pedidos', description: 'Borrar pedidos' },
    ],
  },
  {
    module: 'pos',
    label: 'Punto de Venta (operaciones)',
    permissions: [
      { id: 'pos.create_sale', label: 'Registrar ventas', description: 'Crear nuevas ventas y abonos' },
      { id: 'pos.view_sales', label: 'Ver ventas y clientes', description: 'Historial, fiados y clientes' },
      { id: 'pos.cancel_sale', label: 'Anular/editar ventas', description: 'Cancelar o modificar ventas' },
      { id: 'pos.cash_register', label: 'Cajas registradoras', description: 'Administrar cajas' },
      { id: 'pos.open_close_session', label: 'Abrir/cerrar caja', description: 'Sesiones de caja' },
      { id: 'pos.view_reports', label: 'Ver reportes', description: 'Reportes de ventas' },
    ],
  },
  {
    module: 'products',
    label: 'Catálogo y Productos',
    permissions: [
      { id: 'products.view', label: 'Ver productos', description: 'Productos, plantillas, variantes, producción e insumos' },
      { id: 'products.create', label: 'Crear productos', description: 'Agregar nuevos productos' },
      { id: 'products.edit', label: 'Editar productos', description: 'Modificar productos existentes' },
      { id: 'products.delete', label: 'Eliminar productos', description: 'Borrar productos' },
    ],
  },
  {
    module: 'catalogs',
    label: 'Atributos del catálogo',
    permissions: [
      { id: 'catalogs.view', label: 'Ver atributos', description: 'Categorías, tipos, tallas y colores' },
      { id: 'catalogs.manage', label: 'Gestionar atributos', description: 'Crear, editar y eliminar' },
    ],
  },
  {
    module: 'inventory',
    label: 'Inventario y Compras',
    permissions: [
      { id: 'inventory.view', label: 'Ver inventario y compras', description: 'Proveedores, OCs, movimientos, conteos' },
      { id: 'inventory.manage', label: 'Gestionar inventario y compras', description: 'Crear, recibir y ajustar stock' },
    ],
  },
  {
    module: 'shipping',
    label: 'Envíos',
    permissions: [
      { id: 'shipping.view', label: 'Ver envíos', description: 'Transportadoras, zonas, tarifas y conexiones' },
      { id: 'shipping.manage', label: 'Gestionar envíos', description: 'Configurar transportadoras y tarifas' },
    ],
  },
  {
    module: 'users',
    label: 'Clientes',
    permissions: [
      { id: 'users.view', label: 'Ver clientes', description: 'Listar usuarios registrados' },
      { id: 'users.edit', label: 'Editar clientes', description: 'Modificar información' },
      { id: 'users.delete', label: 'Eliminar clientes', description: 'Borrar usuarios' },
    ],
  },
  {
    module: 'admins',
    label: 'Administradores',
    permissions: [
      { id: 'admins.view', label: 'Ver administradores', description: 'Listar admins del sistema' },
      { id: 'admins.create', label: 'Crear administradores', description: 'Agregar nuevos admins' },
      { id: 'admins.edit', label: 'Editar administradores', description: 'Modificar admins' },
      { id: 'admins.delete', label: 'Eliminar administradores', description: 'Borrar admins' },
    ],
  },
  {
    module: 'roles',
    label: 'Roles y Permisos',
    permissions: [
      { id: 'roles.view', label: 'Ver roles', description: 'Listar roles del sistema' },
      { id: 'roles.create', label: 'Crear roles', description: 'Agregar nuevos roles' },
      { id: 'roles.edit', label: 'Editar roles', description: 'Modificar permisos de roles' },
      { id: 'roles.delete', label: 'Eliminar roles', description: 'Borrar roles personalizados' },
    ],
  },
  {
    module: 'settings',
    label: 'Configuración',
    permissions: [
      { id: 'settings.general', label: 'General', description: 'Nombre, logo, contacto, impresión' },
      { id: 'settings.appearance', label: 'Apariencia', description: 'Colores y estilos' },
      { id: 'settings.home', label: 'Página de inicio', description: 'Secciones y contenido' },
      { id: 'settings.catalog', label: 'Catálogo', description: 'Filtros y ordenamiento' },
      { id: 'settings.payment', label: 'Pagos', description: 'Métodos de pago' },
      { id: 'settings.legal', label: 'Legal', description: 'Términos y políticas' },
    ],
  },
];

// Helper: Obtener todos los permisos
export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap(
  group => group.permissions.map(p => p.id)
);

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
