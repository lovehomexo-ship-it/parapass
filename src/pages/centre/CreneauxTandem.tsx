import { useState } from 'react';
import { Check, Copy, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ymdLocal } from '../../lib/datetime';
import { PLAGES_DEMI_JOURNEE, cleDePlage, heureFr, verifierPlages, type PlageTandem } from '../../lib/tandemPlages';

// ═══════════════════════════════════════════════════════════════════════════
// LES CRÉNEAUX TANDEM, CÔTÉ DZ — choisir comment on vend (heures précises ou
// demi-journées), ouvrir une saison en une fois, et mettre la réservation sur
// le site de la DZ. Les réservations faites sur le site arrivent ici et dans
// l'avionnage sans rien recopier : c'est la même base.
// ═══════════════════════════════════════════════════════════════════════════

const champ: React.CSSProperties = {
  minHeight: 44, padding: '0 12px', borderRadius: 10, fontSize: 14,
  border: '1px solid var(--c-border)', background: 'var(--c-input, var(--c-bg))', color: 'var(--c-text)',
};
const JOURS: [number, string][] = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [7, 'D']];
// Point de départ de « Mes plages » : trois créneaux à ajuster.
const PLAGES_PERSO_DEPART: PlageTandem[] = [
  { cle: 'matin', libelle: 'Matin', debut: '09:00', fin: '12:00' },
  { cle: 'debut_d_apres_midi', libelle: 'Début d’après-midi', debut: '13:00', fin: '16:00' },
  { cle: 'fin_d_apres_midi', libelle: 'Fin d’après-midi', debut: '16:00', fin: '19:00' },
];
const NOMS_JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

function Puce({ actif, onClick, children, label }: { actif: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button type="button" aria-pressed={actif} aria-label={label} onClick={onClick}
      className="px-3 rounded-full text-[13px] font-semibold"
      style={{ minHeight: 40, minWidth: 40, background: actif ? 'var(--action-fond)' : 'var(--c-hover)', color: actif ? '#fff' : 'var(--c-text2, var(--c-text))' }}>
      {children}
    </button>
  );
}

// ── 1. Comment la DZ vend ses tandems ───────────────────────────────────────

