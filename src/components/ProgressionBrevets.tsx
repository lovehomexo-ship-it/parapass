import { GraduationCap, CheckCircle, Clock, Hourglass, XCircle } from 'lucide-react';
import {
  useReferentielBrevets, useMaProgression, useContexteEleve,
  prerequisEpreuveOk, epreuvesBrevetCompletes, resteAFaire, evalRegle, conditionsBrevetOk,
} from '../lib/brevetsProgression';
import { useDzMembre } from '../lib/briefing';

/** Progression brevets côté élève — arbre FFP réel : conditions calculées
 *  depuis le carnet (seuils de sauts, âge, expérience récente), épreuves
 *  qualitatives validées par le moniteur, « Je suis prêt » explicite. */
export function ProgressionBrevets({ userId }: { userId: string | undefined }) {
  const { brevets, epreuves, epreuvesDe, reglesDe, prerequisMap, renseigne, loading } = useReferentielBrevets();
  const dzs = useDzMembre(userId);
  const ctx = useContexteEleve(userId);
  const { progressions, brevetsDelivres, declarerPret, error } = useMaProgression(userId, dzs[0]?.id);

  if (loading) return null;

  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="flex items-center gap-2 mb-1">
        <GraduationCap className="w-5 h-5" style={{ color: '#F97316' }} />
        <h2 className="text-sm font-bold text-white">Ma progression brevets</h2>
      </div>
      <p className="text-[10px] mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Référentiel FFP 2026 (CA 27-03-2026) saisi comme donnée — à vérifier par votre DT ; la FFP reste seule source de vérité.
      </p>

      {!renseigne ? (
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Référentiel des épreuves en attente de la FFP — rien n'est inventé d'ici là.
        </p>
      ) : (
        <div className="space-y-4">
          {error && <p className="text-xs" style={{ color: '#FCA5A5' }}>⚠️ {error}</p>}
          {brevets.map(brevet => {
            const eps = epreuvesDe(brevet.id);
            if (eps.length === 0) return null;
            const regles = reglesDe(brevet.id);
            const delivre = brevetsDelivres.includes(brevet.id) || (ctx?.brevetsAcquis.has(brevet.code) ?? false);
            const conditionsOk = ctx ? conditionsBrevetOk(regles, ctx) : true;
            const validees = eps.filter(e => progressions[e.id]?.statut === 'validee').length;
            const pct = Math.round((validees / eps.length) * 100);
            const reste = resteAFaire(brevet, epreuves, regles, progressions, ctx);
            const epreuvesOk = epreuvesBrevetCompletes(brevet, epreuves, progressions);
            const pretADelivrer = !delivre && epreuvesOk && conditionsOk;

            return (
              <div key={brevet.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-sm font-bold text-white">{brevet.libelle}</span>
                  {delivre && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34D399' }}>Obtenu ✓</span>}
                  {pretADelivrer && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>Prêt à délivrer — en attente du moniteur/DT</span>}
                  <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>{validees}/{eps.length}</span>
                </div>
                <div className="rounded-full overflow-hidden mb-2" style={{ height: 6, background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: delivre ? '#10B981' : '#F97316', borderRadius: 999, transition: 'width 0.4s' }} />
                </div>

                {/* Conditions du brevet — calculées depuis le carnet, jamais validées à la main */}
                {!delivre && ctx && regles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {regles.map(r => {
                      const ev = evalRegle(r, ctx);
                      return (
                        <span key={r.id} title={r.description ?? undefined}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                          style={ev.ok === true
                            ? { background: 'rgba(16,185,129,0.1)', color: '#34D399', border: '1px solid rgba(16,185,129,0.25)' }
                            : ev.ok === false
                            ? { background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.25)' }
                            : { background: 'rgba(148,163,184,0.1)', color: '#CBD5E1', border: '1px solid rgba(148,163,184,0.25)' }}>
                          {ev.ok === true ? <CheckCircle className="w-3 h-3" /> : ev.ok === false ? <XCircle className="w-3 h-3" /> : '👤'}
                          {ev.label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {!delivre && eps.map(ep => {
                  const prog = progressions[ep.id];
                  const statut = prog?.statut ?? 'a_faire';
                  const { ok: preqOk, manque } = prerequisEpreuveOk(ep, progressions, epreuves, prerequisMap, ctx);
                  return (
                    <div key={ep.id} className="flex items-center gap-2.5 py-1.5 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      {statut === 'validee'
                        ? <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#34D399' }} />
                        : statut === 'pret'
                        ? <Hourglass className="w-4 h-4 flex-shrink-0" style={{ color: '#FBBF24' }} />
                        : <Clock className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white">
                          {ep.libelle}
                          {ep.quantite_requise > 1 && <span style={{ color: 'rgba(255,255,255,0.45)' }}> · {prog?.quantite_faite ?? 0}/{ep.quantite_requise}</span>}
                          {!ep.obligatoire && <span className="font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}> (optionnelle)</span>}
                        </p>
                        {ep.description && statut !== 'validee' && (
                          <p className="text-[10px] leading-snug" style={{ color: 'rgba(255,255,255,0.35)' }}>{ep.description}</p>
                        )}
                        {statut === 'validee' && prog?.valide_at && (
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            Validée le {new Date(prog.valide_at).toLocaleDateString('fr-FR')}{prog.note ? ` — « ${prog.note} »` : ''}
                          </p>
                        )}
                        {statut === 'echouee' && (
                          <p className="text-[10px]" style={{ color: '#FCA5A5' }}>À retenter{prog?.note ? ` — « ${prog.note} »` : ''}</p>
                        )}
                      </div>
                      {statut === 'pret' && <span className="text-[10px] font-semibold" style={{ color: '#FBBF24' }}>en attente du moniteur</span>}
                      {(statut === 'a_faire' || statut === 'echouee') && (
                        preqOk ? (
                          <button onClick={() => declarerPret(ep.id)}
                            className="text-[11px] font-bold px-2.5 rounded-lg text-white" style={{ background: '#2563EB', minHeight: 32 }}>
                            Je suis prêt
                          </button>
                        ) : (
                          <span className="text-[10px] text-right" style={{ color: 'rgba(255,255,255,0.35)', maxWidth: 150 }}>
                            valide d'abord {manque}
                          </span>
                        )
                      )}
                    </div>
                  );
                })}

                {!delivre && reste.length > 0 && !pretADelivrer && (
                  <p className="text-[11px] mt-2" style={{ color: '#FDBA74' }}>
                    Il te reste : {reste.join(' · ')}.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
