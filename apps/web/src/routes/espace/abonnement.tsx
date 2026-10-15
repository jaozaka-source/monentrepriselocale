import { useEffect, useState } from 'react';
import type { Route } from './+types/abonnement';
import { seo } from '@/lib/seo';
import { Loader2, CreditCard, FileSignature, Download, AlertCircle, CheckCircle2, XCircle, ArrowUpCircle, ArrowDownCircle, Ban, RefreshCw } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import { useClientData } from '@/components/espace/client-data-context';
import { fetchPacks, type Pack } from '@/lib/client-steps';
import { formatEuro } from '@/data/tariffs';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Mon abonnement — Espace client Mon Entreprise Locale',
    description: 'Consultez et gérez votre abonnement.',
    noindex: true,
  });
}

type Invoice = {
  id: string;
  number: string;
  amount: number;
  currency: string;
  created: string;
  paid: boolean;
  status: string;
  pdfUrl: string;
};

type SubStatus = {
  status: string;
  billing: string;
  engagementEndDate: string | null;
  nextInvoiceDate: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  paymentAlert: boolean;
  invoices: Invoice[];
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: 'check' | 'alert' | 'x' }> = {
  active: { label: 'Actif', color: 'var(--forest)', icon: 'check' },
  past_due: { label: 'Paiement en retard', color: 'var(--logo-red)', icon: 'alert' },
  canceled: { label: 'Résilié', color: 'var(--ink-muted)', icon: 'x' },
  trialing: { label: 'Période d’essai', color: 'var(--blue)', icon: 'check' },
  unpaid: { label: 'Impayé', color: 'var(--logo-red)', icon: 'alert' },
  incomplete: { label: 'Incomplet', color: 'var(--logo-red)', icon: 'alert' },
  paused: { label: 'Suspendu', color: 'var(--ink-muted)', icon: 'x' },
  none: { label: 'Aucun abonnement', color: 'var(--ink-muted)', icon: 'x' },
};

function StatusIcon({ icon }: { icon: 'check' | 'alert' | 'x' }) {
  if (icon === 'check') return <CheckCircle2 size={16} />;
  if (icon === 'alert') return <AlertCircle size={16} />;
  return <XCircle size={16} />;
}

const BILLING_LABEL: Record<string, string> = {
  monthly: 'Mensuel',
  annual: 'Annuel (1 an)',
  biennial: 'Biennal (24 mois)',
};

const BILLING_RANK: Record<string, number> = { monthly: 1, annual: 2, biennial: 3 };

type ConfirmState =
  | { type: 'cancel' }
  | { type: 'change'; packId: string; billing: string; label: string; scheduled: boolean }
  | null;

