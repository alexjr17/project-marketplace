import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RolesProvider } from './context/RolesContext';
import { ProductsProvider } from './context/ProductsContext';
import { CatalogsProvider } from './context/CatalogsContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { UsersProvider } from './context/UsersContext';
import { OrdersProvider } from './context/OrdersContext';
import { PaymentsProvider } from './context/PaymentsContext';
import { SettingsProvider } from './context/SettingsContext';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { CustomizerPage } from './pages/CustomizerPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { ProfilePage } from './pages/ProfilePage';
import { MyOrdersPage } from './pages/MyOrdersPage';
import { LegalPage } from './pages/LegalPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import ProductDetailPage from './pages/ProductDetailPage';
import { AdminLayout } from './components/admin/AdminLayout';
import { DashboardPage } from './pages/admin/DashboardPage';
import { InboxPage as MessagingInboxPage } from './pages/messaging/InboxPage';
import { ChannelsPage as MessagingChannelsPage } from './pages/messaging/ChannelsPage';
import { PostsPage as MessagingPostsPage } from './pages/messaging/PostsPage';
import { PagesPage as MessagingPagesPage } from './pages/messaging/PagesPage';
import { KnowledgePage as MessagingKnowledgePage } from './pages/messaging/KnowledgePage';
import MessagingLayout from './components/messaging/MessagingLayout';
import { ProductsPage } from './pages/admin/ProductsPage';
import { VariantsPage } from './pages/admin/VariantsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { UserDetailPage } from './pages/admin/UserDetailPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminDetailPage } from './pages/admin/AdminDetailPage';
import { RolesPage } from './pages/admin/RolesPage';
import { RoleFormPage } from './pages/admin/RoleFormPage';
import { SizesPage } from './pages/admin/catalogs/SizesPage';
import { ColorsPage } from './pages/admin/catalogs/ColorsPage';
import { CategoriesPage } from './pages/admin/catalogs/CategoriesPage';
import { ProductTypesPage } from './pages/admin/ProductTypesPage';
import { TemplatesPage } from './pages/admin/TemplatesPage';
import ZoneTypesPage from './pages/admin/ZoneTypesPage';
import ZoneTypeDetailPage from './pages/admin/ZoneTypeDetailPage';
import InputTypesPage from './pages/admin/InputTypesPage';
import InputTypeDetailPage from './pages/admin/InputTypeDetailPage';
import InputsPage from './pages/admin/InputsPage';
import InputDetailPage from './pages/admin/InputDetailPage';
import DesignImagesPage from './pages/admin/DesignImagesPage';
import { OrdersPage } from './pages/admin/OrdersPage';
import { OrderDetailPage } from './pages/admin/OrderDetailPage';
import { ShippingPage } from './pages/admin/ShippingPage';
import { PaymentsPage } from './pages/admin/PaymentsPage';
import CashRegistersPage from './pages/admin/CashRegistersPage';
import BarcodePrintPage from './pages/admin/BarcodePrintPage';
import SuppliersPage from './pages/admin/SuppliersPage';
import SupplierDetailPage from './pages/admin/SupplierDetailPage';
import PurchaseOrdersPage from './pages/admin/PurchaseOrdersPage';
import PurchaseOrderDetailPage from './pages/admin/PurchaseOrderDetailPage';
import PurchaseReturnsPage from './pages/admin/PurchaseReturnsPage';
import PurchaseReturnFormPage from './pages/admin/PurchaseReturnFormPage';
import InventoryMovementsPage from './pages/admin/InventoryMovementsPage';
import InventoryCountsPage from './pages/admin/InventoryCountsPage';
import InventoryCountDetailPage from './pages/admin/InventoryCountDetailPage';
import InventoryConversionsPage from './pages/admin/InventoryConversionsPage';
import InventoryConversionDetailPage from './pages/admin/InventoryConversionDetailPage';
import InventoryConversionFromTemplatePage from './pages/admin/InventoryConversionFromTemplatePage';
import TemplateRecipesPage from './pages/admin/TemplateRecipesPage';
import ReviewsPage from './pages/admin/ReviewsPage';
import {
  SettingsGeneralPage,
  SettingsAppearancePage,
  SettingsShippingPage,
  SettingsPaymentPage,
  SettingsLegalPage,
  SettingsHomePage,
  SettingsCatalogPage,
  SettingsPrintingPage,
  LabelTemplatesPage,
} from './pages/admin/settings';
import { NotFoundPage } from './pages/NotFoundPage';
import { POSProvider } from './context/POSContext';
import POSLayout from './components/pos/POSLayout';
import POSDashboard from './pages/pos/POSDashboard';
import NewSalePage from './pages/pos/NewSalePage';
import SalesHistoryPage from './pages/pos/SalesHistoryPage';
import DebtsPage from './pages/pos/DebtsPage';
import CustomersPage from './pages/pos/CustomersPage';
import CashRegisterPage from './pages/pos/CashRegisterPage';
import type { Permission } from './types/roles';

