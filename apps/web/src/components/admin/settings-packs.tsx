import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import type { RecordModel } from 'pocketbase';

type Pack = RecordModel & {
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  biennial_price: number;
  features: string[];
  stripe_product_id: string;
  stripe_monthly_variant_id: string;
  stripe_annual_variant_id: string;
  stripe_biennial_variant_id: string;
  stripe_lookup_prefix: string;
  sort: number;
  active: boolean;
};

export function SettingsPacks() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = async () => {
    try {
      const records = await pb.collection('packs').getFullList({ sort: 'sort', requestKey: null });
      setPacks(records as unknown as Pack[]);
    } catch {
      setPacks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const update = (id: string, patch: Partial<Pack>) => {
    setPacks((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const save = async (p: Pack) => {
    setSaving(p.id);
    try {
      await pb.collection('packs').update(p.id, {
        name: p.name,
        subtitle: p.subtitle,
        description: p.description,
        monthly_price: Number(p.monthly_price) || 0,
        annual_price: Number(p.annual_price) || 0,
        biennial_price: Number(p.biennial_price) || 0,
        features: p.features,
        stripe_product_id: p.stripe_product_id,
        stripe_monthly_variant_id: p.stripe_monthly_variant_id,
        stripe_annual_variant_id: p.stripe_annual_variant_id,
        stripe_biennial_variant_id: p.stripe_biennial_variant_id,
        stripe_lookup_prefix: p.stripe_lookup_prefix,
        sort: Number(p.sort) || 0,
        active: p.active,
      });
      setSaved(p.id);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {packs.map((p) => (
        <div key={p.id} className="espace-card">
          <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{p.name || 'Pack'}</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)' }}>
              <input type="checkbox" checked={Boolean(p.active)} onChange={(e) => update(p.id, { active: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--blue)' }} />
              Actif
            </label>
          </h2>

          <div className="espace-row">
            <div className="espace-field"><label>Nom</label><input className="espace-input" value={p.name || ''} onChange={(e) => update(p.id, { name: e.target.value })} /></div>
            <div className="espace-field"><label>Sous-titre</label><input className="espace-input" value={p.subtitle || ''} onChange={(e) => update(p.id, { subtitle: e.target.value })} /></div>
          </div>
          <div className="espace-field" style={{ marginTop: 14 }}><label>Description</label><textarea className="espace-textarea" value={p.description || ''} onChange={(e) => update(p.id, { description: e.target.value })} /></div>
          <div className="espace-field" style={{ marginTop: 14 }}>
            <label>Fonctionnalités (une par ligne)</label>
            <textarea className="espace-textarea" value={(p.features || []).join('\n')} onChange={(e) => update(p.id, { features: e.target.value.split('\n') })} />
          </div>
          <div className="espace-row" style={{ marginTop: 14 }}>
            <div className="espace-field"><label>Prix mensuel (centimes)</label><input type="number" className="espace-input" value={p.monthly_price ?? 0} onChange={(e) => update(p.id, { monthly_price: Number(e.target.value) })} /></div>
            <div className="espace-field"><label>Prix annuel (centimes)</label><input type="number" className="espace-input" value={p.annual_price ?? 0} onChange={(e) => update(p.id, { annual_price: Number(e.target.value) })} /></div>
          </div>
          <div className="espace-row" style={{ marginTop: 14 }}>
            <div className="espace-field"><label>Prix biennal (centimes)</label><input type="number" className="espace-input" value={p.biennial_price ?? 0} onChange={(e) => update(p.id, { biennial_price: Number(e.target.value) })} /></div>
            <div className="espace-field"><label>Ordre (sort)</label><input type="number" className="espace-input" value={p.sort ?? 0} onChange={(e) => update(p.id, { sort: Number(e.target.value) })} /></div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)', letterSpacing: '.06em', textTransform: 'uppercase', margin: '18px 0 10px' }}>Identifiants Stripe</div>
          <div className="espace-row">
            <div className="espace-field"><label>Product ID</label><input className="espace-input" value={p.stripe_product_id || ''} onChange={(e) => update(p.id, { stripe_product_id: e.target.value })} /></div>
            <div className="espace-field"><label>Lookup key prefix</label><input className="espace-input" value={p.stripe_lookup_prefix || ''} onChange={(e) => update(p.id, { stripe_lookup_prefix: e.target.value })} /></div>
          </div>
          <div className="espace-row" style={{ marginTop: 14 }}>
            <div className="espace-field"><label>Variant ID mensuel</label><input className="espace-input" value={p.stripe_monthly_variant_id || ''} onChange={(e) => update(p.id, { stripe_monthly_variant_id: e.target.value })} /></div>
            <div className="espace-field"><label>Variant ID annuel</label><input className="espace-input" value={p.stripe_annual_variant_id || ''} onChange={(e) => update(p.id, { stripe_annual_variant_id: e.target.value })} /></div>
          </div>
          <div className="espace-row" style={{ marginTop: 14 }}>
            <div className="espace-field"><label>Variant ID biennal</label><input className="espace-input" value={p.stripe_biennial_variant_id || ''} onChange={(e) => update(p.id, { stripe_biennial_variant_id: e.target.value })} /></div>
          </div>

          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" className="espace-btn" onClick={() => save(p)} disabled={saving === p.id}>
              {saving === p.id ? <Loader2 size={15} className="animate-spin" /> : saved === p.id ? <CheckCircle2 size={15} /> : <Save size={15} />}
              Enregistrer
            </button>
            {saved === p.id ? <span style={{ fontSize: 13, color: 'var(--forest)', fontWeight: 700 }}>Enregistré</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
