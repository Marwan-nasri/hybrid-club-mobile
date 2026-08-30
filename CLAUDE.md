@AGENTS.md
# Hybrid Club — Application mobile iOS

## Le projet

Application iOS native de coaching hybride (musculation + endurance) pour athlètes préparant Hyrox, marathon, ou recomposition corporelle.

Modèle économique : abonnement 89,99 €/an (essai 7 jours) ou 14,99 €/mois, via In-App Purchase Apple.

Une version web existe déjà (Astro + Supabase + Vercel) dans un dépôt séparé. **Le backend Supabase est partagé** : seul le frontend est reconstruit ici. Ne jamais proposer de recréer la logique métier côté serveur sans vérifier ce qui existe déjà.

## Stack

- **Expo SDK 57** + Expo Router (routing par fichiers)
- **TypeScript**
- **NativeWind v4** (Tailwind pour React Native)
- **Supabase** (auth, base de données, RLS)
- **RevenueCat** (abonnements IAP — à intégrer en phase 5)
- **React Native Reanimated** (animations)

Cible : iOS uniquement en V1. Android plus tard, ne pas ajouter de code spécifique Android.

## Design system — à respecter strictement

Les maquettes de référence sont dans `design-reference/`. **Toujours les consulter avant de coder un écran ou un composant.** Ne jamais improviser un visuel si une maquette existe.

### Couleurs (définies dans `tailwind.config.js`)

N'utiliser QUE ces classes, jamais de couleur en dur :

| Usage | Classe | Valeur |
|---|---|---|
| Fond principal | `bg-background` | `#0A0A0B` |
| Cartes, surfaces | `bg-surface` | `#141416` |
| Modals, sheets | `bg-surface-elevated` | `#1C1C1F` |
| Bordures | `border-border` | `#2A2A2E` |
| Texte principal | `text-text-primary` | `#FAFAFA` |
| Texte secondaire | `text-text-secondary` | `#8A8A8F` |
| Labels, tertiaire | `text-text-tertiary` | `#5A5A60` |
| **Accent** | `bg-accent` / `text-accent` | `#D4F227` |
| Avertissement | `text-warning` | `#F59E0B` |

`text-warning` est réservé aux contre-indications (mouvement qui sollicite une zone déclarée en limitation). Jamais en fond, jamais avec une icône.

**Règle absolue sur l'accent :** une seule action accent par écran. Si un écran a deux boutons `bg-accent`, c'est une erreur.

Dark mode uniquement. Pas de light mode, pas de `dark:` variants.

### Typographie

- Chiffres de performance (charges, temps, distances) : `text-5xl font-bold`
- Titres d'écran : `text-3xl font-bold`
- Sous-titres : `text-xl font-semibold`
- Corps : `text-base`
- Labels : `text-sm font-medium uppercase tracking-wide`
- Captions : `text-xs`

Les chiffres dans les tableaux (séries, charges) doivent utiliser `font-variant-numeric: tabular-nums` via `style={{ fontVariant: ['tabular-nums'] }}` pour rester alignés.

### Espacements & rayons

Multiples de 4 uniquement : `p-1 p-2 p-3 p-4 p-6 p-8 p-12`. Marge latérale standard des écrans : `px-5`.

Rayons : `rounded-card` (12px) pour cartes et boutons, `rounded-sheet` (20px) pour bottom sheets, `rounded-pill` pour badges.

### Interdits

Dégradés multicolores, ombres portées prononcées, emojis dans l'UI, plus d'une couleur d'accent par écran, valeurs de couleur en dur (`#FFF`, `rgb()`), espacements hors échelle de 4.

## Composants

**Six composants de base uniquement**, dans `src/components/ui/` :

