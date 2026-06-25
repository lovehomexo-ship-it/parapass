import type { Profile } from '../lib/auth';
import type { Saut, Licence, Brevet, CertificatMedical, CentreLicencie, Qualification, ModuleBrevet, Alerte, Badge, Materiel, Maintenance } from '../lib/types';

// ─── Demo Profile ────────────────────────────────────────────────────────────

export const DEMO_PROFILE: Profile = {
  id: 'demo-user-sophie-martin',
  email: 'sophie.martin@demo.fr',
  nom: 'MARTIN',
  prenom: 'Sophie',
  role: 'parachutiste',
  centre_id: 'demo-centre-bigair',
  admin_centre_id: null,
  numero_licence: 'FFP-2021-08734',
  type_pratiquant: 'amateur',
  date_naissance: '1992-03-14',
  lieu_naissance: 'Bordeaux',
  nationalite: 'Française',
  signature_url: null,
  created_at: '2021-09-15T10:00:00Z',
  avatar_url: null,
};

// Fake Supabase User object
export const DEMO_USER = {
  id: 'demo-user-sophie-martin',
  email: 'sophie.martin@demo.fr',
  created_at: '2021-09-15T10:00:00Z',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
} as unknown as import('@supabase/supabase-js').User;

// ─── Licence ─────────────────────────────────────────────────────────────────

export const DEMO_LICENCES: Licence[] = [
  {
    id: 'demo-licence-1',
    parachutiste_id: DEMO_PROFILE.id,
    numero_licence: 'FFP-2021-08734',
    date_delivrance: '2021-09-01',
    date_expiration: '2026-12-31',
    organisme: 'FFP',
    statut: 'actif',
    created_at: '2021-09-01T10:00:00Z',
    code_club: '0916',
    nom_club: 'BigAir Rochefort',
    beneficiaire_nom: 'Pierre MARTIN',
    beneficiaire_lien: 'parent',
    beneficiaire_telephone: '06 XX XX XX XX',
    assurance_individuelle: true,
    assurance_rc: true,
    tampon_dz_url: null,
    tampon_valide_par: 'Johnny Guerin',
    tampon_date_validation: '2026-05-10',
    tampon_signature_url: null,
    tampon_statut: 'valide',
    type_licence: 'lp',
    tampon_snapshot_url: null,
    tampon_timestamp: '2026-05-10T14:30:00Z',
    tampon_validateur_nom: 'Johnny Guerin',
    tampon_hash: 'a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6',
  },
];

// ─── Certificat médical ───────────────────────────────────────────────────────

export const DEMO_CERTIFICATS: CertificatMedical[] = [
  {
    id: 'demo-cert-1',
    parachutiste_id: DEMO_PROFILE.id,
    medecin: 'Dr. Dubois',
    date_visite: '2026-03-15',
    date_expiration: '2027-03-15',
    type: 'aptitude_totale',
    scan_certificat_url: null,
    created_at: '2026-03-15T09:00:00Z',
  },
];

// ─── Brevets ──────────────────────────────────────────────────────────────────

export const DEMO_BREVETS: Brevet[] = [
  {
    id: 'demo-brevet-b',
    parachutiste_id: DEMO_PROFILE.id,
    type_brevet: 'B',
    date_obtention: '2022-06-08',
    centre_delivrance: 'BigAir Rochefort',
    numero_brevet: 'B-2022-04521',
    scan_diplome_url: null,
    created_at: '2022-06-08T10:00:00Z',
  },
  {
    id: 'demo-brevet-a',
    parachutiste_id: DEMO_PROFILE.id,
    type_brevet: 'A',
    date_obtention: '2021-11-12',
    centre_delivrance: 'BigAir Rochefort',
    numero_brevet: 'A-2021-08201',
    scan_diplome_url: null,
    created_at: '2021-11-12T10:00:00Z',
  },
];

// ─── Qualifications ───────────────────────────────────────────────────────────

export const DEMO_QUALIFICATIONS: Qualification[] = [
  {
    id: 'demo-qual-b2',
    parachutiste_id: DEMO_PROFILE.id,
    type: 'initiateur_VR' as Qualification['type'],
    date_obtention: '2023-04-15',
    date_expiration: null,
    organisme_delivrance: 'FFP',
  },
];

// ─── Centres liés ─────────────────────────────────────────────────────────────

export const DEMO_CENTRES_LICENCIES: CentreLicencie[] = [
  {
    id: 'demo-cl-1',
    parachutiste_id: DEMO_PROFILE.id,
    centre_id: 'demo-centre-bigair',
    date_adhesion: '2021-09-15',
    statut: 'actif',
    numero_adhesion: 'ADH-0916-2021-0342',
    centre: { id: 'demo-centre-bigair', nom: 'BigAir Rochefort', ville: 'Rochefort', created_at: '2020-01-01T00:00:00Z' },
  },
];

