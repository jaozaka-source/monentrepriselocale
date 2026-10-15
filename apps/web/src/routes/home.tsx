import type { Route } from './+types/home';
import { seo } from '@/lib/seo';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';
import type { Pack } from '@/lib/client-steps';
import { Hero } from '@/components/home/hero';
import { NotreSolution } from '@/components/home/notre-solution';
import { Solutions } from '@/components/home/solutions';
import { Packs } from '@/components/home/packs';
import { Pricing } from '@/components/home/pricing';
import { HowItWorks } from '@/components/home/how-it-works';
import { Contact } from '@/components/home/contact';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Mon Entreprise Locale — Un site web à l’image de votre commerce',
    description: 'Des sites web prêts à l’emploi pour les commerces de proximité : coiffeurs, instituts, ongleries, barbiers et plus encore. Packs Essentiel, Rendez-vous et Boutique. Parlez-nous de votre projet.',
    image: 'https://horizons-cdn.hostinger.com/082281b5-6516-4c12-b3c6-5cca51241b08/ef19ca00ebda98e4e8323e9236676f7e.jpg',
  });
}

export async function loader() {
  try {
    const result = await pocketbaseAdmin.listRecords<Pack>('packs', {
      sort: 'sort',
      perPage: 50,
    });
    return { packs: result.items };
  } catch {
    return { packs: [] };
  }
}

export default function HomePage({ loaderData }: Route.ComponentProps) {
  return (
    <main>
      <Hero />
      <NotreSolution />
      <Solutions />
      <Packs />
      <Pricing packs={loaderData.packs} />
      <HowItWorks />
      <Contact />
    </main>
  );
}
