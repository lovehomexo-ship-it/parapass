import { useState, useEffect } from 'react';
import { X, Settings2, BookOpen, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { surface, action, pastille, enTeteSection, SEVERITE_COULEUR } from '../../lib/jetons';
import { messageErreur, type Discipline } from '../../lib/avionnage';

// ═══════════════════════════════════════════════════════════════════════════
// RÉGLAGES DE L'AVIONNAGE — ce que le centre décide lui-même.
//
// Discret : une roue crantée dans l'en-tête du module, pas une entrée de menu
// de plus. On règle l'avionnage DEPUIS l'avionnage.
//
// Deux réglages pour commencer, ceux qui changent ce que l'écran affiche :
//   • les disciplines proposées — le catalogue est commun, l'activation est
//     au centre ;
//   • l'abaque de charge alaire, ET SA SOURCE.
//
// SUR L'ABAQUE, UN POINT QUI COMPTE. Les seuils livrés portent tous la mention
// « À VÉRIFIER — recommandations fédérales / manuels constructeurs » : ils ne
// sont fondés sur aucun texte identifié. Tant qu'aucune source n'est saisie,
// cet écran les présente comme un REPÈRE DU CENTRE, jamais comme une règle
// fédérale. C'est P2 : une règle porte la référence qui la fonde, ou elle n'en
// est pas une. Le champ « source » existe pour le jour où le texte est connu.
// ═══════════════════════════════════════════════════════════════════════════

interface Seuil {
  id: string; sauts_min: number; sauts_max: number | null;
  charge_max_recommandee: number; source_texte: string | null; centre_id: string | null;
}

function Inner({ centreId, onFermer, onChange }: {
  centreId: string; onFermer: () => void; onChange: () => void;
}) {
  const [catalogue, setCatalogue] = useState<Discipline[]>([]);
  const [retirees, setRetirees] = useState<Set<string>>(new Set());
  const [seuils, setSeuils] = useState<Seuil[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const charger = async () => {
    const [{ data: d }, { data: cd }, { data: cg }] = await Promise.all([
      supabase.from('disciplines_saut')
        .select('code, libelle, ordre, equipage, radio_attendue, teinte')
        .eq('actif', true).order('ordre'),
      supabase.from('centres_disciplines').select('code, actif').eq('centre_id', centreId),
      supabase.from('canopy_guidelines')
        .select('id, sauts_min, sauts_max, charge_max_recommandee, source_texte, centre_id')
        .or(`centre_id.is.null,centre_id.eq.${centreId}`).order('sauts_min'),
    ]);
    setCatalogue((d ?? []) as Discipline[]);
    setRetirees(new Set((cd ?? []).filter(x => !x.actif).map(x => x.code)));
    setSeuils((cg ?? []) as Seuil[]);
    setChargement(false);
  };
  useEffect(() => { charger(); /* eslint-disable-next-line */ }, [centreId]);

  const basculerDiscipline = async (code: string, actif: boolean) => {
    setOccupe(true); setErreur(null);
    const { error } = await supabase.from('centres_disciplines')
      .upsert({ centre_id: centreId, code, actif }, { onConflict: 'centre_id,code' });
    setOccupe(false);
    if (error) { setErreur(messageErreur(error)); return; }
    setRetirees(s => { const n = new Set(s); if (actif) n.delete(code); else n.add(code); return n; });
    onChange();
  };

  /**
   * Modifier un seuil COMMUN ne se fait pas : on en crée une copie propre au
   * centre. Un centre ne réécrit pas l'abaque des autres, et la version
   * d'origine reste lisible pour comparaison.
   */
  const ecrireSeuil = async (s: Seuil, champ: 'charge_max_recommandee' | 'source_texte', valeur: string) => {
    setOccupe(true); setErreur(null);
    const patch = champ === 'charge_max_recommandee'
      ? { charge_max_recommandee: Number(valeur.replace(',', '.')) }
      : { source_texte: valeur.trim() || null };
    const { error } = s.centre_id
      ? await supabase.from('canopy_guidelines').update(patch).eq('id', s.id)
      : await supabase.from('canopy_guidelines').insert({
          centre_id: centreId, sauts_min: s.sauts_min, sauts_max: s.sauts_max,
          charge_max_recommandee: s.charge_max_recommandee, source_texte: s.source_texte,
          ...patch,
        });
    setOccupe(false);
    if (error) { setErreur(messageErreur(error)); return; }
    await charger();
    onChange();
  };

  // L'abaque du centre prime sur le commun, seuil par seuil.
  const abaque = seuils.filter(s =>
    s.centre_id !== null || !seuils.some(a => a.centre_id !== null && a.sauts_min === s.sauts_min));
  const sansSource = abaque.filter(s => !s.source_texte).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-auto"
      style={{ background: 'rgba(0,0,0,0.6)' }} role="dialog" aria-label="Réglages de l’avionnage">
      <div className="w-full max-w-2xl mt-8 p-4 rounded-2xl" style={surface(1)}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 style={{ ...enTeteSection, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
            <Settings2 className="w-4 h-4 inline-block mr-1.5 align-[-2px]" aria-hidden />
            Réglages de l’avionnage
          </h2>
          <button type="button" onClick={onFermer} style={{ ...action('texte'), minHeight: 36 }}>
            <X className="w-4 h-4" aria-hidden /> Fermer
          </button>
        </div>

        {erreur && (
          <p role="alert" className="px-3 py-2 rounded-xl mb-3" style={{
            fontSize: 13, borderLeft: '5px solid var(--sev-critique)', color: 'var(--c-text2)',
            background: 'color-mix(in srgb, var(--sev-critique) 10%, transparent)' }}>{erreur}</p>
        )}

        {chargement ? (
          <p style={{ fontSize: 13, color: 'var(--c-muted)' }}>Chargement…</p>
        ) : (
          <div className="space-y-5">
            {/* ── Les disciplines proposées ─────────────────────────────── */}
            <section>
              <h3 style={{ ...enTeteSection, marginBottom: 6 }}>Disciplines proposées</h3>
              <p className="mb-2" style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                Ce que ce centre propose à l’avionnage. Retirer une discipline ne
                l’efface nulle part : les sauts passés la gardent, et un saut en
                cours continue de l’afficher.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {catalogue.map(d => {
                  const actif = !retirees.has(d.code);
                  return (
                    <button key={d.code} type="button" disabled={occupe}
                      onClick={() => basculerDiscipline(d.code, !actif)}
                      aria-pressed={actif}
                      className="px-2 py-1 rounded-lg disabled:opacity-50"
                      style={{ fontSize: 12, fontWeight: 700,
                        color: actif ? (d.teinte ?? 'var(--c-text)') : 'var(--c-dim)',
                        border: `1px ${actif ? 'solid' : 'dashed'} ${actif ? (d.teinte ?? 'var(--n2-bord)') : 'var(--n2-bord)'}`,
                        background: actif ? `color-mix(in srgb, ${d.teinte ?? 'transparent'} 12%, transparent)` : 'transparent' }}>
                      {d.libelle}
                      {d.radio_attendue && <span title="radio attendue"> · radio</span>}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ── L'abaque de charge alaire ─────────────────────────────── */}
            <section>
              <h3 style={{ ...enTeteSection, marginBottom: 6 }}>
                Charge alaire — repères par expérience
              </h3>

              {sansSource > 0 && (
                <p className="px-3 py-2 rounded-xl mb-2 flex items-start gap-1.5"
                  style={{ fontSize: 12.5, color: 'var(--c-text2)',
                           borderLeft: `5px solid ${SEVERITE_COULEUR.vigilance}`,
                           background: `color-mix(in srgb, ${SEVERITE_COULEUR.vigilance} 9%, transparent)` }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" aria-hidden />
                  <span>
                    <strong>{sansSource} seuil{sansSource > 1 ? 's' : ''} sans référence.</strong>{' '}
                    ParaPass les présente comme un repère de votre centre, jamais comme
                    une règle fédérale — une règle porte le texte qui la fonde, ou elle
                    n’en est pas une. Saisissez la référence de l’abaque FFP et le
                    libellé changera partout.
                  </span>
                </p>
              )}

              <ul className="space-y-1.5">
                {abaque.map(s => (
                  <li key={s.id} className="flex items-center gap-2 flex-wrap px-2 py-1.5 rounded-xl"
                    style={{ background: 'var(--n3-fond)', border: '1px solid var(--n3-filet)' }}>
                    <span style={{ fontSize: 12, color: 'var(--c-text)', minWidth: 110 }}>
                      {s.sauts_min}{s.sauts_max === null ? ' sauts et +' : `–${s.sauts_max} sauts`}
                    </span>
                    <label className="flex items-center gap-1" style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                      max
                      <input type="number" step={0.05} min={0.3} max={3}
                        defaultValue={s.charge_max_recommandee} disabled={occupe}
                        onBlur={e => { if (Number(e.target.value) !== Number(s.charge_max_recommandee))
                          ecrireSeuil(s, 'charge_max_recommandee', e.target.value); }}
                        className="px-1.5 rounded-lg text-right"
                        style={{ width: 70, minHeight: 30, fontSize: 12, background: 'var(--c-input)',
                                 color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
                      lb/ft²
                    </label>
                    <label className="flex items-center gap-1 flex-1 min-w-[200px]"
                      style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                      <BookOpen className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                      <input type="text" defaultValue={s.source_texte ?? ''} disabled={occupe}
                        placeholder="référence du texte — ex. « FFP, manuel du DT, §… »"
                        onBlur={e => { if (e.target.value.trim() !== (s.source_texte ?? ''))
                          ecrireSeuil(s, 'source_texte', e.target.value); }}
                        className="flex-1 min-w-0 px-2 rounded-lg"
                        style={{ minHeight: 30, fontSize: 12, background: 'var(--c-input)',
                                 color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
                    </label>
                    <span style={pastille(s.centre_id ? 'neutre' : 'conforme')}>
                      {s.centre_id ? 'votre centre' : 'commun'}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5" style={{ fontSize: 11.5, color: 'var(--c-dim)' }}>
                Modifier un seuil commun en crée une copie propre à votre centre :
                un centre ne réécrit pas l’abaque des autres.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReglagesAvionnage(props: { centreId: string; onFermer: () => void; onChange: () => void }) {
  return <ErrorBoundary><Inner {...props} /></ErrorBoundary>;
}
