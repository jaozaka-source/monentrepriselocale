import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Route } from './+types/index';
import { seo } from '@/lib/seo';
import { Loader2, Users, CreditCard, AlertCircle, LifeBuoy, Clock, ChevronRight } from 'lucide-react';
import { fetchAdminClients, countByPhase, isStalled, phaseTitle, STALL_THRESHOLD_DAYS, type AdminClient } from '@/lib/admin-data';
import { stepByCode } from '@/data/steps';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Administration — Tableau de bord',
    description: 'Vue d’ensemble des clients, abonnements et tickets.',
    noindex: true,
  });
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: number | string; color: string }) {
  return (
    <div className="espace-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 10, background: color, color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}>
          <Icon size={22} />
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4 }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminClients().then(setClients).catch(() => setClients([])).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>;
  }

  const byPhase = countByPhase(clients);
  const activeSubs = clients.filter((c) => c.subscription_status === 'active').length;
  const unpaid = clients.filter((c) => c.payment_alert || c.subscription_status === 'past_due' || c.subscription_status === 'unpaid');
  const openTickets = clients.reduce((sum, c) => sum + c.openTickets, 0);
  const stalled = clients.filter(isStalled).sort((a, b) => b.daysInStep - a.daysInStep);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18, marginBottom: 26 }}>
        <StatCard icon={Users} label="Clients" value={clients.length} color="var(--blue)" />
        <StatCard icon={CreditCard} label="Abonnements actifs" value={activeSubs} color="var(--forest)" />
        <StatCard icon={AlertCircle} label="Impayés" value={unpaid.length} color="var(--logo-red)" />
        <StatCard icon={LifeBuoy} label="Tickets ouverts" value={openTickets} color="#b8860b" />
      </div>

      <div className="espace-card" style={{ marginBottom: 22 }}>
        <h2>Clients par phase</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ padding: 18, background: '#f4f7fa', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-muted)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Phase {n}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--navy)', margin: '6px 0 4px' }}>{byPhase[n] || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{phaseTitle(n)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="espace-card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={18} style={{ color: 'var(--logo-red)' }} />
          Clients bloqués ({STALL_THRESHOLD_DAYS} jours+ dans la même étape)
        </h2>
        {stalled.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Aucun client bloqué. 👍</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stalled.map((c) => (
              <Link key={c.id} to={`/espace/admin/clients/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid #e3eaf0', borderRadius: 8, textDecoration: 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{c.expand?.owner?.name || c.expand?.owner?.email || c.company_name || 'Client'}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                    {c.company_name || '—'} · étape {c.current_step} · {stepByCode(c.current_step)?.title || ''}
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--logo-red)', whiteSpace: 'nowrap' }}>{c.daysInStep} j</span>
                <ChevronRight size={18} style={{ color: 'var(--ink-muted)' }} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