// ─── Modules brevet C (en cours) ─────────────────────────────────────────────

export const DEMO_MODULES: ModuleBrevet[] = [
  {
    id: 'demo-mod-1',
    parachutiste_id: DEMO_PROFILE.id,
    type_brevet: 'C',
    code_module: 'C-SOL',
    nom_module: 'Capacités au sol',
    date_validation: '2026-01-12',
    lieu: 'BigAir Rochefort',
    validateur_nom: 'Johnny Guerin',
    cachet_dt_url: null,
    signature_dt_url: null,
    est_facultatif: false,
    created_at: '2026-01-12T10:00:00Z',
  },
  {
    id: 'demo-mod-2',
    parachutiste_id: DEMO_PROFILE.id,
    type_brevet: 'C',
    code_module: 'C-VOL',
    nom_module: 'Capacités en vol',
    date_validation: '2026-02-28',
    lieu: 'BigAir Rochefort',
    validateur_nom: 'Johnny Guerin',
    cachet_dt_url: null,
    signature_dt_url: null,
    est_facultatif: false,
    created_at: '2026-02-28T10:00:00Z',
  },
  {
    id: 'demo-mod-3',
    parachutiste_id: DEMO_PROFILE.id,
    type_brevet: 'C',
    code_module: 'C-THEO',
    nom_module: 'Connaissances théoriques',
    date_validation: null,
    lieu: null,
    validateur_nom: null,
    cachet_dt_url: null,
    signature_dt_url: null,
    est_facultatif: false,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'demo-mod-4',
    parachutiste_id: DEMO_PROFILE.id,
    type_brevet: 'C',
    code_module: 'C-FINAL',
    nom_module: 'C Final',
    date_validation: null,
    lieu: null,
    validateur_nom: null,
    cachet_dt_url: null,
    signature_dt_url: null,
    est_facultatif: false,
    created_at: '2026-01-01T00:00:00Z',
  },
];

// ─── Sauts (20) ───────────────────────────────────────────────────────────────

function makeSaut(
  num: number,
  date: string,
  lieu: string,
  aeronef: string,
  hauteur: number,
  nature: string,
  categorie: string,
  programme: string,
  statut: 'valide' | 'en_attente',
  validePar?: string
): Saut {
  return {
    id: `demo-saut-${num}`,
    parachutiste_id: DEMO_PROFILE.id,
    date_saut: date,
    lieu,
    aeronef_immat: aeronef,
    nature_saut: nature,
    categorie,
    hauteur_m: hauteur,
    fonction: 'parachutiste',
    parachute: 'Sabre 2 150',
    observations: null,
    moniteur_id: null,
    valide_par: statut === 'valide' ? (validePar ?? 'Johnny Guerin') : null,
    valide_le: statut === 'valide' ? date : null,
    statut,
    materiel_id: null,
    created_at: `${date}T10:00:00Z`,
    programme,
    voilure_principale: 'Sabre 2 150',
    observations_moniteur: statut === 'valide' ? 'Bon saut, bonne maîtrise.' : null,
    sortie_avion: statut === 'valide' ? 'bon' : null,
    retour_face_sol: statut === 'valide' ? 'bon' : null,
    vigilance_altitude: statut === 'valide' ? 'bon' : null,
    ouverture_notes: statut === 'valide' ? 'bon' : null,
    position_tete: statut === 'valide' ? 5 : null,
    position_bassin: statut === 'valide' ? 4 : null,
    position_jambes: statut === 'valide' ? 5 : null,
    position_bras: statut === 'valide' ? 4 : null,
    position_globale: statut === 'valide' ? 5 : null,
    exercice_chute: programme,
    exercice_voile: 'Approche précise, posé dans le cercle',
    signature_moniteur_url: null,
    validation_hash: statut === 'valide' ? `${num}a3f2b1c4d5e6` : null,
    validation_timestamp: statut === 'valide' ? `${date}T12:00:00Z` : null,
    certificat_url: null,
  };
}

