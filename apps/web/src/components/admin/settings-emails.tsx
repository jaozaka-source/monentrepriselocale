import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import type { RecordModel } from 'pocketbase';
import { STEPS } from '@/data/steps';

type Template = RecordModel & { step: string; subject: string; body: string; active: boolean; id?: string };

export function SettingsEmails() {
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = async () => {
    try {
      const records = await pb.collection('email_templates').getFullList({ requestKey: null });
      const map: Record<string, Template> = {};
      for (const r of records as unknown as Template[]) {
        map[r.step] = r;
      }
      setTemplates(map);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const ensure = (step: string): Template => {
    if (!templates[step]) {
      return { step, subject: '', body: '', active: true, id: '' } as Template;
    }
    return templates[step];
  };

  const update = (step: string, patch: Partial<Template>) => {
    setTemplates((prev) => ({ ...prev, [step]: { ...ensure(step), ...patch } }));
  };

  const save = async (step: string) => {
    const t = ensure(step);
    setSaving(step);
    try {
      if (t.subject.trim() === '' && t.body.trim() === '') {
        // Empty → delete if exists
        if (t.id) await pb.collection('email_templates').delete(t.id);
        setTemplates((prev) => {
          const next = { ...prev };
          delete next[step];
          return next;
        });
      } else if (t.id) {
        await pb.collection('email_templates').update(t.id, { subject: t.subject, body: t.body, active: t.active });
      } else {
        const rec = await pb.collection('email_templates').create({ step, subject: t.subject, body: t.body, active: t.active });
        setTemplates((prev) => ({ ...prev, [step]: { ...t, id: rec.id } as Template }));
      }
      setSaved(step);
      setTimeout(() => setSaved(null), 2500);
    } catch {
      // ignore
    }
    setSaving(null);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 size={26} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="espace-alert espace-alert-info">
        Variables disponibles dans le corps : <code>{'{{step_label}}'}</code>, <code>{'{{step}}'}</code>, <code>{'{{comment}}'}</code>. Laissez vide pour utiliser le modèle par défaut.
      </div>
      {STEPS.map((s) => {
        const t = ensure(s.code);
        return (
          <div key={s.code} className="espace-card">
            <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{s.code} · {s.title}</span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)' }}>
                <input type="checkbox" checked={Boolean(t.active)} onChange={(e) => update(s.code, { active: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--blue)' }} />
                Actif
              </label>
            </h2>
            <div className="espace-field" style={{ marginBottom: 12 }}><label>Objet</label><input className="espace-input" value={t.subject || ''} onChange={(e) => update(s.code, { subject: e.target.value })} /></div>
            <div className="espace-field"><label>Corps (HTML)</label><textarea className="espace-textarea" style={{ minHeight: 120 }} value={t.body || ''} onChange={(e) => update(s.code, { body: e.target.value })} /></div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="button" className="espace-btn" onClick={() => save(s.code)} disabled={saving === s.code}>
                {saving === s.code ? <Loader2 size={15} className="animate-spin" /> : saved === s.code ? <CheckCircle2 size={15} /> : <Save size={15} />}
                Enregistrer
              </button>
              {saved === s.code ? <span style={{ fontSize: 13, color: 'var(--forest)', fontWeight: 700 }}>Enregistré</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
