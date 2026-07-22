import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { usePacStaff, usePacEleve, niveauComplet, validerObjectifPac } from '../../lib/pac';
import { ErrorBoundary } from '../ErrorBoundary';
import { Check, RotateCcw, ChevronLeft, AlertTriangle, GraduationCap } from 'lucide-react';

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

// ─── Carnet PAC — côté moniteur / DT ──────────────────────────────────────────

function StaffInner({ centreId }: { centreId: string }) {
  const { eleves, loading, error, refresh } = usePacStaff(centreId);
  const [selId, setSelId] = useState<string | null>(null);
  const [selNom, setSelNom] = useState('');

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  if (selId) return <FicheEleve userId={selId} nom={selNom} centreId={centreId} onBack={() => { setSelId(null); refresh(); }} />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><GraduationCap className="w-5 h-5" style={{ color: '#F97316' }} /> Carnet PAC — élèves en formation</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--c-dim)' }}>L'appli informe et trace ; le moniteur valide chaque acquis.</p>
      </div>
      {error && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>⚠️ {error}</div>}

      {eleves.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--c-dim)' }}>Aucun élève en progression PAC pour l'instant.</p>
      ) : (
        <div className="space-y-2">
          {eleves.map(e => {
            const pct = e.objectifsTotal ? Math.round((e.acquisTotal / e.objectifsTotal) * 100) : 0;
            const stagne = e.sautsDepuisValidation >= 3;
            return (
              <button key={e.user_id} onClick={() => { setSelId(e.user_id); setSelNom(`${e.prenom} ${e.nom}`); }}
                className="w-full text-left rounded-xl p-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white text-sm">{e.prenom} {e.nom}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(37,99,235,0.15)', color: '#60A5FA' }}>{e.niveauCode}</span>
                  {e.pretPourBrevetA && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34D399' }}>prêt Brevet A</span>}
                  {stagne && <span className="text-[11px] inline-flex items-center gap-1" style={{ color: '#FCD34D' }}><AlertTriangle className="w-3 h-3" />{e.sautsDepuisValidation} sauts sans validation</span>}
                  <span className="text-xs ml-auto" style={{ color: 'var(--c-dim)' }}>dernier saut {fmt(e.dernierSaut)}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#2563EB' }} />
                </div>
                <p className="text-[11px] mt-1" style={{ color: 'var(--c-dim)' }}>{e.acquisTotal}/{e.objectifsTotal} objectifs · {e.niveauCourant}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Fiche élève : validation rapide des objectifs (mobile) ────────────────────
function FicheEleve({ userId, nom, centreId, onBack }: { userId: string; nom: string; centreId: string; onBack: () => void }) {
  const { profile } = useAuth();
  const { niveaux, prog, sauts, loading, refresh } = usePacEleve(userId);
  const [saving, setSaving] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [sautChoisi, setSautChoisi] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  const agir = async (epreuveId: string, statut: 'validee' | 'echouee') => {
    if (!profile) return;
    setSaving(epreuveId); setErr(null);
    const e = await validerObjectifPac({
      userId, epreuveId, centreId, statut, note: note[epreuveId] ?? '',
      sautId: sautChoisi || null, moniteurId: profile.id,
    });
    setSaving(null);
    if (e) { setErr(e); return; }
    setNote(n => ({ ...n, [epreuveId]: '' }));
    refresh();
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--c-muted)' }}><ChevronLeft className="w-4 h-4" /> Élèves</button>
      <h2 className="text-lg font-bold text-white">{nom}</h2>

      {/* Rattacher au saut (optionnel) */}
      <div className="rounded-xl p-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <label className="text-[11px] font-semibold" style={{ color: 'var(--c-dim)' }}>Rattacher les validations à un saut (optionnel)</label>
        <select value={sautChoisi} onChange={e => setSautChoisi(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm text-white mt-1" style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)', minHeight: 44 }}>
          <option value="">— Aucun saut —</option>
          {sauts.map(s => <option key={s.id} value={s.id}>{new Date(s.date_saut).toLocaleDateString('fr-FR')} · {s.programme ?? 'PAC'}</option>)}
        </select>
      </div>

      {err && <div className="rounded-xl px-4 py-2 text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>⚠️ {err}</div>}

      {niveaux.map(n => (
        <div key={n.id} className="rounded-2xl p-3" style={{ background: 'var(--c-surface)', border: `1px solid ${niveauComplet(n, prog) ? 'rgba(16,185,129,0.35)' : 'var(--c-border)'}` }}>
          <p className="font-bold text-white text-sm mb-2">{n.libelle}</p>
          <div className="space-y-2">
            {n.objectifs.map(o => {
              const st = prog[o.id]?.statut;
              const busy = saving === o.id;
              return (
                <div key={o.id} className="rounded-lg p-2" style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
                  <p className="text-xs text-white">{o.libelle}
                    {st === 'validee' && <span className="ml-1" style={{ color: '#34D399' }}>· acquis</span>}
                    {st === 'echouee' && <span className="ml-1" style={{ color: '#FCD34D' }}>· à retravailler</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <input placeholder="note (option)" value={note[o.id] ?? ''} onChange={e => setNote(nn => ({ ...nn, [o.id]: e.target.value }))}
                      className="flex-1 min-w-[120px] rounded-lg px-2 py-1.5 text-xs text-white" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }} />
                    <button onClick={() => agir(o.id, 'validee')} disabled={busy} className="inline-flex items-center gap-1 text-xs font-bold px-3 rounded-lg text-white disabled:opacity-50" style={{ background: '#10B981', minHeight: 40 }}>
                      <Check className="w-3.5 h-3.5" /> Acquis
                    </button>
                    <button onClick={() => agir(o.id, 'echouee')} disabled={busy} className="inline-flex items-center gap-1 text-xs font-bold px-3 rounded-lg disabled:opacity-50" style={{ background: 'rgba(245,158,11,0.15)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.3)', minHeight: 40 }}>
                      <RotateCcw className="w-3.5 h-3.5" /> À retravailler
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>Chaque validation est signée ({profile?.prenom} {profile?.nom}) et horodatée. Aucune validation automatique.</p>
    </div>
  );
}

export function PacStaff({ centreId }: { centreId: string }) {
  return <ErrorBoundary><StaffInner centreId={centreId} /></ErrorBoundary>;
}
