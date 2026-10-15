import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Route } from './+types/clients';
import { seo } from '@/lib/seo';
import { Loader2, Search, ChevronRight, AlertCircle } from 'lucide-react';
import { fetchAdminClients, phaseNumberOfStep, type AdminClient } from '@/lib/admin-data';
import { stepByCode } from '@/data/steps';
import { getRdvInfo, formatRdvShort } from '@/lib/rdv';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Portefeuille clients — Administration',
    description: 'Liste des clients avec filtres et recherche.',
    noindex: true,
  });
}

const PHASE_OPTIONS = [
  { value: 'all', label: 'Toutes les phases' },
  { value: '1', label: 'Phase 1 — Signature' },
  { value: '2', label: 'Phase 2 — Paiement' },
  { value: '3', label: 'Phase 3 — Développement' },
  { value: '4', label: 'Phase 4 — Exploitation' },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: 'all', label: 'Tous les paiements' },
  { value: 'non_commence', label: 'Non commencé' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'realise', label: 'Réalisé' },
  { value: 'echoue', label: 'Échoué' },
];

function paymentStatusInfo(c: AdminClient): { label: string; cls: string } {
  switch (String(c.statut_paiement || 'non_commence')) {
    case 'en_cours': return { label: 'En cours', cls: 'pmt-badge-en_cours' };
    case 'realise': return { label: 'Réalisé', cls: 'pmt-badge-realise' };
    case 'echoue': return { label: 'Échoué', cls: 'pmt-badge-echoue' };
    default: return { label: 'Non commencé', cls: 'pmt-badge-non_commence' };
  }
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AdminClients() {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState('all');
  const [packFilter, setPackFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchAdminClients().then(setClients).catch(() => setClients([])).finally(() => setLoading(false));
  }, []);

  const packOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of clients) {
      if (c.pack && c.packName) seen.set(c.pack, c.packName);
    }
    return [{ value: 'all', label: 'Tous les packs' }, ...Array.from(seen, ([value, label]) => ({ value, label }))];
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (phase !== 'all' && String(phaseNumberOfStep(c.current_step)) !== phase) return false;
      if (packFilter !== 'all' && c.pack !== packFilter) return false;
      if (statusFilter !== 'all' && String(c.statut_paiement || 'non_commence') !== statusFilter) return false;
      if (q) {
        const hay = `${c.company_name || ''} ${c.expand?.owner?.name || ''} ${c.expand?.owner?.email || ''} ${c.siren || ''} ${c.city || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [clients, search, phase, packFilter, statusFilter]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>;
  }

  return (
    <>
      <div className="espace-card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 14 }}>
          <div className="espace-field" style={{ position: 'relative' }}>
            <label>Recherche (nom, SIREN, ville)</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }} />
              <input className="espace-input" style={{ paddingLeft: 38 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, SIREN, ville…" />
            </div>
          </div>
          <div className="espace-field">
            <label>Phase</label>
            <select className="espace-select" value={phase} onChange={(e) => setPhase(e.target.value)}>
              {PHASE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="espace-field">
            <label>Pack</label>
            <select className="espace-select" value={packFilter} onChange={(e) => setPackFilter(e.target.value)}>
              {packOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="espace-field">
            <label>Paiement</label>
            <select className="espace-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {PAYMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="espace-card">
        <h2>Clients ({filtered.length})</h2>
        {filtered.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Aucun client ne correspond aux filtres.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 880 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e3eaf0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Entreprise</th>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Ville</th>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Pack</th>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Formule</th>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Étape</th>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>RDV</th>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Paiement</th>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Entrée étape</th>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Tickets</th>
                  <th style={{ padding: '10px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const pst = paymentStatusInfo(c);
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #eef2f6' }}>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{c.company_name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{c.expand?.owner?.email || ''}</div>
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--ink-muted)' }}>{c.city || '—'}</td>
                      <td style={{ padding: '12px 8px' }}>{c.packName || '—'}</td>
                      <td style={{ padding: '12px 8px', color: 'var(--ink-muted)' }}>{c.pack_billing === 'biennial' ? '24 mois' : c.pack_billing === 'annual' ? 'Annuel' : c.pack_billing === 'monthly' ? 'Mensuel' : '—'}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{c.current_step}</span>
                        <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{stepByCode(c.current_step)?.title || ''}</div>
                      </td>
                      <td style={{ padding: '12px 8px', color: c.rdv_statut === 'canceled' ? 'var(--logo-red)' : 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                        {c.rdv_statut === 'canceled' ? 'Annulé' : formatRdvShort(getRdvInfo(c))}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span className={`pmt-badge ${pst.cls}`}>{pst.label}</span>
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--ink-muted)' }}>{formatDate(c.stepEnteredAt)}</td>
                      <td style={{ padding: '12px 8px' }}>
                        {c.openTickets > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: 'var(--logo-red)' }}>
                            <AlertCircle size={14} /> {c.openTickets}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        <Link to={`/espace/admin/clients/${c.id}`} style={{ display: 'inline-flex', color: 'var(--blue)' }}>
                          <ChevronRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
