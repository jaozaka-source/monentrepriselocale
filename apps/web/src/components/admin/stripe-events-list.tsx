import { useEffect, useState } from 'react';
import { Loader2, Zap, Search } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import type { RecordModel } from 'pocketbase';

type StripeEvent = RecordModel & {
  event_id: string;
  type: string;
  status: string;
  result?: string;
  error?: string;
  profile_id?: string;
  customer_id?: string;
  created?: string;
};

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  success: { color: 'var(--forest)', bg: '#e8f7ee', label: 'Succès' },
  failed: { color: 'var(--logo-red)', bg: '#fdecea', label: 'Échec' },
  pending: { color: '#b86e00', bg: '#fff3e0', label: 'En cours' },
  ignored: { color: 'var(--ink-muted)', bg: '#eef1f4', label: 'Ignoré' },
};

/** Global Stripe webhook event log (admin view). */
export function StripeEventsList() {
  const [events, setEvents] = useState<StripeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    pb.collection('stripe_events')
      .getFullList({ sort: '-created', requestKey: null })
      .then((recs) => { if (active) setEvents(recs as unknown as StripeEvent[]); })
      .catch(() => { if (active) setEvents([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = query.trim()
    ? events.filter((e) =>
        [e.event_id, e.type, e.profile_id, e.customer_id, e.result, e.error]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query.trim().toLowerCase())),
      )
    : events;

  return (
    <div className="espace-card">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={18} /> Événements Stripe ({events.length})
      </h2>

      <div className="espace-field" style={{ marginBottom: 18, maxWidth: 360 }}>
        <label>Rechercher (id, type, profil, client…)</label>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }} />
          <input className="espace-input" style={{ paddingLeft: 34 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrer…" />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><Loader2 size={24} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Aucun événement Stripe enregistré pour le moment.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e3eaf0', textAlign: 'left' }}>
                <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Date</th>
                <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Type</th>
                <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Statut</th>
                <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Profil</th>
                <th style={{ padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-muted)' }}>Détail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev) => {
                const s = STATUS_STYLE[ev.status] || STATUS_STYLE.ignored;
                return (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #eef2f6' }}>
                    <td style={{ padding: '10px 8px', whiteSpace: 'nowrap', color: 'var(--ink-muted)' }}>{formatDateTime(String(ev.created || ''))}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--navy)' }}>{ev.type}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, padding: '2px 8px', borderRadius: 10 }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 12, fontFamily: 'monospace', color: 'var(--ink-muted)' }}>{ev.profile_id ? String(ev.profile_id).slice(0, 8) : '—'}</td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--ink-muted)', maxWidth: 320 }}>
                      {ev.error ? <span style={{ color: 'var(--logo-red)' }}>{ev.error}</span> : ev.result || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
