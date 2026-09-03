import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoaderParaPass } from '../../components/LoaderParaPass';
import { ModaleSaisie } from '../../components/ModaleSaisie';
import { ymdLocal } from '../../lib/datetime';
import { usePresencesDZ } from '../../lib/presence';
import { Filter, Check } from 'lucide-react';
import { surface, rayure, pastille, action, enTeteSection, type Severite } from '../../lib/jetons';

// ═══════════════════════════════════════════════════════════════════════════
// F08 — UN SEUL TABLEAU pour la population du jour.
//
// La même population était affichée dans trois blocs successifs, sur 892 px :
// les présents, l'aptitude du jour, et la jauge d'acquittement. Le DT devait
// faire lui-même la jointure entre trois listes pour répondre à sa question :
// qui est là, et qui peut sauter.
//
// Une ligne par personne. La sévérité est portée par la RAYURE de bord (forme),
// la pastille ne fait que la confirmer (règle 5). Chaque motif porte son action
// à côté de lui, pas dans un écran séparé.
// ═══════════════════════════════════════════════════════════════════════════

interface Motif {
  code: string; libelle: string;
  severite: 'info' | 'vigilance' | 'blocage';
  categorie: string; detail: string; levee: boolean;
}
interface Ligne {
  parachutiste_id: string; nom: string; prenom: string;
  statut: 'vert' | 'orange' | 'rouge';
  motifs: Motif[];
  dernier_saut: string | null; jours_inactivite: number | null;
  voile: string | null; horaire: string | null;
}

const SEVERITE: Record<'rouge' | 'orange' | 'vert', { sev: Severite; pastille: string; rang: number }> = {
  rouge:  { sev: 'critique',  pastille: 'À examiner',  rang: 0 },
  orange: { sev: 'vigilance', pastille: 'Vigilance',   rang: 1 },
  vert:   { sev: 'conforme',  pastille: 'Peut sauter', rang: 2 },
};

const CLE_FILTRE = 'parapass.terrain.filtre';

