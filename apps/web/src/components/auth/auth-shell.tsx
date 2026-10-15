import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

const LOGO_URL = 'https://horizons-cdn.hostinger.com/082281b5-6516-4c12-b3c6-5cca51241b08/img_8241-8Chpm.PNG';

function AuthLegalLinks() {
  return (
    <div className="auth-legal-links">
      <Link to="/mentions-legales">Mentions légales</Link>
      <Link to="/conditions-utilisation">Conditions d’utilisation</Link>
      <Link to="/politique-de-confidentialite">Confidentialité</Link>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src={LOGO_URL} alt="Mon Entreprise Locale" />
        </div>
        <h1>{title}</h1>
        {subtitle ? <p className="auth-sub">{subtitle}</p> : null}
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
        <AuthLegalLinks />
      </div>
    </div>
  );
}

export function GoogleButton({ label = 'Continuer avec Google' }: { label?: string }) {
  const [loading, setLoading] = useState(false);

  const onClick = () => {
    setLoading(true);
    // `?t` makes each click a unique URL so the edge cache never serves a stale
    // OAuth state. The server reads GOOGLE_CLIENT_ID/SECRET from .env.
    window.location.href = `/api/auth/google?t=${Date.now()}`;
  };

  return (
    <button type="button" className="auth-google" onClick={onClick} disabled={loading}>
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.5l-6.6-5.6C29.6 34.5 26.9 35.5 24 35.5c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.6 5.6C41.9 36.5 44 30.8 44 24c0-1.3-.1-2.3-.4-3.5z" />
      </svg>
      {loading ? 'Redirection…' : label}
    </button>
  );
}
