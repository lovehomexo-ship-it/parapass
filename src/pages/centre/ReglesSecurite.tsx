import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoaderParaPass } from '../../components/LoaderParaPass';
import { ShieldCheck, BookOpen } from 'lucide-react';
import { surface, rayure, pastille, enTeteSection, action, SEVERITE_COULEUR } from '../../lib/jetons';
import { messageErreur } from '../../lib/avionnage';

// ═══════════════════════════════════════════════════════════════════════════
// FEU VERT · P2 — Administration minimale du référentiel.
//
// Ce que l'écran fait : activer ou désactiver une règle POUR CE CENTRE, et
// lire le texte fédéral qui la fonde.
// Ce qu'il ne fait pas, à dessein : créer ou modifier une règle. Le
// référentiel est une donnée versionnée ; on ne l'édite pas depuis un écran.
//
// Ce composant ne connaît AUCUN code de règle. Il affiche ce que la fonction
// regles_en_vigueur() lui rend. Ajouter une quatorzième règle en base la fait
// apparaître ici sans qu'une ligne de ce fichier change — c'est la
// démonstration demandée en P2.3.
// ═══════════════════════════════════════════════════════════════════════════

interface Regle {
  id: string; code: string; version: number; libelle: string; source_texte: string;
  gravite: 'bloquant' | 'vigilance'; levable: boolean;
  habilitation_levee: 'DT' | 'moniteur' | 'plieur' | 'aucun';
  effet_levee: string | null; duree_levee: string | null;
  portee: 'individu' | 'rotation' | 'centre'; actif: boolean; centre_id: string | null;
}

const DUREE: Record<string, string> = {
  une_rotation: 'une rotation', la_journee: 'la journée', jusqu_a_regularisation: 'jusqu’à régularisation',
};