export const DEMO_SAUTS: Saut[] = [
  makeSaut(247, '2026-05-18', 'BigAir Rochefort', 'F-HBGP', 4200, 'Entraînement', 'OC', 'Vol Relatif 4-way — Formation réussie, transitions fluides', 'valide', 'Johnny Guerin'),
  makeSaut(246, '2026-05-10', 'Gap-Tallard', 'F-GCBT', 4000, 'Compétition', 'OC', 'Compétition VR4 — Résultats satisfaisants', 'valide', 'Jean Moreau'),
  makeSaut(245, '2026-05-03', 'BigAir Rochefort', 'F-HBGP', 3800, 'Entraînement', 'OA', 'Exercice de précision à l\'atterrissage', 'valide', 'Johnny Guerin'),
  makeSaut(244, '2026-04-26', 'Saintes', 'F-BTRZ', 4200, 'Entraînement', 'OR>60"', 'Vol libre 75 secondes — bonne stabilité', 'valide', 'Marc Dupont'),
  makeSaut(243, '2026-04-19', 'BigAir Rochefort', 'F-HBGP', 4000, 'Entraînement', 'OC', 'Formation 2-way en cours', 'en_attente'),
  makeSaut(242, '2026-04-12', 'BigAir Rochefort', 'F-HBGP', 4200, 'Entraînement', 'OC', 'Vol Relatif 2-way', 'valide', 'Johnny Guerin'),
  makeSaut(241, '2026-04-05', 'Dole-Tavaux', 'F-GDRT', 4000, 'Loisir', 'OA', 'Saut loisir, beau temps', 'valide', 'Pierre Leroy'),
  makeSaut(240, '2026-03-22', 'BigAir Rochefort', 'F-HBGP', 3800, 'Entraînement', 'OA', 'Chute libre — travail corps', 'valide', 'Johnny Guerin'),
  makeSaut(239, '2026-03-15', 'Chambéry-Aix', 'F-GCBZ', 4500, 'Loisir', 'OC', 'Saut panoramique avec vue Alpes', 'valide', 'Sophie Blanc'),
  makeSaut(238, '2026-02-28', 'BigAir Rochefort', 'F-HBGP', 4000, 'Entraînement', 'OR>60"', 'Retour après pause hivernale', 'valide', 'Johnny Guerin'),
  makeSaut(237, '2025-11-08', 'BigAir Rochefort', 'F-HBGP', 3800, 'Entraînement', 'OA', 'Dernier saut de saison', 'valide', 'Johnny Guerin'),
  makeSaut(236, '2025-10-25', 'Gap-Tallard', 'F-GCBT', 4200, 'Compétition', 'OC', 'Finale régionale VR4', 'valide', 'Jean Moreau'),
  makeSaut(235, '2025-10-12', 'BigAir Rochefort', 'F-HBGP', 4000, 'Entraînement', 'OC', 'Entraînement compétition', 'valide', 'Johnny Guerin'),
  makeSaut(234, '2025-09-28', 'Saintes', 'F-BTRZ', 4200, 'Entraînement', 'OR>60"', 'Vol libre longue durée', 'valide', 'Marc Dupont'),
  makeSaut(233, '2025-09-14', 'BigAir Rochefort', 'F-HBGP', 3800, 'Loisir', 'OA', 'Week-end saut', 'valide', 'Johnny Guerin'),
  makeSaut(232, '2025-08-22', 'Chambéry-Aix', 'F-GCBZ', 4500, 'Loisir', 'OC', 'Saut en vacances', 'valide', 'Sophie Blanc'),
  makeSaut(231, '2025-08-08', 'BigAir Rochefort', 'F-HBGP', 4200, 'Entraînement', 'OC', 'Vol Relatif 4-way', 'valide', 'Johnny Guerin'),
  makeSaut(230, '2025-07-19', 'Dole-Tavaux', 'F-GDRT', 4000, 'Loisir', 'OA', 'Découverte nouvelle DZ', 'valide', 'Pierre Leroy'),
  makeSaut(229, '2025-07-05', 'BigAir Rochefort', 'F-HBGP', 3800, 'Entraînement', 'OR>60"', 'Travail vol libre', 'valide', 'Johnny Guerin'),
  makeSaut(228, '2025-06-21', 'Gap-Tallard', 'F-GCBT', 4200, 'Compétition', 'OC', 'Championnat régional — qualifications', 'valide', 'Jean Moreau'),
];

// ─── Alertes démo ─────────────────────────────────────────────────────────────

export const DEMO_ALERTES: Alerte[] = [
  {
    id: 'demo-alerte-1',
    parachutiste_id: DEMO_PROFILE.id,
    type: 'materiel_revision',
    titre: 'Parachute de secours — révision requise',
    message: 'Votre parachute de secours (Optimum 160) doit être replié. Échéance dépassée de 3 jours (15/05/2026).',
    date_echeance: '2026-05-15',
    urgence: 'critique',
    lue: false,
    created_at: '2026-05-18T10:00:00Z',
  },
];

// ─── Badges démo ─────────────────────────────────────────────────────────────