// Protected route for admin access
// Cliente (roleId 2) NUNCA puede acceder al panel admin, sin importar permisos
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useAuth();

  // Si no está autenticado, redirigir al inicio
  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  // Cliente (roleId 2) NUNCA tiene acceso al panel admin
  if (user.roleId === 2) {
    return <Navigate to="/" replace />;
  }

  // SuperAdmin (roleId 1) y roles administrativos (roleId 3+) tienen acceso
  return <>{children}</>;
};

// Protected route for specific permission
const PermissionRoute = ({
  children,
  permission,
  fallback = <Navigate to="/admin-panel" replace />,
}: {
  children: React.ReactNode;
  permission: Permission;
  fallback?: React.ReactNode;
}) => {
  const { hasPermission } = useAuth();
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
};

// Protected route for POS access
const POSRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, hasPermission } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  if (!hasPermission('pos.access')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Protected route for Social Media (messaging) access
const MessagingRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, hasPermission } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  if (!hasPermission('messaging.access')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <RolesProvider>
          <ToastProvider>
            <ProductsProvider>
              <CatalogsProvider>
                <UsersProvider>
                  <OrdersProvider>
                    <PaymentsProvider>
                      <SettingsProvider>
                        <POSProvider>
                          <CartProvider>
                          <Routes>
                            {/* Mensajería — app independiente con su propio layout */}
                            <Route
                              path="/messaging/*"
                              element={
                                <MessagingRoute>
                                  <MessagingLayout>
                                    <Routes>
                                      <Route path="/" element={<Navigate to="/messaging/inbox" replace />} />
                                      <Route path="/inbox" element={<MessagingInboxPage />} />
                                      <Route path="/posts" element={<MessagingPostsPage />} />
                                      <Route path="/pages" element={<MessagingPagesPage />} />
                                      <Route path="/knowledge" element={<MessagingKnowledgePage />} />
                                      <Route path="/channels" element={<MessagingChannelsPage />} />
                                      <Route path="*" element={<Navigate to="/messaging/inbox" replace />} />
                                    </Routes>
                                  </MessagingLayout>
                                </MessagingRoute>
                              }
                            />

                            {/* POS Routes - Con POSLayout */}
                            <Route
                              path="/pos/*"
                              element={
                                <POSRoute>
                                  <POSLayout>
                                    <Routes>
                                      <Route path="/" element={<POSDashboard />} />
                                      <Route path="/sale" element={<NewSalePage />} />
                                      <Route path="/history" element={<SalesHistoryPage />} />
                                      <Route path="/debts" element={<DebtsPage />} />
                                      <Route path="/customers" element={<CustomersPage />} />
                                      <Route path="/cash" element={<CashRegisterPage />} />
                                      <Route path="*" element={<Navigate to="/pos" replace />} />
                                    </Routes>
                                  </POSLayout>
                                </POSRoute>
                              }
                            />

                            {/* Admin Panel Routes - Con AdminLayout */}
                            <Route
                              path="/admin-panel/*"
                              element={
                              <AdminRoute>
                                <AdminLayout>
                                  <Routes>
                                    {/* Dashboard */}
                                    <Route
                                      path="/"
                                      element={
                                        <PermissionRoute permission="dashboard.view">
                                          <DashboardPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Usuarios */}
                                    <Route
                                      path="/users"
                                      element={
                                        <PermissionRoute permission="users.view">
                                          <UsersPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/users/:id"
                                      element={
                                        <PermissionRoute permission="users.view">
                                          <UserDetailPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Administradores */}
                                    <Route
                                      path="/admins"
                                      element={
                                        <PermissionRoute permission="admins.view">
                                          <AdminUsersPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/admins/:id"
                                      element={
                                        <PermissionRoute permission="admins.view">
                                          <AdminDetailPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Roles */}
                                    <Route
                                      path="/roles"
                                      element={
                                        <PermissionRoute permission="roles.view">
                                          <RolesPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/roles/new"
                                      element={
                                        <PermissionRoute permission="roles.create">
                                          <RoleFormPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/roles/:id/edit"
                                      element={
                                        <PermissionRoute permission="roles.edit">
                                          <RoleFormPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Productos */}
                                    <Route
                                      path="/products"
                                      element={
                                        <PermissionRoute permission="products.view">
                                          <ProductsPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Variantes de Productos */}
                                    <Route
                                      path="/variants"
                                      element={
                                        <PermissionRoute permission="products.view">
                                          <VariantsPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Catálogos */}
                                    <Route
                                      path="/catalogs/sizes"
                                      element={
                                        <PermissionRoute permission="catalogs.view">
                                          <SizesPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/catalogs/colors"
                                      element={
                                        <PermissionRoute permission="catalogs.view">
                                          <ColorsPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/catalogs/product-types"
                                      element={
                                        <PermissionRoute permission="catalogs.view">
                                          <ProductTypesPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/catalogs/categories"
                                      element={
                                        <PermissionRoute permission="catalogs.view">
                                          <CategoriesPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Tipos de Zona */}
                                    <Route
                                      path="/zone-types"
                                      element={
                                        <PermissionRoute permission="products.view">
                                          <ZoneTypesPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/zone-types/:id"
                                      element={
                                        <PermissionRoute permission="products.view">
                                          <ZoneTypeDetailPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Tipos de Insumo */}
                                    <Route
                                      path="/input-types"
                                      element={
                                        <PermissionRoute permission="products.view">
                                          <InputTypesPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/input-types/:id"
                                      element={
                                        <PermissionRoute permission="products.view">
                                          <InputTypeDetailPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Insumos/Inventario */}
                                    <Route
                                      path="/inputs"
                                      element={
                                        <PermissionRoute permission="products.view">
                                          <InputsPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/inputs/:id"
                                      element={
                                        <PermissionRoute permission="products.view">
                                          <InputDetailPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Templates/Modelos */}
                                    <Route
                                      path="/templates"
                                      element={
                                        <PermissionRoute permission="products.view">
                                          <TemplatesPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Imágenes de Diseño (catálogo para personalizador) */}
                                    <Route
                                      path="/design-images"
                                      element={
                                        <PermissionRoute permission="products.view">
                                          <DesignImagesPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Imprimir Códigos de Barras */}
                                    <Route
                                      path="/barcodes/print/:productId"
                                      element={
                                        <PermissionRoute permission="products.view">
                                          <BarcodePrintPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Pedidos */}
                                    <Route
                                      path="/orders"
                                      element={
                                        <PermissionRoute permission="orders.view">
                                          <OrdersPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/orders/:id"
                                      element={
                                        <PermissionRoute permission="orders.view">
                                          <OrderDetailPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/orders/shipping"
                                      element={
                                        <PermissionRoute permission="orders.manage">
                                          <ShippingPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Pagos */}
                                    <Route
                                      path="/payments"
                                      element={
                                        <PermissionRoute permission="settings.payment">
                                          <PaymentsPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Cajas Registradoras */}
                                    <Route
                                      path="/cash-registers"
                                      element={
                                        <PermissionRoute permission="pos.cash_register">
                                          <CashRegistersPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Compras e Inventario */}
                                    <Route
                                      path="/suppliers"
                                      element={
                                        <PermissionRoute permission="inventory.view">
                                          <SuppliersPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/suppliers/:id"
                                      element={
                                        <PermissionRoute permission="inventory.view">
                                          <SupplierDetailPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/purchase-orders"
                                      element={
                                        <PermissionRoute permission="inventory.view">
                                          <PurchaseOrdersPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/purchase-orders/:id"
                                      element={
                                        <PermissionRoute permission="inventory.view">
                                          <PurchaseOrderDetailPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/purchase-returns"
                                      element={
                                        <PermissionRoute permission="inventory.view">
                                          <PurchaseReturnsPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/purchase-returns/new"
                                      element={
                                        <PermissionRoute permission="inventory.manage">
                                          <PurchaseReturnFormPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/inventory-movements"
                                      element={
                                        <PermissionRoute permission="inventory.view">
                                          <InventoryMovementsPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/inventory-counts"
                                      element={
                                        <PermissionRoute permission="inventory.view">
                                          <InventoryCountsPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/inventory-counts/:id"
                                      element={
                                        <PermissionRoute permission="inventory.view">
                                          <InventoryCountDetailPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/inventory-conversions"
                                      element={
                                        <PermissionRoute permission="inventory.view">
                                          <InventoryConversionsPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/inventory-conversions/new-from-template"
                                      element={
                                        <PermissionRoute permission="inventory.manage">
                                          <InventoryConversionFromTemplatePage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/inventory-conversions/:id"
                                      element={
                                        <PermissionRoute permission="inventory.view">
                                          <InventoryConversionDetailPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/template-recipes"
                                      element={
                                        <PermissionRoute permission="inventory.manage">
                                          <TemplateRecipesPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Reseñas */}
                                    <Route
                                      path="/reviews"
                                      element={
                                        <PermissionRoute permission="orders.view">
                                          <ReviewsPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    {/* Configuración */}
                                    <Route
                                      path="/settings"
                                      element={<Navigate to="/admin-panel/settings/general" replace />}
                                    />
                                    <Route
                                      path="/settings/general"
                                      element={
                                        <PermissionRoute permission="settings.general">
                                          <SettingsGeneralPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/settings/appearance"
                                      element={
                                        <PermissionRoute permission="settings.appearance">
                                          <SettingsAppearancePage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/settings/home"
                                      element={
                                        <PermissionRoute permission="settings.home">
                                          <SettingsHomePage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/settings/catalog"
                                      element={
                                        <PermissionRoute permission="settings.catalog">
                                          <SettingsCatalogPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/settings/shipping"
                                      element={
                                        <PermissionRoute permission="shipping.view">
                                          <SettingsShippingPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    {/* Módulo Envíos: pestañas del sidebar */}
                                    {['carriers', 'zones', 'connections', 'config'].map((tab) => (
                                      <Route
                                        key={tab}
                                        path={`/shipping/${tab}`}
                                        element={
                                          <PermissionRoute permission="shipping.view">
                                            <SettingsShippingPage />
                                          </PermissionRoute>
                                        }
                                      />
                                    ))}
                                    <Route
                                      path="/settings/payment"
                                      element={
                                        <PermissionRoute permission="settings.payment">
                                          <SettingsPaymentPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/settings/legal"
                                      element={
                                        <PermissionRoute permission="settings.legal">
                                          <SettingsLegalPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/settings/label-templates"
                                      element={
                                        <PermissionRoute permission="settings.general">
                                          <LabelTemplatesPage />
                                        </PermissionRoute>
                                      }
                                    />
                                    <Route
                                      path="/settings/printing"
                                      element={
                                        <PermissionRoute permission="settings.general">
                                          <SettingsPrintingPage />
                                        </PermissionRoute>
                                      }
                                    />

                                    <Route path="*" element={<NotFoundPage />} />
                                  </Routes>
                                </AdminLayout>
                              </AdminRoute>
                            }
                          />

                          {/* Página de reset password (sin Layout) */}
                          <Route path="/reset-password" element={<ResetPasswordPage />} />

                          {/* Rutas públicas - Con Layout */}
                          <Route
                            path="/*"
                            element={
                              <Layout>
                                <Routes>
                                  <Route path="/" element={<HomePage />} />
                                  <Route path="/catalog" element={<CatalogPage />} />
                                  <Route path="/product/:id" element={<ProductDetailPage />} />
                                  <Route path="/customize" element={<CustomizerPage />} />
                                  <Route path="/cart" element={<CartPage />} />
                                  <Route path="/checkout" element={<CheckoutPage />} />
                                  <Route path="/order-confirmation/:orderNumber" element={<OrderConfirmationPage />} />
                                  <Route path="/profile" element={<ProfilePage />} />
                                  <Route path="/my-orders" element={<MyOrdersPage />} />
                                  <Route path="/legal/:slug" element={<LegalPage />} />
                                  <Route path="*" element={<NotFoundPage />} />
                                </Routes>
                              </Layout>
                            }
                          />
                        </Routes>
                          </CartProvider>
                        </POSProvider>
                      </SettingsProvider>
                    </PaymentsProvider>
                  </OrdersProvider>
                </UsersProvider>
              </CatalogsProvider>
            </ProductsProvider>
          </ToastProvider>
        </RolesProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
