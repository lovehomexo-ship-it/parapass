export type NotationTernaire = 'a_retravailler' | 'correct' | 'bon' | null;

export interface Saut {
  id: string;
  parachutiste_id: string;
  date_saut: string;
  lieu: string;
  aeronef_immat: string;
  nature_saut: string;
  categorie: string;
  hauteur_m: number;
  hauteur_ouverture: number | null;
  fonction: string;
  parachute: string | null;
  observations: string | null;
  moniteur_id: string | null;
  valide_par: string | null;
  valide_le: string | null;
  statut: 'en_attente' | 'valide' | 'refuse' | 'historique' | 'declaration_honneur';
  source?: string | null;
  moniteur_nom_libre?: string | null;
  materiel_id?: string | null;
  nb_sauts_declares?: number | null;
  created_at: string;
  // Observations moniteur
  programme: string | null;
  voilure_principale: string | null;
  observations_moniteur: string | null;
  // Notation ternaire (a_retravailler / correct / bon)
  sortie_avion: NotationTernaire;
  retour_face_sol: NotationTernaire;
  vigilance_altitude: NotationTernaire;
  ouverture_notes: NotationTernaire;
  // Notation 1-5 par partie du corps
  position_tete: number | null;
  position_bassin: number | null;
  position_jambes: number | null;
  position_bras: number | null;
  position_globale: number | null;
  exercice_chute: string | null;
  exercice_voile: string | null;
  // Signature du moniteur
  signature_moniteur_url: string | null;
  // Intégrité
  validation_hash: string | null;
  validation_timestamp: string | null;
  certificat_url: string | null;
  is_tunnel: boolean;
  // Soufflerie — identifié via is_tunnel === true (source === 'soufflerie')
  tunnel_flight_minutes: number | null;
  tunnel_flight_count: number | null;
  tunnel_coach: string | null;
  tunnel_discipline: string | null;
}

export interface Centre {
  id: string;
  nom: string;
  ville: string;
  created_at: string;
}

export interface QrToken {
  id: string;
  parachutiste_id: string;
  token: string;
  created_at: string;
}

export interface Licence {
  id: string;
  parachutiste_id: string;
  numero_licence: string;
  date_delivrance: string | null;
  date_expiration: string | null;
  organisme: 'FFP' | 'DGAC' | 'autre';
  statut: 'actif' | 'expire' | 'suspendu';
  created_at: string;
  code_club: string | null;
  nom_club: string | null;
  beneficiaire_nom: string | null;
  beneficiaire_lien: 'conjoint' | 'enfant' | 'parent' | 'frere_soeur' | 'autre' | null;
  beneficiaire_telephone: string | null;
  assurance_individuelle: boolean;
  assurance_rc: boolean;
  tampon_dz_url: string | null;
  tampon_valide_par: string | null;
  tampon_date_validation: string | null;
  tampon_signature_url: string | null;
  tampon_statut: 'en_attente' | 'valide' | 'refuse';
  type_licence: 'lps' | 'lp' | 'lj' | 'ld' | null;
  // snapshot
  tampon_snapshot_url: string | null;
  tampon_timestamp: string | null;
  tampon_validateur_nom: string | null;
  tampon_hash: string | null;
}

export interface Brevet {
  id: string;
  parachutiste_id: string;
  type_brevet: 'A' | 'B' | 'BPA' | 'C' | 'D' | 'PAC' | 'tandem' | 'wingsuit' | 'voile_contact' | 'BASE' | 'indoor' | 'B1' | 'B2' | 'B3' | 'Bi4' | 'B4' | 'Bi5' | 'B5' | 'VH' | 'WS1' | 'WS2' | 'WS3';
  date_obtention: string;
  centre_delivrance: string;
  numero_brevet: string | null;
  scan_diplome_url: string | null;
  created_at: string;
}

export interface ModuleBrevet {
  id: string;
  parachutiste_id: string;
  type_brevet: string;
  code_module: string;
  nom_module: string;
  date_validation: string | null;
  lieu: string | null;
  validateur_nom: string | null;
  cachet_dt_url: string | null;
  signature_dt_url: string | null;
  est_facultatif: boolean;
  created_at: string;
}

export interface ContactUrgence {
  id: string;
  parachutiste_id: string;
  nom: string;
  telephone: string;
  adresse: string;
  created_at: string;
}

