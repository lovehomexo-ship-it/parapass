import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoaderParaPass } from '../../components/LoaderParaPass';
import { ShieldCheck, AlertTriangle, XCircle, Filter, Check } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// P2 — APTITUDE DU JOUR
//
// Doctrine : l'application n'interdit JAMAIS un saut. Elle informe, elle trace,
// le DT décide. Aucun bouton n'empêche quoi que ce soit ; une règle se lève par
// une décision nommée, datée et signée, écrite en base.
//
// Tous les calculs viennent de la RPC get_aptitude_du_jour, qui réutilise les
// définitions de get_regulatory_snapshot (is_tunnel = false pour le dernier
// saut, mêmes règles d'échéance) : pas de second calcul côté client.
// ═══════════════════════════════════════════════════════════════════════════

interface Motif {
  code: string;
  libelle: string;
  severite: 'info' | 'vigilance' | 'blocage';
  categorie: string;
  detail: string;
  levee: boolean;
}

interface LigneAptitude {
  parachutiste_id: string;
  nom: string;
  prenom: string;
  photo_profil_url: string | null;
  statut: 'vert' | 'orange' | 'rouge';
  motifs: Motif[];
  dernier_saut: string | null;
  jours_inactivite: number | null;
  nb_blocages: number;
  nb_vigilances: number;
}

const COULEUR = {
  vert:   { fond: 'rgba(16,185,129,0.10)', bord: 'rgba(16,185,129,0.35)', texte: '#34D399', Icone: ShieldCheck,   mot: 'Rien à signaler' },
  orange: { fond: 'rgba(249,115,22,0.10)', bord: 'rgba(249,115,22,0.35)', texte: '#FB923C', Icone: AlertTriangle, mot: 'Vigilance' },
  rouge:  { fond: 'rgba(239,68,68,0.10)',  bord: 'rgba(239,68,68,0.35)',  texte: '#F87171', Icone: XCircle,       mot: 'À examiner' },
} as const;