export const DEMO_BADGES: Badge[] = [
  { id: 'db-1', parachutiste_id: DEMO_PROFILE.id, type_badge: 'volume_100', date_obtention: '2023-04-12', notifie: true },
  { id: 'db-2', parachutiste_id: DEMO_PROFILE.id, type_badge: 'volume_200', date_obtention: '2026-01-08', notifie: true },
  { id: 'db-3', parachutiste_id: DEMO_PROFILE.id, type_badge: 'volume_50', date_obtention: '2022-09-15', notifie: true },
  { id: 'db-4', parachutiste_id: DEMO_PROFILE.id, type_badge: 'volume_25', date_obtention: '2022-04-20', notifie: true },
  { id: 'db-5', parachutiste_id: DEMO_PROFILE.id, type_badge: 'volume_10', date_obtention: '2022-01-10', notifie: true },
  { id: 'db-6', parachutiste_id: DEMO_PROFILE.id, type_badge: 'volume_1', date_obtention: '2021-11-12', notifie: true },
  { id: 'db-7', parachutiste_id: DEMO_PROFILE.id, type_badge: 'discipline_competition', date_obtention: '2023-07-15', notifie: true },
  { id: 'db-8', parachutiste_id: DEMO_PROFILE.id, type_badge: 'discipline_3dz', date_obtention: '2023-09-01', notifie: true },
];

// ─── Matériel démo ────────────────────────────────────────────────────────────

export const DEMO_MATERIEL: Materiel[] = [
  {
    id: 'demo-mat-1',
    parachutiste_id: DEMO_PROFILE.id,
    type: 'parachute_principal',
    marque: 'Performance Designs',
    modele: 'Sabre 2 150',
    numero_serie: 'PD-847362',
    date_fabrication: '2019-01-01',
    date_acquisition: '2021-09-01',
    statut: 'actif',
    photo_url: null,
    notes: null,
    created_at: '2021-09-01T10:00:00Z',
  },
  {
    id: 'demo-mat-2',
    parachutiste_id: DEMO_PROFILE.id,
    type: 'parachute_secours',
    marque: 'Precision Aerodynamics',
    modele: 'Optimum 160',
    numero_serie: 'PA-192847',
    date_fabrication: '2018-01-01',
    date_acquisition: '2021-09-01',
    statut: 'actif',
    photo_url: null,
    notes: 'Pliage à renouveler — échéance dépassée',
    created_at: '2021-09-01T10:00:00Z',
  },
  {
    id: 'demo-mat-3',
    parachutiste_id: DEMO_PROFILE.id,
    type: 'aad',
    marque: 'Cypres',
    modele: 'Expert Cypres 2',
    numero_serie: 'CY-284751',
    date_fabrication: '2020-01-01',
    date_acquisition: '2021-09-01',
    statut: 'actif',
    photo_url: null,
    notes: null,
    created_at: '2021-09-01T10:00:00Z',
  },
  {
    id: 'demo-mat-4',
    parachutiste_id: DEMO_PROFILE.id,
    type: 'altimetre',
    marque: 'Alti-2',
    modele: 'Atlas',
    numero_serie: 'A2-384756',
    date_fabrication: '2021-01-01',
    date_acquisition: '2021-09-01',
    statut: 'actif',
    photo_url: null,
    notes: null,
    created_at: '2021-09-01T10:00:00Z',
  },
];

export const DEMO_MAINTENANCES: Maintenance[] = [
  {
    id: 'demo-maint-1',
    materiel_id: 'demo-mat-1',
    type_maintenance: 'autre',
    date_maintenance: '2024-04-10',
    prochain_echeance: '2025-04-10',
    technicien: 'BigAir Lofteur',
    centre: 'BigAir Rochefort',
    notes: 'Révision complète — tout OK, 200 sauts',
    document_url: null,
    created_at: '2024-04-10T10:00:00Z',
  },
  {
    id: 'demo-maint-2',
    materiel_id: 'demo-mat-2',
    type_maintenance: 'pliage_secours',
    date_maintenance: '2025-11-15',
    prochain_echeance: '2026-05-15',
    technicien: 'BigAir Lofteur',
    centre: 'BigAir Rochefort',
    notes: 'Pliage effectué — conforme',
    document_url: null,
    created_at: '2025-11-15T10:00:00Z',
  },
  {
    id: 'demo-maint-3',
    materiel_id: 'demo-mat-3',
    type_maintenance: 'revision_aad',
    date_maintenance: '2025-12-10',
    prochain_echeance: '2026-12-10',
    technicien: 'Service Cypres France',
    centre: null,
    notes: 'Révision annuelle AAD — OK',
    document_url: null,
    created_at: '2025-12-10T10:00:00Z',
  },
];

// ─── QR token fictif ──────────────────────────────────────────────────────────

export const DEMO_QR_TOKEN = 'demo-qr-token-sophie-martin';

