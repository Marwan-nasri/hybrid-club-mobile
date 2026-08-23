import { useState } from 'react';
import { Text, View } from 'react-native';

import { EcranQuestion } from '@/components/quiz/EcranQuestion';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { apercuSubstitutions } from '@/lib/programme';
import { useEtapeQuiz } from '@/lib/quiz';

import type { BodyZone } from '@/lib/programGenerator';

/**
 * La maquette sépare droite et gauche ; `profiles.limitations` ne le fait pas.
 * On garde la précision à l'écran — elle compte pour l'utilisateur qui se
 * reconnaît dans « épaule droite » — et on fusionne à l'écriture : deux chips
 * peuvent viser la même zone.
 */
type Chip = { id: string; label: string; zone: BodyZone | null };

const CHIPS: Chip[] = [
  { id: 'epaule_droite', label: 'Épaule droite', zone: 'epaule' },
  { id: 'epaule_gauche', label: 'Épaule gauche', zone: 'epaule' },
  { id: 'coude', label: 'Coude', zone: 'coude' },
  { id: 'poignet', label: 'Poignet', zone: 'poignet' },
  { id: 'genou_droit', label: 'Genou droit', zone: 'genou' },
  { id: 'genou_gauche', label: 'Genou gauche', zone: 'genou' },
  { id: 'dos_bas', label: 'Bas du dos', zone: 'dos_bas' },
  { id: 'hanche', label: 'Hanche', zone: 'hanche' },
  { id: 'cheville', label: 'Cheville', zone: 'cheville' },
  { id: 'aucune', label: 'Aucune', zone: null },
];

/** Au-delà, l'aperçu devient un mur de texte au lieu d'une preuve. */
const APERCU_MAX = 3;

export default function LimitationsScreen() {
  const { profil, position, total, suivant } = useEtapeQuiz();
  const [choisis, setChoisis] = useState<string[]>([]);

  // « Aucune » et une zone déclarée s'excluent : cocher l'un décoche l'autre.
  const basculer = (id: string) =>
    setChoisis((actuels) => {
      if (id === 'aucune') return actuels.includes('aucune') ? [] : ['aucune'];
      const sansAucune = actuels.filter((c) => c !== 'aucune');
      return sansAucune.includes(id)
        ? sansAucune.filter((c) => c !== id)
        : [...sansAucune, id];
    });

  const zones = [
    ...new Set(
      CHIPS.filter((c) => choisis.includes(c.id))
        .map((c) => c.zone)
        .filter((z): z is BodyZone => z !== null),
    ),
  ];

  // L'objectif, le niveau, les jours et l'équipement sont déjà répondus à cette
  // étape : de quoi générer et montrer ce que les zones changent vraiment.
  const repondu =
    profil?.objectif && profil.niveau && profil.jours_dispo && profil.equipement
      ? {
          objectif: profil.objectif,
          niveau: profil.niveau,
          jours_dispo: profil.jours_dispo,
          equipement: profil.equipement,
        }
      : null;
  const apercu =
    repondu && zones.length > 0
      ? apercuSubstitutions({
          ...repondu,
          limitations: zones,
          squat_1rm: null,
          bench_1rm: null,
          deadlift_1rm: null,
        })
      : [];

  return (
    <EcranQuestion
      question="Une zone à ménager ?"
      aide="On remplace les mouvements concernés par des variantes équivalentes. Le volume reste le même — le programme s'adapte, il ne s'allège pas."
      position={position}
      total={total}>
      <View className="flex-row flex-wrap gap-2">
        {CHIPS.map((c) => {
          const actif = choisis.includes(c.id);
          return (
            <Card
              key={c.id}
              onPress={() => basculer(c.id)}
              className={`!rounded-pill !px-4 !py-3 ${actif ? '!border-accent' : ''}`}>
              <Text
                className={`text-base ${
                  actif ? 'font-semibold text-text-primary' : 'text-text-secondary'
                }`}>
                {c.label}
              </Text>
            </Card>
          );
        })}
      </View>

      {zones.length > 0 ? (
        <Card className="mt-6">
          <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
            Ce que ça change
          </Text>
          {apercu.length === 0 ? (
            <Text className="mt-2 text-sm text-text-secondary">
              Rien à remplacer sur ta semaine 1 — les mouvements prévus épargnent déjà cette zone.
            </Text>
          ) : (
            <>
              {apercu.slice(0, APERCU_MAX).map((s) => (
                <Text key={s.avant} className="mt-2 text-sm text-text-secondary">
                  {s.avant} → {s.apres}
                </Text>
              ))}
              {apercu.length > APERCU_MAX ? (
                <Text className="mt-2 text-sm text-text-tertiary">
                  et {apercu.length - APERCU_MAX} autre
                  {apercu.length - APERCU_MAX > 1 ? 's' : ''} remplacement
                  {apercu.length - APERCU_MAX > 1 ? 's' : ''}
                </Text>
              ) : null}
            </>
          )}
        </Card>
      ) : null}

      <View className="mt-8">
        <Button
          label="Continuer"
          disabled={choisis.length === 0}
          onPress={() => suivant({ limitations: zones })}
        />
      </View>
    </EcranQuestion>
  );
}
