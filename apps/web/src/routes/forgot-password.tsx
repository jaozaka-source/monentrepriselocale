import { useState } from 'react';
import { Link } from 'react-router';
import type { Route } from './+types/forgot-password';
import { seo } from '@/lib/seo';
import pb from '@/lib/pocketbase-client';
import { AuthShell } from '@/components/auth/auth-shell';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Mot de passe oublié — Espace client Mon Entreprise Locale',
    description: 'Réinitialisez votre mot de passe pour accéder à votre espace client.',
    noindex: true,
  });
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await pb.collection('users').requestPasswordReset(email.trim());
      setSent(true);
    } catch {
      setError('Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Recevez un lien de réinitialisation par e-mail"
      footer={<Link to="/login">Retour à la connexion</Link>}
    >
      {sent ? (
        <div className="espace-alert espace-alert-success">
          Si un compte existe pour {email.trim()}, un e-mail de réinitialisation vient d’être envoyé.
          Vérifiez votre boîte de réception (et vos spams).
        </div>
      ) : (
        <form className="auth-form" onSubmit={onSubmit}>
          <div className="espace-field">
            <label htmlFor="email">E-mail</label>
            <input id="email" className="espace-input" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" autoComplete="email" />
          </div>
          {error ? <div className="espace-alert espace-alert-error">{error}</div> : null}
          <button type="submit" className="espace-btn" disabled={loading}>
            {loading ? 'Envoi…' : 'Envoyer le lien'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
