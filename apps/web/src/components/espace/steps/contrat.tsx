import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Link } from 'react-router';
import pb from '@/lib/pocketbase-client';
import { useStepAdvance } from '@/hooks/use-step-advance';
import type { ClientProfile } from '@/lib/client-steps';

type Preview = {
  cadreHtml: string;
  annexBody: string;
  annexTitle: string;
  version: string;
  retractation: boolean;
};

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
  return data as Preview & { pdf?: string };
}

export function ContratStep({ profile }: { profile: ClientProfile }) {
  const { advance, advancing, error } = useStepAdvance();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    postContract({ intent: 'preview' })
      .then((data) => setPreview(data))
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const download = async () => {
    setDownloading(true);
    try {
      const data = await postContract({ intent: 'download' });
      if (data.pdf) {
        const binary = atob(data.pdf);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contrat-mon-entreprise-locale.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Téléchargement impossible.');
    }
    setDownloading(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)' }} />
      </div>
    );
  }

  if (loadError) {
    return <div className="espace-alert espace-alert-error">{loadError}</div>;
  }

  if (!preview) return null;
  const annexIsHtml = preview.annexBody.trim().startsWith('<');

  return (
    <>
      <div className="espace-card">
        <h2>Votre contrat{preview.version ? ` — cadre v${preview.version}` : ''}</h2>
        <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, marginTop: 0 }}>
          Le contrat réunit le contrat cadre (conditions générales) et l’annexe RGPD. Les informations de votre profil sont intégrées dans le bulletin de souscription (Annexe 1).
        </p>
        <button
          type="button"
          className="espace-btn espace-btn-secondary"
          onClick={download}
          disabled={downloading}
          style={{ marginBottom: 16 }}
        >
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Télécharger le PDF
        </button>
        <div
          className="contract-html-preview"
          // The cadre body is admin-authored HTML rendered as-is (no client edits).
          dangerouslySetInnerHTML={{ __html: preview.cadreHtml }}
        />
      </div>

      {preview.annexBody ? (
        <div className="espace-card" style={{ marginTop: 20 }}>
          <h2>{preview.annexTitle || 'Annexe RGPD'}</h2>
          {annexIsHtml ? (
            <div className="contract-html-preview" dangerouslySetInnerHTML={{ __html: preview.annexBody }} />
          ) : (
            <pre className="contract-text-preview">{preview.annexBody}</pre>
          )}
        </div>
      ) : null}

      <div className="espace-alert espace-alert-info" style={{ marginTop: 20 }}>
        <strong>Droit de rétractation de 14 jours.</strong>
        <p style={{ margin: '8px 0 0', fontWeight: 500 }}>
          {preview.retractation
            ? 'Le droit de rétractation s’applique. Vous pouvez vous rétracter pendant 14 jours à compter de la signature. Le formulaire type est disponible ici : '
            : 'Ce contrat est conclu pour les besoins de votre activité professionnelle principale : le droit de rétractation ne s’applique pas.'}
          {preview.retractation ? (
            <Link to="/formulaire-retractation">formulaire de rétractation</Link>
          ) : null}
        </p>
      </div>

      {error ? <div className="espace-alert espace-alert-error" style={{ marginTop: 16 }}>{error}</div> : null}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="espace-btn" onClick={() => advance()} disabled={advancing}>
          {advancing ? 'Enregistrement…' : 'J’ai pris connaissance du contrat'}
        </button>
      </div>
      <span style={{ display: 'none' }}>{profile.id}</span>
    </>
  );
}