export interface Incident {
  id: string;
  parachutiste_id: string;
  date_incident: string;
  lieu: string;
  motif: string;
  created_at: string;
}

export interface InterdictionSaut {
  id: string;
  parachutiste_id: string;
  date_interdiction: string;
  duree: string;
  motif: string;
  cachet_url: string | null;
  signature_url: string | null;
  created_at: string;
}

export interface CertificatMedical {
  id: string;
  parachutiste_id: string;
  medecin: string;
  date_visite: string;
  date_expiration: string;
  type: 'aptitude_totale' | 'aptitude_restrictive' | 'inapte';
  scan_certificat_url: string | null;
  created_at: string;
}

export interface CentreLicencie {
  id: string;
  parachutiste_id: string;
  centre_id: string;
  date_adhesion: string;
  statut: 'actif' | 'inactif';
  numero_adhesion: string | null;
  carnet_statut: 'en_attente' | 'valide' | 'refuse';
  carnet_valide_par: string | null;
  carnet_date_validation: string | null;
  carnet_signature_url: string | null;
  carnet_tampon_url: string | null;
  carnet_motif_refus: string | null;
  centre?: Centre;
}

export interface Qualification {
  id: string;
  parachutiste_id: string;
  type: 'moniteur_tandem' | 'directeur_technique' | 'initiateur_VR' | 'initiateur_freestyle' | 'formateur_PAC' | 'largueur' | 'pilote_planeur';
  date_obtention: string;
  date_expiration: string | null;
  organisme_delivrance: string;
}

export interface Alerte {
  id: string;
  parachutiste_id: string;
  type: 'licence_expire' | 'certificat_medical' | 'materiel_revision' | 'saut_requis' | 'qualification_expire' | 'brevet_anniversaire';
  titre: string;
  message: string;
  date_echeance: string | null;
  urgence: 'critique' | 'attention' | 'info';
  lue: boolean;
  created_at: string;
}

export interface Badge {
  id: string;
  parachutiste_id: string;
  type_badge: string;
  date_obtention: string;
  notifie: boolean;
}

export interface Materiel {
  id: string;
  parachutiste_id: string;
  type: 'parachute_principal' | 'parachute_secours' | 'conteneur' | 'aad' | 'altimetre' | 'casque' | 'combinaison' | 'autre';
  marque: string;
  modele: string;
  numero_serie: string | null;
  date_fabrication: string | null;
  date_acquisition: string | null;
  statut: 'actif' | 'remise' | 'vendu' | 'hors_service';
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  maintenances?: Maintenance[];
}

export interface Maintenance {
  id: string;
  materiel_id: string;
  type_maintenance: 'pliage_secours' | 'revision_aad' | 'controle_altimetre' | 'inspection_conteneur' | 'autre';
  date_maintenance: string;
  prochain_echeance: string | null;
  technicien: string;
  centre: string | null;
  notes: string | null;
  document_url: string | null;
  created_at: string;
}

// ─── Label Maps ────────────────────────────────────────────────────────────────

export const NATURE_SAUT_LABELS: Record<string, string> = {
  entrainement: 'Entraînement',
  competition: 'Compétition',
  manifestation: 'Manifestation aérienne',
  travail_aerien: 'Travail aérien',
  nuit: 'Saut de nuit',
  largage: 'Largage',
  tandem: 'Tandem',
};

export const CATEGORIE_LABELS: Record<string, string> = {
  OA: 'OA - Ouverture Automatique',
  OC: 'OC - Ouverture Commandée',
  soufflerie: 'Soufflerie',
};

export const FONCTION_LABELS: Record<string, string> = {
  parachutiste: 'Parachutiste',
  eleve: 'Élève-Parachutiste',
  instructeur: 'Instructeur',
  largueur: 'Largueur',
};

export const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  valide: 'Validé',
  refuse: 'Refusé',
  historique: 'Historique',
  declaration_honneur: 'Déclaration',
};