function AptitudeInner({ centreId, date }: { centreId: string; date?: string }) {
  const [lignes, setLignes] = useState<LigneAptitude[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [seulementCeQuiCoince, setSeulementCeQuiCoince] = useState(false);
  const [levee, setLevee] = useState<{ ligne: LigneAptitude; motif: Motif } | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    const { data, error } = await supabase.rpc('get_aptitude_du_jour', {
      p_centre_id: centreId,
      ...(date ? { p_date: date } : {}),
    });
    if (error) {
      // Gestion d'erreur explicite : on n'avale jamais l'échec en silence.
      console.error('Aptitude du jour — chargement échoué :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(error.message);
      setLoading(false);
      return;
    }
    setLignes((data ?? []) as LigneAptitude[]);
    setLoading(false);
  }, [centreId, date]);

  useEffect(() => { charger(); }, [charger]);

  if (loading) return <LoaderParaPass taille={72} message={null} />;

  if (erreur) {
    return (
      <div className="rounded-2xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)', color: '#F87171' }}>
        Aptitude indisponible : {erreur}
        <button onClick={charger} className="ml-2 underline" style={{ minHeight: 32 }}>Réessayer</button>
      </div>
    );
  }

  const qui_coince = lignes.filter(l => l.statut !== 'vert');
  const affichees = seulementCeQuiCoince ? qui_coince : lignes;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold" style={{ color: 'var(--c-text)' }}>Aptitude du jour</h3>
          <p className="text-xs" style={{ color: 'var(--c-dim)' }}>
            {lignes.length} présent{lignes.length > 1 ? 's' : ''}
            {qui_coince.length > 0 && ` · ${qui_coince.length} à examiner`}
          </p>
        </div>
        {qui_coince.length > 0 && (
          <button onClick={() => setSeulementCeQuiCoince(v => !v)}
            className="flex items-center gap-1.5 px-3 rounded-full text-xs font-semibold transition"
            style={{
              minHeight: 40,
              background: seulementCeQuiCoince ? '#2563EB' : 'var(--c-surface)',
              color: seulementCeQuiCoince ? '#fff' : 'var(--c-muted)',
              border: `1px solid ${seulementCeQuiCoince ? '#2563EB' : 'var(--c-border)'}`,
            }}>
            <Filter className="w-3.5 h-3.5" aria-hidden />
            Ne montrer que ce qui coince
          </button>
        )}
      </div>

      {affichees.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: 'var(--c-dim)' }}>
          {lignes.length === 0 ? 'Aucune présence enregistrée aujourd’hui.' : 'Rien ne coince : tout le monde est en règle.'}
        </p>
      )}

      {affichees.map((l) => {
        const c = COULEUR[l.statut];
        const Icone = c.Icone;
        return (
          <div key={l.parachutiste_id} className="rounded-2xl p-3"
            style={{ background: c.fond, border: `1px solid ${c.bord}` }}>
            <div className="flex items-start gap-3">
              <Icone className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: c.texte }} aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="font-bold text-sm break-words" style={{ color: 'var(--c-text)' }}>
                    {l.prenom} {l.nom}
                  </p>
                  <span className="text-[11px] font-semibold" style={{ color: c.texte }}>{c.mot}</span>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-dim)' }}>
                  {l.dernier_saut
                    ? `Dernier saut le ${new Date(l.dernier_saut).toLocaleDateString('fr-FR')}`
                    : 'Aucun saut enregistré'}
                  {l.jours_inactivite !== null && ` · ${l.jours_inactivite} j`}
                </p>

                {l.motifs.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {l.motifs.map((m) => (
                      <li key={m.code} className="flex items-start gap-2 text-xs">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: m.levee ? 'var(--c-dim)' : m.severite === 'blocage' ? '#F87171' : '#FB923C' }} />
                        <span className="flex-1 break-words"
                          style={{ color: m.levee ? 'var(--c-dim)' : 'var(--c-text2)',
                                   textDecoration: m.levee ? 'line-through' : 'none' }}>
                          {m.libelle} — {m.detail}
                        </span>
                        {m.levee ? (
                          <span className="flex items-center gap-1 text-[11px] flex-shrink-0" style={{ color: '#34D399' }}>
                            <Check className="w-3 h-3" aria-hidden /> levée
                          </span>
                        ) : (
                          <button onClick={() => setLevee({ ligne: l, motif: m })}
                            className="text-[11px] font-semibold underline flex-shrink-0"
                            style={{ color: '#60A5FA', minHeight: 32 }}>
                            lever avec motif
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {levee && (
        <ModaleLevee centreId={centreId} ligne={levee.ligne} motif={levee.motif}
          onFerme={() => setLevee(null)} onFait={() => { setLevee(null); charger(); }} />
      )}
    </div>
  );
}

// ─── Levée d'une règle : décision nommée, datée, signée ───────────────────────
function ModaleLevee({ centreId, ligne, motif, onFerme, onFait }: {
  centreId: string; ligne: LigneAptitude; motif: Motif;
  onFerme: () => void; onFait: () => void;
}) {
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const valider = async () => {
    if (!texte.trim()) return;
    setEnvoi(true);
    const { error } = await supabase.rpc('poser_derogation', {
      p_centre_id: centreId,
      p_parachutiste_id: ligne.parachutiste_id,
      p_regle_code: motif.code,
      p_motif: texte.trim(),
    });
    setEnvoi(false);
    if (error) {
      console.error('Levée de règle — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      alert('Impossible d’enregistrer la levée : ' + error.message);
      return;
    }
    onFait();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onFerme}>
      <div className="w-full max-w-md rounded-2xl p-4 space-y-3"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
        onClick={(e) => e.stopPropagation()}>
        <div>
          <h4 className="font-bold text-sm" style={{ color: 'var(--c-text)' }}>
            Lever une règle — {ligne.prenom} {ligne.nom}
          </h4>
          <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>
            {motif.libelle} — {motif.detail}
          </p>
        </div>
        <label className="block text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>
          Motif de la décision (obligatoire)
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} autoFocus
            placeholder="Ex. : justificatif présenté au bureau, régularisation en cours."
            className="mt-1 w-full rounded-xl px-3 py-2 text-sm"
            style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }} />
        </label>
        <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
          La levée vaut pour <strong>aujourd’hui seulement</strong>. Elle sera enregistrée
          avec votre nom et l’heure.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onFerme} className="px-4 rounded-xl text-sm font-semibold"
            style={{ minHeight: 44, color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
            Annuler
          </button>
          <button onClick={valider} disabled={!texte.trim() || envoi}
            className="px-4 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ minHeight: 44, background: '#2563EB', color: '#fff' }}>
            {envoi ? 'Enregistrement…' : 'Lever et signer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AptitudeDuJour({ centreId, date }: { centreId: string; date?: string }) {
  return <ErrorBoundary><AptitudeInner centreId={centreId} date={date} /></ErrorBoundary>;
}
