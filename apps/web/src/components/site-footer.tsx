import { ArrowUpRight } from 'lucide-react';
export function SiteFooter() {
  return <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div>
            <a href="#accueil" className="brand footer-brand" aria-label="Mon Entreprise Locale, accueil">
              <img src="https://horizons-cdn.hostinger.com/082281b5-6516-4c12-b3c6-5cca51241b08/img_8243-NmIVL.PNG" alt="Mon Entreprise Locale" className="brand-logo brand-logo-footer" width={240} height={62} />
            </a>
            <p>Des sites web pensés pour les commerces qui font vivre nos quartiers.</p>
          </div>
          <div className="footer-links"><span>Explorer</span><a href="#solutions">Nos solutions</a><a href="#packs">Nos packs</a><a href="#tarifs">Tarifs</a><a href="#comment-ca-marche">Comment ça marche</a><a href="#contact">Demander un site</a></div>
          <div className="footer-links"><span>Une question ?</span><a href="mailto:contact@monentrepriselocale.fr">contact@monentrepriselocale.fr <ArrowUpRight size={15} /></a></div>
          <div className="footer-links"><span>Informations légales</span><a href="/mentions-legales">Mentions légales</a><a href="/conditions-utilisation">Conditions d’utilisation</a><a href="/politique-de-confidentialite">Politique de confidentialité</a></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Mon Entreprise Locale. Tous droits réservés.</span><span>Fait pour les commerces de proximité.</span></div>
      </div>
    </footer>;
}