`Button` (variants: primary / secondary / ghost) · `Card` · `Input` · `StatBlock` (label + valeur + delta) · `SetRow` (ligne de série d'exercice) · `Sheet` (bottom sheet)

**Ne jamais créer un septième composant de base sans me le proposer d'abord et expliquer pourquoi les six existants ne suffisent pas.** Les écrans doivent être composés à partir de ces briques.

## Structure du projet

```
app/
  (onboarding)/     Quiz 10 écrans → calcul → reveal du plan
  paywall.tsx       Après le reveal, avant l'authentification
  (auth)/           Création de compte APRÈS l'achat
  (tabs)/
    index.tsx       Aujourd'hui — séance du jour
    program.tsx     Calendrier 12 semaines
    progress.tsx    Records, volume, allures
    profile.tsx     Compte, abonnement, préférences
  workout/[id].tsx  Séance live — écran central du produit
src/
  components/ui/    Les 6 composants de base
  lib/supabase.ts   Client Supabase
  types/            Types TypeScript partagés
design-reference/   Maquettes — consulter avant de coder
```

## Contraintes produit non négociables

### L'écran de séance (`workout/[id]`)

C'est le cœur du produit, utilisé 5 fois par semaine par les abonnés. Contexte réel d'utilisation : **debout dans une salle de sport, mains moites, entre deux séries, éclairage faible, réseau souvent absent en sous-sol.**

Conséquences directes sur le code :

- **Offline-first obligatoire** : la séance doit fonctionner sans réseau. État local d'abord, synchronisation différée vers Supabase.
- **Zones de tap minimum 56pt de haut.** Aucune interaction fine, aucun geste complexe.
- **Charge de la séance précédente pré-remplie** en gris sur chaque série — l'utilisateur ajuste ou valide.
- **Écran maintenu allumé** pendant la séance (`expo-keep-awake`).
- **Haptic feedback** à chaque validation de série.
- Aucun crash toléré : un plantage en pleine séance = demande de remboursement + avis 1 étoile.

### Données

Séparation stricte entre le **prescrit** (`programs`, `sessions`, `session_blocks`) et le **réalisé** (`workout_logs`, `set_logs`, `cardio_logs`). Ne jamais écrire un résultat dans une table de programme.

### Génération de programme

**Pas d'IA, pas d'appel LLM.** Matrice de templates déterministe (objectif × niveau × jours disponibles) avec substitution d'exercices selon l'équipement disponible et les limitations physiques déclarées.

La substitution pour blessures (`limitations[]` → `substituts[]`) est un différenciateur produit, pas une option — la traiter avec soin.

Le catalogue d'exercices est **embarqué dans l'app**, pas lu en base : le reveal (A6) et le paywall (A7) sont pré-authentification, et la RLS de `exercises` exige un utilisateur connecté. Un aller-retour réseau à cet endroit serait un point de friction au pire moment du funnel.

**Le moteur doit rester strictement déterministe : `programme = f(profil)`.** C'est ce qui permet de ne transporter que le profil d'onboarding (persisté dans AsyncStorage, `src/lib/profilOnboarding.ts`) à travers le tunnel quiz → reveal → paywall → création de compte, et de régénérer après authentification pour insérer. Si le moteur gagne un jour de la variété (pool d'exercices tournants, aléatoire), le programme affiché en A6 et celui inséré après l'auth divergeraient : il faudra alors transporter le programme lui-même, pas le profil.

**Si tu modifies le seed `exercises` ou `exercise_substitutions` dans `supabase/migrations/`, relance `npm run build:catalogue`.** Le script régénère `src/lib/exercises.generated.json` depuis les migrations — sans ça, l'app continue de tourner sur l'ancien catalogue. Ne jamais éditer ce JSON à la main.

## Conventions de code

- TypeScript strict, types explicites sur les props de composants
- Composants fonctionnels uniquement, pas de classes
- Un fichier par composant, nommé en PascalCase
- Pas de `any` — si un type est incertain, le demander plutôt que le contourner
- Requêtes Supabase centralisées dans `src/lib/`, jamais inline dans un écran
- Textes de l'interface en français

## Ce que j'attends de toi

1. **Consulte `design-reference/` avant de coder un écran.** Si la maquette existe, la respecter au pixel près plutôt que d'improviser.
2. **Signale plutôt que de contourner.** Si une maquette est ambiguë, si un composant manque, si une contrainte technique empêche de suivre le design — dis-le, ne prends pas d'initiative silencieuse.
3. **Une tâche à la fois.** Ne pas anticiper sur des écrans non demandés.
4. **Données réalistes dans les mocks** : vrais noms d'exercices, charges cohérentes (100 kg au squat), allures plausibles (4'45/km). Jamais de "Lorem ipsum" ni de "Exercice 1".
5. **Pas de dépendance ajoutée sans validation.** Proposer, expliquer pourquoi, attendre l'accord.

## Chantiers ouverts
- Profondeur table de substitution : 28 trous restants (épaule 9, dos_bas 7, 
  genou 6). Nécessite d'élargir le catalogue, pas seulement d'ajouter des 
  lignes — certains manques sont structurels (aucun squat sans genou hors 
  leg-press). À traiter comme un chantier dédié.
  Deux lignes fausses repérées via l'aperçu A4, même famille que le cas 002 :
  - `romanian-deadlift → back-extension`, en priorité 1 pour `limitation_dos_bas`
    *et* `limitation_hanche` : le substitut charge directement la zone à ménager.
  - `lat-pulldown → lateral-raise` (`limitation_coude`, priorité 2) : change de
    pattern (tirage vertical → isolation épaule). La priorité 1
    (`straight-arm-pulldown`) est bonne — c'est le repli qui dérape, et il sort
    dès que la priorité 1 est déjà prise ailleurs dans la séance.
- Réalisé : ce qui reste après la passe du 2026-08-27. `workout/[id].tsx` écrit
  bien `workout_logs` / `set_logs`, et `creer_programme` remplit `profiles`
  (migration 007). Restent :
  - `cardio_logs` n'est écrit par personne. Les blocs cardio d'une séance sont
    affichés en lecture seule dans l'écran de séance, avec une mention
    explicite — ni chrono, ni distance, ni allure enregistrés.
  - `personal_records` : aucune détection de record. Comparaison au meilleur
    existant + mise à jour, à faire dans une passe dédiée.
  - `profiles.ratio_muscu_cardio` reste à sa valeur par défaut (50). Le moteur
    le calcule (`objectif_modifiers`) et `programGenerator.ts:187` demande de
    le réécrire sur le profil — pas fait, il n'était pas dans le périmètre.
  - Pas de note de fin de séance ni de ressenti (`workout_logs.note`,
    `ressenti`), volontairement.
  - Offline : écriture directe à chaque validation de série, aucune file
    d'attente. Une coupure réseau en pleine séance perd la série. Le
    `client_uuid` est posé sur `workout_logs` pour que la déduplication soit
    possible le jour où la synchro différée arrive — c'est la seule chose de
    l'offline qui existe aujourd'hui. Contradiction assumée avec la règle
    « offline-first obligatoire » du présent fichier, à lever avant TestFlight.
  - `duree_sec` compte depuis l'ouverture de l'écran, pas depuis
    `workout_logs.date_debut` : une séance reprise après un crash repart de
    zéro. À recaler sur la colonne quand l'offline sera traité.

- Édition du profil après l'onboarding : aucun champ n'est modifiable une fois
  le quiz passé. Limitations, 1RM, jours dispo, équipement et poids sont figés à
  vie sur `profiles`, alors que ce sont précisément les entrées du moteur — une
  blessure qui guérit, un 1RM qui monte ou un jour libéré n'ont aucun chemin
  pour remonter. L'onglet Profil (B10) ne pose volontairement que les deux
  préférences d'affichage. Chantier dédié : rééditer ces champs implique de
  décider quoi faire du programme en cours (le laisser tel quel, ou régénérer —
  ce qui rejoint le chantier fin de cycle / `program_cycles`).

- Notifications : `profiles.notifications_actives` est lu et écrit par l'onglet
  Profil, mais rien ne planifie de notification. Ni `expo-notifications`, ni
  demande de permission, ni programmation des rappels de séance. La préférence
  existe, l'effet non.

- Tagger des exercices en `home_gym` : aucun exercice du catalogue n'utilise ce
  niveau d'équipement, et tous les mouvements à la barre (back-squat, deadlift,
  bench-press, overhead-press, barbell-row) demandent `salle_complete`. Un
  profil `home_gym` perd donc tout le travail à la barre. L'option est retirée
  du quiz (`quiz/equipement.tsx`) en attendant, mais l'enum la garde.
