import { useEffect, useState } from 'react';
import { Loader2, Upload, CheckCircle2, FileText } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import type { RecordModel } from 'pocketbase';

type Template = RecordModel & { version: string; title: string; body: string; active: boolean; created: string };

export function SettingsContract() {
  const [active, setActive] = useState<Template | null>(null);
  const [versions, setVersions] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const load = async () => {
    try {
      const all = await pb.collection('contract_templates').getFullList({
        filter: 'category = "framework"',
        sort: '-created',
        requestKey: null,
      });
      const list = all as unknown as Template[];
      setVersions(list);
      setActive(list.find((t) => t.active) || null);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const publish = async () => {
    setError('');
    if (!version.trim() || !title.trim() || !body.trim()) {
      setError('Version, titre et contenu sont requis.');
      return;
    }
    setPublishing(true);
    try {
      // Deactivate previous active framework templates (signed contracts keep
      // their version — signatures store template_version independently).
      for (const t of versions.filter((t) => t.active)) {
        await pb.collection('contract_templates').update(t.id, { active: false });
      }
      await pb.collection('contract_templates').create({
        version: version.trim(),
        title: title.trim(),
        body: body.trim(),
        category: 'framework',
        active: true,
      });
      setVersion('');
      setTitle('');
      setBody('');
      setDone(true);
      setTimeout(() => setDone(false), 3000);
      await load();
    } catch {
      setError("La publication a échoué.");
    }
    setPublishing(false);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 size={26} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div className="espace-card">
        <h2>Version active</h2>
        {active ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FileText size={20} style={{ color: 'var(--forest)' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>{active.title}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Version {active.version}</div>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Aucune version active. La version intégrée à l’application est utilisée par défaut.</p>
        )}
        <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 12, lineHeight: 1.5 }}>
          Les contrats déjà signés conservent leur version d’origine (chaque signature enregistre la version du modèle).
        </p>
      </div>

      <div className="espace-card">
        <h2>Publier une nouvelle version</h2>
        {error ? <div className="espace-alert espace-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
        {done ? <div className="espace-alert espace-alert-success" style={{ marginBottom: 12 }}>Nouvelle version publiée. Elle s’applique aux prochaines signatures.</div> : null}
        <div className="espace-row" style={{ marginBottom: 14 }}>
          <div className="espace-field"><label>Version</label><input className="espace-input" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="2.0" /></div>
          <div className="espace-field"><label>Titre</label><input className="espace-input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        </div>
        <div className="espace-field">
          <label>Contenu (HTML — balises {'{{nom_du_champ}}'} interpolées)</label>
          <textarea className="espace-textarea" style={{ minHeight: 220, fontFamily: 'monospace', fontSize: 13 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="<h1>Contrat cadre</h1><p>Entre JRConsulting et {{denomination}}…</p>" />
        </div>
        <button type="button" className="espace-btn" onClick={publish} disabled={publishing} style={{ marginTop: 14 }}>
          {publishing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Publier la version
        </button>
      </div>

      {versions.length > 0 ? (
        <div className="espace-card">
          <h2>Historique des versions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {versions.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid #e3eaf0', borderRadius: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>v{t.version} — {t.title}</div>
                </div>
                {t.active ? <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)' }}>Active</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