function TerrainInner({ centreId }: { centreId: string }) {
  const jour = ymdLocal(new Date());
  const { rows: presences } = usePresencesDZ(centreId);
  const [aptitudes, setAptitudes] = useState<Ligne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  // Le filtre était déjà la bonne idée au bon endroit : on le garde, et son
  // état survit à la visite.
  const [seulementCeQuiCoince, setFiltre] = useState(() => {
    try { return localStorage.getItem(CLE_FILTRE) === '1'; } catch { return false; }
  });
  const [levee, setLevee] = useState<{ ligne: Ligne; motif: Motif } | null>(null);

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null);
    const { data, error } = await supabase.rpc('get_aptitude_du_jour', {
      p_centre_id: centreId, p_date: jour,
    });
    if (error) {
      console.error('Sur le terrain — aptitude échouée :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(error.message); setChargement(false); return;
    }
    setAptitudes((data ?? []) as Ligne[]);
    setChargement(false);
  }, [centreId, jour]);

  useEffect(() => { charger(); }, [charger]);

  const basculerFiltre = () => {
    setFiltre(v => {
      const n = !v;
      try { localStorage.setItem(CLE_FILTRE, n ? '1' : '0'); } catch { /* mode privé */ }
      return n;
    });
  };

  if (chargement) return <LoaderParaPass taille={72} message={null} />;

  if (erreur) {
    return (
      <div className="rounded-2xl p-4 text-sm" style={{
        background: 'color-mix(in srgb, var(--sev-critique) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--sev-critique) 35%, transparent)',
        color: 'var(--sev-critique)' }}>
        Terrain indisponible : {erreur}
        <button onClick={charger} className="ml-2" style={action('texte')}>Réessayer</button>
      </div>
    );
  }

  // La présence apporte l'horaire et la voile ; l'aptitude apporte les motifs.
  // Une seule ligne par personne — c'est tout l'objet de ce composant.
  const lignes: Ligne[] = aptitudes.map(a => {
    const p = presences.find(x => x.user_id === a.parachutiste_id);
    return {
      ...a,
      voile: p?.voile_perso_nom ?? p?.voile_perso_libre ?? null,
      horaire: p?.heure_debut ? `${p.heure_debut}${p.heure_fin ? `–${p.heure_fin}` : ''}` : null,
    };
  }).sort((a, b) =>
    SEVERITE[a.statut].rang - SEVERITE[b.statut].rang || a.nom.localeCompare(b.nom));

  const aExaminer = lignes.filter(l => l.statut !== 'vert').length;
  const affichees = seulementCeQuiCoince ? lignes.filter(l => l.statut !== 'vert') : lignes;

  return (
    <section id="sur-le-terrain" aria-label="Sur le terrain" style={surface(2)}>
      <header className="flex items-center justify-between gap-2 flex-wrap px-4 py-3"
        style={{ borderBottom: '1px solid var(--n3-filet)' }}>
        <h3 style={{ ...enTeteSection, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
          Sur le terrain
          <span className="font-normal" style={{ color: 'var(--c-muted)' }}>
            {' · '}{lignes.length} présent{lignes.length > 1 ? 's' : ''}
            {aExaminer > 0 && `, ${aExaminer} à examiner`}
          </span>
        </h3>
        {aExaminer > 0 && (
          <button onClick={basculerFiltre} aria-pressed={seulementCeQuiCoince}
            className="flex items-center gap-1.5 px-3 rounded-full text-xs font-semibold"
            style={{ minHeight: 36,
              background: seulementCeQuiCoince ? 'var(--action-fond)' : 'transparent',
              color: seulementCeQuiCoince ? '#fff' : 'var(--action-texte)',
              border: `1px solid ${seulementCeQuiCoince ? 'var(--action-fond)' : 'var(--action-texte)'}` }}>
            <Filter className="w-3.5 h-3.5" aria-hidden />
            Ne montrer que ce qui coince
          </button>
        )}
      </header>

      {affichees.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--c-muted)' }}>
          {lignes.length === 0
            ? 'Aucune présence enregistrée aujourd’hui.'
            : 'Rien ne coince : tout le monde est en règle.'}
        </p>
      ) : (
        <ul>
          {affichees.map((l, i) => {
            const sev = SEVERITE[l.statut];
            const motifsVifs = l.motifs.filter(m => !m.levee);
            return (
              <li key={l.parachutiste_id}
                className="flex gap-3 px-3 py-2.5"
                style={{
                  borderTop: i === 0 ? 'none' : '1px solid var(--n3-filet)',
                  // La RAYURE porte la sévérité ; elle reste lisible en gris.
                  ...rayure(sev.sev),
                }}>
                <div className="flex-1 min-w-0">
                  {/* Sous 900 px les colonnes se replient sous le nom. */}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>
                      {l.prenom} {l.nom}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--c-muted)' }}>
                      {l.dernier_saut
                        ? `dernier saut ${new Date(l.dernier_saut).toLocaleDateString('fr-FR')}`
                        : 'aucun saut'}
                      {l.jours_inactivite !== null && ` · ${l.jours_inactivite} j`}
                      {l.voile && ` · ${l.voile}`}
                      {l.horaire && ` · ${l.horaire}`}
                    </span>
                  </div>

                  {motifsVifs.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {motifsVifs.map(m => (
                        <li key={m.code} className="flex items-baseline gap-2 text-xs flex-wrap">
                          <span className="flex-1 min-w-0" style={{ color: 'var(--c-text2)' }}>
                            {m.libelle} — {m.detail}
                          </span>
                          {/* L'action est À CÔTÉ du motif : le DT n'a pas à
                              changer d'écran pour traiter ce qu'il lit. */}
                          <button onClick={() => setLevee({ ligne: l, motif: m })}
                            className="flex-shrink-0"
                            style={action('texte')}>
                            lever avec motif
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {l.motifs.some(m => m.levee) && (
                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--sev-conforme)' }}>
                      <Check className="w-3 h-3" aria-hidden />
                      {l.motifs.filter(m => m.levee).length} règle(s) levée(s) ce jour
                    </p>
                  )}
                </div>

                <span className="self-start flex-shrink-0 whitespace-nowrap" style={pastille(sev.sev)}>
                  {sev.pastille}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {levee && (
        <ModaleSaisie
          titre={`Lever une règle — ${levee.ligne.prenom} ${levee.ligne.nom}`}
          description={`${levee.motif.libelle} — ${levee.motif.detail}. La levée vaut pour aujourd’hui seulement et sera enregistrée avec votre nom et l’heure.`}
          label="Motif de la décision"
          placeholder="Ex. : justificatif présenté au bureau, régularisation en cours."
          obligatoire
          libelleValider="Lever et signer"
          onFermer={() => setLevee(null)}
          onValider={async (motif) => {
            const { error } = await supabase.rpc('poser_derogation', {
              p_centre_id: centreId,
              p_parachutiste_id: levee.ligne.parachutiste_id,
              p_regle_code: levee.motif.code,
              p_motif: motif,
            });
            if (error) {
              console.error('Levée de règle — échec :', {
                code: error.code, message: error.message, details: error.details, hint: error.hint,
              });
              alert('Impossible d’enregistrer la levée : ' + error.message);
              return;
            }
            setLevee(null);
            charger();
          }}
        />
      )}
    </section>
  );
}

export function SurLeTerrain({ centreId }: { centreId: string }) {
  return <ErrorBoundary><TerrainInner centreId={centreId} /></ErrorBoundary>;
}
