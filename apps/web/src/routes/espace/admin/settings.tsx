import { useEffect, useState } from 'react';
import type { Route } from './+types/settings';
import { seo } from '@/lib/seo';
import { SettingsPacks } from '@/components/admin/settings-packs';
import { SettingsContract } from '@/components/admin/settings-contract';
import { SettingsEmails } from '@/components/admin/settings-emails';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Paramètres — Administration',
    description: 'Gestion des packs, du contrat cadre et des modèles d’e-mails.',
    noindex: true,
  });
}

const TABS = [
  { id: 'packs', label: 'Packs' },
  { id: 'contract', label: 'Contrat cadre' },
  { id: 'emails', label: 'Modèles d’e-mails' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AdminSettings() {
  const [tab, setTab] = useState<TabId>('packs');

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, borderBottom: '1px solid #e3eaf0', paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 700,
              background: 'none',
              border: 0,
              borderBottom: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
              color: tab === t.id ? 'var(--blue)' : 'var(--ink-muted)',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'packs' ? <SettingsPacks /> : null}
      {tab === 'contract' ? <SettingsContract /> : null}
      {tab === 'emails' ? <SettingsEmails /> : null}
    </>
  );
}
