import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
} from 'react-native-purchases';

/**
 * Client RevenueCat.
 *
 * L'app ne connaît qu'un droit d'accès, `premium`, accordé aussi bien par
 * l'offre annuelle que par la mensuelle. Rien dans le code ne doit dépendre de
 * la formule active : changer de prix, ajouter une offre trimestrielle ou une
 * promo se fait alors entièrement depuis le tableau de bord RevenueCat, sans
 * livrer une nouvelle version sur l'App Store.
 *
 * Corollaire : aucun identifiant de produit n'est écrit ici. Les paquets sont
 * lus par leur type (`annual`, `monthly`) dans l'offering courant — c'est la
 * convention RevenueCat, et elle survit au renommage des produits.
 */
export const ENTITLEMENT = 'premium';

// `configure` est synchrone et ne joint pas le réseau : le coût à l'import est
// nul. Ce module n'est importé que par le paywall, donc rien ne démarre tant
// que l'utilisateur n'y arrive pas.
Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY! });

function actif(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT] !== undefined;
}

function estAnnulation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as PurchasesError).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
}

export type Offres = {
  annuel: PurchasesPackage | null;
  mensuel: PurchasesPackage | null;
};

/**
 * Les deux paquets de l'offering courant. Tant que le compte Apple n'est pas
 * validé et l'offering pas publié, les deux sont `null` — c'est un état normal,
 * pas une erreur.
 */
export async function chargerOffres(): Promise<Offres> {
  const { current } = await Purchases.getOfferings();
  return { annuel: current?.annual ?? null, mensuel: current?.monthly ?? null };
}

/** `true` si l'utilisateur a accès, quelle que soit la formule. */
export async function estAbonne(): Promise<boolean> {
  return actif(await Purchases.getCustomerInfo());
}

/**
 * Achat. Renvoie `false` si l'utilisateur a annulé — annuler n'est pas une
 * erreur et ne doit rien afficher. Les vrais échecs (carte refusée, réseau)
 * remontent en exception.
 */
export async function acheter(paquet: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(paquet);
    if (!actif(customerInfo)) {
      // StoreKit a validé mais RevenueCat n'accorde rien : le produit n'est pas
      // rattaché à l'entitlement dans le tableau de bord. Erreur de config, pas
      // d'utilisateur — la taire laisserait un abonné payant devant le paywall.
      throw new Error(
        `Paiement accepté mais l'accès n'a pas été accordé. Produit non rattaché à « ${ENTITLEMENT} » côté RevenueCat.`,
      );
    }
    return true;
  } catch (e) {
    if (estAnnulation(e)) return false;
    throw e;
  }
}

/** Obligatoire pour la review Apple. `true` si un abonnement a été retrouvé. */
export async function restaurer(): Promise<boolean> {
  return actif(await Purchases.restorePurchases());
}

/**
 * Rattache l'achat au compte Supabase.
 *
 * L'achat précède la création de compte dans le tunnel : il est donc fait sous
 * un identifiant RevenueCat anonyme. Sans ce rattachement, l'abonnement reste
 * collé à l'appareil et se perd à la réinstallation ou sur un second appareil.
 */
export async function lierCompte(idUtilisateur: string): Promise<void> {
  await Purchases.logIn(idUtilisateur);
}
