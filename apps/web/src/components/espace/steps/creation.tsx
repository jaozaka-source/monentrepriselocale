import { Hammer, MessageSquare } from 'lucide-react';
import type { ClientProfile } from '@/lib/client-steps';

export function Creation({ profile }: { profile: ClientProfile }) {
  const comment = profile.creation_comment?.trim();

  return (
    <div className="espace-card">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Hammer size={20} style={{ color: 'var(--blue)' }} /> Création de votre site
      </h2>
      <p style={{ fontSize: 15, color: 'var(--ink-muted)', lineHeight: 1.7, margin: '0 0 8px' }}>
        Notre équipe conçoit votre site sur mesure à partir des contenus et informations que vous
        avez transmis : mise en page, charte graphique, textes et images.
      </p>
      <p style={{ fontSize: 15, color: 'var(--ink-muted)', lineHeight: 1.7, margin: 0 }}>
        Vous serez notifié(e) par e-mail dès que la maquette sera prête à être consultée.
        Aucune action n’est requise de votre part pour le moment.
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
