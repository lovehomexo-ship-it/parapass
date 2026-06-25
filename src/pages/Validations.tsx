import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, isDelegationActive } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import type { Saut } from '../lib/types';
import { NATURE_SAUT_LABELS, CATEGORIE_LABELS } from '../lib/types';
import { hashSautData } from '../lib/validationCrypto';
import {
  CheckCircle, XCircle, Clock, ShieldCheck, AlertTriangle, Key,
  Hash, ChevronRight, Calendar, MapPin, Plane, Ruler,
} from 'lucide-react';
import { ParachuteIcon } from '../components/ParachuteIcon';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SautEnriched extends Saut {
  parachutiste_nom?: string;
  parachutiste_prenom?: string;
  parachutiste_brevet?: string | null;
  motif_refus?: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fr(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysSince(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function HashBadge({ hash }: { hash: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
      <Hash className="w-2.5 h-2.5" />{hash.slice(0, 8)}
    </span>
  );
}

// ─── Refus Modal ───────────────────────────────────────────────────────────────

const REFUS_MOTIFS = ['Informations incorrectes', 'Saut non encadré par le centre', 'Données manquantes', 'Autre'];

function RefusModal({ saut, onConfirm, onCancel }: {
  saut: SautEnriched;
  onConfirm: (motif: string, precision: string) => void;
  onCancel: () => void;
}) {
  const [motif, setMotif] = useState('');
  const [precision, setPrecision] = useState('');
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" style={{ background: '#002266', border: '1px solid rgba(255,255,255,0.15)' }}>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-400" /> Motif du refus
        </h2>
        <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>
          <strong className="text-white">{saut.parachutiste_prenom} {saut.parachutiste_nom}</strong> — {fr(saut.date_saut)} — {saut.lieu}
        </div>
        <div className="space-y-2">
          {REFUS_MOTIFS.map(m => (
            <label key={m} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition" style={{ border: `1px solid ${motif === m ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`, background: motif === m ? 'rgba(239,68,68,0.1)' : 'transparent' }}>
              <input type="radio" name="motif" value={m} checked={motif === m} onChange={() => setMotif(m)} className="w-4 h-4 accent-red-500" />
              <span className="text-sm text-white/80">{m}</span>
            </label>
          ))}
        </div>
        {motif === 'Autre' && (
          <textarea value={precision} onChange={e => setPrecision(e.target.value)}
            placeholder="Précisions..." rows={2}
            className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }} />
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-xl transition" style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.06)' }}>Annuler</button>
          <button onClick={() => onConfirm(motif, precision)} disabled={!motif}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
            style={{ background: '#EF4444', color: 'white' }}>
            <XCircle className="w-4 h-4" /> Confirmer le refus
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Validation 3-step Modal ───────────────────────────────────────────────────

function ValidationModal({ saut, moniteurNom, moniteurBrevet, dtNom, onDone, onCancel }: {
  saut: SautEnriched;
  moniteurNom: string;
  moniteurBrevet: string;
  dtNom: string;
  onDone: (sigUrl: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [presence, setPresence] = useState<'present' | 'dossier' | null>(null);
  const [notes, setNotes] = useState({ tete: 0, bras: 0, observation: '' });
  const [showPositions, setShowPositions] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [signing, setSigning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [canvasEmpty, setCanvasEmpty] = useState(true);

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const doDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y); ctx.strokeStyle = '#001A4D'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
    setCanvasEmpty(false);
  };
  const endDraw = () => setDrawing(false);
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setCanvasEmpty(true);
  };
  const handleSign = async () => {
    if (!canvasRef.current || canvasEmpty || !confirmed) return;
    setSigning(true);
    onDone(canvasRef.current.toDataURL('image/png'));
  };

  const ScoreButtons = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className="w-8 h-8 rounded-lg text-sm font-semibold transition"
          style={{ background: value === n ? '#F59E0B' : 'rgba(255,255,255,0.08)', color: value === n ? '#fff' : 'rgba(255,255,255,0.5)' }}>
          {n}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[90vh] overflow-hidden" style={{ background: '#002266', border: '1px solid rgba(255,255,255,0.15)' }}>
        <div className="px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-white">Validation du saut</h2>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map(n => (
                <div key={n} className="w-6 h-1.5 rounded-full transition-colors" style={{ background: step >= n ? '#F59E0B' : 'rgba(255,255,255,0.15)' }} />
              ))}
            </div>
          </div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Étape {step}/3</div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="rounded-xl p-3 mb-5 text-sm" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <p className="font-semibold text-white">{saut.parachutiste_prenom} {saut.parachutiste_nom}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {fr(saut.date_saut)} · {saut.lieu} · {saut.hauteur_m?.toLocaleString('fr-FR')} m · {CATEGORIE_LABELS[saut.categorie] ?? saut.categorie}
            </p>
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-white/70 mb-4">Avez-vous encadré ce saut ?</p>
              {[
                { value: 'present' as const, label: "Oui, j'étais présent" },
                { value: 'dossier' as const, label: 'Validation sur dossier (DT)' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition" style={{ border: `1px solid ${presence === opt.value ? 'rgba(245,158,11,0.6)' : 'rgba(255,255,255,0.1)'}`, background: presence === opt.value ? 'rgba(245,158,11,0.1)' : 'transparent' }}>
                  <input type="radio" name="presence" value={opt.value} checked={presence === opt.value} onChange={() => setPresence(opt.value)} className="w-4 h-4 accent-amber-500" />
                  <span className="text-sm text-white/80">{opt.label}</span>
                </label>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white/70">Notes de progression</p>
                <span className="text-xs italic" style={{ color: 'rgba(255,255,255,0.3)' }}>Optionnel — PAC uniquement</span>
              </div>

              {/* Toggle positions */}
              <button
                type="button"
                onClick={() => setShowPositions((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors text-sm"
                style={{ background: showPositions ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
              >
                <span>{showPositions ? '▼ Masquer les notes de position' : '▶ Ajouter des notes de position'}</span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>PAC uniquement</span>
              </button>

              {showPositions && (
                <div className="space-y-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">Position tête</span>
                    <ScoreButtons value={notes.tete} onChange={v => setNotes(n => ({ ...n, tete: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">Position bras</span>
                    <ScoreButtons value={notes.bras} onChange={v => setNotes(n => ({ ...n, bras: v }))} />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-white/60 mb-1">Observation</label>
                <textarea value={notes.observation} onChange={e => setNotes(n => ({ ...n, observation: e.target.value }))}
                  placeholder="Bon saut, stable en chute..." rows={3} maxLength={500}
                  className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 text-sm space-y-1" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <p className="font-semibold text-amber-400">Je soussigné(e)</p>
                <p className="font-bold text-base text-white">{moniteurNom}</p>
                <p className="text-xs text-white/50">{moniteurBrevet}</p>
                <p className="text-xs text-white/40 mt-1">par délégation du DT {dtNom}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Signature</label>
                <div className="rounded-xl overflow-hidden" style={{ border: '2px dashed rgba(255,255,255,0.2)', touchAction: 'none' }}>
                  <canvas ref={canvasRef} width={380} height={120}
                    className="w-full cursor-crosshair block bg-white"
                    onMouseDown={startDraw} onMouseMove={doDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
                    onTouchStart={startDraw} onTouchMove={doDraw} onTouchEnd={endDraw} />
                </div>
                <button onClick={clearCanvas} className="mt-1 text-xs transition" style={{ color: 'rgba(255,255,255,0.35)' }}>Effacer</button>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-amber-500 rounded" />
                <span className="text-sm text-white/60">Je confirme l'exactitude des informations et valide ce saut sous ma responsabilité</span>
              </label>
            </div>
          )}
        </div>

        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={step === 1 ? onCancel : () => setStep(s => (s - 1) as 1 | 2 | 3)}
            className="px-4 py-2.5 text-sm rounded-xl transition"
            style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.06)' }}>
            {step === 1 ? 'Annuler' : '← Retour'}
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(s => (s + 1) as 2 | 3)} disabled={step === 1 && !presence}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
              style={{ background: '#F59E0B', color: '#fff' }}>
              Suivant <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSign} disabled={canvasEmpty || !confirmed || signing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50"
              style={{ background: '#16A34A', color: '#fff' }}>
              {signing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Signer et valider
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Saut Card ─────────────────────────────────────────────────────────────────

function SautCard({ saut, showActions, onValidate, onRefuse }: {
  saut: SautEnriched;
  showActions: boolean;
  onValidate: () => void;
  onRefuse: () => void;
}) {
  const days = daysSince(saut.created_at);
  const initials = `${(saut.parachutiste_prenom?.[0] ?? '').toUpperCase()}${(saut.parachutiste_nom?.[0] ?? '').toUpperCase()}`;

  return (
    <div className="rounded-xl p-5 transition-all" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white" style={{ background: '#1E3A5F' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-white text-sm">{saut.parachutiste_prenom} {saut.parachutiste_nom}</span>
              {saut.parachutiste_brevet && (
                <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(59,130,246,0.2)', color: '#93C5FD' }}>{saut.parachutiste_brevet}</span>
              )}
              {saut.statut === 'valide' && saut.validation_hash && <HashBadge hash={saut.validation_hash} />}
              {saut.statut === 'refuse' && saut.motif_refus && (
                <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}>Motif : {saut.motif_refus}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fr(saut.date_saut)}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{saut.lieu}</span>
              {saut.aeronef_immat && <span className="flex items-center gap-1"><Plane className="w-3 h-3" />{saut.aeronef_immat}</span>}
              <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />{saut.hauteur_m?.toLocaleString('fr-FR')} m</span>
              <span className="font-medium text-white/70">{CATEGORIE_LABELS[saut.categorie] ?? saut.categorie}</span>
              {saut.nature_saut && <span>{NATURE_SAUT_LABELS[saut.nature_saut] ?? saut.nature_saut}</span>}
            </div>
            {saut.statut === 'en_attente' && days > 0 && (
              <div className="flex items-center gap-1 mt-1.5">
                <Clock className="w-3 h-3 text-amber-400" />
                <span className="text-xs font-medium" style={{ color: days > 14 ? '#F87171' : '#FBBF24' }}>
                  En attente depuis {days} jour{days > 1 ? 's' : ''}
                </span>
              </div>
            )}
            {saut.statut === 'valide' && saut.valide_le && (
              <div className="flex items-center gap-1 mt-1.5">
                <ShieldCheck className="w-3 h-3 text-green-400" />
                <span className="text-xs text-green-400 font-medium">
                  Validé le {new Date(saut.valide_le).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {saut.valide_par && ` par ${saut.valide_par}`}
                </span>
              </div>
            )}
            {saut.statut === 'refuse' && saut.valide_le && (
              <div className="flex items-center gap-1 mt-1.5">
                <XCircle className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-400 font-medium">
                  Refusé le {fr(saut.valide_le)}{saut.valide_par && ` par ${saut.valide_par}`}
                </span>
              </div>
            )}
          </div>
        </div>
        {showActions && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={onValidate}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-white"
              style={{ background: '#16A34A' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
              onMouseLeave={e => (e.currentTarget.style.background = '#16A34A')}>
              <CheckCircle className="w-4 h-4" /> Valider
            </button>
            <button onClick={onRefuse}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-white"
              style={{ background: '#DC2626' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#B91C1C')}
              onMouseLeave={e => (e.currentTarget.style.background = '#DC2626')}>
              <XCircle className="w-4 h-4" /> Refuser
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type TabId = 'pending' | 'validated' | 'refused';

export function ValidationsPage() {
  const { user, profile, delegation } = useAuth();
  const navigate = useNavigate();

  const [pending, setPending] = useState<SautEnriched[]>([]);
  const [validated, setValidated] = useState<SautEnriched[]>([]);
  const [refused, setRefused] = useState<SautEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('pending');
  const [validationSaut, setValidationSaut] = useState<SautEnriched | null>(null);
  const [refusSaut, setRefusSaut] = useState<SautEnriched | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const hasActiveDelegation = isDelegationActive(delegation);

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); }
  }, [user, navigate]);

  // Enrich sauts with profile data
  const enrich = useCallback(async (rows: Record<string, unknown>[]) =>
    Promise.all(rows.map(async (s) => {
      const { data: p } = await supabase
        .from('profiles').select('nom, prenom').eq('id', s.parachutiste_id as string).maybeSingle();
      const { data: b } = await supabase
        .from('brevets').select('type_brevet').eq('parachutiste_id', s.parachutiste_id as string)
        .order('date_obtention', { ascending: false }).limit(1).maybeSingle();
      return {
        ...s,
        parachutiste_nom: (p as { nom: string } | null)?.nom ?? '?',
        parachutiste_prenom: (p as { prenom: string } | null)?.prenom ?? '?',
        parachutiste_brevet: (b as { type_brevet: string } | null)?.type_brevet ?? null,
      } as SautEnriched;
    })), []);

  // Stable fetch — depends only on delegation.id (not the whole object or fetchSauts itself)
  const fetchSauts = useCallback(async () => {
    if (!user || !delegation || !hasActiveDelegation) { setLoading(false); return; }
    setLoading(true);

    const { data: licencies } = await supabase
      .from('licencies_centres').select('parachutiste_id')
      .eq('centre_id', delegation.centre_id).eq('statut', 'actif');

    const ids = (licencies ?? []).map((l: { parachutiste_id: string }) => l.parachutiste_id);

    if (ids.length === 0) { setPending([]); setValidated([]); setRefused([]); setLoading(false); return; }

    const validateur = `${profile?.prenom ?? ''} ${profile?.nom ?? ''}`.trim();

    const [pendingRes, validatedRes, refusedRes] = await Promise.all([
      supabase.from('sauts').select('*').eq('statut', 'en_attente').in('parachutiste_id', ids).neq('parachutiste_id', user.id).order('created_at', { ascending: true }),
      supabase.from('sauts').select('*').eq('statut', 'valide').in('parachutiste_id', ids).eq('valide_par', validateur).order('valide_le', { ascending: false }).limit(100),
      supabase.from('sauts').select('*').eq('statut', 'refuse').in('parachutiste_id', ids).eq('valide_par', validateur).order('valide_le', { ascending: false }).limit(100),
    ]);

    const [pendingEnriched, validatedEnriched, refusedEnriched] = await Promise.all([
      enrich((pendingRes.data ?? []) as Record<string, unknown>[]),
      enrich((validatedRes.data ?? []) as Record<string, unknown>[]),
      enrich((refusedRes.data ?? []) as Record<string, unknown>[]),
    ]);

    setPending(pendingEnriched);
    setValidated(validatedEnriched);
    setRefused(refusedEnriched);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delegation?.id, user?.id]);

  // Trigger fetch only when delegation ID changes (stable dep, no loop)
  useEffect(() => {
    fetchSauts();
  }, [fetchSauts]);

  // Realtime: when any saut changes statut, update pending list immediately
  useEffect(() => {
    if (!delegation?.centre_id) return;

    const channel = supabase
      .channel(`validations-rt-${delegation.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sauts' },
        async (payload) => {
          // New saut added — re-fetch if it's en_attente for this centre
          if ((payload.new as Saut).statut === 'en_attente') {
            fetchSauts();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sauts' },
        (payload) => {
          const updated = payload.new as Saut;
          if (updated.statut !== 'en_attente') {
            // Saut was validated or refused — remove from pending list immediately
            setPending(prev => prev.filter(s => s.id !== updated.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delegation?.id]);

  // Validation
  const handleValidationDone = async (saut: SautEnriched, sigUrl: string) => {
    if (!user || !profile || !delegation) return;
    setValidationSaut(null);

    const { data: freshDel } = await supabase
      .from('delegations_validation').select('*').eq('id', delegation.id).eq('actif', true).maybeSingle();
    if (!freshDel) { alert("Votre délégation a été révoquée. Vous ne pouvez plus valider ce saut."); return; }

    const now = new Date().toISOString();
    const validateur = `${profile.prenom} ${profile.nom}`;
    const hash = await hashSautData({
      saut_id: saut.id, parachutiste_id: saut.parachutiste_id, moniteur_id: user.id,
      date_saut: saut.date_saut, lieu: saut.lieu, aeronef: saut.aeronef_immat,
      hauteur: saut.hauteur_m, categorie: saut.categorie, timestamp_validation: now,
    });

    await supabase.from('sauts').update({
      statut: 'valide', valide_par: validateur, valide_le: now,
      validation_hash: hash, validation_timestamp: now, signature_moniteur_url: sigUrl,
    }).eq('id', saut.id).eq('statut', 'en_attente');

    await supabase.from('audit_log').insert({
      action: 'saut_valide', acteur_id: user.id, acteur_nom: validateur, acteur_role: 'moniteur_delegue',
      cible_id: saut.id, cible_type: 'saut',
      donnees_avant: { statut: 'en_attente' },
      donnees_apres: { statut: 'valide', valide_par: validateur, validation_hash: hash, delegation_id: delegation.id },
      hash_donnees: hash, timestamp_utc: now,
    });

    await supabase.from('notifications').insert({
      profile_id: saut.parachutiste_id, titre: 'Saut validé',
      message: `Votre saut du ${fr(saut.date_saut)} à ${saut.lieu} a été validé par ${validateur}.`,
      type: 'success', lue: false,
    });

    // Remove immediately from local state — Realtime will do the same for other moniteurs
    setPending(prev => prev.filter(s => s.id !== saut.id));
    setSuccessId(saut.id);
    setTimeout(() => setSuccessId(null), 3000);
    // Refresh validated/refused lists
    fetchSauts();
  };

  const handleRefusDone = async (saut: SautEnriched, motif: string, precision: string) => {
    if (!user || !profile) return;
    setRefusSaut(null);
    const now = new Date().toISOString();
    const validateur = `${profile.prenom} ${profile.nom}`;
    const motifFull = motif === 'Autre' && precision ? `Autre : ${precision}` : motif;

    await supabase.from('sauts').update({ statut: 'refuse', valide_par: validateur, valide_le: now }).eq('id', saut.id).eq('statut', 'en_attente');
    await supabase.from('audit_log').insert({
      action: 'saut_refuse', acteur_id: user.id, acteur_nom: validateur, acteur_role: 'moniteur_delegue',
      cible_id: saut.id, cible_type: 'saut',
      donnees_avant: { statut: 'en_attente' }, donnees_apres: { statut: 'refuse', motif: motifFull },
      hash_donnees: null, timestamp_utc: now,
    });
    await supabase.from('notifications').insert({
      profile_id: saut.parachutiste_id, titre: 'Saut refusé',
      message: `Votre saut du ${fr(saut.date_saut)} a été refusé par ${validateur}. Motif : ${motifFull}.`,
      type: 'warning', lue: false,
    });

    setPending(prev => prev.filter(s => s.id !== saut.id));
    fetchSauts();
  };

  // Bulk validate
  const handleBulkValidate = async () => {
    if (!user || !profile || !delegation || pending.length === 0) return;
    setBulkLoading(true);
    for (const saut of pending) {
      const now = new Date().toISOString();
      const validateur = `${profile.prenom} ${profile.nom}`;
      const hash = await hashSautData({
        saut_id: saut.id, parachutiste_id: saut.parachutiste_id, moniteur_id: user.id,
        date_saut: saut.date_saut, lieu: saut.lieu, aeronef: saut.aeronef_immat,
        hauteur: saut.hauteur_m, categorie: saut.categorie, timestamp_validation: now,
      });
      await supabase.from('sauts').update({
        statut: 'valide', valide_par: validateur, valide_le: now,
        validation_hash: hash, validation_timestamp: now,
      }).eq('id', saut.id).eq('statut', 'en_attente');
      await supabase.from('notifications').insert({
        profile_id: saut.parachutiste_id, titre: 'Saut validé',
        message: `Votre saut du ${fr(saut.date_saut)} à ${saut.lieu} a été validé par ${validateur}.`,
        type: 'success', lue: false,
      });
    }
    setPending([]);
    setBulkLoading(false);
    setBulkConfirm(false);
    fetchSauts();
  };

  const monNom = profile ? `${profile.prenom} ${profile.nom}` : '';
  const monBrevet = (profile as Record<string, unknown>)?.numero_brevet_moniteur as string ?? '';

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'pending', label: 'En attente', count: pending.length },
    { id: 'validated', label: 'Validés', count: validated.length },
    { id: 'refused', label: 'Refusés', count: refused.length },
  ];

  const currentList = activeTab === 'pending' ? pending : activeTab === 'validated' ? validated : refused;

  return (
    <Layout noPadding>
      {validationSaut && delegation && (
        <ValidationModal
          saut={validationSaut}
          moniteurNom={monNom}
          moniteurBrevet={monBrevet || 'Moniteur'}
          dtNom={delegation.dt ? `${delegation.dt.prenom} ${delegation.dt.nom}` : '?'}
          onDone={(sigUrl) => handleValidationDone(validationSaut, sigUrl)}
          onCancel={() => setValidationSaut(null)}
        />
      )}
      {refusSaut && (
        <RefusModal saut={refusSaut}
          onConfirm={(m, p) => handleRefusDone(refusSaut, m, p)}
          onCancel={() => setRefusSaut(null)} />
      )}
      {bulkConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" style={{ background: '#002266', border: '1px solid rgba(255,255,255,0.15)' }}>
            <h2 className="text-lg font-bold text-white">Tout valider</h2>
            <p className="text-sm text-white/60">
              Valider les <strong className="text-white">{pending.length} sauts</strong> en attente ? Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setBulkConfirm(false)} className="px-4 py-2 text-sm rounded-xl transition" style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.06)' }}>Annuler</button>
              <button onClick={handleBulkValidate} disabled={bulkLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
                style={{ background: '#16A34A', color: 'white' }}>
                {bulkLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
      {successId && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2" style={{ background: '#16A34A', color: 'white' }}>
          <CheckCircle className="w-5 h-5" />
          <span className="font-semibold">Saut validé avec succès !</span>
        </div>
      )}

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6" style={{ background: '#001A4D', minHeight: 'calc(100vh - 64px)' }}>
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-amber-400" /> Mes Validations
            </h1>
            {delegation && (
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Délégation accordée par {delegation.dt ? `${delegation.dt.prenom} ${delegation.dt.nom}` : '?'} — {delegation.centre?.nom ?? '?'}
                {delegation.date_expiration
                  ? ` — Expire le ${fr(delegation.date_expiration)}`
                  : ' — Permanente'}
              </p>
            )}
          </div>

          {/* Delegation status card */}
          {hasActiveDelegation && delegation ? (
            <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <Key className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-green-400 flex items-center gap-2">
                  Délégation active <CheckCircle className="w-4 h-4" />
                </p>
                <div className="text-xs text-green-300 mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span>Centre : <strong>{delegation.centre?.nom ?? '?'}</strong></span>
                  <span>DT : <strong>{delegation.dt ? `${delegation.dt.prenom} ${delegation.dt.nom}` : '?'}</strong></span>
                  <span>Depuis : <strong>{fr(delegation.date_delegation)}</strong></span>
                  <span>Expire : <strong>{delegation.date_expiration ? fr(delegation.date_expiration) : 'Permanente'}</strong></span>
                </div>
                {delegation.note && <p className="text-xs text-green-400 italic mt-1.5">"{delegation.note}"</p>}
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-5 flex items-start gap-3" style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)' }}>
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-400">Aucune délégation de validation active</p>
                <p className="text-xs text-amber-300/70 mt-1">
                  Contactez le Directeur Technique de votre centre pour qu'il vous accorde une délégation dans ParaPass.
                </p>
              </div>
            </div>
          )}

          {/* Content — only if active delegation */}
          {hasActiveDelegation && (
            <>
              {/* Tabs */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex gap-0 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
                  {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className="flex items-center gap-2 py-2 px-4 text-sm font-medium transition-colors"
                      style={{
                        background: activeTab === tab.id ? 'white' : 'transparent',
                        color: activeTab === tab.id ? '#001A4D' : 'rgba(255,255,255,0.5)',
                        borderBottom: activeTab === tab.id ? '2px solid #F59E0B' : '2px solid transparent',
                      }}>
                      {tab.label}
                      {tab.count != null && tab.count > 0 && (
                        <span className="text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
                          style={{ background: tab.id === 'pending' ? '#F59E0B' : 'rgba(255,255,255,0.15)', color: tab.id === 'pending' ? '#fff' : 'rgba(255,255,255,0.7)' }}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {activeTab === 'pending' && pending.length >= 3 && (
                  <button onClick={() => setBulkConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white"
                    style={{ background: '#16A34A' }}>
                    <CheckCircle className="w-4 h-4" /> Tout valider ({pending.length})
                  </button>
                )}
              </div>

              {/* List */}
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  ))}
                </div>
              ) : currentList.length === 0 ? (
                <div className="rounded-xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <ParachuteIcon className="w-28 h-28 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.1)' }} />
                  <p className="font-medium text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {activeTab === 'pending'
                      ? 'Aucun saut en attente de validation'
                      : activeTab === 'validated'
                      ? 'Aucune validation enregistrée'
                      : 'Aucun refus enregistré'}
                  </p>
                  {activeTab === 'pending' && (
                    <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Les nouveaux sauts apparaîtront ici automatiquement.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {currentList.map(saut => (
                    <SautCard key={saut.id} saut={saut}
                      showActions={activeTab === 'pending'}
                      onValidate={() => setValidationSaut(saut)}
                      onRefuse={() => setRefusSaut(saut)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
