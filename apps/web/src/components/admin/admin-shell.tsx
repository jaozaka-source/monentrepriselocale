import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { LayoutDashboard, Users, Settings, Shield, Loader2, LifeBuoy, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const NAV = [
  { to: '/espace/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/espace/admin/clients', label: 'Portefeuille', icon: Users, end: false },
  { to: '/espace/admin/tickets', label: 'Tickets', icon: LifeBuoy, end: false },
  { to: '/espace/admin/stripe-events', label: 'Stripe', icon: Zap, end: false },
  { to: '/espace/admin/settings', label: 'Paramètres', icon: Settings, end: false },
];

export function AdminShell() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user?.role !== 'admin') {
      navigate('/espace');
    }
  }, [isLoading, user, navigate]);

  if (isLoading || user?.role !== 'admin') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)' }} />
      </div>
    );
  }

  return (
    <>
      <div className="espace-page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: 'var(--logo-red)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
          <Shield size={15} /> Administration
        </div>
        <h1>Espace administrateur</h1>
        <p>Pilotage des clients, des abonnements et des paramètres de la plateforme.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `espace-btn espace-btn-secondary${isActive ? ' active' : ''}`
            }
            style={({ isActive }) => ({
              padding: '10px 16px',
              fontSize: 13,
              background: isActive ? 'var(--blue)' : undefined,
              color: isActive ? '#fff' : undefined,
              borderColor: isActive ? 'var(--blue)' : undefined,
            })}
          >
            <item.icon size={15} /> {item.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </>
  );
}

export default AdminShell;