export default function Abonnement() {
  const { profile, loading } = useClientData();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [status, setStatus] = useState<SubStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  useEffect(() => {
    fetchPacks().then(setPacks).catch(() => {});
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/stripe/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // ignore
    }
    setStatusLoading(false);
  };

  if (loading || !profile) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>;
  }

  const pack = packs.find((p) => p.id === profile.pack);
  const billing = String(profile.subscription_billing || profile.pack_billing || 'monthly');
  const subStatus = status?.status || profile.subscription_status || 'none';
  const statusInfo = STATUS_LABELS[subStatus] || STATUS_LABELS.none;
  const hasSubscription = Boolean(profile.stripe_subscription_id) && subStatus !== 'none' && subStatus !== 'canceled';

  // Cancellation eligibility.
  const now = new Date();
  const engEnd = profile.engagement_end_date ? new Date(profile.engagement_end_date) : null;
  let canCancel = false;
  let cancelHint = '';
  if (hasSubscription && engEnd) {
    if (billing === 'monthly') {
      canCancel = now.getTime() >= engEnd.getTime();
      cancelHint = canCancel
        ? 'Résiliation possible (engagement de 12 mois terminé).'
        : `Résiliation possible à la fin de votre engagement (${formatDate(profile.engagement_end_date)}).`;
    } else {
      const threshold = engEnd.getTime() - 15 * 24 * 60 * 60 * 1000;
      canCancel = now.getTime() >= threshold;
      cancelHint = canCancel
        ? 'Résiliation possible (moins de 15 jours avant l’échéance).'
        : `Résiliation possible à partir de 15 jours avant votre échéance (${formatDate(profile.engagement_end_date)}).`;
    }
  }

  const openPortal = async () => {
    setBusy('portal');
    setError('');
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Impossible d’ouvrir le portail.');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setBusy('');
    }
  };

  const runChange = async (packId: string, billingTarget: string) => {
    setBusy('change');
    setError('');
    try {
      const res = await fetch('/api/stripe/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
        body: JSON.stringify({ packId, billing: billingTarget }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'L’opération a échoué.');
      setConfirm(null);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    }
    setBusy('');
  };

  const runCancel = async () => {
    setBusy('cancel');
    setError('');
    try {
      const res = await fetch('/api/stripe/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'La résiliation a échoué.');
      setConfirm(null);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    }
    setBusy('');
  };

  const currentSort = pack?.sort || 0;
  const currentPackId = String(profile.pack || '');

  return (
    <>
      <div className="espace-page-head">
        <h1>Mon abonnement</h1>
        <p>Gérez votre formule, vos informations de paiement et vos factures.</p>
      </div>

      {profile.payment_alert || subStatus === 'past_due' || subStatus === 'unpaid' ? (
        <div className="espace-alert espace-alert-error" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
          <AlertCircle size={20} style={{ flex: 'none', marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <strong>Échec de paiement détecté.</strong>
            <p style={{ margin: '6px 0 8px', fontWeight: 500 }}>
              Votre dernier paiement a échoué. Mettez à jour votre moyen de paiement pour éviter une suspension de service.
            </p>
            <button type="button" className="espace-btn espace-btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={openPortal} disabled={Boolean(busy)}>
              <CreditCard size={14} /> Ouvrir le portail de paiement
            </button>
          </div>
        </div>
      ) : null}

      <div className="espace-card">
        <h2>Formule choisie</h2>
        {pack ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)' }}>{pack.name}</div>
            <div style={{ fontSize: 14, color: 'var(--ink-muted)', marginTop: 4 }}>
              {billing === 'biennial'
                ? `24 mois — ${formatEuro(pack.biennial_price / 100)} HT`
                : billing === 'annual'
                  ? `1 an — ${formatEuro(pack.annual_price / 100)} HT`
                  : `Mensuel — ${formatEuro(pack.monthly_price / 100)} HT / mois`}
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Aucun pack choisi pour l’instant.</p>
        )}
      </div>

      <div className="espace-card">
        <h2>État de l’abonnement</h2>
        {statusLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader2 size={22} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>
        ) : hasSubscription ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span className="espace-alert espace-alert-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: statusInfo.color, background: 'transparent', border: 'none', padding: 0 }}>
                <StatusIcon icon={statusInfo.icon} /> {statusInfo.label}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 14 }}>
              <div>
                <div style={{ color: 'var(--ink-muted)', fontSize: 12, marginBottom: 4 }}>Formule</div>
                <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{BILLING_LABEL[billing] || billing}</div>
              </div>
              <div>
                <div style={{ color: 'var(--ink-muted)', fontSize: 12, marginBottom: 4 }}>Prochaine échéance</div>
                <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{formatDate(status?.nextInvoiceDate || profile.next_invoice_date)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--ink-muted)', fontSize: 12, marginBottom: 4 }}>Fin d’engagement</div>
                <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{formatDate(profile.engagement_end_date)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--ink-muted)', fontSize: 12, marginBottom: 4 }}>Fin de période en cours</div>
                <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{formatDate(status?.currentPeriodEnd || profile.subscription_current_period_end)}</div>
              </div>
            </div>

            {error ? <div className="espace-alert espace-alert-error" style={{ marginTop: 16 }}>{error}</div> : null}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
              <button type="button" className="espace-btn espace-btn-secondary" onClick={openPortal} disabled={Boolean(busy)}>
                {busy === 'portal' ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                Moyen de paiement et factures
              </button>
              {canCancel ? (
                <button type="button" className="espace-btn espace-btn-ghost" style={{ color: 'var(--logo-red)', borderColor: 'var(--logo-red)' }} onClick={() => setConfirm({ type: 'cancel' })} disabled={Boolean(busy)}>
                  <Ban size={15} /> Résilier
                </button>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--ink-muted)', alignSelf: 'center' }}>{cancelHint}</span>
              )}
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--ink-muted)', fontSize: 14, lineHeight: 1.6 }}>
            Votre abonnement démarrera après le paiement de l’étape 2.1. Vous pourrez ensuite le gérer (changement de formule, carte bancaire, résiliation) depuis cette page.
          </p>
        )}
      </div>

      {hasSubscription ? (
        <div className="espace-card">
          <h2>Changement de pack</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, margin: '0 0 16px' }}>
            Passer à un pack supérieur est immédiat (au prorata), la date de fin d’engagement reste inchangée. Passer à un pack inférieur est programmé à la fin de l’engagement en cours.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {packs.filter((p) => p.active && p.id !== currentPackId).map((p) => {
              const isUpgrade = p.sort > currentSort;
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid #e3eaf0', borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{formatEuro(p.monthly_price / 100)} HT / mois</div>
                  </div>
                  <button
                    type="button"
                    className="espace-btn espace-btn-secondary"
                    style={{ padding: '8px 14px', fontSize: 13 }}
                    onClick={() => setConfirm({ type: 'change', packId: p.id, billing, label: p.name, scheduled: !isUpgrade })}
                  >
                    {isUpgrade ? <ArrowUpCircle size={15} /> : <ArrowDownCircle size={15} />}
                    {isUpgrade ? 'Passer à' : 'Programmer'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {hasSubscription ? (
        <div className="espace-card">
          <h2>Changement de formule</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, margin: '0 0 16px' }}>
            Passer du mensuel à l’annuel ou aux 24 mois est immédiat (prorata déduit) avec une nouvelle date de fin d’engagement. Passer à une formule plus courte est programmé en fin d’engagement.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {(['monthly', 'annual', 'biennial'] as const)
              .filter((b) => b !== billing)
              .map((b) => {
                const isUpgrade = BILLING_RANK[b] > BILLING_RANK[billing];
                const priceLabel = b === 'biennial'
                  ? `24 mois — ${formatEuro((pack?.biennial_price || 0) / 100)} HT`
                  : b === 'annual'
                    ? `1 an — ${formatEuro((pack?.annual_price || 0) / 100)} HT`
                    : `Mensuel — ${formatEuro((pack?.monthly_price || 0) / 100)} HT`;
                return (
                  <div key={b} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', border: '1px solid #e3eaf0', borderRadius: 8, minWidth: 200 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{BILLING_LABEL[b]}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{priceLabel}</div>
                    <button
                      type="button"
                      className="espace-btn espace-btn-secondary"
                      style={{ padding: '8px 14px', fontSize: 13, marginTop: 4 }}
                      onClick={() => setConfirm({ type: 'change', packId: currentPackId, billing: b, label: BILLING_LABEL[b], scheduled: !isUpgrade })}
                    >
                      {isUpgrade ? <ArrowUpCircle size={15} /> : <ArrowDownCircle size={15} />}
                      {isUpgrade ? 'Passer à' : 'Programmer'}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      ) : null}

      {hasSubscription && status && status.invoices.length > 0 ? (
        <div className="espace-card">
          <h2>Factures ({status.invoices.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {status.invoices.map((inv) => (
              <a
                key={inv.id}
                href={inv.pdfUrl || '#'}
                target={inv.pdfUrl ? '_blank' : undefined}
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid #e3eaf0', borderRadius: 8, background: '#fff', textDecoration: 'none' }}
              >
                <FileSignature size={18} style={{ color: 'var(--blue)', flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>
                    Facture {inv.number || inv.id.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                    {formatDate(inv.created)} · {formatEuro(inv.amount / 100)} {inv.currency.toUpperCase()}
                    {inv.paid ? ' · Payée' : ' · En attente'}
                  </div>
                </div>
                {inv.pdfUrl ? <Download size={16} style={{ color: 'var(--ink-muted)' }} /> : null}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {confirm ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }} onClick={() => setConfirm(null)}>
          <div className="espace-card" style={{ maxWidth: 460, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {confirm.type === 'cancel' ? <Ban size={20} style={{ color: 'var(--logo-red)' }} /> : confirm.scheduled ? <ArrowDownCircle size={20} style={{ color: 'var(--blue)' }} /> : <ArrowUpCircle size={20} style={{ color: 'var(--blue)' }} />}
              {confirm.type === 'cancel' ? 'Résilier l’abonnement' : confirm.scheduled ? 'Programmer le changement' : 'Confirmer le changement'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, margin: '0 0 16px' }}>
              {confirm.type === 'cancel'
                ? 'La résiliation prendra effet à la fin de la période payée. Vous ne serez plus prélevé(e) ensuite.'
                : confirm.scheduled
                  ? `Le changement vers « ${confirm.label} » prendra effet à la fin de votre engagement en cours (${formatDate(profile.engagement_end_date)}).`
                  : `Le changement vers « ${confirm.label} » est immédiat et au prorata.`}
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.5, margin: '0 0 16px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <RefreshCw size={14} style={{ flex: 'none', marginTop: 1 }} />
              Un bulletin de souscription sera à accepter (cases + code) pour valider ce changement.
            </p>
            {error ? <div className="espace-alert espace-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="espace-btn espace-btn-secondary" onClick={() => { setConfirm(null); setError(''); }}>Annuler</button>
              <button
                type="button"
                className="espace-btn"
                style={confirm.type === 'cancel' ? { background: 'var(--logo-red)' } : {}}
                onClick={() => (confirm.type === 'cancel' ? runCancel() : runChange(confirm.packId, confirm.billing))}
                disabled={Boolean(busy)}
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
