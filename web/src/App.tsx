import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProductsProvider } from './context/ProductsContext';
import { CatalogsProvider } from './context/CatalogsContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { CustomizerPage } from './pages/CustomizerPage';
import { CartPage } from './pages/CartPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminLayout } from './components/admin/AdminLayout';
import { DashboardPage } from './pages/admin/DashboardPage';
import { ProductsPage } from './pages/admin/ProductsPage';
import { SizesPage } from './pages/admin/catalogs/SizesPage';
import { ColorsPage } from './pages/admin/catalogs/ColorsPage';
import { ProductTypesPage } from './pages/admin/catalogs/ProductTypesPage';
import { CategoriesPage } from './pages/admin/catalogs/CategoriesPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Protected route for admin only
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <ProductsProvider>
            <CatalogsProvider>
              <CartProvider>
                <Routes>
                {/* Admin Panel Routes - Con AdminLayout */}
                <Route
                  path="/admin-panel/*"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <Routes>
                          <Route path="/" element={<DashboardPage />} />
                          <Route path="/products" element={<ProductsPage />} />
                          <Route path="/catalogs/sizes" element={<SizesPage />} />
                          <Route path="/catalogs/colors" element={<ColorsPage />} />
                          <Route path="/catalogs/product-types" element={<ProductTypesPage />} />
                          <Route path="/catalogs/categories" element={<CategoriesPage />} />
                          <Route path="*" element={<NotFoundPage />} />
                        </Routes>
                      </AdminLayout>
                    </AdminRoute>
                  }
                />

              {/* Rutas públicas - Con Layout */}
              <Route
                path="/*"
                element={
                  <Layout>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/catalog" element={<CatalogPage />} />
                      <Route path="/customize" element={<CustomizerPage />} />
                      <Route path="/cart" element={<CartPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </Layout>
                }
              />
              </Routes>
            </CartProvider>
          </CatalogsProvider>
          </ProductsProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
