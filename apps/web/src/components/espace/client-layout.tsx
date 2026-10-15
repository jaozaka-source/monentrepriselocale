import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { LayoutDashboard, User, FileText, CreditCard, LifeBuoy, Shield, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useClientData } from './client-data-context';
import { isInPhase4 } from '@/data/steps';

const LOGO_URL = 'https://horizons-cdn.hostinger.com/082281b5-6516-4c12-b3c6-5cca51241b08/img_8241-8Chpm.PNG';

export function ClientLayout() {
  const { user, logout } = useAuth();
  const { profile } = useClientData();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentStep = profile?.current_step ?? '1.1';
  const showTickets = isInPhase4(currentStep);
  const isAdmin = user?.role === 'admin';

  const navItems = [
    { to: '/espace', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    { to: '/espace/informations', label: 'Mes informations', icon: User },
    { to: '/espace/documents', label: 'Mes documents', icon: FileText },
    { to: '/espace/abonnement', label: 'Mon abonnement', icon: CreditCard },
  ];

  if (showTickets) {
    navItems.push({ to: '/espace/tickets', label: 'Mes tickets', icon: LifeBuoy, end: false });
  }
  if (isAdmin) {
    navItems.push({ to: '/espace/admin', label: 'Administration', icon: Shield, end: false });
  }

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="espace-body">
      <header className="espace-topbar">
        <a href="/espace" className="espace-logo" aria-label="Espace client — accueil">
          <img src={LOGO_URL} alt="Mon Entreprise Locale" />
        </a>
        <div className="espace-user">
          <span className="espace-email">{user?.email}</span>
          <button type="button" className="espace-logout" onClick={onLogout}>
            <LogOut size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Déconnexion
          </button>
          <button type="button" className="espace-menu-btn" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      <div className="espace-shell">
        <aside className={menuOpen ? 'espace-sidebar is-open' : 'espace-sidebar'}>
          <nav>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="espace-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
