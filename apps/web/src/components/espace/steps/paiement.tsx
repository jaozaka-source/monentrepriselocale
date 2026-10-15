import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Loader2, CreditCard, ShieldCheck, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import { useClientData } from '@/components/espace/client-data-context';
import { useStepAdvance } from '@/hooks/use-step-advance';
import { fetchPacks, type Pack } from '@/lib/client-steps';
import { formatEuro } from '@/data/tariffs';
import type { ClientProfile } from '@/lib/client-steps';

export function Paiement({ profile }: { profile: ClientProfile }) {
  const { packs, refresh } = useClientData();
  const { advance, advancing } = useStepAdvance();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extraPacks, setExtraPacks] = useState<Pack[]>([]);
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (packs.length === 0) {
      fetchPacks().then(setExtraPacks).catch(() => {});
    }
  }, [packs.length]);

  const allPacks = packs.length ? packs : extraPacks;
  const pack = allPacks.find((p) => p.id === profile.pack);
  const billing = profile.pack_billing || 'monthly';

  const status = searchParams.get('status');
  const showCancel = status === 'cancel';
  const showSuccess = status === 'success';

  const alreadyActive = profile.subscription_status === 'active' && Boolean(profile.stripe_subscription_id);
  // Payment confirmed by the webhook once the step has moved past 2.1.
  const confirmed = alreadyActive && profile.current_step !== '2.1';

  const statutPaiement = String(profile.statut_paiement || 'non_commence');
  const paymentRealized = statutPaiement === 'realise';
  const paymentInProgress = statutPaiement === 'en_cours';

  // On success return, ask the server to verify the subscription with Stripe
  // and advance to 3.1 if it's active. The webhook is the primary mechanism,
  // but this endpoint is the safety net that works even when the webhook hasn't
  // fired yet (or isn't registered).
  useEffect(() => {
    if (!showSuccess) return;
    if (profile.current_step !== '2.1') {
      navigate('/espace/etapes/3.1', { replace: true });
      return;
    }
    setVerifying(true);
    let cancelled = false;
    let attempts = 0;
    const verify = async () => {
      attempts += 1;
      try {
        const res = await fetch('/api/stripe/verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${pb.authStore.token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.advanced || data.current_step === '3.1') {
            await refresh();
            if (!cancelled) navigate('/espace/etapes/3.1', { replace: true });
            return;
          }
        }
      } catch {
        // network hiccup — keep polling
      }
      await refresh();
      if (attempts >= 12) {
        if (!cancelled) setVerifying(false);
        return;
      }
      if (!cancelled) pollRef.current = setTimeout(verify, 2500);
    };
    pollRef.current = setTimeout(verify, 1500);
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSuccess]);

  // Navigate once the polled profile has advanced.
  useEffect(() => {
    if (showSuccess && profile.current_step === '3.1') {
      navigate('/espace/etapes/3.1', { replace: true });
    }
  }, [showSuccess, profile.current_step, navigate]);

  const startCheckout = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pb.authStore.token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const apiErr = data.error;
        const message = typeof apiErr === 'string'
          ? apiErr
          : apiErr?.message || data.message || 'La création du paiement a échoué.';
        throw new Error(message);
      }
      // Stripe Checkout sends X-Frame-Options: DENY, so it cannot render inside
      // the preview iframe — navigating the iframe to it produces a blank page.
      // Open it in a new top-level tab; fall back to same-tab navigation if the
      // popup is blocked.
      const checkoutUrl = data.url;
      const opened = window.open(checkoutUrl, '_blank');
      if (!opened) {
        window.location.href = checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    }
    setLoading(false);
  };

  const amountDue = billing === 'annual'
    ? pack?.annual_price
    : billing === 'biennial'
      ? pack?.biennial_price
      : pack ? pack.monthly_price : 0;

  const billingLabel = billing === 'annual'
    ? 'Annuel (1 an)'
    : billing === 'biennial'
      ? 'Biennal (24 mois)'
      : 'Mensuel';

  return (
    <>
      {showSuccess || confirmed ? (
        <div className="espace-alert espace-alert-success" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
          <CheckCircle2 size={22} style={{ flex: 'none', marginTop: 1 }} />
          <div>
            <strong>Paiement confirmé !</strong>
            <p style={{ margin: '6px 0 0', fontWeight: 500 }}>
              Votre abonnement est actif. Notre équipe démarre la création de votre site. Vous recevrez un e-mail de confirmation.
            </p>
          </div>
        </div>
      ) : null}

      {showSuccess && verifying && profile.current_step === '2.1' ? (
        <div className="espace-alert espace-alert-info" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
          <Loader2 size={18} className="animate-spin" style={{ flex: 'none' }} />
          <span>Vérification du paiement en cours… Vous allez être redirigé(e) automatiquement.</span>
        </div>
      ) : null}

      {showCancel ? (
        <div className="espace-alert espace-alert-info" style={{ marginBottom: 20 }}>
          Le paiement n’a pas été finalisé. Vous pouvez réessayer quand vous le souhaitez.
        </div>
      ) : null}

      {error ? <div className="espace-alert espace-alert-error" style={{ marginBottom: 20 }}>{error}</div> : null}

      <div className="espace-card">
        <h2>Récapitulatif</h2>
        {pack ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--blue)', color: '#fff', display: 'grid', placeItems: 'center' }}>
                <CreditCard size={22} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>{pack.name}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{pack.subtitle}</div>
              </div>
            </div>

            <div style={{ background: '#f4f7fa', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--ink-muted)' }}>Formule</span>
                <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{billingLabel}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--ink-muted)' }}>Montant HT</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--blue)' }}>{formatEuro((amountDue || 0) / 100)} HT</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.5, marginTop: 4 }}>
                Prix HT. La TVA est calculée automatiquement par Stripe Tax lors du paiement. Aucun frais de création, aucune mensualité d’avance, aucun essai gratuit.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-muted)' }}>
              <ShieldCheck size={16} style={{ color: 'var(--forest)' }} />
              Paiement sécurisé via Stripe. Carte bancaire et prélèvement SEPA acceptés.
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Aucun pack sélectionné.</p>
        )}
      </div>

      {paymentRealized ? (
        <div className="espace-card">
          <h2>Paiement</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', background: '#e8f7ee', borderRadius: 10, border: '1px solid #b3e6c8' }}>
            <CheckCircle2 size={28} style={{ color: 'var(--forest)', flex: 'none' }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--forest)' }}>Paiement réalisé</div>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 2 }}>
                {profile.last_payment_date
                  ? `Le ${new Date(profile.last_payment_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`
                  : 'Votre paiement a bien été reçu.'}
              </div>
            </div>
          </div>
          <button type="button" className="espace-btn" disabled style={{ marginTop: 18, opacity: 0.55, cursor: 'default' }}>
            <CheckCircle2 size={16} /> Paiement réalisé
          </button>
        </div>
      ) : paymentInProgress ? (
        <div className="espace-card">
          <h2>Paiement</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', background: '#fff3e0', borderRadius: 10, border: '1px solid #ffdbab' }}>
            <Loader2 size={24} className="animate-spin" style={{ color: '#b86e00', flex: 'none' }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#b86e00' }}>Paiement en cours de traitement</div>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 2 }}>Votre paiement est en cours de validation (notamment pour les prélèvements SEPA). Vous serez notifié(e) dès qu'il sera confirmé.</div>
            </div>
          </div>
          <button type="button" className="espace-btn" disabled style={{ marginTop: 18, opacity: 0.55, cursor: 'default' }}>
            <Loader2 size={16} className="animate-spin" /> Paiement en cours de traitement
          </button>
        </div>
      ) : !alreadyActive ? (
        <div className="espace-card">
          <h2>Régler le paiement</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, margin: '0 0 18px' }}>
            Cliquez sur le bouton ci-dessous pour accéder au paiement sécurisé. Vous serez redirigé(e) vers Stripe, puis de retour dans votre espace client une fois le paiement effectué.
          </p>
          <button type="button" className="espace-btn" onClick={startCheckout} disabled={loading || !pack}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
            {loading ? 'Redirection…' : 'Régler maintenant'}
          </button>
        </div>
      ) : confirmed ? (
        <div className="espace-card">
          <h2>Étape suivante</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, margin: '0 0 18px' }}>
            Votre paiement est confirmé et votre projet passe à l’étape suivante : la rencontre avec notre équipe.
          </p>
          <button type="button" className="espace-btn" onClick={() => navigate('/espace/etapes/3.1')}>
            Continuer vers la rencontre <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="espace-card">
          <h2>Étape suivante</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, margin: '0 0 18px' }}>
            Votre paiement est confirmé. Vous pouvez passer à l’étape suivante : la rencontre avec notre équipe.
          </p>
          <button type="button" className="espace-btn" onClick={() => advance()} disabled={advancing}>
            {advancing ? 'Enregistrement…' : 'Continuer vers l’étape suivante'}
          </button>
        </div>
      )}

      {profile.payment_alert ? (
        <div className="espace-alert espace-alert-error" style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertCircle size={20} style={{ flex: 'none', marginTop: 1 }} />
          <div>
            <strong>Échec de paiement.</strong>
            <p style={{ margin: '6px 0 0', fontWeight: 500 }}>
              Votre dernier paiement a échoué. Mettez à jour votre moyen de paiement depuis la page « Mon abonnement » pour éviter une suspension de service.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
