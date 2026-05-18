export { default as api } from './api.service';
export { default as authService } from './auth.service';
export { default as productsService } from './products.service';
export { default as catalogsService } from './catalogs.service';
export { default as settingsService } from './settings.service';
export { default as ordersService } from './orders.service';
export { default as usersService } from './users.service';
export { default as addressesService } from './addresses.service';
export { default as rolesService } from './roles.service';

// Re-export types
export type { LoginCredentials, RegisterData, User, AuthResponse } from './auth.service';
export type { ProductFilters, ProductsResponse } from './products.service';
export type { Size, Color, Category, ProductType } from './catalogs.service';
export type {
  PublicSettings,
  StoreSettings,
  OrderSettings,
  PaymentSettings,
  NotificationSettings,
} from './settings.service';
export type {
  ApiOrder,
  OrderItem,
  CreateOrderInput,
  ChangeStatusInput,
  OrdersFilters,
  OrdersResponse,
} from './orders.service';
export type {
  ApiUser,
  CreateUserInput,
  UpdateUserInput,
  UsersFilters,
  UsersResponse,
} from './users.service';
export type { Address, AddressInput } from './addresses.service';
export type {
  ApiRole,
  CreateRoleInput,
  UpdateRoleInput,
  RolesFilters,
  RolesResponse,
  PermissionsResponse,
  RoleStats,
} from './roles.service';
