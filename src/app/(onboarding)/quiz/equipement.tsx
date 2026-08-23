import { ChoixSimple } from '@/components/quiz/ChoixSimple';
import { EcranQuestion } from '@/components/quiz/EcranQuestion';
import { useEtapeQuiz } from '@/lib/quiz';

import type { Option } from '@/components/quiz/ChoixSimple';
import type { EquipmentType } from '@/lib/programGenerator';

/**
 * `home_gym` existe dans l'enum mais n'est pas proposé : aucun exercice n'est
 * tagué à ce niveau, et tous les mouvements à la barre demandent
 * `salle_complete`. Le choisir ferait perdre tout le travail à la barre à
 * quelqu'un qui a justement une barre. À rouvrir quand le catalogue sera tagué
 * (voir les chantiers ouverts).
 */
const OPTIONS: Option<EquipmentType>[] = [
  {
    valeur: 'salle_complete',
    titre: 'Salle complète',
    description: 'Barres, racks, machines, cardio',
  },
  {
    valeur: 'halteres_seuls',
    titre: 'Haltères seuls',
    description: "Une paire d'haltères, rien d'autre",
  },
  { valeur: 'poids_corps', titre: 'Poids du corps', description: 'Aucun matériel' },
];

export default function EquipementScreen() {
  const { position, total, suivant } = useEtapeQuiz();

  return (
    <EcranQuestion
      question="Avec quoi tu t'entraînes ?"
      aide="Les mouvements que ton matériel ne permet pas sont remplacés par des variantes équivalentes."
      position={position}
      total={total}
      legende="Une réponse suffit — on passe à la suite automatiquement.">
      <ChoixSimple options={OPTIONS} onSelect={(equipement) => suivant({ equipement })} />
    </EcranQuestion>
  );
}
