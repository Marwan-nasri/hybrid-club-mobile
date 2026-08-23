import { ChoixSimple } from '@/components/quiz/ChoixSimple';
import { EcranQuestion } from '@/components/quiz/EcranQuestion';
import { useEtapeQuiz } from '@/lib/quiz';

import type { Option } from '@/components/quiz/ChoixSimple';
import type { LevelType } from '@/lib/programGenerator';

/**
 * Jamais « Débutant / Intermédiaire / Avancé » en options sèches : les gens se
 * surestiment, et ce champ décide si le bloc commence par un apprentissage des
 * mouvements ou par du squat chargé. Chaque option est ancrée sur l'expérience
 * réelle, pas sur l'idée qu'on se fait de son niveau.
 */
const OPTIONS: Option<LevelType>[] = [
  {
    valeur: 'debutant',
    titre: 'Débutant',
    description: "Je découvre l'entraînement structuré, moins de 6 mois de pratique régulière",
  },
  {
    valeur: 'intermediaire',
    titre: 'Intermédiaire',
    description:
      "Je m'entraîne depuis un moment, je connais les mouvements de base (squat, développé, tirage)",
  },
  {
    valeur: 'avance',
    titre: 'Avancé',
    description: "Je m'entraîne depuis plusieurs années, je maîtrise les mouvements techniques",
  },
];

export default function NiveauScreen() {
  const { position, total, suivant } = useEtapeQuiz();

  return (
    <EcranQuestion
      question="Comment décrirais-tu ton niveau ?"
      position={position}
      total={total}
      legende="Une réponse suffit — on passe à la suite automatiquement.">
      <ChoixSimple options={OPTIONS} onSelect={(niveau) => suivant({ niveau })} />
    </EcranQuestion>
  );
}