export const TYPE_BREVET_LABELS: Record<string, string> = {
  A: 'Brevet A',
  B: 'Brevet B',
  BPA: 'BPA',
  C: 'Brevet C',
  D: 'Brevet D',
  PAC: 'PAC',
  tandem: 'Tandem',
  wingsuit: 'Wingsuit',
  voile_contact: 'Voile Contact',
  BASE: 'BASE',
  indoor: 'Indoor',
  B1: 'B1 — PA / Voltige',
  B2: 'B2 — Vol Relatif',
  B3: 'B3 — Voile Contact',
  Bi4: 'Bi4 — Tête en haut / Track',
  B4: 'B4 — Free Fly / Free Style',
  Bi5: 'Bi5 — Posé en survitesse N2',
  B5: 'B5 — Pilotage sous voile',
  VH: 'VH — Voilure Hybride',
  WS1: 'WS Niv.1 — Wingsuit débutant',
  WS2: 'WS Niv.2 — Wingsuit confirmé',
  WS3: 'WS Niv.3 — Wingsuit expert',
};

// Définition des modules par type de brevet (carnet papier FFP)
export interface ModuleDefinition {
  code: string;
  nom: string;
  facultatif?: boolean;
}

export const MODULES_PAR_BREVET: Record<string, ModuleDefinition[]> = {
  BPA: [
    { code: 'BPA_sol', nom: 'Capacités au sol' },
    { code: 'BPA_vol', nom: 'Capacités en vol' },
    { code: 'BPA_voile', nom: 'Capacités sous voile' },
    { code: 'BPA_theo', nom: 'Connaissances théoriques' },
    { code: 'BPA', nom: 'BPA final (Attestation formation annexe 4 DT49)' },
  ],
  A: [
    { code: 'Av', nom: 'Capacités sous voile' },
    { code: 'Ac', nom: 'Capacités en chute' },
    { code: 'A_annexe3', nom: 'Annexe 3 DT49 — Révision de formation' },
    { code: 'A', nom: 'Brevet A final' },
  ],
  B: [
    { code: 'Bv', nom: 'Capacités sous voile' },
    { code: 'Bc', nom: 'Capacités en chute' },
    { code: 'Bp', nom: 'Capacité à plier son parachute' },
    { code: 'B', nom: 'Brevet B final' },
    { code: 'Cav', nom: 'Capacité auto-vérification pliage', facultatif: true },
  ],
  C: [
    { code: 'C_sol', nom: 'Capacités au sol' },
    { code: 'C_vol', nom: 'Capacités en vol' },
    { code: 'C_theo', nom: 'Connaissances théoriques' },
    { code: 'C', nom: 'Brevet C final' },
  ],
  D: [
    { code: 'D_largage', nom: 'Largage et capacités sous voile' },
    { code: 'D_theo', nom: 'Connaissances théoriques' },
    { code: 'D', nom: 'Brevet D final' },
  ],
  B1: [{ code: 'B1_loisir', nom: 'B1 loisir' }, { code: 'B1_compet', nom: 'B1 compétition' }],
  B2: [{ code: 'B2_loisir', nom: 'B2 loisir' }, { code: 'B2_compet', nom: 'B2 compétition' }],
  B3: [{ code: 'B3_loisir', nom: 'B3 loisir' }, { code: 'B3_compet', nom: 'B3 compétition' }],
  Bi4: [{ code: 'Bi4_loisir', nom: 'Bi4 loisir' }, { code: 'Bi4_compet', nom: 'Bi4 compétition' }],
  B4: [{ code: 'B4_loisir', nom: 'B4 loisir' }, { code: 'B4_compet', nom: 'B4 compétition' }],
  Bi5: [{ code: 'Bi5', nom: 'Posé en survitesse catégorie N2' }],
  B5: [{ code: 'B5_loisir', nom: 'B5 loisir' }, { code: 'B5_compet', nom: 'B5 compétition' }],
  VH: [{ code: 'VH', nom: 'Aptitude voilure hybride' }],
  WS1: [{ code: 'WS1', nom: 'Vol wingsuit débutant' }],
  WS2: [{ code: 'WS2', nom: 'Vol wingsuit confirmé' }],
  WS3: [{ code: 'WS3', nom: 'Vol wingsuit expert' }],
};

export const TYPE_MATERIEL_LABELS: Record<string, string> = {
  parachute_principal: 'Parachute principal',
  parachute_secours: 'Parachute de secours',
  conteneur: 'Conteneur',
  aad: 'AAD (Cypres/MARS)',
  altimetre: 'Altimètre',
  casque: 'Casque',
  combinaison: 'Combinaison',
  autre: 'Autre',
};

export const TYPE_MAINTENANCE_LABELS: Record<string, string> = {
  pliage_secours: 'Pliage secours',
  revision_aad: 'Révision AAD',
  controle_altimetre: 'Contrôle altimètre',
  inspection_conteneur: 'Inspection conteneur',
  autre: 'Autre',
};

