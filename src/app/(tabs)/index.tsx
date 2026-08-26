import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatBlock } from '@/components/ui/StatBlock';
import { jourIso } from '@/lib/calendrier';
import { estComplet, lireProfil } from '@/lib/profilOnboarding';
import { chargerSemaine, LIBELLE_TYPE } from '@/lib/seances';
import { supabase } from '@/lib/supabase';

import type { EtatSemaine, Seance } from '@/lib/seances';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const INITIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** B1 en montre 3 avant de résumer le reste en « + N exercices ». */
const BLOCS_VISIBLES = 3;

/**
 * Formaté à la main plutôt qu'avec `toLocaleDateString` : l'app est en
 * français quelle que soit la langue de l'appareil, et le support d'Intl
 * dépend du moteur JS embarqué.
 */
function libelleDate(d: Date): string {
  return `${JOURS[jourIso(d) - 1]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}

/**
 * « Demain » ou le nom du jour de la prochaine séance.
 *
 * Les créneaux sont les mêmes toutes les semaines : s'il ne reste rien après
 * aujourd'hui, la prochaine est la première de la semaine suivante. Aucune
 * heure affichée — la maquette annonce « Demain 7 h », mais `sessions` ne
 * stocke pas d'heure de séance.
 */
function prochaineSeance(seances: Seance[], jour: number): string | null {
  const jours = seances.map((s) => s.jour).sort((a, b) => a - b);
  if (jours.length === 0) return null;

  const suivant = jours.find((j) => j > jour);
  if (suivant === undefined) return JOURS[jours[0] - 1];
  return suivant === jour + 1 ? 'Demain' : JOURS[suivant - 1];
}

function Entete({ date, titre }: { date: Date; titre: string }) {
  return (
    <>
      <Text className="text-sm font-medium uppercase tracking-wide text-text-tertiary">
        {libelleDate(date)}
      </Text>
      <Text className="mt-1 text-3xl font-bold text-text-primary">{titre}</Text>
    </>
  );
}

function CarteSeance({ seance }: { seance: Seance }) {
  const reste = seance.blocs.length - BLOCS_VISIBLES;

  return (
    <Card className="mt-6">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm font-medium uppercase tracking-wide text-accent">
          {seance.nom}
        </Text>
        {seance.duree_estimee_min ? (
          <Text className="text-base text-text-secondary">{seance.duree_estimee_min} min</Text>
        ) : null}
      </View>

      <View className="mt-4 gap-2">
        {seance.blocs.slice(0, BLOCS_VISIBLES).map((b, i) => (
          <View key={`${b.nom}-${i}`} className="flex-row items-baseline justify-between">
            <Text className="flex-1 pr-3 text-base text-text-primary">{b.nom}</Text>
            {b.dose ? (
              <Text
                className="text-base text-text-secondary"
                style={{ fontVariant: ['tabular-nums'] }}>
                {b.dose}
              </Text>
            ) : null}
          </View>
        ))}
        {reste > 0 ? (
          <Text className="text-sm text-text-tertiary">
            + {reste} {reste === 1 ? 'exercice' : 'exercices'}
          </Text>
        ) : null}
      </View>

      <View className="mt-6">
        <Button
          label="Démarrer"
          onPress={() => router.push({ pathname: '/workout/[id]', params: { id: seance.id } })}
        />
      </View>
    </Card>
  );
}

/**
 * B1 met ici deux blocs : « Charge 7 j » et « Prochaine ». Le premier se
 * calcule sur les séances réalisées, donc sur `workout_logs` — il attend
 * l'écriture du réalisé. Seul « Prochaine » se dérive du prescrit.
 */
function CarteRepos({ prochaine }: { prochaine: string | null }) {
  return (
    <Card className="mt-6">
      <Text className="text-base text-text-secondary">
        Ce repos fait partie du plan — il n&apos;est pas rattrapable. Mange, dors, marche : la
        prochaine séance sera meilleure pour ça.
      </Text>
      {prochaine ? (
        <View className="mt-4 flex-row">
          <View className="flex-1">
            <StatBlock label="Prochaine" value={prochaine} />
          </View>
          <View className="flex-1" />
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Les 7 jours de la semaine en cours.
 *
 * B1 distingue « fait / à venir / repos ». On n'en garde que deux — séance
 * prévue, repos — plus la mise en évidence d'aujourd'hui. « Fait » vient de
 * `workout_logs`, qui n'est pas encore écrit : une pastille pleine sur un jour
 * passé mentirait sur une donnée qu'on n'a pas.
 */
function LigneSemaine({ seances, jour }: { seances: Seance[]; jour: number }) {
  const prevus = new Set(seances.map((s) => s.jour));

  return (
    <View className="mt-8">
      <Text className="text-sm font-medium uppercase tracking-wide text-text-tertiary">
        Cette semaine
      </Text>

      <View className="mt-3 flex-row">
        {INITIALES.map((initiale, i) => {
          const n = i + 1;
          const aujourdhui = n === jour;
          return (
            <View key={n} className="flex-1 items-center">
              <Text
                className={`text-xs ${
                  aujourdhui ? 'font-semibold text-accent' : 'text-text-tertiary'
                }`}>
                {initiale}
              </Text>
              <View
                className={`mt-2 h-10 w-10 rounded-pill border ${
                  aujourdhui ? 'border-accent' : 'border-border'
                } ${prevus.has(n) ? 'bg-surface-elevated' : ''}`}
              />
            </View>
          );
        })}
      </View>

      <View className="mt-4 flex-row items-center gap-4">
        <View className="flex-row items-center gap-2">
          <View className="h-3 w-3 rounded-pill border border-border bg-surface-elevated" />
          <Text className="text-xs text-text-tertiary">Séance prévue</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="h-3 w-3 rounded-pill border border-border" />
          <Text className="text-xs text-text-tertiary">Repos</Text>
        </View>
      </View>
    </View>
  );
}

function Repli({ titre, message, action }: { titre: string; message: string; action?: () => void }) {
  return (
    <View className="flex-1 justify-center px-5">
      <Text className="text-3xl font-bold text-text-primary">{titre}</Text>
      <Text className="mt-3 text-base text-text-secondary">{message}</Text>
      {action ? (
        <View className="mt-6">
          <Button label="Réessayer" variant="secondary" onPress={action} />
        </View>
      ) : null}
    </View>
  );
}

function Semaine({ etat, date }: { etat: Extract<EtatSemaine, { statut: 'ok' }>; date: Date }) {
  const seance = etat.seances.find((s) => s.jour === etat.jour);
  // « Séance 4 · Semaine 1 » : le rang de la séance du jour dans la semaine,
  // pas un compteur de séances faites. Se lit sur le prescrit seul.
  const rang = etat.seances.findIndex((s) => s.jour === etat.jour) + 1;

  return (
    <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
      <Entete
        date={date}
        titre={seance ? `Séance ${rang} · Semaine ${etat.semaine}` : 'Repos programmé'}
      />
      {seance ? (
        <CarteSeance seance={seance} />
      ) : (
        <CarteRepos prochaine={prochaineSeance(etat.seances, etat.jour)} />
      )}
      <LigneSemaine seances={etat.seances} jour={etat.jour} />
    </ScrollView>
  );
}

export default function AujourdhuiScreen() {
  const [etat, setEtat] = useState<EtatSemaine | null>(null);
  const [erreur, setErreur] = useState(false);
  // ponytail: la date est figée au montage. L'app laissée ouverte toute la
  // nuit affiche encore la veille — à recalculer au retour au premier plan si
  // ça se voit à l'usage.
  const [date] = useState(() => new Date());

  const charger = useCallback(async () => {
    setErreur(false);
    setEtat(null);
    try {
      setEtat(await chargerSemaine(date));
    } catch {
      setErreur(true);
    }
  }, [date]);

  // Un profil d'onboarding encore en attente alors qu'une session existe
  // signifie que l'insertion n'est jamais allée au bout — app tuée pendant le
  // chargement, typiquement. On repart sur l'écran qui sait la reprendre plutôt
  // que d'afficher un accueil qui ment sur l'état du compte.
  useEffect(() => {
    (async () => {
      const [{ data }, profil] = await Promise.all([supabase.auth.getSession(), lireProfil()]);
      if (data.session && estComplet(profil)) router.replace('/creer-compte');
      else charger();
    })();
  }, [charger]);

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        {erreur ? (
          <Repli
            titre="Programme indisponible"
            message="Impossible de récupérer ta semaine. Vérifie ta connexion."
            action={charger}
          />
        ) : etat === null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : etat.statut === 'sans_programme' ? (
          <Repli
            titre="Aucun programme actif"
            message="Ton programme n’a pas été enregistré. Reprends l’onboarding pour le régénérer."
          />
        ) : etat.statut === 'termine' ? (
          <Repli
            titre="Bloc terminé"
            message="Tes 12 semaines sont bouclées. Le bloc suivant arrive bientôt."
          />
        ) : (
          <Semaine etat={etat} date={date} />
        )}
      </SafeAreaView>
    </View>
  );
}
