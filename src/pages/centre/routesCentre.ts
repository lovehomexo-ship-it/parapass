// ═══════════════════════════════════════════════════════════════════════════
// Référentiel des routes de l'espace Centre DZ.
//
// Avant : les 16 écrans vivaient sous la seule URL /centre/dashboard et
// changeaient par état local → pas de favori, pas de lien partageable, le
// bouton retour du navigateur quittait l'application.
//
// Ici on garde les clés internes historiques (activeSection) et on leur associe
// un segment d'URL stable. Les composants enfants ne changent pas : ils
// continuent d'appeler onNavigate('validations'), c'est la page qui traduit.
// ═══════════════════════════════════════════════════════════════════════════

/** segment d'URL → clé interne (activeSection) */
export const URL_VERS_SECTION: Record<string, string> = {
  journee: 'dashboard',
  licencies: 'licencies',
  adhesions: 'demandes',
  sauts: 'sauts',
  briefing: 'briefing',
  planning: 'planning',
  equipe: 'equipe',
  pliage: 'pliage',
  tandem: 'tandem',
  attestations: 'validations',
  statistiques: 'stats',
  parametres: 'centre',
  modules: 'modules',
  academie: 'academy',
  finances: 'finances',
  messages: 'messages',
  journal: 'journal',
};

/** clé interne → segment d'URL (dérivée, pour ne jamais désynchroniser) */
export const SECTION_VERS_URL: Record<string, string> = Object.fromEntries(
  Object.entries(URL_VERS_SECTION).map(([url, section]) => [section, url])
);

/** Libellé affiché dans le fil d'Ariane et l'onglet du navigateur. */
export const LIBELLE_SECTION: Record<string, string> = {
  dashboard: 'Journée',
  licencies: 'Licenciés',
  demandes: 'Adhésions',
  sauts: 'Sauts',
  briefing: 'Briefing',
  planning: 'Planning',
  equipe: 'Équipe',
  pliage: 'Pliage',
  tandem: 'Tandem',
  validations: 'Attestations',
  stats: 'Statistiques',
  centre: 'Paramètres',
  modules: 'Modules',
  academy: 'Académie',
  finances: 'Finances',
  messages: 'Messages',
  journal: 'Journal de bord',
};

/** Sous-onglets adressables, par section. Le premier est celui par défaut. */
export const SOUS_ONGLETS: Record<string, readonly string[]> = {
  equipe: ['equipe', 'encadrement'],
  messages: ['conversations', 'relances'],
  academy: ['quiz', 'pac', 'brevets', 'documents'],
};

export const SECTION_DEFAUT = 'dashboard';
export const URL_DEFAUT = 'journee';

/** Traduit un segment d'URL en clé interne ; retombe sur la Journée si inconnu. */
export function sectionDepuisUrl(segment: string | undefined): string {
  if (!segment) return SECTION_DEFAUT;
  return URL_VERS_SECTION[segment] ?? SECTION_DEFAUT;
}

/** Construit l'URL d'un écran (avec sous-onglet facultatif). */
export function urlDeSection(section: string, sousOnglet?: string): string {
  const seg = SECTION_VERS_URL[section] ?? URL_DEFAUT;
  return sousOnglet ? `/centre/${seg}/${sousOnglet}` : `/centre/${seg}`;
}

/** Valide un sous-onglet pour une section donnée (sinon : le premier). */
export function sousOngletValide(section: string, valeur: string | undefined): string | undefined {
  const permis = SOUS_ONGLETS[section];
  if (!permis) return undefined;
  return valeur && permis.includes(valeur) ? valeur : permis[0];
}

/** Un identifiant de licencié ressemble à un UUID — sert à distinguer
 *  /centre/licencies/<uuid> d'un sous-onglet. */
export function estIdentifiant(v: string | undefined): boolean {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
