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
  - Offline : traité le 2026-08-30. L'état de la séance en cours vit dans
    AsyncStorage (`seanceLocale.ts`, logique pure et testée), les écritures
    sont locales d'abord, et `synchroniser()` (`seanceLive.ts`) pousse en
    tâche de fond — après chaque écriture, au démarrage (`_layout.tsx`) et au
    retour au premier plan. L'identifiant manipulé par l'écran est le
    `client_uuid`, pas l'`id` de `workout_logs` : la séance est démarrable et
    jouable sans réseau. La déduplication s'appuie sur les deux contraintes
    uniques existantes, vérifiées sur la base réelle — aucune migration.
    Corrigé au passage : l'écran ne relisait jamais le réalisé, une séance
    reprise après un redémarrage repartait de séries vierges alors qu'elles
    étaient en base.
    Hors périmètre, assumé : le cache de lecture ne couvre que la séance déjà
    chargée une fois (`prescrit.<session_id>`), pas le programme complet, et
    il n'a pas d'invalidation — à revoir avec `program_cycles`. Pas de
    NetInfo : l'échec de l'appel fait office de détection, chaque validation
    hors ligne tente donc un appel perdu.
  - `duree_sec` : recalé sur `debut_iso` de l'état local. Une séance reprise
    après un crash retrouve son chrono.

- L'état local de séance survivait à la déconnexion : les clés
  `seance.<client_uuid>` n'étaient purgées ni par `signOut()` ni au changement
  de compte, et une séance jamais synchronisée aurait été insérée sous le
  compte suivant (la RLS l'autorise, `user_id` valant `auth.uid()`). Corrigé le
  2026-08-31 : `deconnecter` fait une dernière `synchroniser()` sous la bonne
  session, puis `oublierSeancesLocales()` efface `seance.*` et `prescrit.*`
  avant `signOut()`. Vérifié sur simulateur, AsyncStorage revient vide.
  L'échec de la purge n'est pas attrapé — se déconnecter sans avoir purgé,
  c'est exactement la fuite qu'on évite. Durcissement possible mais non fait :
  porter le `user_id` dans `EtatSeance` et l'ignorer dans `pousser()` s'il ne
  correspond pas à la session courante. Aujourd'hui la purge suffit, changer de
  compte passant forcément par ce bouton.

- Un spinner de ~90 s a été observé sur l'onglet Profil le 2026-08-31, et
  attribué à tort à `statutAbonnement()`. Re-mesuré : l'écran se rend en moins
  de 2 s, carte abonnement comprise. La garde de rendu ne porte que sur
  `profil` et `bloc` — `abonnement` en est déjà exclu et `CarteAbonnement`
  affiche son propre « Chargement… ». Les 90 s venaient du partage de connexion
  instable de cette nuit-là, pas du code. Seule correction réelle apportée :
  `statutAbonnement()` part désormais en parallèle des lectures Supabase au
  lieu d'être sérialisé derrière, ce qui ne retardait que sa propre carte.

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
  (60 séances / 276 blocs) avec le profil de démo, puis le 2026-08-31 sur un
  profil venu du vrai quiz (hyrox / intermédiaire / 4 jours / salle complète /
  épaule → 48 séances, `profiles` rempli, `onboarding_complete` à `true`).
  Test manuel :
  `npm run test:insertion` (voir en-tête du script pour les variables).
- ESLint : `expo lint` installe eslint + eslint-config-expo (2 devDependencies +
  réécriture du lockfile) et génère `eslint.config.js`. Décidé de le garder,
  mais après le quiz — pas pendant.
- Écran de connexion : posé le 2026-08-31 (`(auth)/connexion.tsx`), avec le
  lien « J'ai déjà un compte » de la maquette A1 sur `accroche.tsx`.
  `signOut()` est désormais vérifié de bout en bout — quiz, création de compte,
  onglets, déconnexion, reconnexion, atterrissage sur les onglets avec le bon
  programme. Restent ouverts :
  - **Sign in with Apple : code écrit, provider non configuré.**
    `src/lib/auth.ts` porte `connexionAvecApple()`, partagée par la création de
    compte et la connexion — `signInWithIdToken` ne distingue pas les deux, et
    ce qui diffère est ce qui suit (insertion du programme d'un côté, rien de
    l'autre). `app.json` a le plugin et `ios.usesAppleSignIn`. Rien ne marchera
    tant que la capability « Sign in with Apple » (App ID + clé) côté Apple
    Developer Portal et le provider Apple (Team ID / Key ID / clé privée) côté
    Supabase ne sont pas faits. Le bouton n'apparaît pas sur un dev build
    antérieur à l'ajout du module natif : `isAvailableAsync()` échoue et le
    `.catch` le masque — dégradation voulue, pas un bug. Refaire `expo run:ios`.
  - Le bouton Apple utilise `AppleAuthenticationButton` (rendu imposé par la
    review Apple), pas le `Button` du design system. Deux boutons pleine
    largeur cohabitent donc sur ces écrans, l'accent et un blanc. La règle
    « une seule action accent » tient à la lettre, l'équilibre visuel est à
    trancher.
  - Pas de « mot de passe oublié », hors périmètre assumé.
  - `mailer_autoconfirm` est à `true` sur le projet : la branche « ton compte
    doit être confirmé » de `creer-compte.tsx` est morte tant que ce réglage
    tient. Gardée comme garde-fou.

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