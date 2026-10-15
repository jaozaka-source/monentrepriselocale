import { useState } from 'react';
import { Link, redirect, useNavigate } from 'react-router';
import type { Route } from './+types/signup';
import { seo } from '@/lib/seo';
import pb from '@/lib/pocketbase-client';
import { useAuth } from '@/hooks/use-auth';
import { syncRole } from '@/lib/auth-sync';
import { AuthShell, GoogleButton } from '@/components/auth/auth-shell';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Créer un compte — Espace client Mon Entreprise Locale',
    description: 'Inscrivez-vous pour lancer la création de votre site web de commerce de proximité.',
    noindex: true,
  });
}

export function clientLoader() {
  if (pb.authStore.isValid && pb.authStore.record) {
    throw redirect('/espace');
  }
  return null;
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return <div className="auth-page" />;
}

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Le mot de passe doit comporter au moins 8 caractères.');
      return;
    }
    if (!terms) {
      setError('Vous devez accepter les conditions d’utilisation et la politique de confidentialité.');
      return;
    }

    setLoading(true);
    try {
      await signup(email.trim(), password, {
        name: name.trim(),
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        role: 'client',
      });

      // Send the verification email (non-blocking).
      pb.collection('users').requestVerification(email.trim()).catch(() => {});

      await syncRole();
      navigate('/espace');
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 400 ? 'Cet e-mail est déjà utilisé ou invalide.' : 'L’inscription a échoué. Réessayez.');
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Créer mon compte"
      subtitle="Lancez la création de votre site web"
      footer={<>Déjà un compte ? <Link to="/login">Se connecter</Link></>}
    >
      <GoogleButton label="S’inscrire avec Google" />
      <div className="auth-divider">ou avec votre e-mail</div>
      <form className="auth-form" onSubmit={onSubmit}>
        <div className="espace-field">
          <label htmlFor="name">Nom complet</label>
          <input id="name" className="espace-input" type="text" required value={name}
            onChange={(e) => setName(e.target.value)} placeholder="Jean Dupont" autoComplete="name" />
        </div>
        <div className="espace-field">
          <label htmlFor="email">E-mail</label>
          <input id="email" className="espace-input" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" autoComplete="email" />
        </div>
        <div className="espace-field">
          <label htmlFor="password">Mot de passe</label>
          <input id="password" className="espace-input" type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} />
          <span className="hint">8 caractères minimum</span>
        </div>
        <label className="espace-check">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>
            J’accepte les <Link to="/conditions-utilisation">conditions d’utilisation</Link> et la{' '}
            <Link to="/politique-de-confidentialite">politique de confidentialité</Link>. Voir aussi les{' '}
            <Link to="/mentions-legales">mentions légales</Link>.
          </span>
        </label>
        {error ? <div className="espace-alert espace-alert-error">{error}</div> : null}
        <button type="submit" className="espace-btn" disabled={loading}>
          {loading ? 'Création…' : 'Créer mon compte'}
        </button>
      </form>
    </AuthShell>
  );
}
