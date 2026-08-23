import { ChoixSimple } from '@/components/quiz/ChoixSimple';
import { EcranQuestion } from '@/components/quiz/EcranQuestion';
import { useEtapeQuiz } from '@/lib/quiz';

import type { Option } from '@/components/quiz/ChoixSimple';
import type { GoalType } from '@/lib/programGenerator';

const OPTIONS: Option<GoalType>[] = [
  { valeur: 'hyrox', titre: 'Hyrox', description: 'Force fonctionnelle + running dégradé' },
  {
    valeur: 'marathon_muscu',
    titre: 'Marathon + musculation',
    description: 'Volume course prioritaire, force en soutien',
  },
  { valeur: 'recomposition', titre: 'Recomposition', description: 'Masse maigre, déficit maîtrisé' },
  {
    valeur: 'performance',
    titre: 'Performance générale',
    description: "Pas d'événement, progresser partout",
  },
];

export default function ObjectifScreen() {
  const { position, total, suivant } = useEtapeQuiz();

  return (
    <EcranQuestion
      question="Quel est ton objectif principal ?"
      position={position}
      total={total}
      legende="Une réponse suffit — on passe à la suite automatiquement.">
      <ChoixSimple options={OPTIONS} onSelect={(objectif) => suivant({ objectif })} />
    </EcranQuestion>
  );
}
