import { useCallback, useEffect, useState } from 'react';
import { Video, Camera, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ymdLocal } from '../../lib/datetime';
import { surface, pastille, action, enTeteSection } from '../../lib/jetons';
import { libelleCreneau, type PlageTandem } from '../../lib/tandemPlages';

// ═══════════════════════════════════════════════════════════════════════════
// LES TANDEMS DU JOUR, DANS L'AVIONNAGE — ceux qu'on a réservés sur le site de
// la DZ arrivent ici tout seuls, regroupés par plage (matin, après-midi…).
// Retour du DT de Rochefort : un planning modulable pour rentabiliser l'avion.
// Le DT voit combien de places les tandems de la demi-journée vont prendre
// (moniteur + passager), et place chacun sur la planche qui lui convient, en
// un geste : le passager arrive avec son nom, son poids et l'option vidéo ;
// son moniteur, s'il est désigné, l'accompagne.
// ═══════════════════════════════════════════════════════════════════════════

interface TandemJour {
  booking_id: string; heure: string; plage: string | null; passager: string; poids: number | null;
  avec_video: boolean; avec_photos: boolean; moniteur_id: string | null; moniteur: string | null;
  arrive: boolean; dossier_complete: boolean; statut: string; rotation_numero: number | null;
}

export function TandemsDuJour({ centreId, planches, onPlace }: {
  centreId: string;
  /** Les planches encore modifiables : ni embarquement validé, ni avion parti. */
  planches: { id: string; numero: number; placesLibres: number | null }[];
  onPlace: () => void;
}) {
  const [tandems, setTandems] = useState<TandemJour[] | null>(null);
  const [plages, setPlages] = useState<PlageTandem[] | null>(null);
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [occupe, setOccupe] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const [{ data, error }, { data: cfg }] = await Promise.all([
      supabase.rpc('tandems_du_jour', { p_centre_id: centreId, p_date: ymdLocal(new Date()) }),
      supabase.from('tandem_config').select('*').eq('centre_id', centreId).maybeSingle(),
    ]);
    if (error) { setTandems([]); return; }
    setTandems((data ?? []) as TandemJour[]);
    setPlages(((cfg as { plages?: PlageTandem[] | null } | null)?.plages) ?? null);
  }, [centreId]);
  useEffect(() => { charger(); }, [charger]);

  // Rien de réservé aujourd'hui : le bloc ne s'affiche pas.
  if (!tandems || tandems.length === 0) return null;

  const groupes = new Map<string, TandemJour[]>();
  for (const t of tandems) {
    const cle = libelleCreneau({ heure: t.heure, plage: t.plage }, plages);
    groupes.set(cle, [...(groupes.get(cle) ?? []), t]);
  }

  const placer = async (t: TandemJour) => {
    const rotation = choix[t.booking_id] ?? planches[0]?.id;
    if (!rotation) return;
    setErreur(null); setOccupe(t.booking_id);
    const { error } = await supabase.rpc('tandem_placer', { p_booking_id: t.booking_id, p_rotation_id: rotation });
    setOccupe(null);
    if (error) { setErreur(error.message); return; }
    await charger();
    onPlace();
  };

  return (
    <section aria-label="Tandems du jour" className="p-4" style={surface(2)}>
      <h2 style={enTeteSection} className="flex items-center gap-2">
        <Users className="w-4 h-4" aria-hidden /> Tandems du jour
        <span className="ml-auto font-normal" style={{ fontSize: 13, color: 'var(--c-muted)' }}>
          {tandems.length} réservé{tandems.length > 1 ? 's' : ''}
        </span>
      </h2>
      {erreur && <p role="alert" className="mt-2" style={{ fontSize: 13, color: 'var(--sev-critique)' }}>{erreur}</p>}
      {[...groupes.entries()].map(([titre, liste]) => {
        const aPlacer = liste.filter(t => t.rotation_numero == null && t.statut !== 'effectue');
        return (
          <div key={titre} className="mt-3">
            <p className="flex items-baseline justify-between gap-2" style={{ fontSize: 13 }}>
              <strong style={{ color: 'var(--c-text)' }}>{titre}</strong>
              {/* Ce que la demi-journée va prendre dans les avions. */}
              <span style={{ color: 'var(--c-muted)' }}>
                {aPlacer.length ? `${aPlacer.length} à placer · ${aPlacer.length * 2} places` : 'tous placés'}
              </span>
            </p>
            <ul className="list-none m-0 p-0 mt-1">
              {liste.map(t => (
                <li key={t.booking_id} className="py-2 flex items-center gap-2 flex-wrap"
                  style={{ borderTop: '1px solid var(--c-border-s, var(--c-border))', fontSize: 13 }}>
                  <span className="flex-1 min-w-[140px]">
                    <span className="block font-semibold" style={{ fontSize: 14, color: 'var(--c-text)' }}>{t.passager}</span>
                    <span className="flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--c-muted)' }}>
                      {t.poids ? `${t.poids} kg` : 'poids inconnu'}
                      {t.avec_video && <><span aria-hidden>·</span><Video className="w-3.5 h-3.5" aria-label="vidéo" /></>}
                      {t.avec_photos && <><span aria-hidden>·</span><Camera className="w-3.5 h-3.5" aria-label="photos" /></>}
                      <span aria-hidden>·</span>
                      {t.moniteur ?? <span style={{ color: 'var(--sev-vigilance)', fontWeight: 700 }}>moniteur à désigner</span>}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1" style={pastille(t.dossier_complete ? 'conforme' : 'vigilance')}>
                    {t.dossier_complete ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> : <AlertTriangle className="w-3.5 h-3.5" aria-hidden />}
                    {t.dossier_complete ? 'dossier' : 'dossier incomplet'}
                  </span>
                  {t.arrive && <span style={pastille('conforme')}>arrivé</span>}
                  {t.rotation_numero != null ? (
                    <span style={pastille('neutre')}>avion n°{t.rotation_numero}</span>
                  ) : t.statut === 'effectue' ? (
                    <span style={pastille('neutre')}>effectué</span>
                  ) : planches.length === 0 ? (
                    <span style={{ color: 'var(--c-dim, var(--c-muted))' }}>aucune planche ouverte</span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <label className="sr-only" htmlFor={`planche-${t.booking_id}`}>Planche pour {t.passager}</label>
                      <select id={`planche-${t.booking_id}`} value={choix[t.booking_id] ?? planches[0].id}
                        onChange={e => setChoix(c => ({ ...c, [t.booking_id]: e.target.value }))}
                        className="rounded-lg px-2" style={{ minHeight: 36, fontSize: 13, background: 'var(--c-input)', color: 'var(--c-text)', border: '1px solid var(--n2-bord, var(--c-border))' }}>
                        {planches.map(p => (
                          <option key={p.id} value={p.id}>
                            Avion n°{p.numero}{p.placesLibres != null ? ` · ${p.placesLibres} libre${p.placesLibres > 1 ? 's' : ''}` : ''}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => placer(t)} disabled={occupe === t.booking_id}
                        style={{ ...action('principal'), minHeight: 36, fontSize: 13 }}>
                        {occupe === t.booking_id ? '…' : 'Placer'}
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
