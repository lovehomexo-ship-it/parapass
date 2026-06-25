import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import type { Saut } from '../lib/types';
import { NATURE_SAUT_LABELS, CATEGORIE_LABELS } from '../lib/types';
import { hashSautData } from '../lib/validationCrypto';
import {
  CheckCircle, XCircle, Clock, ShieldCheck, AlertTriangle, Key,
  ChevronRight, Hash, Eye,
} from 'lucide-react';
import { ParachuteIcon } from '../components/ParachuteIcon';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Delegation {
  id: string;
  centre_id: string;
  dt_id: string;
  actif: boolean;
  date_delegation: string;
  date_expiration: string | null;
  note: string | null;
  dt_nom?: string;
  dt_prenom?: string;
  centre_nom?: string;
}

interface SautPending extends Saut {
  parachutiste_nom?: string;
  parachutiste_prenom?: string;
  parachutiste_photo?: string | null;
  parachutiste_brevet?: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fr(d: string) {
  return new Date(d).toLocaleDateString('fr-FR');
}

function daysSince(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function HashBadge({ hash }: { hash: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
      <Hash className="w-2.5 h-2.5" />{hash.slice(0, 8)}…
    </span>
  );
}

// ─── Refus Modal ───────────────────────────────────────────────────────────────

const REFUS_MOTIFS = [
  'Informations incorrectes',
  'Saut non encadré par le centre',
  'Données manquantes',
  'Autre',
];

function RefusModal({ saut, onConfirm, onCancel }: {
  saut: SautPending;
  onConfirm: (motif: string, precision: string) => void;
  onCancel: () => void;
}) {
  const [motif, setMotif] = useState('');
  const [precision, setPrecision] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-[#001A4D] flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-500" /> Motif du refus
        </h2>
        <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
          <strong>{saut.parachutiste_prenom} {saut.parachutiste_nom}</strong> — {fr(saut.date_saut)} — {saut.lieu}
        </div>
        <div className="space-y-2">
          {REFUS_MOTIFS.map(m => (
            <label key={m} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
              motif === m ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input type="radio" name="motif" value={m} checked={motif === m}
                onChange={() => setMotif(m)} className="w-4 h-4 text-red-500" />
              <span className="text-sm text-gray-700">{m}</span>
            </label>
          ))}
        </div>
        {motif === 'Autre' && (
          <textarea
            value={precision}
            onChange={e => setPrecision(e.target.value)}
            placeholder="Précisions..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
          />
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition">
            Annuler
          </button>
          <button
            onClick={() => onConfirm(motif, precision)}
            disabled={!motif}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition"
          >
            <XCircle className="w-4 h-4" /> Confirmer le refus
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Validation 3-step Modal ───────────────────────────────────────────────────

function ValidationModal({ saut, moniteurNom, moniteurBrevet, dtNom, delegationId, onDone, onCancel }: {
  saut: SautPending;
  moniteurNom: string;
  moniteurBrevet: string;
  dtNom: string;
  delegationId: string;
  onDone: (sigUrl: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [presence, setPresence] = useState<'present' | 'dossier' | null>(null);
  const [notes, setNotes] = useState({ tete: 0, bras: 0, observation: '' });
  const [confirmed, setConfirmed] = useState(false);
  const [signing, setSigning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [canvasEmpty, setCanvasEmpty] = useState(true);

  // Canvas drawing
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
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
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#001A4D';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    setCanvasEmpty(false);
  };

  const endDraw = () => setDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setCanvasEmpty(true);
  };

  const handleSign = async () => {
    if (!canvasRef.current || canvasEmpty || !confirmed) return;
    setSigning(true);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onDone(dataUrl);
  };

  const ScoreButtons = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button"
          onClick={() => onChange(n)}
          className={`w-8 h-8 rounded-lg text-sm font-semibold transition ${
            value === n ? 'bg-[#001A4D] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >{n}</button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-[#001A4D]">Validation du saut</h2>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map(n => (
                <div key={n}
                  className={`w-6 h-1.5 rounded-full transition-colors ${step >= n ? 'bg-[#001A4D]' : 'bg-gray-200'}`}
                />
              ))}
            </div>
          </div>
          <div className="text-xs text-gray-400">Étape {step}/3</div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Saut summary (always visible) */}
          <div className="bg-gray-50 rounded-xl p-3 mb-5 text-sm">
            <p className="font-semibold text-[#001A4D]">{saut.parachutiste_prenom} {saut.parachutiste_nom}</p>
            <p className="text-gray-500 text-xs mt-0.5">
              {fr(saut.date_saut)} · {saut.lieu} · {saut.hauteur_m.toLocaleString('fr-FR')} m · {CATEGORIE_LABELS[saut.categorie] ?? saut.categorie}
            </p>
            {saut.nature_saut && saut.nature_saut !== 'entrainement' && (
              <p className="text-xs text-gray-400 mt-0.5">{NATURE_SAUT_LABELS[saut.nature_saut] ?? saut.nature_saut}</p>
            )}
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 mb-4">Avez-vous encadré ce saut ?</p>
              {[
                { value: 'present' as const, label: 'Oui, j\'étais présent' },
                { value: 'dossier' as const, label: 'Validation sur dossier (DT)' },
              ].map(opt => (
                <label key={opt.value} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition ${
                  presence === opt.value ? 'border-[#001A4D] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input type="radio" name="presence" value={opt.value}
                    checked={presence === opt.value}
                    onChange={() => setPresence(opt.value)}
                    className="w-4 h-4 text-[#001A4D]"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">Notes rapides <span className="text-gray-400 font-normal">(optionnel)</span></p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Position tête</span>
                  <ScoreButtons value={notes.tete} onChange={v => setNotes(n => ({ ...n, tete: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Position bras</span>
                  <ScoreButtons value={notes.bras} onChange={v => setNotes(n => ({ ...n, bras: v }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Observation</label>
                <textarea
                  value={notes.observation}
                  onChange={e => setNotes(n => ({ ...n, observation: e.target.value }))}
                  placeholder="Bon saut, stable en chute..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-[#001A4D] space-y-1">
                <p className="font-semibold">Je soussigné(e)</p>
                <p className="font-bold text-base">{moniteurNom}</p>
                <p className="text-xs text-gray-500">{moniteurBrevet}</p>
                <p className="text-xs text-gray-500 mt-1">par délégation du DT {dtNom}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Signature</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden"
                  style={{ touchAction: 'none' }}>
                  <canvas
                    ref={canvasRef}
                    width={380}
                    height={120}
                    className="w-full cursor-crosshair bg-white block"
                    onMouseDown={startDraw}
                    onMouseMove={doDraw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={doDraw}
                    onTouchEnd={endDraw}
                  />
                </div>
                <button onClick={clearCanvas}
                  className="mt-1 text-xs text-gray-400 hover:text-gray-600 transition">
                  Effacer
                </button>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-[#001A4D] rounded"
                />
                <span className="text-sm text-gray-600">
                  Je confirme l'exactitude des informations et valide ce saut sous ma responsabilité
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button
            onClick={step === 1 ? onCancel : () => setStep(s => (s - 1) as 1 | 2 | 3)}
            className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition"
          >
            {step === 1 ? 'Annuler' : '← Retour'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(s => (s + 1) as 2 | 3)}
              disabled={step === 1 && !presence}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#001A4D] text-white rounded-xl text-sm font-medium hover:bg-[#001A4D]/90 disabled:opacity-50 transition"
            >
              Suivant →
            </button>
          ) : (
            <button
              onClick={handleSign}
              disabled={canvasEmpty || !confirmed || signing}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition"
            >
              {signing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
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
  saut: SautPending;
  showActions: boolean;
  onValidate: () => void;
  onRefuse: () => void;
}) {
  const days = daysSince(saut.created_at);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#001A4D] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
            {`${(saut.parachutiste_prenom?.[0] ?? '').toUpperCase()}${(saut.parachutiste_nom?.[0] ?? '').toUpperCase()}`}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[#001A4D]">
                {saut.parachutiste_prenom} {saut.parachutiste_nom}
              </span>
              {saut.parachutiste_brevet && (
                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                  {saut.parachutiste_brevet}
                </span>
              )}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                saut.statut === 'valide' ? 'bg-green-100 text-green-700' :
                saut.statut === 'refuse' ? 'bg-red-100 text-red-700' :
                'bg-orange-100 text-orange-700'
              }`}>
                {saut.statut === 'valide' ? 'Validé' : saut.statut === 'refuse' ? 'Refusé' : 'En attente'}
              </span>
              {saut.validation_hash && <HashBadge hash={saut.validation_hash} />}
            </div>
            <div className="text-sm text-gray-500 flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
              <span>{fr(saut.date_saut)}</span>
              <span>·</span>
              <span>{saut.lieu}</span>
              <span>·</span>
              <span>{CATEGORIE_LABELS[saut.categorie] ?? saut.categorie}</span>
              <span>·</span>
              <span>{saut.hauteur_m.toLocaleString('fr-FR')} m</span>
            </div>
            {saut.nature_saut && (
              <p className="text-xs text-gray-400 mt-0.5">{NATURE_SAUT_LABELS[saut.nature_saut] ?? saut.nature_saut}</p>
            )}
            {saut.statut === 'en_attente' && days > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3 text-amber-500" />
                <span className={`text-xs font-medium ${days > 14 ? 'text-red-500' : 'text-amber-500'}`}>
                  En attente depuis {days} jour{days > 1 ? 's' : ''}
                </span>
              </div>
            )}
            {saut.statut === 'valide' && saut.valide_le && (
              <div className="flex items-center gap-1 mt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                <p className="text-xs text-green-600 font-medium">
                  Validé le {new Date(saut.valide_le).toLocaleString('fr-FR', {
                    timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit',
                    year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                  {saut.valide_par && ` par ${saut.valide_par}`}
                </p>
              </div>
            )}
          </div>
        </div>

        {showActions && (
          <div className="flex gap-2 flex-shrink-0 sm:flex-col">
            <button
              onClick={onValidate}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <CheckCircle className="w-4 h-4" /> Valider
            </button>
            <button
              onClick={onRefuse}
              className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <XCircle className="w-4 h-4" /> Refuser
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function MoniteurPage() {
  const { user, profile } = useAuth();

  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [delegationLoading, setDelegationLoading] = useState(true);

  const [pending, setPending] = useState<SautPending[]>([]);
  const [validated, setValidated] = useState<SautPending[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'validated'>('pending');

  // Validation modal state
  const [validationSaut, setValidationSaut] = useState<SautPending | null>(null);
  const [refusSaut, setRefusSaut] = useState<SautPending | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // ── Load delegation ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      setDelegationLoading(true);
      const { data } = await supabase
        .from('delegations_validation')
        .select('*')
        .eq('moniteur_id', user.id)
        .eq('actif', true)
        .maybeSingle();

      if (data) {
        const d = data as Delegation;
        // Check expiry
        if (d.date_expiration && new Date(d.date_expiration) < new Date()) {
          await supabase.from('delegations_validation').update({ actif: false }).eq('id', d.id);
          setDelegation(null);
        } else {
          // Load DT and centre names
          const [dtRes, centreRes] = await Promise.all([
            supabase.from('profiles').select('nom, prenom').eq('id', d.dt_id).maybeSingle(),
            supabase.from('centres').select('nom').eq('id', d.centre_id).maybeSingle(),
          ]);
          setDelegation({
            ...d,
            dt_nom: dtRes.data ? `${(dtRes.data as { prenom: string }).prenom} ${(dtRes.data as { nom: string }).nom}` : '?',
            centre_nom: (centreRes.data as { nom: string } | null)?.nom ?? '?',
          });
        }
      }
      setDelegationLoading(false);
    })();
  }, [user]);

  // ── Load sauts ────────────────────────────────────────────────────────────────
  const fetchSauts = useCallback(async () => {
    if (!user || !delegation) return;
    setLoading(true);

    // Get licencies of the centre
    const { data: licencies } = await supabase
      .from('licencies_centres')
      .select('parachutiste_id')
      .eq('centre_id', delegation.centre_id)
      .eq('statut', 'actif');

    const ids = (licencies ?? []).map((l: { parachutiste_id: string }) => l.parachutiste_id);

    if (ids.length === 0) {
      setPending([]);
      setValidated([]);
      setLoading(false);
      return;
    }

    const enrich = async (rows: Record<string, unknown>[]) =>
      Promise.all(rows.map(async (s) => {
        const { data: p } = await supabase
          .from('profiles')
          .select('nom, prenom, photo_profil_url')
          .eq('id', s.parachutiste_id as string)
          .maybeSingle();
        const { data: b } = await supabase
          .from('brevets')
          .select('type_brevet')
          .eq('parachutiste_id', s.parachutiste_id as string)
          .order('date_obtention', { ascending: false })
          .limit(1)
          .maybeSingle();
        return {
          ...s,
          parachutiste_nom: (p as { nom: string } | null)?.nom ?? '?',
          parachutiste_prenom: (p as { prenom: string } | null)?.prenom ?? '?',
          parachutiste_photo: (p as { photo_profil_url: string | null } | null)?.photo_profil_url ?? null,
          parachutiste_brevet: (b as { type_brevet: string } | null)?.type_brevet ?? null,
        } as SautPending;
      }));

    const { data: pendingData } = await supabase
      .from('sauts')
      .select('*')
      .eq('statut', 'en_attente')
      .in('parachutiste_id', ids)
      // Don't let a moniteur validate their own sauts
      .neq('parachutiste_id', user.id)
      .order('created_at', { ascending: true });

    const { data: validatedData } = await supabase
      .from('sauts')
      .select('*')
      .in('statut', ['valide', 'refuse'])
      .in('parachutiste_id', ids)
      .eq('valide_par', `${profile?.prenom ?? ''} ${profile?.nom ?? ''}`.trim())
      .order('valide_le', { ascending: false })
      .limit(50);

    if (pendingData) setPending(await enrich(pendingData as Record<string, unknown>[]));
    if (validatedData) setValidated(await enrich(validatedData as Record<string, unknown>[]));
    setLoading(false);
  }, [user, delegation, profile]);

  useEffect(() => {
    if (delegation) fetchSauts();
  }, [fetchSauts, delegation]);

  // ── Validation ────────────────────────────────────────────────────────────────
  const handleValidationDone = async (saut: SautPending, sigUrl: string) => {
    if (!user || !profile || !delegation) return;
    setValidationSaut(null);

    // Re-check delegation is still active
    const { data: freshDel } = await supabase
      .from('delegations_validation')
      .select('*')
      .eq('id', delegation.id)
      .eq('actif', true)
      .maybeSingle();

    if (!freshDel) {
      alert('Votre délégation a été révoquée. Vous ne pouvez plus valider ce saut.');
      return;
    }

    const timestampUtc = new Date().toISOString();
    const validateur = `${profile.prenom} ${profile.nom}`;

    const hash = await hashSautData({
      saut_id: saut.id,
      parachutiste_id: saut.parachutiste_id,
      moniteur_id: user.id,
      date_saut: saut.date_saut,
      lieu: saut.lieu,
      aeronef: saut.aeronef_immat,
      hauteur: saut.hauteur_m,
      categorie: saut.categorie,
      timestamp_validation: timestampUtc,
    });

    await supabase.from('sauts').update({
      statut: 'valide',
      valide_par: validateur,
      valide_le: timestampUtc,
      validation_hash: hash,
      validation_timestamp: timestampUtc,
      signature_moniteur_url: sigUrl,
    }).eq('id', saut.id);

    await supabase.from('audit_log').insert({
      action: 'saut_valide',
      acteur_id: user.id,
      acteur_nom: validateur,
      acteur_role: 'moniteur_delegue',
      acteur_licence_moniteur: (profile as Record<string, unknown>).numero_brevet_moniteur as string ?? null,
      cible_id: saut.id,
      cible_type: 'saut',
      donnees_avant: { statut: 'en_attente' },
      donnees_apres: {
        statut: 'valide',
        valide_par: validateur,
        valide_le: timestampUtc,
        validation_hash: hash,
        delegation_id: delegation.id,
        dt_nom: delegation.dt_nom,
      },
      hash_donnees: hash,
      timestamp_utc: timestampUtc,
    });

    // Notify parachutiste
    await supabase.from('notifications').insert({
      profile_id: saut.parachutiste_id,
      titre: 'Saut validé',
      message: `Votre saut du ${fr(saut.date_saut)} à ${saut.lieu} a été validé par ${validateur} (délégation DT).`,
      type: 'success',
      lue: false,
    }).then(() => {});

    setSuccessId(saut.id);
    setTimeout(() => setSuccessId(null), 3000);
    fetchSauts();
  };

  const handleRefusDone = async (saut: SautPending, motif: string, precision: string) => {
    if (!user || !profile) return;
    setRefusSaut(null);

    const timestampUtc = new Date().toISOString();
    const validateur = `${profile.prenom} ${profile.nom}`;
    const motifFull = motif === 'Autre' && precision ? `Autre : ${precision}` : motif;

    await supabase.from('sauts').update({
      statut: 'refuse',
      valide_par: validateur,
      valide_le: timestampUtc,
    }).eq('id', saut.id);

    await supabase.from('audit_log').insert({
      action: 'saut_refuse',
      acteur_id: user.id,
      acteur_nom: validateur,
      acteur_role: 'moniteur_delegue',
      cible_id: saut.id,
      cible_type: 'saut',
      donnees_avant: { statut: 'en_attente' },
      donnees_apres: { statut: 'refuse', motif: motifFull },
      hash_donnees: null,
      timestamp_utc: timestampUtc,
    });

    await supabase.from('notifications').insert({
      profile_id: saut.parachutiste_id,
      titre: 'Saut refusé',
      message: `Votre saut du ${fr(saut.date_saut)} a été refusé par ${validateur}. Motif : ${motifFull}.`,
      type: 'warning',
      lue: false,
    }).then(() => {});

    fetchSauts();
  };

  // ─────────────────────────────────────────────────────────────────────────────

  const monNom = profile ? `${profile.prenom} ${profile.nom}` : '';
  const monBrevet = (profile as Record<string, unknown>)?.type_brevet_moniteur as string ?? '';
  const monBrevetNum = (profile as Record<string, unknown>)?.numero_brevet_moniteur as string ?? '';
  const monBrevetLabel = [monBrevet, monBrevetNum].filter(Boolean).join(' N°') || 'Moniteur';

  const sauts = activeTab === 'pending' ? pending : validated;

  return (
    <Layout>
      {/* Modals */}
      {validationSaut && delegation && (
        <ValidationModal
          saut={validationSaut}
          moniteurNom={monNom}
          moniteurBrevet={monBrevetLabel}
          dtNom={delegation.dt_nom ?? ''}
          delegationId={delegation.id}
          onDone={(sigUrl) => handleValidationDone(validationSaut, sigUrl)}
          onCancel={() => setValidationSaut(null)}
        />
      )}
      {refusSaut && (
        <RefusModal
          saut={refusSaut}
          onConfirm={(m, p) => handleRefusDone(refusSaut, m, p)}
          onCancel={() => setRefusSaut(null)}
        />
      )}

      {/* Success toast */}
      {successId && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-pulse">
          <CheckCircle className="w-5 h-5" />
          <span className="font-semibold">Saut validé avec succès !</span>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#001A4D]">Espace Moniteur</h1>
            {!delegationLoading && delegation && (
              <p className="text-sm text-gray-500 mt-0.5">
                Centre {delegation.centre_nom}
              </p>
            )}
          </div>
          {(profile as Record<string, unknown>)?.numero_brevet_moniteur && (
            <div className="flex items-center gap-2 bg-[#001A4D]/5 rounded-xl px-3 py-2">
              <ShieldCheck className="w-4 h-4 text-[#001A4D]" />
              <span className="text-xs font-semibold text-[#001A4D]">{monBrevetLabel}</span>
            </div>
          )}
        </div>

        {/* Delegation status */}
        {delegationLoading ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6 flex justify-center">
            <div className="w-6 h-6 border-3 border-[#001A4D] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : delegation ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <Key className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-green-800 flex items-center gap-2">
                Délégation active
                <CheckCircle className="w-4 h-4" />
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                Accordée par {delegation.dt_nom} · {delegation.centre_nom}
                {delegation.date_expiration && (
                  <span className="ml-1">· Expire le {fr(delegation.date_expiration)}</span>
                )}
              </p>
              {delegation.note && <p className="text-xs text-green-600 italic mt-0.5">"{delegation.note}"</p>}
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">Aucune délégation de validation active</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Vous n'avez pas de délégation de validation active. Contactez le Directeur Technique de votre centre pour qu'il vous accorde une délégation dans ParaPass.
              </p>
            </div>
          </div>
        )}

        {/* Tabs — only if delegation */}
        {delegation && (
          <>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 max-w-xs">
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'pending' ? 'bg-white shadow-sm text-[#001A4D]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Clock className="w-4 h-4" /> En attente
                {pending.length > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {pending.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('validated')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'validated' ? 'bg-white shadow-sm text-[#001A4D]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CheckCircle className="w-4 h-4" /> Mes validations
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12"><div className="w-8 h-8 border-4 border-[#001A4D] border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : sauts.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <ParachuteIcon className="w-36 h-36 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">
                  {activeTab === 'pending' ? 'Aucun saut en attente de validation' : 'Aucune validation enregistrée'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sauts.map((saut) => (
                  <SautCard
                    key={saut.id}
                    saut={saut}
                    showActions={activeTab === 'pending'}
                    onValidate={() => setValidationSaut(saut)}
                    onRefuse={() => setRefusSaut(saut)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
