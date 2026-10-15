import { useEffect, useState } from 'react';
import { Loader2, Upload, FileText, Download } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import type { RecordModel } from 'pocketbase';

const TYPE_OPTIONS = [
  { value: 'contract', label: 'Contrat signé' },
  { value: 'amendment', label: 'Avenant' },
  { value: 'framework', label: 'Contrat cadre' },
  { value: 'invoice', label: 'Facture' },
  { value: 'kbis', label: 'Extrait Kbis' },
  { value: 'delegation', label: 'Délégation de pouvoir' },
  { value: 'other', label: 'Autre' },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function ClientDocuments({ ownerId }: { ownerId: string }) {
  const [docs, setDocs] = useState<RecordModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('invoice');
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const records = await pb.collection('documents').getFullList({
        filter: `owner = "${ownerId}"`,
        sort: '-created',
        requestKey: null,
      });
      setDocs(records);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [ownerId]);

  const openSecure = async (doc: RecordModel) => {
    setOpening(doc.id);
    try {
      const token = await pb.files.getToken();
      const url = pb.files.getURL(doc, String(doc.file || ''), { token });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Le lien de téléchargement n’a pas pu être généré.');
    }
    setOpening('');
  };

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
      fd.append('owner', ownerId);
      await pb.collection('documents').create(fd);
      setTitle('');
      await load();
    } catch {
      setError("Le dépôt a échoué.");
    }
    setUploading(false);
  };

  return (
    <div className="espace-card" style={{ marginBottom: 22 }}>
      <h2>Documents</h2>

      <div className="espace-row" style={{ marginBottom: 14 }}>
        <div className="espace-field">
          <label>Titre</label>
          <input className="espace-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Facture octobre 2026" />
        </div>
        <div className="espace-field">
          <label>Type</label>
          <select className="espace-select" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {error ? <div className="espace-alert espace-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      <label className="espace-btn espace-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', width: 'auto', marginBottom: 18 }}>
        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Ajouter un document (visible par le client)
        <input type="file" accept="application/pdf,image/jpeg,image/png" style={{ display: 'none' }} onChange={onUpload} disabled={uploading} />
      </label>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader2 size={22} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>
      ) : docs.length === 0 ? (
        <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Aucun document.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map((doc) => (
            <button key={doc.id} type="button" onClick={() => openSecure(doc)} disabled={opening === doc.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid #e3eaf0', borderRadius: 8, background: '#fff', textAlign: 'left', width: '100%' }}>
              <FileText size={18} style={{ color: 'var(--blue)', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{String(doc.title || 'Document')}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                  {TYPE_LABELS[String(doc.type || 'other')] || doc.type}
                  {doc.created ? ` · ${formatDate(String(doc.created))}` : ''}
                </div>
              </div>
              {opening === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} style={{ color: 'var(--ink-muted)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
