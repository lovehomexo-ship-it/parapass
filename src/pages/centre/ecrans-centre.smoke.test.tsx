import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// Tests fumée des écrans du Centre DZ.
//
// CE QU'ILS COUVRENT
// Le module de chaque écran se charge et son arbre React se rend. Cela attrape
// les erreurs de niveau module — import cassé, composant `undefined`,
// identifiant jamais défini référencé dans le chemin de CHARGEMENT.
//
// CE QU'ILS NE COUVRENT PAS — et il faut le savoir
// renderToStaticMarkup n'exécute PAS les effets. Les données ne se chargent
// donc jamais, et seul l'état de chargement est rendu : les branches qui
// affichent les lignes ne sont pas traversées.
//
// MESURÉ, pas supposé : en retirant l'import de l'icône `Plane` — utilisée
// uniquement dans la liste des rotations — ces tests passent quand même. Le
// simulacre de données ci-dessous n'y change rien, précisément parce que les
// effets ne tournent pas.
//
// La garde EFFECTIVE contre cette famille d'erreurs reste le cliquet de typage
// (scripts/typecheck-cliquet.mjs), qui l'a rattrapée trois fois pendant la
// construction de ces écrans. Ces tests sont une seconde ligne, pas la
// première.
//
// Pour couvrir les branches de données, il faudrait un rendu DOM exécutant les
// effets (@testing-library/react + jsdom, absents du projet). C'est un ajout de
// dépendance à décider, pas à faire en passant.
// ═══════════════════════════════════════════════════════════════════════════

const ROT = 'r0000000-0000-0000-0000-000000000001';

const LIGNES: Record<string, unknown[]> = {
  rotations: [{ id: ROT, numero: 1, pilote: 'P', altitude_largage_m: 4000,
                heure_prevue: null, statut: 'preparation', aeronef_id: 'a1', cloturee_le: null }],
  aeronefs: [{ id: 'a1', immatriculation: 'F-TEST', places: 4, altitude_max_m: 4200 }],
  places_rotation: [{ id: 'p1', rotation_id: ROT, parachutiste_id: 'u1', type_saut: 'groupe',
                      rang_sortie: 1, statut: 'pose', groupe_id: null,
                      profiles: { nom: 'DUPONT', prenom: 'Jean' } }],
  journal_dz: [{ id: 'j1', survenu_a: new Date().toISOString(), type: 'derogation',
                 auteur_nom: 'DT', texte: 'Entrée de journal' }],
  evenements_securite: [{ id: 'e1', date_jour: new Date().toISOString().slice(0,10),
                          declarant_nom: 'DT', categorie: 'poser_hors_zone',
                          gravite: 'blessure_legere', phase: 'atterrissage',
                          recit: 'Récit', statut: 'declare', conditions: { vent_kt: 12, vent_deg: 270 } }],
  dz_briefings: [{ id: 'b1', revision: 2, published_at: new Date().toISOString(),
                   aeronef: 'PC-6', pilote: 'P', altitude_largage_m: 4000 }],
  licencies_centres: [{ parachutiste_id: 'u1', profiles: { id: 'u1', nom: 'DUPONT', prenom: 'Jean' } }],
  centres: [{ code_oaci: 'LFDN', nom: 'Centre' }],
  clotures_journee: [],
};

const RPC: Record<string, unknown[]> = {
  get_aptitude_du_jour: [{ parachutiste_id: 'u1', nom: 'DUPONT', prenom: 'Jean',
    photo_profil_url: null, statut: 'orange',
    motifs: [{ code: 'inactivite', libelle: 'Reprise', severite: 'vigilance',
               categorie: 'activite_recente', detail: '200 jours', levee: false }],
    dernier_saut: '2026-01-01', jours_inactivite: 200, nb_blocages: 0, nb_vigilances: 1 }],
  get_non_acquittes: [{ parachutiste_id: 'u1', nom: 'DUPONT', prenom: 'Jean',
                        acquitte_revision_anterieure: true }],
  get_echeances_materiel: [{ materiel_id: 'm1', type: 'parachute_secours', marque: 'M',
    modele: 'X', numero_serie: 'S1', proprietaire: 'Jean DUPONT', proprietaire_id: 'u1',
    est_parc_centre: false, type_echeance: 'pliage_secours', derniere_operation: null,
    echeance: null, jours_restants: null, palier: 'inconnu', qr_token: 'tok' }],
};

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const data = LIGNES[table] ?? [];
      const chaine: Record<string, unknown> = {};
      for (const m of ['select','eq','in','not','order','limit','gte','lte','insert','update','delete']) {
        chaine[m] = () => chaine;
      }
      chaine.maybeSingle = () => Promise.resolve({ data: data[0] ?? null, error: null });
      chaine.then = (r: (v: unknown) => unknown) =>
        Promise.resolve({ data, error: null, count: data.length }).then(r);
      return chaine;
    },
    rpc: (nom: string) => Promise.resolve({ data: RPC[nom] ?? [], error: null }),
  },
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: null, profile: null, loading: false }),
}));

// L'environnement de test est Node : pas de window. Ces écrans n'en ont pas
// besoin — renderToStaticMarkup n'exécute ni les effets ni les API navigateur.

import { AptitudeDuJour } from './AptitudeDuJour';
import { SuiviAcquittements } from './SuiviAcquittements';
import { JournalDeBord } from './JournalDeBord';
import { EcheancesMateriel } from './EcheancesMateriel';
import { EvenementsSecurite } from './EvenementsSecurite';
import { Rotations } from './Rotations';
import { BriefingOperationnel } from './BriefingOperationnel';

const CENTRE = '00000000-0000-0000-0000-000000000001';

// Ajouter ici tout nouvel écran du Centre.
const ECRANS: [string, ReactElement][] = [
  ['AptitudeDuJour (P2)',       <AptitudeDuJour centreId={CENTRE} />],
  ['SuiviAcquittements (P8)',   <SuiviAcquittements centreId={CENTRE} />],
  ['JournalDeBord (P4)',        <JournalDeBord centreId={CENTRE} />],
  ['EcheancesMateriel (P5)',    <EcheancesMateriel centreId={CENTRE} />],
  ['EvenementsSecurite (P6)',   <EvenementsSecurite centreId={CENTRE} />],
  ['Rotations (P3)',            <Rotations centreId={CENTRE} />],
  ['BriefingOperationnel (P8)', <BriefingOperationnel centreId={CENTRE} />],
];

describe('smoke : les écrans du Centre se rendent sans crash', () => {
  it.each(ECRANS)('%s', (_nom, node) => {
    expect(() => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)).not.toThrow();
  });
});
