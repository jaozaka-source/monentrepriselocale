import { ClipboardCheck, MessageSquare } from 'lucide-react';
import type { ClientProfile } from '@/lib/client-steps';

export function ControleQualite({ profile }: { profile: ClientProfile }) {
  const comment = profile.qa_comment?.trim();

  return (
    <div className="espace-card">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ClipboardCheck size={20} style={{ color: 'var(--blue)' }} /> Contrôle qualité
      </h2>
      <p style={{ fontSize: 15, color: 'var(--ink-muted)', lineHeight: 1.7, margin: '0 0 8px' }}>
        Votre site passe une série de vérifications : affichage sur mobile et ordinateur,
        référencement naturel (SEO), performance et accessibilité.
      </p>
      <p style={{ fontSize: 15, color: 'var(--ink-muted)', lineHeight: 1.7, margin: 0 }}>
        Une fois ces contrôles validés, nous vous présenterons votre site pour recueil de vos
        retours. Vous serez notifié(e) par e-mail.
      </p>

      {comment ? (
        <div className="espace-alert espace-alert-info" style={{ marginTop: 22, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <MessageSquare size={20} style={{ flex: 'none', marginTop: 1 }} />
          <div>
            <strong>Message de notre équipe</strong>
            <p style={{ margin: '6px 0 0', fontWeight: 500, lineHeight: 1.6 }}>{comment}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