// ─────────────────────────────────────────────────────────────────────────────
// DEMO PARACHUTISTE — Lucas Bernard (used by DemoSelectModal / local demo mode)
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_PARACHUTISTE_PROFILE: Profile = {
  id: 'demo-user-lucas-bernard',
  email: 'lucas.bernard@demo.fr',
  nom: 'BERNARD',
  prenom: 'Lucas',
  role: 'parachutiste',
  centre_id: 'demo-centre-skydive-atlantique',
  admin_centre_id: null,
  numero_licence: 'FFP-2019-04521',
  type_pratiquant: 'amateur',
  date_naissance: '1995-07-22',
  lieu_naissance: 'Nantes',
  nationalite: 'Française',
  signature_url: null,
  created_at: '2019-05-12T10:00:00Z',
  avatar_url: null,
};

export const DEMO_PARACHUTISTE_USER = {
  id: 'demo-user-lucas-bernard',
  email: 'lucas.bernard@demo.fr',
  created_at: '2019-05-12T10:00:00Z',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
} as unknown as import('@supabase/supabase-js').User;

export const DEMO_PARACHUTISTE_LICENCES: Licence[] = [
  {
    id: 'demo-lic-lucas-1',
    parachutiste_id: DEMO_PARACHUTISTE_PROFILE.id,
    numero_licence: 'FFP-2019-04521',
    date_delivrance: '2019-05-01',
    date_expiration: '2026-12-31',
    organisme: 'FFP',
    statut: 'actif',
    created_at: '2019-05-01T10:00:00Z',
    code_club: '0442',
    nom_club: 'SkyDive Atlantique',
    beneficiaire_nom: 'Marie BERNARD',
    beneficiaire_lien: 'conjoint',
    beneficiaire_telephone: '06 XX XX XX XX',
    assurance_individuelle: true,
    assurance_rc: true,
    tampon_dz_url: null,
    tampon_valide_par: 'Patrick Moreau',
    tampon_date_validation: '2026-04-20',
    tampon_signature_url: null,
    tampon_statut: 'valide',
    type_licence: 'lp',
    tampon_snapshot_url: null,
    tampon_timestamp: '2026-04-20T09:00:00Z',
    tampon_validateur_nom: 'Patrick Moreau',
    tampon_hash: 'b7c3a2d1e4f5a6b7c8d9e0f1a2b3c4d5',
  },
];

export const DEMO_PARACHUTISTE_CERTIFICATS: CertificatMedical[] = [
  {
    id: 'demo-cert-lucas-1',
    parachutiste_id: DEMO_PARACHUTISTE_PROFILE.id,
    medecin: 'Dr. Lefebvre',
    date_visite: '2026-02-10',
    date_expiration: '2027-02-10',
    type: 'aptitude_totale',
    scan_certificat_url: null,
    created_at: '2026-02-10T09:00:00Z',
  },
];

export const DEMO_PARACHUTISTE_BREVETS: Brevet[] = [
  {
    id: 'demo-brevet-lucas-b',
    parachutiste_id: DEMO_PARACHUTISTE_PROFILE.id,
    type_brevet: 'B',
    date_obtention: '2020-08-15',
    centre_delivrance: 'SkyDive Atlantique',
    numero_brevet: 'B-2020-02187',
    scan_diplome_url: null,
    created_at: '2020-08-15T10:00:00Z',
  },
  {
    id: 'demo-brevet-lucas-a',
    parachutiste_id: DEMO_PARACHUTISTE_PROFILE.id,
    type_brevet: 'A',
    date_obtention: '2020-02-28',
    centre_delivrance: 'SkyDive Atlantique',
    numero_brevet: 'A-2020-05621',
    scan_diplome_url: null,
    created_at: '2020-02-28T10:00:00Z',
  },
];

function makeLucasSaut(
  num: number,
  date: string,
  lieu: string,
  aeronef: string,
  hauteur: number,
  nature: string,
  categorie: string,
  programme: string,
  statut: 'valide' | 'en_attente',
  validePar?: string
): Saut {
  return {
    id: `demo-saut-lucas-${num}`,
    parachutiste_id: DEMO_PARACHUTISTE_PROFILE.id,
    date_saut: date,
    lieu,
    aeronef_immat: aeronef,
    nature_saut: nature,
    categorie,
    hauteur_m: hauteur,
    fonction: 'parachutiste',
    parachute: 'Storm 135',
    observations: null,
    moniteur_id: null,
    valide_par: statut === 'valide' ? (validePar ?? 'Patrick Moreau') : null,
    valide_le: statut === 'valide' ? date : null,
    statut,
    materiel_id: null,
    created_at: `${date}T10:00:00Z`,
    programme,
    voilure_principale: 'Storm 135',
    observations_moniteur: statut === 'valide' ? 'Bonne maîtrise, progression régulière.' : null,
    sortie_avion: statut === 'valide' ? 'bon' : null,
    retour_face_sol: statut === 'valide' ? 'bon' : null,
    vigilance_altitude: statut === 'valide' ? 'bon' : null,
    ouverture_notes: statut === 'valide' ? 'bon' : null,
    position_tete: statut === 'valide' ? 4 : null,
    position_bassin: statut === 'valide' ? 4 : null,
    position_jambes: statut === 'valide' ? 5 : null,
    position_bras: statut === 'valide' ? 4 : null,
    position_globale: statut === 'valide' ? 4 : null,
    exercice_chute: programme,
    exercice_voile: 'Approche standard, atterrissage précis',
    signature_moniteur_url: null,
    validation_hash: statut === 'valide' ? `${num}b4c3d2e1f0a9` : null,
    validation_timestamp: statut === 'valide' ? `${date}T12:00:00Z` : null,
    certificat_url: null,
  };
}

