import { useEffect, useState } from 'react';
import { Link, redirect, useNavigate, useSearchParams } from 'react-router';
import type { Route } from './+types/login';
import { seo } from '@/lib/seo';
import pb from '@/lib/pocketbase-client';
import { useAuth } from '@/hooks/use-auth';
import { syncRole } from '@/lib/auth-sync';
import { AuthShell, GoogleButton } from '@/components/auth/auth-shell';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Connexion — Espace client Mon Entreprise Locale',
    description: 'Connectez-vous à votre espace client pour suivre la création de votre site web.',
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

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const googleFinish = searchParams.get('google_finish');
  const googleError = searchParams.get('google_error');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(googleError ? 'La connexion Google a échoué. Réessayez.' : '');
  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(Boolean(googleFinish));

  // Redeem the one-time code issued by the Google OAuth callback (server-side
  // flow). The code is exchanged for a PocketBase session token via POST (never
  // cached), then the session is opened and the user is sent to /espace.
  useEffect(() => {
    if (!googleFinish) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: googleFinish }),
        });
        if (!res.ok) throw new Error('exchange failed');
        const data = (await res.json()) as { token: string; record: Parameters<typeof pb.authStore.save>[1] };
        pb.authStore.save(data.token, data.record);
        await syncRole();
        if (!cancelled) navigate('/espace');
      } catch {
        if (!cancelled) {
          setError('La connexion Google a échoué. Réessayez.');
          setExchanging(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [googleFinish, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      await syncRole();
      navigate('/espace');
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 400 ? 'E-mail ou mot de passe incorrect.' : 'La connexion a échoué. Réessayez.');
      setLoading(false);
    }
  };

  if (exchanging) {
    return (
      <AuthShell title="Connexion Google" subtitle="Finalisation de la connexion…">
        <div className="espace-alert espace-alert-info">Connexion Google en cours, veuillez patienter…</div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Connexion"
      subtitle="Accédez à votre espace client"
      footer={<>Pas encore de compte ? <Link to="/signup">Créer un compte</Link></>}
    >
      <GoogleButton />
      <div className="auth-divider">ou avec votre e-mail</div>
      <form className="auth-form" onSubmit={onSubmit}>
        <div className="espace-field">
          <label htmlFor="email">E-mail</label>
          <input id="email" className="espace-input" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" autoComplete="email" />
        </div>
        <div className="espace-field">
          <label htmlFor="password">Mot de passe</label>
          <input id="password" className="espace-input" type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error ? <div className="espace-alert espace-alert-error">{error}</div> : null}
        <button type="submit" className="espace-btn" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 600 }}>
          Mot de passe oublié ?
        </Link>
      </div>
    </AuthShell>
  );
}
