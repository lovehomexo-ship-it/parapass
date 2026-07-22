import { useState } from 'react';
import { usePacEleve, niveauComplet, rouesParDomaine, type PacNiveau, type PacProgression, type PacSaut } from '../../lib/pac';
import { ErrorBoundary } from '../ErrorBoundary';
import { Check, Clock, RotateCcw, Lock, Unlock, Award, ChevronRight } from 'lucide-react';

// ─── Carnet PAC — vue ÉLÈVE (3 angles : temps / compétence / parcours) ────────
// L'appli informe ; c'est le moniteur qui valide chaque acquis.

type Vue = 'timeline' | 'roue' | 'niveaux';
const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

function CarnetInner({ userId }: { userId: string }) {
  const { niveaux, prog, sauts, niveauCourant, pretPourBrevetA, loading } = usePacEleve(userId);
  const [vue, setVue] = useState<Vue>('niveaux');

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  if (niveaux.length === 0) return <p className="text-sm text-center py-10" style={{ color: 'var(--c-dim)' }}>Référentiel PAC non chargé.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Mon carnet PAC</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--c-dim)' }}>
          Niveau en cours : <span style={{ color: '#FCD34D' }}>{niveauCourant?.libelle}</span>
          {pretPourBrevetA && <span style={{ color: '#34D399' }}> · prêt pour le Brevet A</span>}
        </p>
      </div>

      {/* Sélecteur de vue */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {([['niveaux', 'Niveaux'], ['roue', 'Compétences'], ['timeline', 'Mes sauts']] as [Vue, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setVue(k)} className="px-4 text-sm font-semibold whitespace-nowrap rounded-full transition"
            style={{ minHeight: 40, background: vue === k ? '#2563EB' : 'var(--c-surface)', color: vue === k ? 'white' : 'var(--c-muted)', border: `1px solid ${vue === k ? '#2563EB' : 'var(--c-border)'}` }}>
            {l}
          </button>
        ))}
      </div>

      {vue === 'niveaux' && <VueNiveaux niveaux={niveaux} prog={prog} />}
      {vue === 'roue' && <VueRoue niveaux={niveaux} prog={prog} />}
      {vue === 'timeline' && <VueTimeline niveaux={niveaux} prog={prog} sauts={sauts} />}
    </div>
  );
}