export const QUALIFICATION_LABELS: Record<string, string> = {
  moniteur_tandem: 'Moniteur Tandem',
  directeur_technique: 'Directeur Technique',
  initiateur_VR: 'Initiateur VR',
  initiateur_freestyle: 'Initiateur Freestyle',
  formateur_PAC: 'Formateur PAC',
  largueur: 'Largueur',
  pilote_planeur: 'Pilote planeur',
};

// ─── Badge definitions ─────────────────────────────────────────────────────────

export interface BadgeDefinition {
  type: string;
  nom: string;
  description: string;
  icone: string;
  categorie: 'volume' | 'discipline' | 'temporel' | 'figures_vr' | 'figures_freefly' | 'figures_tracking' | 'figures_belly' | 'disciplines_speciales' | 'equipement';
  couleur: string;
  rarete: 'commun' | 'rare' | 'epique' | 'legendaire';
}

export const BADGES: BadgeDefinition[] = [
  // ── Volume ──────────────────────────────────────────────────────────────────
  { type: 'premier_saut', nom: 'Premier saut', description: '1 saut', icone: '🪂', categorie: 'volume', couleur: '#64748B', rarete: 'commun' },
  { type: 'decollage', nom: 'Décollage', description: '10 sauts', icone: '🚀', categorie: 'volume', couleur: '#64748B', rarete: 'commun' },
  { type: 'en_route', nom: 'En route', description: '25 sauts', icone: '🛫', categorie: 'volume', couleur: '#64748B', rarete: 'commun' },
  { type: 'confirme', nom: 'Confirmé', description: '50 sauts', icone: '⭐', categorie: 'volume', couleur: '#16A34A', rarete: 'rare' },
  { type: 'centenaire', nom: 'Centenaire', description: '100 sauts', icone: '💯', categorie: 'volume', couleur: '#16A34A', rarete: 'rare' },
  { type: 'veteran', nom: 'Vétéran', description: '200 sauts', icone: '🏅', categorie: 'volume', couleur: '#2563EB', rarete: 'epique' },
  { type: 'expert', nom: 'Expert', description: '300 sauts', icone: '🥈', categorie: 'volume', couleur: '#2563EB', rarete: 'epique' },
  { type: 'maitre', nom: 'Maître', description: '500 sauts', icone: '🥇', categorie: 'volume', couleur: '#7C3AED', rarete: 'epique' },
  { type: 'legende', nom: 'Légende', description: '1 000 sauts', icone: '🏆', categorie: 'volume', couleur: '#D97706', rarete: 'legendaire' },
  { type: 'icone', nom: 'Icône', description: '2 000 sauts', icone: '👑', categorie: 'volume', couleur: '#D97706', rarete: 'legendaire' },
  { type: 'mythe', nom: 'Mythe', description: '5 000 sauts', icone: '🌟', categorie: 'volume', couleur: '#D97706', rarete: 'legendaire' },
  { type: 'immortel', nom: 'Immortel', description: '10 000 sauts', icone: '⚡', categorie: 'volume', couleur: '#D97706', rarete: 'legendaire' },

  // ── Discipline générale ──────────────────────────────────────────────────────
  { type: 'noctambule', nom: 'Noctambule', description: '1er saut de nuit', icone: '🌙', categorie: 'discipline', couleur: '#2563EB', rarete: 'epique' },
  { type: 'aile', nom: 'Ailé', description: '1er saut wingsuit', icone: '🦅', categorie: 'discipline', couleur: '#2563EB', rarete: 'epique' },
  { type: 'instructeur_badge', nom: 'Instructeur', description: "1er saut en tant qu'instructeur", icone: '🎓', categorie: 'discipline', couleur: '#16A34A', rarete: 'rare' },
  { type: 'tandem_badge', nom: 'Tandem', description: '1er saut tandem', icone: '👥', categorie: 'discipline', couleur: '#64748B', rarete: 'commun' },
  { type: 'competiteur', nom: 'Compétiteur', description: '1er saut en compétition', icone: '🎯', categorie: 'discipline', couleur: '#16A34A', rarete: 'rare' },
  { type: 'globetrotter', nom: 'Globetrotter', description: 'Sauts dans 3 dropzones différentes', icone: '🌍', categorie: 'discipline', couleur: '#16A34A', rarete: 'rare' },
  { type: 'explorateur', nom: 'Explorateur', description: 'Sauts dans 10 dropzones', icone: '🗺️', categorie: 'discipline', couleur: '#2563EB', rarete: 'epique' },
  { type: 'fidele', nom: 'Fidèle', description: '50 sauts dans la même dropzone', icone: '❤️', categorie: 'discipline', couleur: '#16A34A', rarete: 'rare' },
  { type: 'altitude_max', nom: 'Altitude max', description: '1er saut au-dessus de 5 000m', icone: '⛰️', categorie: 'discipline', couleur: '#D97706', rarete: 'legendaire' },

  // ── Temporel ─────────────────────────────────────────────────────────────────
  { type: 'anniversaire_1an', nom: 'Anniversaire 1 an', description: '1 an depuis le 1er saut', icone: '🎂', categorie: 'temporel', couleur: '#64748B', rarete: 'commun' },
  { type: 'anniversaire_5ans', nom: 'Anniversaire 5 ans', description: '5 ans depuis le 1er saut', icone: '🎉', categorie: 'temporel', couleur: '#16A34A', rarete: 'rare' },
  { type: 'saison_active', nom: 'Saison active', description: '20 sauts en 1 mois', icone: '🔥', categorie: 'temporel', couleur: '#2563EB', rarete: 'epique' },
  { type: 'regulier', nom: 'Régulier', description: '1 saut/mois pendant 6 mois consécutifs', icone: '📅', categorie: 'temporel', couleur: '#16A34A', rarete: 'rare' },

  // ── Figures VR (Voile Relative) ───────────────────────────────────────────────
  { type: 'vr_first_formation', nom: 'Première formation', description: '1 saut VR / FS enregistré', icone: '🔵', categorie: 'figures_vr', couleur: '#2563EB', rarete: 'commun' },
  { type: 'vr_2way', nom: 'Duo dans les airs', description: 'VR 2-way enregistré', icone: '✌️', categorie: 'figures_vr', couleur: '#2563EB', rarete: 'commun' },
  { type: 'vr_4way', nom: 'Carré magique', description: 'VR 4-way enregistré', icone: '🟦', categorie: 'figures_vr', couleur: '#16A34A', rarete: 'rare' },
  { type: 'vr_8way', nom: 'Octopus', description: 'VR 8-way enregistré', icone: '🐙', categorie: 'figures_vr', couleur: '#16A34A', rarete: 'rare' },
  { type: 'vr_4way_10x', nom: 'Formation addict', description: '10 sauts VR 4-way', icone: '🔟', categorie: 'figures_vr', couleur: '#D97706', rarete: 'epique' },
  { type: 'vr_sequential', nom: 'Séquenceur', description: 'Séquence VR enregistrée', icone: '⚡', categorie: 'figures_vr', couleur: '#D97706', rarete: 'epique' },
  { type: 'vr_rw_specialist', nom: 'Spécialiste RW', description: '50 sauts VR au total', icone: '🏅', categorie: 'figures_vr', couleur: '#D97706', rarete: 'legendaire' },

  // ── Figures Freefly ───────────────────────────────────────────────────────────
  { type: 'ff_first_sit', nom: 'Assis dans le vide', description: '1er saut en sit-fly', icone: '🪑', categorie: 'figures_freefly', couleur: '#F97316', rarete: 'commun' },
  { type: 'ff_first_head_down', nom: 'Tête en bas', description: '1er saut en head-down', icone: '⬇️', categorie: 'figures_freefly', couleur: '#16A34A', rarete: 'rare' },
  { type: 'ff_head_up_stable', nom: "Colonne d'air", description: '1er saut en head-up stable', icone: '⬆️', categorie: 'figures_freefly', couleur: '#16A34A', rarete: 'rare' },
  { type: 'ff_tube', nom: 'Dans le tube', description: 'Figure tube/puck enregistrée', icone: '🎯', categorie: 'figures_freefly', couleur: '#D97706', rarete: 'epique' },
  { type: 'ff_dynamic', nom: 'Dynamique', description: 'Dynamic freefly enregistré', icone: '💨', categorie: 'figures_freefly', couleur: '#D97706', rarete: 'epique' },
  { type: 'ff_specialist', nom: 'Maître du freefly', description: '50 sauts freefly au total', icone: '🦁', categorie: 'figures_freefly', couleur: '#D97706', rarete: 'legendaire' },

  // ── Figures Tracking / Angle ──────────────────────────────────────────────────
  { type: 'track_first', nom: 'Premier angle', description: '1er saut tracking enregistré', icone: '↗️', categorie: 'figures_tracking', couleur: '#16A34A', rarete: 'commun' },
  { type: 'track_group', nom: 'Meute volante', description: 'Tracking groupe 3+ enregistré', icone: '🐺', categorie: 'figures_tracking', couleur: '#16A34A', rarete: 'rare' },
  { type: 'track_angle_dive', nom: 'Angle plongé', description: 'Angle dive enregistré', icone: '🏹', categorie: 'figures_tracking', couleur: '#D97706', rarete: 'epique' },

  // ── Figures Belly / Solo ──────────────────────────────────────────────────────
  { type: 'belly_first_stable', nom: 'Stable et libre', description: 'Première chute libre stable', icone: '🕊️', categorie: 'figures_belly', couleur: '#64748B', rarete: 'commun' },
  { type: 'belly_backfly', nom: 'Dos au ciel', description: '1er dos stable enregistré', icone: '🔄', categorie: 'figures_belly', couleur: '#16A34A', rarete: 'rare' },
  { type: 'belly_flip', nom: 'Tonneau', description: 'Tonneau enregistré', icone: '🌀', categorie: 'figures_belly', couleur: '#16A34A', rarete: 'rare' },
  { type: 'belly_delta', nom: 'Delta', description: 'Position delta enregistrée', icone: '🔺', categorie: 'figures_belly', couleur: '#16A34A', rarete: 'rare' },
  { type: 'belly_track_solo', nom: 'Flèche solitaire', description: 'Tracking solo — 10 sauts', icone: '🏃', categorie: 'figures_belly', couleur: '#D97706', rarete: 'epique' },

  // ── Disciplines spéciales ─────────────────────────────────────────────────────
  { type: 'canopy_first_hook', nom: 'Crochet ouvert', description: '1er virage serré enregistré', icone: '🪝', categorie: 'disciplines_speciales', couleur: '#64748B', rarete: 'commun' },
  { type: 'canopy_swoop', nom: 'Swoop', description: 'Swoop enregistré', icone: '⚡', categorie: 'disciplines_speciales', couleur: '#D97706', rarete: 'epique' },
  { type: 'wingsuit_first', nom: 'Homme-oiseau', description: '1er saut wingsuit', icone: '🦇', categorie: 'disciplines_speciales', couleur: '#16A34A', rarete: 'rare' },
  { type: 'wingsuit_formation', nom: "Vol en escadrille", description: 'Wingsuit formation 2+', icone: '🦅', categorie: 'disciplines_speciales', couleur: '#D97706', rarete: 'epique' },
  { type: 'speed_first', nom: 'Vitesse pure', description: '1er saut speed enregistré', icone: '💨', categorie: 'disciplines_speciales', couleur: '#16A34A', rarete: 'rare' },

  // ── Caméra & Équipement ───────────────────────────────────────────────────────
  { type: 'camera_first_jump', nom: "Œil dans le ciel", description: '1er saut avec caméra déclarée', icone: '📷', categorie: 'equipement', couleur: '#64748B', rarete: 'commun' },
  { type: 'camera_10_jumps', nom: 'Vidéaste confirmé', description: '10 sauts avec caméra', icone: '🎬', categorie: 'equipement', couleur: '#16A34A', rarete: 'rare' },
  { type: 'camera_50_jumps', nom: 'Cinéaste du vide', description: '50 sauts avec caméra', icone: '🎥', categorie: 'equipement', couleur: '#D97706', rarete: 'epique' },
  { type: 'camera_tandem_pro', nom: 'Tandem vidéo', description: '20 sauts caméra tandem', icone: '🎦', categorie: 'equipement', couleur: '#D97706', rarete: 'epique' },
  { type: 'gopro_head', nom: 'GoPro head-cam', description: 'Saut avec caméra casque', icone: '🎮', categorie: 'equipement', couleur: '#64748B', rarete: 'commun' },
  { type: 'two_cameras', nom: 'Double optique', description: 'Saut avec 2 caméras déclarées', icone: '📸', categorie: 'equipement', couleur: '#16A34A', rarete: 'rare' },
];

