import { useEffect, useState } from 'react';
import { Loader2, ExternalLink, CreditCard, Download, RefreshCw } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import type { RecordModel } from 'pocketbase';
import { formatEuro } from '@/data/tariffs';

type SubData = {
  status: string;
  billing: string;
  customerId: string;
  dashboardUrl: string;
  invoices: { id: string; number: string; amount: number; currency: string; created: string; paid: boolean; pdfUrl: string }[];
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: 'var(--forest)' },
  past_due: { label: 'Paiement en retard', color: 'var(--logo-red)' },
  canceled: { label: 'Résilié', color: 'var(--ink-muted)' },
  unpaid: { label: 'Impayé', color: 'var(--logo-red)' },
  none: { label: 'Aucun abonnement', color: 'var(--ink-muted)' },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function ClientSubscription({ profile }: { profile: RecordModel }) {
  const [data, setData] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [resyncMsg, setResyncMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
        body: JSON.stringify({ profileId: profile.id }),
      });
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile.id]);

  const openPortal = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
        body: JSON.stringify({ profileId: profile.id, intent: 'portal' }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
    setBusy(false);
  };

  const resync = async () => {
    setResyncing(true);
    setResyncMsg('');
    try {
      const res = await fetch('/api/stripe/resync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
        body: JSON.stringify({ profileId: profile.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setResyncMsg(`Synchronisé — paiement : ${d.paymentStatus || ''}${d.advanced ? ' (étape avancée)' : ''}`);
        load();
      } else {
        setResyncMsg(d.error || 'Échec de la resynchronisation.');
      }
    } catch {
      setResyncMsg('Échec de la resynchronisation.');
    }
    setResyncing(false);
  };

  const status = data?.status || String(profile.subscription_status || 'none');
  const info = STATUS_LABELS[status] || STATUS_LABELS.none;

  return (
    <div className="espace-card" style={{ marginBottom: 22 }}>
      <h2>Abonnement</h2>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader2 size={22} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 14, marginBottom: 16 }}>
            <div>
              <div style={{ color: 'var(--ink-muted)', fontSize: 12, marginBottom: 4 }}>Statut</div>
              <div style={{ fontWeight: 700, color: info.color }}>{info.label}</div>
            </div>
            <div>
              <div style={{ color: 'var(--ink-muted)', fontSize: 12, marginBottom: 4 }}>Formule</div>
              <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{profile.pack_billing === 'biennial' ? '24 mois' : profile.pack_billing === 'annual' ? 'Annuel' : profile.pack_billing === 'monthly' ? 'Mensuel' : '—'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--ink-muted)', fontSize: 12, marginBottom: 4 }}>Fin d’engagement</div>
              <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{formatDate(profile.engagement_end_date)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--ink-muted)', fontSize: 12, marginBottom: 4 }}>Prochaine échéance</div>
              <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{formatDate(profile.next_invoice_date)}</div>
            </div>
          </div>

          {data?.dashboardUrl ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: data.invoices.length ? 18 : 0 }}>
              <a href={data.dashboardUrl} target="_blank" rel="noopener noreferrer" className="espace-btn espace-btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>
                <ExternalLink size={14} /> Voir dans Stripe
              </a>
              <button type="button" className="espace-btn espace-btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={openPortal} disabled={busy}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />} Portail de paiement
              </button>
              <button type="button" className="espace-btn espace-btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={resync} disabled={resyncing} title="Relit l’abonnement et la dernière facture sur Stripe">
                {resyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Resynchroniser avec Stripe
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Aucun client Stripe associé.</p>
          )}
          {resyncMsg ? (
            <div className="espace-alert espace-alert-info" style={{ marginTop: 12, padding: '10px 14px', fontSize: 13 }}>{resyncMsg}</div>
          ) : null}

          {data && data.invoices.length > 0 ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>Historique des paiements</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.invoices.map((inv) => (
                  <a key={inv.id} href={inv.pdfUrl || '#'} target={inv.pdfUrl ? '_blank' : undefined} rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid #e3eaf0', borderRadius: 8, textDecoration: 'none' }}>
                    <Download size={15} style={{ color: 'var(--blue)', flex: 'none' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{inv.number || inv.id.slice(0, 8)}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{formatDate(inv.created)} · {formatEuro(inv.amount / 100)} {inv.currency.toUpperCase()}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: inv.paid ? 'var(--forest)' : 'var(--logo-red)' }}>{inv.paid ? 'Payée' : 'En attente'}</span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
