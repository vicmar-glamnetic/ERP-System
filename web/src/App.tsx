import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/inventory/ProductsPage';
import { WarehousesPage } from './pages/inventory/WarehousesPage';
import { StockPage } from './pages/inventory/StockPage';
import { PurchaseOrdersPage } from './pages/wms/PurchaseOrdersPage';
import { SalesOrdersPage } from './pages/wms/SalesOrdersPage';
import { CheckTasksPage } from './pages/wms/CheckTasksPage';
import { InvoicesPage } from './pages/wms/InvoicesPage';
import { RoutesPage } from './pages/tms/RoutesPage';
import { VehiclesPage } from './pages/tms/VehiclesPage';
import { LiveGPSPage } from './pages/tms/LiveGPSPage';
import { FuelLogsPage } from './pages/tms/FuelLogsPage';
import { APPage } from './pages/finance/APPage';
import { ARPage } from './pages/finance/ARPage';
import { BranchesPage } from './pages/finance/BranchesPage';
import { EmployeesPage } from './pages/hris/EmployeesPage';
import { ShiftsPage } from './pages/hris/ShiftsPage';
import { NewOrderPage } from './pages/orders/NewOrderPage';

function ProtectedApp() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/inventory/products" element={<ProductsPage />} />
        <Route path="/inventory/warehouses" element={<WarehousesPage />} />
        <Route path="/inventory/stock" element={<StockPage />} />
        <Route path="/wms/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/wms/sales-orders" element={<SalesOrdersPage />} />
        <Route path="/wms/check-tasks" element={<CheckTasksPage />} />
        <Route path="/wms/invoices" element={<InvoicesPage />} />
        <Route path="/tms/routes" element={<RoutesPage />} />
        <Route path="/tms/vehicles" element={<VehiclesPage />} />
        <Route path="/tms/live-gps" element={<LiveGPSPage />} />
        <Route path="/tms/fuel-logs" element={<FuelLogsPage />} />
        <Route path="/finance/ap" element={<APPage />} />
        <Route path="/finance/ar" element={<ARPage />} />
        <Route path="/finance/branches" element={<BranchesPage />} />
        <Route path="/hris/employees" element={<EmployeesPage />} />
        <Route path="/hris/shifts" element={<ShiftsPage />} />
        <Route path="/orders/new" element={<NewOrderPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function AuthGate() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spinner size={40} />
      </div>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  );
}
