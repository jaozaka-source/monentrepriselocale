import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Route } from './+types/tickets';
import { seo } from '@/lib/seo';
import { Loader2, ChevronRight, Search } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import type { RecordModel } from 'pocketbase';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Tickets — Administration',
    description: 'Tous les tickets clients avec filtres.',
    noindex: true,
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  site_inaccessible: 'Site inaccessible',
  display_error: 'Erreur d’affichage',
  content_modification: 'Modification de contenu',
  question: 'Question',
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  blocking: { label: 'Bloquant', color: 'var(--logo-red)' },
  annoying: { label: 'Gênant', color: '#b8860b' },
  minor: { label: 'Mineur', color: 'var(--ink-muted)' },
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'open', label: 'Ouvert' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'resolved', label: 'Résolu' },
  { value: 'closed', label: 'Fermé' },
];

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'Toutes les priorités' },
  { value: 'blocking', label: 'Bloquant' },
  { value: 'annoying', label: 'Gênant' },
  { value: 'minor', label: 'Mineur' },
];

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé',
};

type AdminTicket = RecordModel & { owner: string; subject: string; status: string; category: string; priority: string; created: string; expand?: { owner?: { email?: string; name?: string } } };

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AdminTickets() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');

  useEffect(() => {
    pb.collection('tickets')
      .getFullList({ expand: 'owner', sort: '-created', requestKey: null })
      .then((r) => setTickets(r as unknown as AdminTicket[]))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = tickets.filter((t) => {
    if (status !== 'all' && t.status !== status) return false;
    if (priority !== 'all' && t.priority !== priority) return false;
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = `${t.subject} ${t.expand?.owner?.email || ''} ${t.expand?.owner?.name || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      <div className="espace-page-head">
        <h1>Tickets</h1>
        <p>Tous les tickets clients. Filtrez par statut et priorité, ou recherchez par sujet ou client.</p>
      </div>

      <div className="espace-card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
          <div className="espace-field" style={{ position: 'relative' }}>
            <label>Recherche</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }} />
              <input className="espace-input" style={{ paddingLeft: 38 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sujet, client…" />
            </div>
          </div>
          <div className="espace-field">
            <label>Statut</label>
            <select className="espace-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="espace-field">
            <label>Priorité</label>
            <select className="espace-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="espace-card">
        <h2>Tickets ({filtered.length})</h2>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader2 size={22} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Aucun ticket ne correspond aux filtres.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e3eaf0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Sujet</th>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Client</th>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Catégorie</th>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Priorité</th>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Statut</th>
                  <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Date</th>
                  <th style={{ padding: '10px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const pr = PRIORITY_LABELS[t.priority] || { label: t.priority, color: 'var(--ink-muted)' };
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #eef2f6' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--navy)' }}>{t.subject}</td>
                      <td style={{ padding: '12px 8px', color: 'var(--ink-muted)' }}>{t.expand?.owner?.email || '—'}</td>
                      <td style={{ padding: '12px 8px', color: 'var(--ink-muted)' }}>{CATEGORY_LABELS[t.category] || t.category}</td>
                      <td style={{ padding: '12px 8px', fontWeight: 700, color: pr.color }}>{pr.label}</td>
                      <td style={{ padding: '12px 8px' }}>{STATUS_LABELS[t.status] || t.status}</td>
                      <td style={{ padding: '12px 8px', color: 'var(--ink-muted)' }}>{formatDate(t.created)}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        <Link to={`/espace/admin/tickets/${t.id}`} style={{ display: 'inline-flex', color: 'var(--blue)' }}>
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
