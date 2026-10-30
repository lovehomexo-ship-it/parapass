import { useEffect, useState } from 'react';
import { AlertTriangle, Printer, Send, X } from 'lucide-react';
import type { FichePilote } from '../../lib/fichePilote';
import type { BilanMasse } from '../../lib/masseCentrage';
import { SEVERITE_COULEUR } from '../../lib/jetons';

// ═══════════════════════════════════════════════════════════════════════════
// LA FICHE PILOTE, À L'ÉCRAN — lisible d'un coup d'œil, en gros, au bord de
// l'avion. Les paliers d'abord (c'est là que se jouent les accidents), puis la
// masse et le carburant. « Envoyer au pilote » ouvre le partage du téléphone :
// SMS, WhatsApp… sans service payant ni numéro à enregistrer.
// ═══════════════════════════════════════════════════════════════════════════

const nf = new Intl.NumberFormat('fr-FR');

export function FichePiloteVue({ titre, pilote, fiche, bilan, carburantL, heurePrevue, onFermer }: {
  titre: string; pilote: string | null; fiche: FichePilote; bilan: BilanMasse | null;
  carburantL: number | null; heurePrevue: string | null; onFermer: () => void;
}) {
  const [copie, setCopie] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onFermer]);

  const nbSorties = fiche.paliers.reduce((n, p) => n + p.sorties.length, 0);
  const texte = [
    `${titre}${heurePrevue ? ` · décollage ${heurePrevue.slice(0, 5).replace(':', ' h ')}` : ''}`,
    ...fiche.alertes.map(a => `⚠ ${a}`),
    ...fiche.paliers.map(p => `${nf.format(p.altitudeM)} m : ${p.sorties.length} sortie${p.sorties.length > 1 ? 's' : ''}`
      + ` (dernier : ${p.dernier.nom})`),
    bilan?.decollage ? bilan.resume : null,
    carburantL != null ? `Carburant : ${nf.format(carburantL)} L` : null,
  ].filter(Boolean).join('\n');

  const envoyer = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: titre, text: texte }); return; } catch { /* annulé */ }
    }
    try { await navigator.clipboard.writeText(texte); setCopie(true); } catch { /* sans presse-papiers */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(11,29,58,0.55)' }} onClick={onFermer}>
      <div role="dialog" aria-modal="true" aria-labelledby="titre-fiche-pilote"
        className="fiche-pilote w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        style={{ background: 'var(--c-card)', color: 'var(--c-text)' }} onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center gap-2 px-4 py-3" style={{ background: 'var(--c-card)', borderBottom: '1px solid var(--c-border)' }}>
          <h2 id="titre-fiche-pilote" className="flex-1 min-w-0 text-[17px] font-bold">
            Fiche pilote · {titre}
            <span className="block text-[13px] font-normal" style={{ color: 'var(--c-muted)' }}>
              {pilote ? `Pilote ${pilote} · ` : ''}{nbSorties} sortie{nbSorties > 1 ? 's' : ''}
              {heurePrevue ? ` · décollage prévu ${heurePrevue.slice(0, 5).replace(':', ' h ')}` : ''}
            </span>
          </h2>
          <button type="button" onClick={onFermer} aria-label="Fermer la fiche pilote"
            className="w-11 h-11 flex items-center justify-center rounded-xl print:hidden" style={{ color: 'var(--c-muted)' }}>
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {fiche.alertes.length > 0 && (
            <ul role="alert" className="list-none m-0 p-0 space-y-2">
              {fiche.alertes.map(a => (
                <li key={a} className="flex gap-2 rounded-xl px-3 py-2.5 text-[15px] font-semibold"
                  style={{ background: SEVERITE_COULEUR.vigilance, color: '#fff' }}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden />{a}
                </li>
              ))}
            </ul>
          )}

          <ol className="list-none m-0 p-0 space-y-3">
            {fiche.paliers.map(p => (
              <li key={p.altitudeM} className="rounded-2xl p-3"
                style={{ border: `2px solid ${p.principal ? 'var(--c-border)' : SEVERITE_COULEUR.vigilance}` }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[24px] font-extrabold tabular-nums whitespace-nowrap">{nf.format(p.altitudeM)} m</span>
                  <span className="text-[13px] font-semibold text-right" style={{ color: p.principal ? 'var(--c-muted)' : SEVERITE_COULEUR.vigilance }}>
                    {p.principal ? 'altitude principale' : 'palier'} · {p.sorties.length} sortie{p.sorties.length > 1 ? 's' : ''}
                  </span>
                </div>
                <ol className="list-none m-0 mt-1 p-0">
                  {p.sorties.map(x => (
                    <li key={x.id} className="flex items-center gap-2 py-1 text-[15px]"
                      style={{ borderTop: '1px solid var(--c-border-s, var(--c-border))' }}>
                      <span className="w-7 text-right tabular-nums font-bold" style={{ color: 'var(--c-muted)' }}>{x.rang != null && x.rang < 99 ? x.rang : '–'}</span>
                      <span className="flex-1 min-w-0 truncate">{x.nom}</span>
                      <span className="text-[13px]" style={{ color: 'var(--c-muted)' }}>{x.passager ? 'passager' : x.typeSaut}</span>
                      {x.id === p.dernier.id && p.sorties.length > 0 && (
                        <span className="text-[13px] font-bold px-2 rounded-full"
                          style={{ background: 'var(--c-hover)', color: 'var(--c-text)' }}>dernier</span>
                      )}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>

          {(bilan?.decollage || carburantL != null) && (
            <p className="text-[14px] rounded-xl px-3 py-2" style={{ background: 'var(--c-hover)' }}>
              {bilan?.decollage && <span className="block">{bilan.resume}</span>}
              {carburantL != null && <span className="block">Carburant au décollage : {nf.format(carburantL)} L</span>}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-2 px-4 py-3 print:hidden" style={{ background: 'var(--c-card)', borderTop: '1px solid var(--c-border)' }}>
          <button type="button" onClick={() => window.print()} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl text-[14px] font-semibold"
            style={{ minHeight: 44, border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
            <Printer className="w-4 h-4" aria-hidden /> Imprimer
          </button>
          <button type="button" onClick={envoyer} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl text-[14px] font-bold"
            style={{ minHeight: 44, background: 'var(--action-fond, #2563EB)', color: '#fff' }}>
            <Send className="w-4 h-4" aria-hidden /> {copie ? 'Texte copié' : 'Envoyer au pilote'}
          </button>
        </div>
      </div>
    </div>
  );
}
