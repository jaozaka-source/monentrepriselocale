import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import { useClientData } from '@/components/espace/client-data-context';
import type { ClientProfile } from '@/lib/client-steps';

type Check = { id: string; label: string; required: boolean };

async function postContract(body: Record<string, unknown>) {
  const res = await fetch('/api/contract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pb.authStore.token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'La requête a échoué.');
  return data as { version?: string; retractation?: boolean; checks?: Check[]; signerEmail?: string; current_step?: string };
}

export function SignatureStep({ profile }: { profile: ClientProfile }) {
  const { refresh } = useClientData();
  const navigate = useNavigate();
  const [checks, setChecks] = useState<Check[]>([]);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [retractation, setRetractation] = useState(Boolean(profile.retractation_applicable));
  const [version, setVersion] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    postContract({ intent: 'preview' })
      .then((data) => {
        setChecks(data.checks || []);
        setRetractation(Boolean(data.retractation));
        setVersion(data.version || '');
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const allChecked = checks.length > 0 && checks.every((item) => ticked[item.label]);

  const sendCode = async () => {
    setError('');
    if (!allChecked) {
      setError('Cochez toutes les cases obligatoires avant de recevoir le code.');
      return;
    }
    setBusy('code');
    try {
      const data = await postContract({ intent: 'send-code' });
      setSentTo(data.signerEmail || profile.rep_email || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible.');
    }
    setBusy('');
  };

  const sign = async () => {
    setError('');
    setBusy('sign');
    try {
      const data = await postContract({
        intent: 'sign',
        code,
        checks: checks.filter((item) => ticked[item.label]).map((item) => item.label),
      });
      await refresh();
      navigate(`/espace/etapes/${data.current_step || '2.1'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La signature a échoué.');
      setBusy('');
    }
  };

  return (
    <>
      <div className="espace-card">
        <h2>Signature électronique{version ? ` — cadre v${version}` : ''}</h2>
        <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginTop: 0, lineHeight: 1.6 }}>
          Vous signez en une seule fois le contrat cadre et l’annexe RGPD. Cochez les cases, recevez un code par e-mail, puis validez.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {checks.map((item) => (
            <label key={item.id} className="espace-check">
              <input
                type="checkbox"
                checked={Boolean(ticked[item.label])}
                onChange={(e) => setTicked((prev) => ({ ...prev, [item.label]: e.target.checked }))}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {retractation ? (
        <div className="espace-alert espace-alert-info" style={{ marginTop: 20 }}>
          <strong>Droit de rétractation de 14 jours.</strong>
          <p style={{ margin: '8px 0 0', fontWeight: 500 }}>
            Vous pouvez vous rétracter pendant 14 jours. Formulaire type :{' '}
            <Link to="/formulaire-retractation">formulaire de rétractation</Link>.
            La case demandant le démarrage anticipé des travaux est obligatoire pour signer.
          </p>
        </div>
      ) : (
        <div className="espace-alert espace-alert-info" style={{ marginTop: 20 }}>
          Ce contrat est conclu pour les besoins de votre activité professionnelle principale : le droit de rétractation ne s’applique pas.
        </div>
      )}

      <div className="espace-card">
        <h2>Code de signature</h2>
        <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginTop: 0, lineHeight: 1.6 }}>
          Un code à 6 chiffres, valable 10 minutes, est envoyé à l’e-mail du signataire. 5 essais maximum, 3 envois maximum par heure.
        </p>
        <button type="button" className="espace-btn espace-btn-secondary" onClick={sendCode} disabled={Boolean(busy)}>
          {busy === 'code' ? <Loader2 size={16} className="animate-spin" /> : null}
          Recevoir mon code de signature
        </button>
        {sentTo ? <p style={{ fontSize: 13, color: 'var(--forest)', marginTop: 12 }}>Code envoyé à {sentTo}.</p> : null}
        <div className="espace-field" style={{ marginTop: 16, maxWidth: 220 }}>
          <label htmlFor="sign-code">Code reçu</label>
          <input id="sign-code" className="espace-input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
        </div>
      </div>

      {error ? <div className="espace-alert espace-alert-error" style={{ marginTop: 16 }}>{error}</div> : null}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="espace-btn" onClick={sign} disabled={Boolean(busy) || code.length !== 6}>
          {busy === 'sign' ? 'Signature…' : 'Signer le contrat'}
        </button>
      </div>
    </>
  );
}
