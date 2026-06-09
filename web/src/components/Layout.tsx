import { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Truck, DollarSign,
  Users, Warehouse, LogOut, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  label: string;
  path?: string;
  icon: React.ReactNode;
  children?: { label: string; path: string }[];
  roles?: string[];
}

const NAV: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <LayoutDashboard size={16} /> },
  {
    label: 'Inventory', icon: <Warehouse size={16} />,
    children: [
      { label: 'Products',   path: '/inventory/products' },
      { label: 'Warehouses', path: '/inventory/warehouses' },
      { label: 'Stock',      path: '/inventory/stock' },
    ],
  },
  {
    label: 'WMS', icon: <Package size={16} />,
    children: [
      { label: 'Purchase Orders', path: '/wms/purchase-orders' },
      { label: 'Sales Orders',    path: '/wms/sales-orders' },
      { label: 'Check Tasks',     path: '/wms/check-tasks' },
      { label: 'Invoices',        path: '/wms/invoices' },
    ],
  },
  {
    label: 'TMS', icon: <Truck size={16} />,
    children: [
      { label: 'Routes',   path: '/tms/routes' },
      { label: 'Vehicles', path: '/tms/vehicles' },
      { label: 'Live GPS', path: '/tms/live-gps' },
      { label: 'Fuel Logs', path: '/tms/fuel-logs' },
    ],
  },
  {
    label: 'Finance', icon: <DollarSign size={16} />,
    children: [
      { label: 'Accounts Payable',   path: '/finance/ap' },
      { label: 'Accounts Receivable', path: '/finance/ar' },
      { label: 'Branches',           path: '/finance/branches' },
    ],
  },
  {
    label: 'HRIS', icon: <Users size={16} />,
    children: [
      { label: 'Employees', path: '/hris/employees' },
      { label: 'Shifts',    path: '/hris/shifts' },
    ],
  },
  {
    label: 'Orders', icon: <ShoppingCart size={16} />,
    children: [
      { label: 'Place Order', path: '/orders/new' },
    ],
    roles: ['system_admin', 'operations_manager', 'finance_officer'],
  },
];

function NavGroup({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(() =>
    item.children?.some((c) => location.pathname.startsWith(c.path)) ?? false
  );

  if (item.path) {
    return (
      <NavLink
        to={item.path}
        end
        style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px',
          borderRadius: 6, fontSize: 13, fontWeight: 500, color: isActive ? 'var(--primary)' : 'var(--text-muted)',
          background: isActive ? 'var(--primary-light)' : 'transparent',
          textDecoration: 'none', cursor: 'pointer',
        })}
      >
        {item.icon}{item.label}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px',
          borderRadius: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-muted)',
          background: 'none', border: 'none', width: '100%', cursor: 'pointer',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {item.icon}{item.label}
        </span>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {open && (
        <div style={{ paddingLeft: 28, marginTop: 2 }}>
          {item.children!.map((c) => (
            <NavLink
              key={c.path}
              to={c.path}
              style={({ isActive }) => ({
                display: 'block', padding: '5px 10px', borderRadius: 5,
                fontSize: 12, color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                background: isActive ? 'var(--primary-light)' : 'transparent',
                fontWeight: isActive ? 600 : 400, textDecoration: 'none', marginBottom: 1,
              })}
            >
              {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleNav = NAV.filter((item) =>
    !item.roles || item.roles.includes(user?.role ?? '')
  );

  const sidebar = (
    <aside style={{
      width: 'var(--sidebar-w)', flexShrink: 0, height: '100vh', position: 'sticky', top: 0,
      background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary)', letterSpacing: -0.3 }}>
          ERP System
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {user?.role?.replace(/_/g, ' ')}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {visibleNav.map((item) => <NavGroup key={item.label} item={item} />)}
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{user?.full_name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{user?.employee_code}</div>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
            color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar (desktop) */}
      <div style={{ display: 'none' }} className="sidebar-desktop">{sidebar}</div>
      <div style={{ display: 'flex' }}>{sidebar}</div>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{
          height: 'var(--header-h)', background: 'var(--surface)',
          borderBottom: '1px solid var(--border)', display: 'flex',
          alignItems: 'center', padding: '0 24px', gap: 12, flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Welcome back, <strong style={{ color: 'var(--text)' }}>{user?.full_name}</strong>
          </span>
        </header>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {children}
        </div>
      </main>
    </div>
  );
}