// ── c) Niveaux à débloquer ────────────────────────────────────────────────────
function VueNiveaux({ niveaux, prog }: { niveaux: PacNiveau[]; prog: Record<string, PacProgression> }) {
  return (
    <div className="space-y-3">
      {niveaux.map((n, idx) => {
        const complet = niveauComplet(n, prog);
        const acquis = n.objectifs.filter(o => prog[o.id]?.statut === 'validee').length;
        // débloqué = niveau précédent complet (ou premier niveau)
        const debloque = idx === 0 || niveauComplet(niveaux[idx - 1], prog);
        return (
          <div key={n.id} className="rounded-2xl p-4" style={{
            background: complet ? 'rgba(16,185,129,0.06)' : 'var(--c-surface)',
            border: `1px solid ${complet ? 'rgba(16,185,129,0.35)' : debloque ? 'var(--c-border)' : 'var(--c-border)'}`,
            opacity: debloque ? 1 : 0.6,
          }}>
            <div className="flex items-center gap-2">
              {complet ? <Award className="w-5 h-5 flex-shrink-0" style={{ color: '#34D399' }} />
                : debloque ? <Unlock className="w-5 h-5 flex-shrink-0" style={{ color: '#FCD34D' }} />
                : <Lock className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--c-dim)' }} />}
              <p className="font-bold text-white text-sm flex-1">{n.libelle}</p>
              <span className="text-xs font-semibold" style={{ color: complet ? '#34D399' : 'var(--c-dim)' }}>{acquis}/{n.objectifs.length}</span>
            </div>
            {complet && <p className="text-[11px] mt-1 ml-7" style={{ color: '#34D399' }}>🎉 Niveau débloqué</p>}
            <div className="mt-2 ml-7 space-y-1">
              {n.objectifs.map(o => {
                const st = prog[o.id]?.statut;
                return (
                  <div key={o.id} className="flex items-center gap-2 text-xs">
                    {st === 'validee' ? <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#34D399' }} />
                      : st === 'echouee' ? <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#FCD34D' }} />
                      : st === 'pret' ? <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#60A5FA' }} />
                      : <span className="w-3.5 h-3.5 flex-shrink-0 rounded-full" style={{ border: '1.5px solid var(--c-border-f)' }} />}
                    <span style={{ color: st === 'validee' ? 'var(--c-text2)' : 'var(--c-dim)', textDecoration: st === 'validee' ? 'none' : 'none' }}>
                      {o.libelle}{st === 'echouee' ? ' — à retravailler' : ''}{o.a_valider_ffp ? ' *' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
            {n.regles.length > 0 && (
              <ul className="mt-2 ml-7 text-[11px] space-y-0.5" style={{ color: 'var(--c-dim)' }}>
                {n.regles.map((r, i) => <li key={i}>• {r.description}</li>)}
              </ul>
            )}
          </div>
        );
      })}
      <p className="text-[10px]" style={{ color: 'var(--c-dim)' }}>* détail à valider avec la FFP. L'appli informe ; le moniteur valide chaque acquis.</p>
    </div>
  );
}

// ── b) Roue / barres de compétence ────────────────────────────────────────────
function VueRoue({ niveaux, prog }: { niveaux: PacNiveau[]; prog: Record<string, PacProgression> }) {
  const roues = rouesParDomaine(niveaux, prog);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {roues.map(r => (
          <div key={r.key} className="rounded-2xl p-3 flex flex-col items-center" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
            <Anneau pct={r.pct} color={r.color} />
            <p className="text-xs font-semibold text-white mt-2 text-center">{r.label}</p>
            <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>{r.acquis}/{r.total}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>Progression par domaine, tous niveaux confondus. Se remplit à mesure que le moniteur valide tes acquis.</p>
    </div>
  );
}
function Anneau({ pct, color }: { pct: number; color: string }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--c-border)" strokeWidth="7" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 36 36)" />
      <text x="36" y="41" textAnchor="middle" fontSize="16" fontWeight="700" fill="white">{pct}%</text>
    </svg>
  );
}

// ── a) Timeline des sauts ─────────────────────────────────────────────────────
function VueTimeline({ niveaux, prog, sauts }: { niveaux: PacNiveau[]; prog: Record<string, PacProgression>; sauts: PacSaut[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  // objectifs validés/à retravailler rattachés à chaque saut
  const objParSaut = (sautId: string) => niveaux.flatMap(n => n.objectifs
    .filter(o => prog[o.id]?.saut_id === sautId)
    .map(o => ({ libelle: o.libelle, statut: prog[o.id].statut })));

  if (sauts.length === 0) return <p className="text-sm text-center py-10" style={{ color: 'var(--c-dim)' }}>Aucun saut PAC enregistré pour l'instant.</p>;

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-1 bottom-1 w-px" style={{ background: 'var(--c-border-f)' }} />
      <div className="space-y-2">
        {sauts.map((s, idx) => {
          const objs = objParSaut(s.id);
          const aRetravailler = objs.some(o => o.statut === 'echouee');
          const premier = idx === 0;
          const est = ouvert === s.id;
          return (
            <div key={s.id} className="relative">
              <span className="absolute -left-[18px] top-3 w-3 h-3 rounded-full" style={{
                background: aRetravailler ? '#FCD34D' : objs.length > 0 ? '#34D399' : 'var(--c-border-f)',
                boxShadow: premier ? '0 0 0 3px rgba(37,99,235,0.4)' : 'none',
              }} />
              <button onClick={() => setOuvert(est ? null : s.id)} className="w-full text-left rounded-xl px-3 py-2" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono" style={{ color: 'var(--c-dim)' }}>{fmt(s.date_saut)}</span>
                  <span className="text-sm font-semibold text-white flex-1">{s.programme ?? 'Saut PAC'}</span>
                  {premier && <span className="text-[10px] px-1.5 rounded-full" style={{ background: 'rgba(37,99,235,0.2)', color: '#60A5FA' }}>1er saut</span>}
                  {aRetravailler ? <span className="text-[10px]" style={{ color: '#FCD34D' }}>à retravailler</span>
                    : objs.length > 0 && <Check className="w-3.5 h-3.5" style={{ color: '#34D399' }} />}
                  <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--c-dim)', transform: est ? 'rotate(90deg)' : 'none' }} />
                </div>
              </button>
              {est && (
                <div className="mt-1 ml-1 rounded-xl px-3 py-2 text-xs space-y-1" style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
                  {objs.length === 0 ? <p style={{ color: 'var(--c-dim)' }}>Aucun objectif rattaché à ce saut.</p>
                    : objs.map((o, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        {o.statut === 'validee' ? <Check className="w-3 h-3" style={{ color: '#34D399' }} /> : <RotateCcw className="w-3 h-3" style={{ color: '#FCD34D' }} />}
                        <span style={{ color: 'var(--c-text2)' }}>{o.libelle}</span>
                      </div>
                    ))}
                  {s.observations_moniteur && <p className="pt-1" style={{ color: 'var(--c-dim)' }}>« {s.observations_moniteur} »</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CarnetPACEleve({ userId }: { userId: string }) {
  return <ErrorBoundary><CarnetInner userId={userId} /></ErrorBoundary>;
}