export const DEMO_PARACHUTISTE_SAUTS: Saut[] = [
  makeLucasSaut(50, '2026-05-25', 'SkyDive Atlantique', 'F-HSLK', 4200, 'Entraînement', 'OC', 'Vol Relatif 2-way — formation satisfaisante', 'valide', 'Patrick Moreau'),
  makeLucasSaut(49, '2026-05-18', 'SkyDive Atlantique', 'F-HSLK', 4000, 'Entraînement', 'OA', 'Travail sur la précision à l\'atterrissage', 'valide', 'Patrick Moreau'),
  makeLucasSaut(48, '2026-05-04', 'Niort-Marais Poitevin', 'F-GNPT', 3800, 'Loisir', 'OA', 'Saut loisir, belle journée ensoleillée', 'valide', 'Claire Tissot'),
  makeLucasSaut(47, '2026-04-26', 'SkyDive Atlantique', 'F-HSLK', 4200, 'Entraînement', 'OR>60"', 'Vol libre 70 secondes — stabilité bonne', 'valide', 'Patrick Moreau'),
  makeLucasSaut(46, '2026-04-13', 'SkyDive Atlantique', 'F-HSLK', 4000, 'Entraînement', 'OC', 'Entraînement VR — travail de sortie', 'en_attente'),
  makeLucasSaut(45, '2026-03-29', 'La Ferté-Gaucher', 'F-GLFG', 4200, 'Compétition', 'OC', 'Compétition régionale VR2', 'valide', 'Jean-Marc Aubert'),
  makeLucasSaut(44, '2026-03-15', 'SkyDive Atlantique', 'F-HSLK', 3800, 'Entraînement', 'OA', 'Exercice de chute stabilisée', 'valide', 'Patrick Moreau'),
  makeLucasSaut(43, '2026-02-22', 'SkyDive Atlantique', 'F-HSLK', 4000, 'Entraînement', 'OC', 'Formation 2-way — bonne communication', 'valide', 'Patrick Moreau'),
  makeLucasSaut(42, '2025-11-15', 'SkyDive Atlantique', 'F-HSLK', 4200, 'Entraînement', 'OR>60"', 'Dernier saut de saison 2025', 'valide', 'Patrick Moreau'),
  makeLucasSaut(41, '2025-10-18', 'Niort-Marais Poitevin', 'F-GNPT', 3800, 'Loisir', 'OA', 'Week-end découverte DZ', 'valide', 'Claire Tissot'),
];

export const DEMO_PARACHUTISTE_BADGES: Badge[] = [
  { id: 'dlb-1', parachutiste_id: DEMO_PARACHUTISTE_PROFILE.id, type_badge: 'volume_50', date_obtention: '2022-06-10', notifie: true },
  { id: 'dlb-2', parachutiste_id: DEMO_PARACHUTISTE_PROFILE.id, type_badge: 'volume_25', date_obtention: '2021-09-05', notifie: true },
  { id: 'dlb-3', parachutiste_id: DEMO_PARACHUTISTE_PROFILE.id, type_badge: 'volume_10', date_obtention: '2020-08-15', notifie: true },
  { id: 'dlb-4', parachutiste_id: DEMO_PARACHUTISTE_PROFILE.id, type_badge: 'volume_1', date_obtention: '2019-05-12', notifie: true },
  { id: 'dlb-5', parachutiste_id: DEMO_PARACHUTISTE_PROFILE.id, type_badge: 'discipline_competition', date_obtention: '2026-03-29', notifie: true },
];

