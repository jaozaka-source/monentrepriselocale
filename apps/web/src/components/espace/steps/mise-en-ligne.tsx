import { PartyPopper, ExternalLink, Rocket } from 'lucide-react';
import type { ClientProfile } from '@/lib/client-steps';

export function MiseEnLigne({ profile }: { profile: ClientProfile }) {
  const liveUrl = profile.live_site_url?.trim() || '';

  return (
    <>
      <div className="espace-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#e8f7ee', color: 'var(--forest)', display: 'grid', placeItems: 'center', margin: '0 auto 22px' }}>
          <PartyPopper size={34} />
        </div>
        <h2 style={{ fontSize: 26, margin: '0 0 12px', textAlign: 'center' }}>Votre site est en ligne !</h2>
        <p style={{ fontSize: 16, color: 'var(--ink-muted)', lineHeight: 1.7, maxWidth: 520, margin: '0 auto 26px' }}>
          Félicitations ! Votre site est désormais publié sur votre domaine et indexé par les
          moteurs de recherche. Vos clients peuvent vous trouver en ligne.
        </p>
        {liveUrl ? (
          <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="espace-btn" style={{ margin: '0 auto' }}>
            <ExternalLink size={16} /> Voir mon site
          </a>
        ) : (
          <div className="espace-alert espace-alert-info" style={{ maxWidth: 420, margin: '0 auto' }}>
            Le lien de votre site sera disponible prochainement. Vous serez notifié(e) par e-mail.
          </div>
        )}
      </div>

      <div className="espace-card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Rocket size={20} style={{ color: 'var(--blue)' }} /> Et maintenant ?
        </h2>
        <p style={{ fontSize: 15, color: 'var(--ink-muted)', lineHeight: 1.7, margin: 0 }}>
          Votre site est en exploitation. Si vous rencontrez un incident technique ou souhaitez une
          modification, ouvrez un ticket depuis l’onglet « Mes tickets ». Notre équipe vous répond
          dans les meilleurs délais.
        </p>
      </div>
    </>
  );
}
