import { useEffect, useState } from 'react';
import type { Route } from './+types/documents';
import { seo } from '@/lib/seo';
import { Loader2, Upload, FileText, Download } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import type { RecordModel } from 'pocketbase';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Mes documents — Espace client Mon Entreprise Locale',
    description: 'Déposez et consultez vos documents (Kbis, contrat, factures).',
    noindex: true,
  });
}

type Doc = {
  id: string;
  title: string;
  type: string;
  file: string;
  created: string;
  collection: 'documents' | 'signatures';
  record: RecordModel;
};

const TYPE_LABELS: Record<string, string> = {
  contract: 'Contrat signé',
  framework: 'Contrat cadre',
  amendment: 'Avenant',
  invoice: 'Facture',
  kbis: 'Extrait Kbis',
  delegation: 'Délégation de pouvoir',
  other: 'Autre',
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function Documents() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('kbis');
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const userId = pb.authStore.record?.id;
    if (!userId) return;
    try {
      const [records, signatures] = await Promise.all([
        pb.collection('documents').getFullList({
          filter: `owner = "${userId}"`,
          sort: '-created',
          requestKey: 'docs-list',
        }),
        pb.collection('signatures').getFullList({
          filter: `owner = "${userId}"`,
          sort: '-created',
          requestKey: 'signatures-list',
        }).catch(() => [] as RecordModel[]),
      ]);
      const fromDocs: Doc[] = records.map((record) => ({
        id: record.id,
        title: String(record.title || 'Document'),
        type: String(record.type || 'other'),
        file: String(record.file || ''),
        created: String(record.created || ''),
        collection: 'documents',
        record,
      }));
      const copiedContracts = fromDocs.some((item) => item.type === 'contract');
      const fromSignatures: Doc[] = copiedContracts
        ? []
        : signatures.map((record) => ({
          id: record.id,
          title: 'Contrat signé',
          type: 'contract',
          file: String(record.pdf || ''),
          created: String(record.signed_at || record.created || ''),
          collection: 'signatures',
          record,
        }));
      setDocs([...fromDocs, ...fromSignatures].sort((a, b) => b.created.localeCompare(a.created)));
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  const openSecure = async (doc: Doc) => {
    if (!doc.file) return;
    setOpening(doc.id);
    setError('');
    try {
      const token = await pb.files.getToken();
      const url = pb.files.getURL(doc.record, doc.file, { token });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Le lien de téléchargement n’a pas pu être généré. Réessayez.');
    }
    setOpening('');
  };

  useEffect(() => { load(); }, []);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!title.trim()) {
      setError('Donnez un titre au document.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('type', type);
      fd.append('file', file);
      fd.append('owner', pb.authStore.record!.id);
      await pb.collection('documents').create(fd);
      setTitle('');
      await load();
    } catch {
      setError("Le dépôt a échoué.");
    }
    setUploading(false);
  };

  return (
    <>
      <div className="espace-page-head">
        <h1>Mes documents</h1>
        <p>Contrat signé, contrat cadre, avenants, factures et documents déposés par notre équipe. Chaque téléchargement ouvre un lien temporaire sécurisé.</p>
      </div>

      <div className="espace-card">
        <h2>Déposer un document</h2>
        <div className="espace-row">
          <div className="espace-field">
            <label>Titre</label>
            <input className="espace-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Extrait Kbis 2026" />
          </div>
          <div className="espace-field">
            <label>Type</label>
            <select className="espace-select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="kbis">Extrait Kbis</option>
              <option value="delegation">Délégation de pouvoir</option>
              <option value="other">Autre</option>
            </select>
          </div>
        </div>
        {error ? <div className="espace-alert espace-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}
        <div style={{ marginTop: 14 }}>
          <label className="espace-btn espace-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', width: 'auto' }}>
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Déposer un fichier
            <input type="file" accept="application/pdf,image/jpeg,image/png" style={{ display: 'none' }} onChange={onUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="espace-card">
        <h2>Documents ({docs.length})</h2>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><Loader2 size={24} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>
        ) : docs.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Aucun document pour l’instant.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map((doc) => (
              <button key={`${doc.collection}-${doc.id}`} type="button" onClick={() => openSecure(doc)} disabled={opening === doc.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid #e3eaf0', borderRadius: 8, background: '#fff', textAlign: 'left', width: '100%' }}>
                <FileText size={18} style={{ color: 'var(--blue)', flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{doc.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                    {TYPE_LABELS[doc.type] || doc.type}
                    {doc.created ? ` · ${formatDate(doc.created)}` : ''}
                  </div>
                </div>
                {opening === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} style={{ color: 'var(--ink-muted)' }} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
