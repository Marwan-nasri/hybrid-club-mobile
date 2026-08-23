import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';

import { lireProfil, majProfil } from './profilOnboarding';

import type { ProfilPartiel } from './profilOnboarding';
import type { Href } from 'expo-router';

/**
 * Le parcours du quiz, dans l'ordre.
 *
 * Un écran ne connaît ni sa position ni son suivant : il les demande à
 * `useEtapeQuiz()`. Insérer, retirer ou réordonner une question, c'est éditer
 * ce tableau et rien d'autre — aucun écran ne référence un autre écran.
 */
type Etape = {
  /** Route Expo Router de l'écran — `typedRoutes` la vérifie à la compilation. */
  route: Href;
  /** Étape conditionnelle : hors parcours ET hors compteur si le prédicat est faux. */
  requise?: (profil: ProfilPartiel) => boolean;
};

const ETAPES: Etape[] = [
  { route: '/quiz/objectif' },
  { route: '/quiz/niveau' },
  { route: '/quiz/jours' },
  { route: '/quiz/equipement' },
  { route: '/quiz/limitations' },
  { route: '/quiz/benchmarks' },
  {
    // Seul embranchement du parcours : demander un 5k à quelqu'un qui vise la
    // recomposition, c'est de la friction pour une donnée que le moteur
    // n'utilisera pas.
    route: '/quiz/temps-5k',
    requise: (p) => p.objectif === 'hyrox' || p.objectif === 'marathon_muscu',
  },
  { route: '/quiz/toi' },
];

/** Sortie du quiz. L'écran de calcul (A5) s'insérera ici. */
const APRES_LE_QUIZ: Href = '/reveal';

const applicables = (profil: ProfilPartiel) =>
  ETAPES.filter((e) => !e.requise || e.requise(profil));

export function useEtapeQuiz() {
  const chemin = usePathname();
  const [profil, setProfil] = useState<ProfilPartiel | null>(null);

  useEffect(() => {
    lireProfil().then(setProfil);
  }, []);

  // Tant que le profil n'est pas lu, les étapes conditionnelles comptent comme
  // présentes : le total ne peut que baisser d'une unité, et jamais avant que
  // l'objectif soit choisi — l'écart n'est pas atteignable à l'écran.
  const parcours = profil ? applicables(profil) : ETAPES;

  return {
    /** Les réponses déjà données — `null` tant que la lecture n'est pas revenue. */
    profil,
    position: parcours.findIndex((e) => e.route === chemin) + 1,
    total: parcours.length,

    /** Persiste la réponse, puis avance vers l'étape suivante du profil à jour. */
    async suivant(reponse: ProfilPartiel) {
      const aJour = await majProfil(reponse);
      setProfil(aJour);

      // Le suivant se calcule sur le profil fusionné, pas sur l'ancien : c'est
      // ce qui fait que répondre « recomposition » retire le 5k du parcours
      // dans le même geste.
      const rang = ETAPES.findIndex((e) => e.route === chemin);
      const suite = applicables(aJour).find((e) => ETAPES.indexOf(e) > rang);
      router.push(suite?.route ?? APRES_LE_QUIZ);
    },
  };
}
