import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Avatar } from '../../components/Avatar';
import { MapPin, ChevronRight, Plane } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// PRÉSENTS DU JOUR — l'aperçu, pour le mode Gestion.
//
// Le mode Journée a « Sur le terrain », qui répond à « qui peut sauter ». Le
// mode Gestion n'avait RIEN sur les personnes présentes : une tuile « Sauts
// aujourd'hui » dont le sous-titre disait « Sur le terrain » sans jamais
// donner une tête. Le gestionnaire ouvrait sa journée sans savoir qui était
// dans le hangar.
//
// Cet aperçu ne refait pas la liste : il la résume et il y mène. Il lit
// `presents_du_jour`, la MÊME fonction que l'écran complet — un second calcul
// aurait fini par donner un second chiffre.
// ═══════════════════════════════════════════════════════════════════════════

interface Ligne {
  user_id: string; prenom: string; nom: string; photo_profil_url: string | null;
  brevet: string | null; encadrant: boolean; statut: string;
  materiel_type: string | null; position_file: number | null; embarque: boolean;
}

const MAX_VISAGES = 10;

function Inner({ centreId }: { centreId: string }) {
  const [rows, setRows] = useState<Ligne[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('presents_du_jour', { p_centre_id: centreId });
    if (error) {
      console.error('Aperçu des présents — lecture échouée :', error);
      setErreur(error.message); setRows([]); return;
    }
    setErreur(null);
    setRows((data ?? []) as Ligne[]);
  }, [centreId]);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    const canal = supabase.channel(`apercu-presences-${centreId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'dz_presences', filter: `dz_id=eq.${centreId}` },
        () => charger())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [centreId, charger]);

  const presents = rows.filter(r => r.statut !== 'parti');
  const encadrants = presents.filter(r => r.encadrant).length;
  const enVol = presents.filter(r => r.position_file !== null || r.embarque).length;
  const sacsDz = presents.filter(r => r.materiel_type === 'location').length;
  const visages = presents.slice(0, MAX_VISAGES);
  const reste = presents.length - visages.length;

  return (
    <Link to="/centre/presents" className="rounded-2xl p-4 block no-underline"
      style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5"
          style={{ color: 'var(--c-dim)', letterSpacing: '1px' }}>
          <MapPin className="w-3.5 h-3.5" style={{ color: '#F97316' }} aria-hidden /> Présents du jour
        </span>
        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-dim)' }} aria-hidden />
      </div>

      {erreur ? (
        // Pas de « 0 » sur une lecture ratée : un hangar vide et un hangar
        // illisible ne se ressemblent pas.
        <p className="text-xs mt-2" style={{ color: 'var(--sev-critique)' }}>Présences illisibles — {erreur}</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mt-1 flex-wrap">
            <span style={{ color: 'var(--c-text)', fontSize: 28, fontWeight: 800, lineHeight: 1 }}>
              {presents.length}
            </span>
            <span className="text-xs" style={{ color: 'var(--c-muted)' }}>
              sur le terrain
              {encadrants > 0 && <span style={{ color: '#6EE7B7' }}> · {encadrants} encadrant{encadrants > 1 ? 's' : ''}</span>}
              {sacsDz > 0 && <span style={{ color: '#93C5FD' }}> · {sacsDz} sac{sacsDz > 1 ? 's' : ''} du centre</span>}
            </span>
          </div>

          {presents.length === 0 ? (
            <p className="text-xs mt-2" style={{ color: 'var(--c-dim)' }}>
              Personne ne s’est déclaré présent aujourd’hui.
            </p>
          ) : (
            <>
              {/* LES VISAGES, PAS SEULEMENT LE CHIFFRE. Un gestionnaire
                  reconnaît son monde avant de lire un nombre. */}
              <div className="flex items-center mt-3 flex-wrap gap-y-1">
                {visages.map((p, i) => (
                  <span key={p.user_id} title={`${p.prenom} ${p.nom}${p.brevet ? ` · ${p.brevet}` : ''}`}
                    style={{ marginLeft: i === 0 ? 0 : -8, zIndex: MAX_VISAGES - i }}
                    className="rounded-full inline-flex"
                    // Le liseré détache les avatars qui se chevauchent ; sans
                    // lui, dix têtes font une tache.
                    >
                    <span style={{ border: '2px solid var(--c-card)', borderRadius: 999, display: 'inline-flex' }}>
                      <Avatar photo={p.photo_profil_url} prenom={p.prenom} nom={p.nom} taille={26} />
                    </span>
                  </span>
                ))}
                {reste > 0 && (
                  <span className="text-[11px] font-semibold ml-2" style={{ color: 'var(--c-muted)' }}>
                    +{reste}
                  </span>
                )}
              </div>

              {enVol > 0 && (
                <p className="text-[11px] mt-2 inline-flex items-center gap-1" style={{ color: '#FDBA74' }}>
                  <Plane className="w-3 h-3" aria-hidden /> {enVol} en file ou embarqué{enVol > 1 ? 's' : ''}
                </p>
              )}
            </>
          )}
        </>
      )}
    </Link>
  );
}

export function ApercuPresents({ centreId }: { centreId: string }) {
  return <ErrorBoundary><Inner centreId={centreId} /></ErrorBoundary>;
}