export const DEMO_PARACHUTISTE_MATERIEL: Materiel[] = [
  {
    id: 'demo-mat-lucas-1',
    parachutiste_id: DEMO_PARACHUTISTE_PROFILE.id,
    type: 'parachute_principal',
    marque: 'Flight Concepts',
    modele: 'Storm 135',
    numero_serie: 'FC-624831',
    date_fabrication: '2021-03-01',
    date_acquisition: '2022-04-15',
    statut: 'actif',
    photo_url: null,
    notes: null,
    created_at: '2022-04-15T10:00:00Z',
  },
  {
    id: 'demo-mat-lucas-2',
    parachutiste_id: DEMO_PARACHUTISTE_PROFILE.id,
    type: 'parachute_secours',
    marque: 'Precision Aerodynamics',
    modele: 'Raven III 218',
    numero_serie: 'PA-381047',
    date_fabrication: '2020-06-01',
    date_acquisition: '2022-04-15',
    statut: 'actif',
    photo_url: null,
    notes: null,
    created_at: '2022-04-15T10:00:00Z',
  },
  {
    id: 'demo-mat-lucas-3',
    parachutiste_id: DEMO_PARACHUTISTE_PROFILE.id,
    type: 'aad',
    marque: 'MARS',
    modele: 'Vigil 2+',
    numero_serie: 'VM-194752',
    date_fabrication: '2021-01-01',
    date_acquisition: '2022-04-15',
    statut: 'actif',
    photo_url: null,
    notes: null,
    created_at: '2022-04-15T10:00:00Z',
  },
];

export const DEMO_PARACHUTISTE_STATS = {
  totalSauts: 50,
  sautsCetteAnnee: 9,
  altitudeMoyenne: 4050,
  altitudeRecord: 4200,
  dzPreferee: 'SkyDive Atlantique',
  dzPrefereeCount: 38,
  dzVisitees: 4,
  repartitionCategories: { OA: 22, OC: 20, 'OR>60"': 8 },
  sautsParMois: [0, 2, 3, 3, 5, 0, 0, 0, 0, 0, 0, 0],
  prochainPalier: 100,
  progressionPalier: 50 / 100,
};

export const DEMO_PARACHUTISTE_PROGRESSION = {
  note_globale: 4.2,
  tendance: 'up' as const,
  position_corps: 4.1,
  poses_debout: 8,
  poses_total: 10,
  elements_maitrises: 9,
  elements_total: 11,
  precision_metres: 12,
  note_mental: 4.3,
  note_ouverture_voile: 4.5,
  note_atterrissage: 3.8,
};

