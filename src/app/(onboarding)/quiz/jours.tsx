import { ChoixSimple } from '@/components/quiz/ChoixSimple';
import { EcranQuestion } from '@/components/quiz/EcranQuestion';
import { useEtapeQuiz } from '@/lib/quiz';

import type { Option } from '@/components/quiz/ChoixSimple';

/**
 * Le pool des templates compte 6 types de séance et le moteur retient les N
 * premiers dans l'ordre de priorité de l'objectif. Au-delà de 6 il ne sait
 * qu'ajouter du repos actif — inutile de le proposer.
 */
const OPTIONS: Option<number>[] = [2, 3, 4, 5, 6].map((n) => ({
  valeur: n,
  titre: `${n} jours`,
}));

export default function JoursScreen() {
  const { position, total, suivant } = useEtapeQuiz();

  return (
    <EcranQuestion
      question="Combien de jours par semaine ?"
      aide="Peu importe le nombre, ce sont les séances les plus utiles à ton objectif qui sont gardées en premier. Annonce ce que tu tiendras 12 semaines, pas ton meilleur mois."
      position={position}
      total={total}
      legende="Une réponse suffit — on passe à la suite automatiquement.">
      <ChoixSimple options={OPTIONS} onSelect={(jours_dispo) => suivant({ jours_dispo })} />
    </EcranQuestion>
  );
}