function ReglesInner({ centreId }: { centreId: string }) {
  // Deux lectures : les règles EN VIGUEUR (résolues), et TOUTES les lignes
  // visibles, pour retrouver celles que le centre a désactivées — elles ne
  // sortent plus de regles_en_vigueur mais doivent rester réactivables.
  const [enVigueur, setEnVigueur] = useState<Regle[]>([]);
  const [desactivees, setDesactivees] = useState<Regle[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setErreur(null);
    const [{ data: v, error: e1 }, { data: toutes, error: e2 }] = await Promise.all([
      supabase.rpc('regles_en_vigueur', { p_centre_id: centreId }),
      supabase.from('regles_securite').select('*')
        .eq('centre_id', centreId).eq('actif', false).order('code'),
    ]);
    if (e1 || e2) {
      const e = e1 ?? e2;
      console.error('Référentiel — lecture échouée :', e);
      setErreur(messageErreur(e)); setChargement(false); return;
    }
    const codesEnVigueur = new Set(((v ?? []) as Regle[]).map(r => r.code));
    setEnVigueur((v ?? []) as Regle[]);
    // Une ligne centre inactive masque la fédérale : la règle est « éteinte ici ».
    setDesactivees(((toutes ?? []) as Regle[]).filter(r => !codesEnVigueur.has(r.code)));
    setChargement(false);
  }, [centreId]);

  useEffect(() => { charger(); }, [charger]);

  const basculer = async (code: string, actif: boolean) => {
    setOccupe(code); setErreur(null);
    const { error } = await supabase.rpc('basculer_regle_centre', {
      p_centre_id: centreId, p_code: code, p_actif: actif,
    });
    setOccupe(null);
    if (error) { setErreur(messageErreur(error)); return; }
    await charger();
  };

  if (chargement) return <LoaderParaPass taille={72} message={null} />;

  const Ligne = ({ r, active }: { r: Regle; active: boolean }) => {
    const sev = !active ? 'neutre' : r.gravite === 'bloquant' ? 'critique' : 'vigilance';
    const detail = ouverte === r.code;
    return (
      <li className="py-3 px-3" style={{ borderTop: '1px solid var(--n3-filet)', ...rayure(sev),
                                          opacity: active ? 1 : 0.6 }}>
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--c-muted)', marginRight: 8 }}>
                {r.code}
              </span>
              {r.libelle}
            </p>
            <p className="mt-0.5" style={{ fontSize: 12, color: 'var(--c-muted)' }}>
              v{r.version}
              {r.centre_id ? ' · surcharge du centre' : ' · règle fédérale'}
              {' · portée '}{r.portee}
              {r.levable
                ? ` · levable par ${r.habilitation_levee}${r.duree_levee ? `, ${DUREE[r.duree_levee] ?? r.duree_levee}` : ''}`
                : ' · non levable'}
            </p>
            {detail && (
              <div className="mt-2 p-3 rounded-xl" style={{ background: 'var(--c-bg)', border: '1px solid var(--n2-bord)' }}>
                <p className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text2)' }}>
                  <BookOpen className="w-3.5 h-3.5" aria-hidden /> Texte fondateur
                </p>
                {/* C'est ce texte que le système citera quand il refusera. */}
                <p className="mt-1" style={{ fontSize: 13, color: 'var(--c-text)' }}>{r.source_texte}</p>
                {r.effet_levee && (
                  <p className="mt-2" style={{ fontSize: 12, color: 'var(--c-text2)' }}>
                    <strong>Effet d’une levée :</strong> {r.effet_levee}
                  </p>
                )}
              </div>
            )}
          </div>
          <span className="flex-shrink-0" style={pastille(sev)}>
            {!active ? 'désactivée ici' : r.gravite === 'bloquant' ? 'bloquant' : 'vigilance'}
          </span>
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" style={action('texte')}
              onClick={() => setOuverte(detail ? null : r.code)}
              aria-expanded={detail}>
              {detail ? 'masquer la source' : 'voir la source'}
            </button>
            <button type="button" disabled={occupe !== null}
              style={{ ...action('secondaire'), minHeight: 36, fontSize: 12, padding: '0 10px' }}
              onClick={() => basculer(r.code, !active)}>
              {occupe === r.code ? '…' : active ? 'Désactiver ici' : 'Réactiver'}
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--c-text)' }}>
          <ShieldCheck className="w-5 h-5" style={{ color: 'var(--action-texte)' }} aria-hidden />
          Référentiel Feu Vert
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--c-muted)' }}>
          Chaque règle cite le texte fédéral qui la fonde. Désactiver une règle
          ne la supprime pas : elle est masquée pour ce centre, et la trace reste.
          Aucune règle ne se crée ni ne se modifie ici.
        </p>
      </div>

      {erreur && (
        <p role="alert" className="px-3 py-2 rounded-xl" style={{
          fontSize: 13, borderLeft: `5px solid ${SEVERITE_COULEUR.critique}`, color: 'var(--c-text2)',
          background: 'color-mix(in srgb, var(--sev-critique) 10%, transparent)' }}>{erreur}</p>
      )}

      <section style={surface(2)}>
        <h3 className="px-3 pt-3" style={{ ...enTeteSection, marginBottom: 0 }}>
          En vigueur
          <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: 0, textTransform: 'none',
                         color: 'var(--c-muted)', marginLeft: 8 }}>
            {enVigueur.length} règle{enVigueur.length > 1 ? 's' : ''}
            {' · '}{enVigueur.filter(r => r.gravite === 'bloquant').length} bloquante(s)
          </span>
        </h3>
        {enVigueur.length === 0 ? (
          <p className="px-3 py-6 text-center" style={{ fontSize: 13, color: 'var(--c-muted)' }}>
            Aucune règle en vigueur. Le référentiel n’est peut-être pas encore chargé.
          </p>
        ) : (
          <ul>{enVigueur.map(r => <Ligne key={r.id} r={r} active />)}</ul>
        )}
      </section>

      {desactivees.length > 0 && (
        <section style={surface(2)}>
          <h3 className="px-3 pt-3" style={{ ...enTeteSection, marginBottom: 0 }}>
            Désactivées pour ce centre
          </h3>
          <ul>{desactivees.map(r => <Ligne key={r.id} r={r} active={false} />)}</ul>
        </section>
      )}
    </div>
  );
}

export function ReglesSecurite({ centreId }: { centreId: string }) {
  return <ErrorBoundary><ReglesInner centreId={centreId} /></ErrorBoundary>;
}