export function ChoixPlages({ plages, onChange }: { plages: PlageTandem[] | null; onChange: (p: PlageTandem[] | null) => void }) {
  const mode: 'heures' | 'demi' | 'perso' = !plages ? 'heures'
    // Champ par champ : la base réordonne les clés d'un objet JSON, une
    // comparaison de texte classait toujours « matin / après-midi » en « mes plages ».
    : plages.length === PLAGES_DEMI_JOURNEE.length && plages.every((p, i) => {
        const d = PLAGES_DEMI_JOURNEE[i];
        return p.cle === d.cle && p.libelle === d.libelle && p.debut === d.debut && p.fin === d.fin;
      }) ? 'demi' : 'perso';
  const erreur = plages ? verifierPlages(plages) : null;
  const maj = (i: number, patch: Partial<PlageTandem>) => onChange((plages ?? []).map((p, j) => {
    if (j !== i) return p;
    const n = { ...p, ...patch };
    return patch.libelle !== undefined ? { ...n, cle: cleDePlage(n.libelle) } : n;
  }));

  return (
    <section className="rounded-xl p-4 space-y-3" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      <div>
        <h3 className="text-[15px] font-bold" style={{ color: 'var(--c-text)' }}>Créneaux proposés aux passagers</h3>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--c-muted)' }}>
          Une demi-journée laisse la DZ remplir chaque avion au mieux ; une heure précise engage davantage.
        </p>
      </div>
      <div role="radiogroup" aria-label="Type de créneaux" className="grid gap-2 sm:grid-cols-3">
        {([['heures', 'Heures précises', 'ex. 10 h, 11 h 30'], ['demi', 'Matin / après-midi', '9 h – 13 h, 13 h – 19 h'], ['perso', 'Mes plages', 'à définir']] as const).map(([k, t, d]) => (
          <button key={k} type="button" role="radio" aria-checked={mode === k}
            onClick={() => onChange(k === 'heures' ? null : k === 'demi' ? PLAGES_DEMI_JOURNEE
              : mode === 'perso' && plages ? plages : PLAGES_PERSO_DEPART)}
            className="rounded-xl px-3 py-2.5 text-left"
            style={{ border: `2px solid ${mode === k ? 'var(--action-texte)' : 'var(--c-border)'}`, background: mode === k ? 'color-mix(in srgb, var(--action-texte) 8%, transparent)' : 'transparent' }}>
            <span className="block text-[14px] font-bold" style={{ color: 'var(--c-text)' }}>{t}</span>
            <span className="block text-[13px]" style={{ color: 'var(--c-muted)' }}>{d}</span>
          </button>
        ))}
      </div>
      {mode === 'perso' && plages && (
        <div className="space-y-2">
          {plages.map((p, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <input aria-label="Nom de la plage" value={p.libelle} onChange={e => maj(i, { libelle: e.target.value })}
                style={{ ...champ, width: 160 }} />
              <input aria-label={`Début de ${p.libelle}`} type="time" value={p.debut} onChange={e => maj(i, { debut: e.target.value })} style={champ} />
              <span style={{ color: 'var(--c-muted)' }}>à</span>
              <input aria-label={`Fin de ${p.libelle}`} type="time" value={p.fin} onChange={e => maj(i, { fin: e.target.value })} style={champ} />
              <button type="button" aria-label={`Supprimer la plage ${p.libelle}`} onClick={() => onChange(plages.filter((_, j) => j !== i))}
                className="w-11 h-11 flex items-center justify-center rounded-xl" style={{ color: 'var(--sev-critique)' }}>
                <Trash2 className="w-4 h-4" aria-hidden />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => onChange([...plages, { cle: `plage_${plages.length + 1}`, libelle: `Plage ${plages.length + 1}`, debut: '17:00', fin: '19:00' }])}
            className="inline-flex items-center gap-1.5 px-3 rounded-xl text-[13px] font-semibold"
            style={{ minHeight: 40, color: 'var(--accent-texte)', border: '1px solid var(--c-border)' }}>
            <Plus className="w-4 h-4" aria-hidden /> Ajouter une plage
          </button>
        </div>
      )}
      {erreur && <p role="alert" className="text-[13px]" style={{ color: 'var(--sev-critique)' }}>{erreur}</p>}
    </section>
  );
}

// ── 2. Ouvrir une saison en une fois ────────────────────────────────────────

export function OuvrirCreneaux({ centreId, plages, dateInitiale, onFermer, onFait }: {
  centreId: string; plages: PlageTandem[] | null; dateInitiale: string; onFermer: () => void; onFait: (n: number) => void;
}) {
  const [du, setDu] = useState(dateInitiale);
  const [au, setAu] = useState(dateInitiale);
  const [jours, setJours] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [choix, setChoix] = useState<string[]>(plages ? plages.map(p => p.cle) : ['10:00', '14:00']);
  const [heure, setHeure] = useState('11:30');
  const [capacite, setCapacite] = useState(plages ? 6 : 4);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const basculer = <T,>(l: T[], v: T) => l.includes(v) ? l.filter(x => x !== v) : [...l, v];
  const ouvrir = async () => {
    setErreur(null);
    if (au < du) { setErreur('La fin de période est avant son début.'); return; }
    if (jours.length === 0 || choix.length === 0) { setErreur('Choisissez au moins un jour et un créneau.'); return; }
    setEnvoi(true);
    const { data, error } = await supabase.rpc('tandem_ouvrir_creneaux', {
      p_centre_id: centreId, p_du: du, p_au: au, p_jours: jours, p_creneaux: choix, p_capacite: capacite });
    setEnvoi(false);
    if (error) { setErreur(error.message); return; }
    onFait(Number(data ?? 0));
  };

  return (
    <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-bold" style={{ color: 'var(--c-text)' }}>Ouvrir des créneaux</p>
        <button type="button" onClick={onFermer} aria-label="Fermer" className="w-11 h-11 flex items-center justify-center rounded-xl" style={{ color: 'var(--c-muted)' }}>
          <X className="w-4 h-4" aria-hidden />
        </button>
      </div>
      <div className="flex gap-3 flex-wrap">
        <label className="text-[13px]" style={{ color: 'var(--c-muted)' }}>Du
          <input type="date" value={du} min={ymdLocal(new Date())} onChange={e => { setDu(e.target.value); if (au < e.target.value) setAu(e.target.value); }} className="block mt-1" style={champ} />
        </label>
        <label className="text-[13px]" style={{ color: 'var(--c-muted)' }}>Au
          <input type="date" value={au} min={du} onChange={e => setAu(e.target.value)} className="block mt-1" style={champ} />
        </label>
        <label className="text-[13px]" style={{ color: 'var(--c-muted)' }}>Tandems par créneau
          <input type="number" min={1} max={50} value={capacite} onChange={e => setCapacite(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="block mt-1" style={{ ...champ, width: 110 }} />
        </label>
      </div>
      <div>
        <p className="text-[13px] mb-1.5" style={{ color: 'var(--c-muted)' }}>Jours</p>
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Jours de la semaine">
          {JOURS.map(([n, l]) => (
            <Puce key={n} actif={jours.includes(n)} onClick={() => setJours(j => basculer(j, n))} label={NOMS_JOURS[n - 1]}>{l}</Puce>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[13px] mb-1.5" style={{ color: 'var(--c-muted)' }}>Créneaux</p>
        <div className="flex gap-1.5 flex-wrap items-center">
          {plages
            ? plages.map(p => (
                <Puce key={p.cle} actif={choix.includes(p.cle)} onClick={() => setChoix(c => basculer(c, p.cle))}>
                  {p.libelle} · {heureFr(p.debut)} – {heureFr(p.fin)}
                </Puce>
              ))
            : <>
                {choix.slice().sort().map(h => (
                  <Puce key={h} actif onClick={() => setChoix(c => c.filter(x => x !== h))} label={`Retirer ${heureFr(h)}`}>{heureFr(h)} ✕</Puce>
                ))}
                <input type="time" value={heure} onChange={e => setHeure(e.target.value)} aria-label="Heure à ajouter" style={{ ...champ, minHeight: 40 }} />
                <button type="button" onClick={() => heure && setChoix(c => c.includes(heure) ? c : [...c, heure])}
                  className="px-3 rounded-full text-[13px] font-semibold" style={{ minHeight: 40, color: 'var(--accent-texte)', border: '1px solid var(--c-border)' }}>
                  + Ajouter
                </button>
              </>}
        </div>
      </div>
      {erreur && <p role="alert" className="text-[13px]" style={{ color: 'var(--sev-critique)' }}>{erreur}</p>}
      <button type="button" onClick={ouvrir} disabled={envoi}
        className="px-5 rounded-xl text-[14px] font-bold text-white disabled:opacity-60" style={{ minHeight: 44, background: 'var(--action-fond, #2563EB)' }}>
        {envoi ? 'Ouverture…' : 'Ouvrir ces créneaux'}
      </button>
      <p className="text-[13px]" style={{ color: 'var(--c-dim, var(--c-muted))' }}>
        Un créneau déjà ouvert le même jour à la même heure n’est pas doublé.
      </p>
    </div>
  );
}

// ── 3. La réservation sur le site de la DZ ──────────────────────────────────

export function IntegrationSite({ slug }: { slug: string }) {
  const [copie, setCopie] = useState(false);
  const url = `${window.location.origin}/dz/${slug}/tandem?integre=1`;
  const code = `<iframe src="${url}" title="Réserver un saut en tandem" style="width:100%;min-height:760px;border:0" loading="lazy"></iframe>
<script>addEventListener("message",function(e){if(e.data&&e.data.parapassHauteur){document.querySelectorAll('iframe[src^="${window.location.origin}/dz/${slug}/tandem"]').forEach(function(f){f.style.height=e.data.parapassHauteur+"px"})}});</script>`;
  const copier = async () => {
    try { await navigator.clipboard.writeText(code); setCopie(true); setTimeout(() => setCopie(false), 2500); } catch { /* sans presse-papiers */ }
  };
  return (
    <section className="rounded-xl p-4 space-y-3" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      <div>
        <h3 className="text-[15px] font-bold" style={{ color: 'var(--c-text)' }}>Réservation sur votre site</h3>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--c-muted)' }}>
          Collez ce code dans une page de votre site (WordPress, Wix, Squarespace : bloc « HTML personnalisé »).
          Les réservations arrivent directement dans ParaPass : planning tandem et avionnage du jour.
        </p>
      </div>
      <pre className="text-[13px] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all"
        style={{ background: 'var(--c-hover)', color: 'var(--c-text)', fontFamily: 'ui-monospace, monospace' }}>{code}</pre>
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={copier} className="inline-flex items-center gap-2 px-4 rounded-xl text-[14px] font-bold text-white"
          style={{ minHeight: 44, background: 'var(--action-fond, #2563EB)' }}>
          {copie ? <><Check className="w-4 h-4" aria-hidden /> Code copié</> : <><Copy className="w-4 h-4" aria-hidden /> Copier le code</>}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 rounded-xl text-[14px] font-semibold no-underline"
          style={{ minHeight: 44, color: 'var(--c-text)', border: '1px solid var(--c-border)' }}>
          Voir l’aperçu
        </a>
      </div>
    </section>
  );
}