- Migration 002 : la ligne seated-calf-raise → plank est mal pensée 
  (substitution qui change la nature du mouvement). À corriger.
- Insertion Supabase : `creer_programme` (migration 006, RPC atomique) est
  branchée — `creer-compte.tsx` appelle `enregistrerProgrammeEnAttente()`
  depuis le commit 3d98533. Vérifiée le 2026-08-22 sur le projet de dev
  (60 séances / 276 blocs), mais avec le profil de démo : reste à la repasser
  sur un profil venu du vrai quiz, une fois les 8 écrans posés. Test manuel :
  `npm run test:insertion` (voir en-tête du script pour les variables).
- ESLint : `expo lint` installe eslint + eslint-config-expo (2 devDependencies +
  réécriture du lockfile) et génère `eslint.config.js`. Décidé de le garder,
  mais après le quiz — pas pendant.
- Écran de connexion : n'existe pas. `creer-compte.tsx` est un signup
  post-achat, et le lien « J'ai déjà un compte » de la maquette A1 est absent
  d'`accroche.tsx`. Deux choses en dépendent, à traiter dans la même passe :
  - le lien A1 lui-même ;
  - **tester `signOut()` complet ⟵ nécessite l'écran de connexion.** Le bouton
    « Se déconnecter » de l'onglet Profil appelle `delierCompte()` puis
    `supabase.auth.signOut()` puis `router.replace('/accroche')`. Seul
    `delierCompte()` est vérifié (2026-08-27) : dérouler la déconnexion
    entière laisserait le simulateur sans session et sans moyen de revenir
    dans l'app autrement qu'en refaisant tout l'onboarding. Ne pas le tester
    tant que l'écran de connexion n'est pas posé.

## État d'avancement

- [x] Environnement Mac (Xcode, simulateur, Homebrew, Watchman, EAS CLI)
- [x] Projet Expo initialisé, build iOS validé sur simulateur
- [x] NativeWind + Supabase installés
- [ ] Config NativeWind (tailwind.config, babel, metro, global.css)
- [ ] Schéma Supabase + RLS
- [ ] Les 6 composants de base
- [x] Moteur de génération de programme
- [x] Persistance Supabase du programme (RPC 006, non branchée)
- [ ] Écran de séance live
- [ ] Onboarding + paywall
- [ ] RevenueCat
- [ ] TestFlight