import { useEffect, useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import type { RecordModel } from 'pocketbase';

type StripeEvent = RecordModel & {
  event_id: string;
  type: string;
  status: string;
  result?: string;
  error?: string;
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

/** Stripe webhook event log for a single client profile (admin view). */
export function ClientStripeEvents({ profileId }: { profileId: string }) {
  const [events, setEvents] = useState<StripeEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    pb.collection('stripe_events')
      .getFullList({
        filter: `profile_id = "${profileId}"`,
        sort: '-created',
        requestKey: null,
      })
      .then((recs) => { if (active) setEvents(recs as unknown as StripeEvent[]); })
      .catch(() => { if (active) setEvents([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profileId]);

  return (
    <div className="espace-card">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={18} /> Journal des événements Stripe
      </h2>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader2 size={22} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>
      ) : events.length === 0 ? (
        <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Aucun événement Stripe enregistré pour ce client.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map((ev) => {
            const s = STATUS_STYLE[ev.status] || STATUS_STYLE.ignored;
            return (
              <div key={ev.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #eef2f6' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-muted)', whiteSpace: 'nowrap', minWidth: 130 }}>
                  {formatDateTime(String(ev.created || ''))}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{ev.type}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, padding: '2px 8px', borderRadius: 10 }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2, fontFamily: 'monospace' }}>{ev.event_id}</div>
                  {ev.result ? <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>{ev.result}</div> : null}
                  {ev.error ? <div style={{ fontSize: 12, color: 'var(--logo-red)', marginTop: 2 }}>{ev.error}</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
