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
  materiel: 'materiel',
  securite: 'securite',
  regles: 'regles',
  rotations: 'rotations',
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
  materiel: 'Matériel',
  securite: 'Sécurité',
  regles: 'Référentiel Feu Vert',
  rotations: 'Rotations',
};

/** Sous-onglets adressables, par section. Le premier est celui par défaut. */
export const SOUS_ONGLETS: Record<string, readonly string[]> = {
  equipe: ['equipe', 'encadrement'],
  messages: ['conversations', 'relances'],
  // Le premier est l'onglet par défaut : la PAC ouvre l'Académie, le quiz
  // vient en troisième, après la progression des brevets.
  academy: ['pac', 'brevets', 'quiz', 'questions', 'documents'],
};

// ═══════════════════════════════════════════════════════════════════════════
// REGROUPEMENTS DU MENU
//
// Vingt et une entrées dans la barre latérale, dont six qui allaient deux par
// deux : « Demandes d'adhésion » et « Attestation de carnet » sont deux
// dossiers qu'un licencié soumet et que la DZ doit signer ; « Sécurité » et
// « Référentiel Feu Vert » sont la veille et sa règle ; « Mes licenciés » et
// « Mon équipe » sont les gens.
//
// On ne DÉPLACE rien : chaque écran garde sa section, son URL, ses favoris.
// C'est la navigation qui se resserre — une entrée de menu, une barre
// d'onglets. « Activité des sauts » reste seule : elle ne se range sous
// aucune des trois.
// ═══════════════════════════════════════════════════════════════════════════

export interface OngletGroupe {
  readonly section: string;
  readonly label: string;
  /** Quand la section a elle-même des sous-onglets, on les remonte ICI plutôt
   *  que d'empiler deux barres — « Mon équipe » s'affichait deux fois. */
  readonly sousOnglet?: string;
}

export interface GroupeNav {
  /** Section ouverte au clic sur l'entrée de menu — la première du groupe. */
  readonly cle: string;
  readonly label: string;
  readonly onglets: readonly OngletGroupe[];
}

/** Clé d'onglet stable : une section, ou une section + son sous-onglet. */
export function cleOnglet(o: { section: string; sousOnglet?: string }): string {
  return o.sousOnglet ? `${o.section}:${o.sousOnglet}` : o.section;
}

export const GROUPES_NAV: readonly GroupeNav[] = [
  {
    cle: 'demandes',
    label: 'Demandes',
    onglets: [
      { section: 'demandes', label: "Demandes d'adhésion" },
      { section: 'validations', label: 'Attestations de carnet' },
    ],
  },
  {
    // Le référentiel d'abord : c'est la règle qu'on consulte, la veille n'est
    // que le registre de ce qui a déjà eu lieu.
    cle: 'regles',
    label: 'Sécurité',
    onglets: [
      { section: 'regles', label: 'Référentiel Feu Vert' },
      { section: 'securite', label: 'Veille sécurité' },
    ],
  },
  {
    cle: 'licencies',
    label: 'Licenciés & équipe',
    onglets: [
      { section: 'licencies', label: 'Mes licenciés' },
      { section: 'equipe', label: 'Encadrement du jour', sousOnglet: 'encadrement' },
      { section: 'equipe', label: 'Mon équipe', sousOnglet: 'equipe' },
    ],
  },
];

/** Le groupe auquel appartient une section, s'il y en a un. */
export function groupeDeSection(section: string): GroupeNav | undefined {
  return GROUPES_NAV.find(g => g.onglets.some(o => o.section === section));
}

/** Toutes les sections absorbées par un groupe — sauf la clé qui le représente. */
export const SECTIONS_GROUPEES: ReadonlySet<string> = new Set(
  GROUPES_NAV.flatMap(g => g.onglets.map(o => o.section)).filter(
    s => !GROUPES_NAV.some(g => g.cle === s)
  )
);

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

// ═══════════════════════════════════════════════════════════════════════════
// ORDRE DU MENU
//
// Il suivait l'ordre d'écriture des écrans, pas un usage. On lui donne une
// logique : LA JOURNÉE d'abord (préparer, voler, constater), puis LES GENS,
// puis LA FORMATION, puis LES MODULES MÉTIER, puis LE MATÉRIEL ET LA SÉCURITÉ,
// puis LES TRACES, et l'administration en dernier.
//
// Chaque centre peut ensuite la réécrire (`centres.ordre_menu`). Cet ordre
// stocké est PARTIEL par nature : un module souscrit plus tard — l'avionnage,
// le tandem — n'y figure pas et se range à sa place par défaut, sans que
// personne ait rien à refaire. Un module résilié y reste sans effet, et
// retrouve sa place si le centre y revient.
// ═══════════════════════════════════════════════════════════════════════════

export const ORDRE_MENU_DEFAUT: readonly string[] = [
  // La journée
  'dashboard', 'briefing', 'planning', 'rotations', 'sauts',
  // Les gens
  'licencies', 'demandes',
  // La formation
  'academy',
  // Les modules métier
  'pliage', 'tandem', 'finances',
  // Le matériel et la sécurité
  'materiel', 'regles',
  // Les traces
  'journal', 'stats',
  // L'administration
  'messages', 'centre', 'modules',
];

/**
 * Range les entrées du menu selon l'ordre du centre, puis l'ordre par défaut.
 *
 * Ce qu'aucun des deux ne nomme passe en fin de liste, dans l'ordre reçu :
 * un écran nouvellement ajouté au code apparaît, il ne disparaît jamais.
 */
export function ordonnerMenu<T extends { key: string }>(
  items: T[],
  ordreDuCentre: readonly string[] | null | undefined
): T[] {
  const rang = new Map<string, number>();
  (ordreDuCentre ?? []).forEach((cle, i) => { if (!rang.has(cle)) rang.set(cle, i); });
  const apres = rang.size;
  ORDRE_MENU_DEFAUT.forEach((cle, i) => { if (!rang.has(cle)) rang.set(cle, apres + i); });
  const fin = rang.size;
  return items
    .map((item, i) => ({ item, i, r: rang.get(item.key) ?? fin + i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.item);
}