// ─────────────────────────────────────────────────────────────────────────────
// DEMO CENTRE — SkyDive Atlantique (used by DemoSelectModal / local demo mode)
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_CENTRE_DATA = {
  centre: {
    id: 'demo-centre-skydive-atlantique',
    nom: 'SkyDive Atlantique',
    ville: 'Saint-Jean-d\'Angély',
    region: 'Nouvelle-Aquitaine',
    departement: '17',
    code_club: '0442',
    email_contact: 'contact@skydive-atlantique.fr',
    telephone: '05 46 XX XX XX',
    site_web: 'https://skydive-atlantique.fr',
    created_at: '2018-04-01T00:00:00Z',
    nom_dt: 'Patrick Moreau',
    signature_dt_url: null,
  },
  stats: {
    totalLicencies: 25,
    licenciesActifs: 22,
    totalSautsAnnee: 487,
    moniteurs: 3,
    alertesCritiques: 2,
    alertesWarning: 5,
    planningCreneaux: 14,
  },
  licencies: [
    { id: 'dl-1', nom: 'BERNARD', prenom: 'Lucas', numero_licence: 'FFP-2019-04521', statut_licence: 'actif', brevet: 'B', nb_sauts: 50, derniere_activite: '2026-05-25', alertes: 0 },
    { id: 'dl-2', nom: 'MARTIN', prenom: 'Sophie', numero_licence: 'FFP-2021-08734', statut_licence: 'actif', brevet: 'B', nb_sauts: 247, derniere_activite: '2026-05-18', alertes: 1 },
    { id: 'dl-3', nom: 'DUPONT', prenom: 'Thomas', numero_licence: 'FFP-2022-10284', statut_licence: 'actif', brevet: 'A', nb_sauts: 32, derniere_activite: '2026-04-30', alertes: 0 },
    { id: 'dl-4', nom: 'LEROY', prenom: 'Maxime', numero_licence: 'FFP-2020-07431', statut_licence: 'actif', brevet: 'B', nb_sauts: 88, derniere_activite: '2026-05-12', alertes: 1 },
    { id: 'dl-5', nom: 'GIRARD', prenom: 'Nicolas', numero_licence: 'FFP-2023-12841', statut_licence: 'actif', brevet: 'A', nb_sauts: 18, derniere_activite: '2026-05-08', alertes: 0 },
    { id: 'dl-6', nom: 'PETIT', prenom: 'Camille', numero_licence: 'FFP-2021-09102', statut_licence: 'actif', brevet: 'B', nb_sauts: 74, derniere_activite: '2026-05-20', alertes: 0 },
    { id: 'dl-7', nom: 'ROUX', prenom: 'Antoine', numero_licence: 'FFP-2019-03214', statut_licence: 'actif', brevet: 'B', nb_sauts: 121, derniere_activite: '2026-05-11', alertes: 0 },
    { id: 'dl-8', nom: 'MOREAU', prenom: 'Julie', numero_licence: 'FFP-2024-14523', statut_licence: 'actif', brevet: 'A', nb_sauts: 8, derniere_activite: '2026-04-27', alertes: 1 },
    { id: 'dl-9', nom: 'CLEMENT', prenom: 'Paul', numero_licence: 'FFP-2022-11089', statut_licence: 'actif', brevet: 'B', nb_sauts: 43, derniere_activite: '2026-05-15', alertes: 0 },
    { id: 'dl-10', nom: 'GARCIA', prenom: 'Laura', numero_licence: 'FFP-2020-06728', statut_licence: 'actif', brevet: 'B', nb_sauts: 96, derniere_activite: '2026-05-22', alertes: 0 },
  ],
  moniteurs: [
    { id: 'dm-1', nom: 'MOREAU', prenom: 'Patrick', qualification: 'Moniteur BPA + DT', nb_validations: 47, disponible: true },
    { id: 'dm-2', nom: 'TISSOT', prenom: 'Claire', qualification: 'Moniteur BPA', nb_validations: 31, disponible: true },
    { id: 'dm-3', nom: 'AUBERT', prenom: 'Jean-Marc', qualification: 'Moniteur BPA + Tandem', nb_validations: 29, disponible: false },
  ],
  alertes: [
    { id: 'da-1', parachutiste: 'LEROY Maxime', type: 'certificat_medical', message: 'Certificat médical expire le 30/06/2026', urgence: 'warning' },
    { id: 'da-2', parachutiste: 'MARTIN Sophie', type: 'materiel_revision', message: 'Parachute de secours — révision dépassée', urgence: 'critique' },
    { id: 'da-3', parachutiste: 'MOREAU Julie', type: 'licence', message: 'Licence non tamponnée pour la saison', urgence: 'warning' },
  ],
  planning: [
    { id: 'dp-1', date: '2026-06-07', heure_debut: '09:00', heure_fin: '17:00', type: 'saut_en_groupe', nb_inscrits: 8, places_max: 12, moniteur: 'Patrick Moreau' },
    { id: 'dp-2', date: '2026-06-07', heure_debut: '14:00', heure_fin: '18:00', type: 'formation_brevet_a', nb_inscrits: 3, places_max: 6, moniteur: 'Claire Tissot' },
    { id: 'dp-3', date: '2026-06-08', heure_debut: '10:00', heure_fin: '16:00', type: 'saut_en_groupe', nb_inscrits: 5, places_max: 10, moniteur: 'Jean-Marc Aubert' },
    { id: 'dp-4', date: '2026-06-14', heure_debut: '09:00', heure_fin: '18:00', type: 'journee_portes_ouvertes', nb_inscrits: 0, places_max: 20, moniteur: 'Patrick Moreau' },
    { id: 'dp-5', date: '2026-06-15', heure_debut: '09:00', heure_fin: '17:00', type: 'saut_en_groupe', nb_inscrits: 11, places_max: 12, moniteur: 'Claire Tissot' },
  ],
  validations_recentes: [
    { id: 'dv-1', parachutiste: 'BERNARD Lucas', saut_date: '2026-05-25', nature: 'Entraînement', statut: 'valide', moniteur: 'Patrick Moreau' },
    { id: 'dv-2', parachutiste: 'GARCIA Laura', saut_date: '2026-05-22', nature: 'Loisir', statut: 'valide', moniteur: 'Claire Tissot' },
    { id: 'dv-3', parachutiste: 'PETIT Camille', saut_date: '2026-05-20', nature: 'Entraînement', statut: 'valide', moniteur: 'Patrick Moreau' },
    { id: 'dv-4', parachutiste: 'MARTIN Sophie', saut_date: '2026-05-18', nature: 'Entraînement', statut: 'valide', moniteur: 'Patrick Moreau' },
    { id: 'dv-5', parachutiste: 'DUPONT Thomas', saut_date: '2026-04-30', nature: 'Entraînement', statut: 'en_attente', moniteur: null },
  ],
};

// ─── Stats précalculées ───────────────────────────────────────────────────────

export const DEMO_STATS = {
  totalSauts: 247,
  sautsCetteAnnee: 34,
  altitudeMoyenne: 4050,
  altitudeRecord: 4500,
  dzPreferee: 'BigAir Rochefort',
  dzPrefereeCount: 147,
  dzVisitees: 7,
  repartitionCategories: {
    OA: 45,
    OC: 156,
    'OR>60"': 46,
  },
  sautsParMois: [4, 2, 6, 8, 14, 0, 18, 22, 15, 8, 3, 2], // jan..dec
  prochainPalier: 300,
  progressionPalier: 247 / 300,
};
