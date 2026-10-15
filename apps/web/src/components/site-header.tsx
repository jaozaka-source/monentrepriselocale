import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, Menu, X } from 'lucide-react';
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <header className="site-header">
      <div className="header-inner">
        <a href="#accueil" className="brand" aria-label="Mon Entreprise Locale, accueil" onClick={close}>
          <img src="https://horizons-cdn.hostinger.com/082281b5-6516-4c12-b3c6-5cca51241b08/img_8241-8Chpm.PNG" alt="Mon Entreprise Locale" className="brand-logo" width={280} height={72} />
        </a>
        <nav className={open ? 'header-nav is-open' : 'header-nav'} aria-label="Navigation principale">
          <a href="#solutions" onClick={close}>Nos solutions</a>
          <a href="#packs" onClick={close}>Nos packs</a>
          <a href="#tarifs" onClick={close}>Tarifs</a>
          <a href="#comment-ca-marche" onClick={close}>Comment ça marche</a>
          <a href="#contact" onClick={close}>Contact</a>
          <Link to="/espace" onClick={close}>Espace client</Link>
          <Link to="/signup" className="header-cta" onClick={close}>Créer mon espace client <ArrowUpRight size={17} strokeWidth={2} /></Link>
        </nav>
        <button className="menu-toggle" type="button" aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </header>;
}