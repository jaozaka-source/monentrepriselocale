import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="legal-page">
      <Link to="/" className="auth-back">
        <ArrowLeft size={15} /> Retour au site
      </Link>
      <h1>{title}</h1>
      {updated ? <p className="legal-updated">Dernière mise à jour : {updated}</p> : null}
      {children}
    </div>
  );
}
