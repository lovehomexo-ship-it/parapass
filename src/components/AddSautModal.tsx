import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useDemo } from '../lib/useDemo';
import { X, ChevronDown, ChevronUp, AlertTriangle, Check, Search, Info } from 'lucide-react';
import { NATURE_SAUT_LABELS, CATEGORIE_LABELS, FONCTION_LABELS } from '../lib/types';
import type { Saut, NotationTernaire } from '../lib/types';
import { ReAuthModal } from './ReAuthModal';
import { hashSautData } from '../lib/validationCrypto';
import { getRegles } from '../data/reglesFFP';

type ProgressionTernaire = 'non' | 'en_cours' | 'maitrise' | null;

interface AddSautModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: (saut: Saut) => void;
  userBrevet?: string | null;
  sautAEditer?: Saut | null;
  targetParachutisteId?: string; // when set, admin is logging a jump FOR this parachutist
}

const darkInput: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10,
  color: 'white',
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
};
const darkInputErr: React.CSSProperties = {
  ...darkInput,
  borderColor: 'rgba(239,68,68,0.6)',
};
const inputCls = '';
const inputErrCls = '';
const labelCls = 'block text-sm font-medium mb-1' as const;

// ─── Notation ternaire ────────────────────────────────────────────────────────
const TERNAIRE_OPTIONS: { value: NotationTernaire; label: string; short: string; color: string; bg: string }[] = [
  { value: 'a_retravailler', label: 'À retravailler', short: '✗', color: 'text-white', bg: 'bg-red-500' },
  { value: 'correct', label: 'Correct', short: '~', color: 'text-white', bg: 'bg-amber-500' },
  { value: 'bon', label: 'Bon', short: '✓', color: 'text-white', bg: 'bg-green-500' },
];

function TernaireSelector({ label, value, onChange, tooltip }: {
  label: string;
  value: NotationTernaire;
  onChange: (v: NotationTernaire) => void;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1.5 w-36 flex-shrink-0">
        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
        {tooltip && (
          <Info className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} title={tooltip} />
        )}
      </div>
      <div className="flex gap-1.5">
        {TERNAIRE_OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(selected ? null : opt.value)}
              className={`w-9 h-9 rounded-lg text-sm font-bold transition-all border ${
                selected
                  ? `${opt.bg} ${opt.color} border-transparent shadow-sm scale-105`
                  : ''
              }`}
              style={selected ? {} : {
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.4)',
                borderColor: 'rgba(255,255,255,0.12)',
              }}
              title={opt.label}
            >
              {opt.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Progression ternaire selector ────────────────────────────────────────────
const PROGRESSION_TERNAIRE_OPTIONS: { value: ProgressionTernaire; label: string; short: string; color: string; bg: string }[] = [
  { value: 'non', label: 'Non maîtrisé', short: '✗', color: 'text-white', bg: 'bg-red-500' },
  { value: 'en_cours', label: 'En cours', short: '~', color: 'text-white', bg: 'bg-amber-500' },
  { value: 'maitrise', label: 'Maîtrisé', short: '✓', color: 'text-white', bg: 'bg-green-500' },
];

function ProgTernaireSelector({ label, value, onChange, tooltip }: {
  label: string;
  value: ProgressionTernaire;
  onChange: (v: ProgressionTernaire) => void;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1.5 w-36 flex-shrink-0">
        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
        {tooltip && (
          <Info className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} title={tooltip} />
        )}
      </div>
      <div className="flex gap-1.5">
        {PROGRESSION_TERNAIRE_OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(selected ? null : opt.value)}
              className={`w-9 h-9 rounded-lg text-sm font-bold transition-all border ${
                selected
                  ? `${opt.bg} ${opt.color} border-transparent shadow-sm scale-105`
                  : ''
              }`}
              style={selected ? {} : {
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.4)',
                borderColor: 'rgba(255,255,255,0.12)',
              }}
              title={opt.label}
            >
              {opt.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Notation étoiles 1-5 ────────────────────────────────────────────────────
const STAR_COLORS = ['', '#EF4444', '#F59E0B', '#EAB308', '#84CC16', '#10B981'];
const STAR_LABELS = ['', 'À travailler', 'En progression', 'Correct', 'Bien', 'Excellent'];

function StarSelector({ label, icon, value, onChange, labels: customLabels }: {
  label: string;
  icon: string;
  value: number | null;
  onChange: (v: number | null) => void;
  labels?: string[];
}) {
  const displayLabels = customLabels || STAR_LABELS;
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
        {value && (
          <span className="ml-auto text-xs font-medium" style={{ color: STAR_COLORS[value] }}>
            {displayLabels[value]}
          </span>
        )}
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(selected ? null : n)}
              style={selected ? { background: STAR_COLORS[n], color: '#fff', borderColor: 'transparent' } : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.12)' }}
              className="flex-1 h-9 rounded-lg text-xs font-bold transition-all"
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Global rating (5 large clickable stars) ──────────────────────────────────
function GlobalRating({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const labels = ['', 'Difficile', 'Moyen', 'Correct', 'Bon saut', 'Excellent saut !'];
  return (
    <div className="space-y-2">
      <div className="flex gap-2 justify-center">
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); onChange(selected ? null : n); }}
              className="transition-transform"
              style={{
                fontSize: '32px',
                lineHeight: 1,
                color: (value ?? 0) >= n ? '#F97316' : 'rgba(255,255,255,0.15)',
                cursor: 'pointer',
                transform: selected ? 'scale(1.15)' : 'scale(1)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              ★
            </button>
          );
        })}
      </div>
      {value && (
        <p className="text-xs text-center font-medium" style={{ color: '#F97316' }}>
          {labels[value]}
        </p>
      )}
    </div>
  );
}

// ─── Chip text field ──────────────────────────────────────────────────────────
function ChipTextField({ value, onChange, chips, placeholder, rows }: {
  value: string;
  onChange: (v: string) => void;
  chips: string[];
  placeholder?: string;
  rows?: number;
}) {
  const handleChipClick = (chip: string) => {
    const newValue = value ? `${value}, ${chip}` : chip;
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => handleChipClick(chip)}
            className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              background: 'rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
            }}
          >
            {chip}
          </button>
        ))}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows ?? 2}
        placeholder={placeholder}
        style={{ ...darkInput, resize: 'none', fontSize: 12 }}
      />
    </div>
  );
}

// ─── Signature canvas ─────────────────────────────────────────────────────────
function SignatureCanvas({ onSave, onClear }: { onSave: (dataUrl: string) => void; onClear: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSig, setHasSig] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent, c: HTMLCanvasElement) => {
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width; const sy = c.height / r.height;
    if ('touches' in e) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); drawing.current = true;
    const c = canvasRef.current!; const ctx = c.getContext('2d')!;
    const p = getPos(e, c); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return; e.preventDefault();
    const c = canvasRef.current!; const ctx = c.getContext('2d')!;
    const p = getPos(e, c); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#001A4D';
    ctx.lineTo(p.x, p.y); ctx.stroke(); setHasSig(true);
  };
  const stop = () => {
    drawing.current = false;
    if (hasSig) onSave(canvasRef.current!.toDataURL('image/png'));
  };

  const clear = () => {
    const c = canvasRef.current!; const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#F8FAFC'; ctx.fillRect(0, 0, c.width, c.height);
    setHasSig(false); onClear();
  };

  useEffect(() => {
    const c = canvasRef.current!; const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#F8FAFC'; ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef} width={600} height={120}
        className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-[#F8FAFC] touch-none"
        style={{ cursor: 'crosshair', minHeight: '80px' }}
        onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
      />
      <div className="flex items-center gap-3">
        <button type="button" onClick={clear} className="text-xs text-gray-500 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">
          Effacer
        </button>
        {hasSig && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Signature tracée</span>}
      </div>
    </div>
  );
}

interface MoniteurSuggestion {
  id: string;
  nom: string;
  prenom: string;
  avatar_url: string | null;
  numero_brevet_moniteur: string | null;
  type_brevet_moniteur: string | null;
  centre_nom?: string | null;
  role_centre?: string;
}

const ENVOI_TOUS_ID = '__tous__';
const ENVOI_TOUS_SENTINEL: MoniteurSuggestion = {
  id: ENVOI_TOUS_ID,
  nom: '',
  prenom: 'Envoyer à tous les validateurs',
  avatar_url: null,
  numero_brevet_moniteur: null,
  type_brevet_moniteur: null,
  role_centre: 'tous',
};

// ─── Moniteur du centre selector ─────────────────────────────────────────────
function RechercheMoniteur({
  selected,
  onSelect,
  userId,
  allMoniteurs,
}: {
  selected: MoniteurSuggestion | null;
  onSelect: (m: MoniteurSuggestion | null) => void;
  userId: string | undefined;
  allMoniteurs: MoniteurSuggestion[];
}) {
  const [query, setQuery] = useState('');
  const [moniteurs, setMoniteurs] = useState<MoniteurSuggestion[]>(allMoniteurs);
  const [loading, setLoading] = useState(allMoniteurs.length === 0);

  useEffect(() => {
    if (allMoniteurs.length > 0) {
      setMoniteurs(allMoniteurs);
      setLoading(false);
      return;
    }
    if (!userId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('get_moniteurs_pour_parachutiste', { para_id: userId });

      if (error || !data?.length) { setLoading(false); return; }

      const seen = new Set<string>();
      const result: MoniteurSuggestion[] = [];
      for (const m of data) {
        if (seen.has(m.moniteur_id as string)) continue;
        seen.add(m.moniteur_id as string);
        result.push({
          id: m.moniteur_id as string,
          nom: m.nom as string,
          prenom: m.prenom as string,
          avatar_url: m.avatar_url as string | null,
          numero_brevet_moniteur: m.numero_brevet_moniteur as string | null,
          type_brevet_moniteur: m.type_brevet_moniteur as string | null,
          centre_nom: m.centre_nom as string | null,
          role_centre: m.source === 'dt' ? 'admin' : 'delegation',
        });
      }
      setMoniteurs(result);
      setLoading(false);
    })();
  }, [userId, allMoniteurs]);

  // ── Selected state ──────────────────────────────────────────────────────────
  if (selected) {
    const isTous = selected.id === ENVOI_TOUS_ID;
    const isAdmin = selected.role_centre === 'admin';
    return (
      <div
        className="flex items-center gap-3 p-3 rounded-xl"
        style={isTous
          ? { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)' }
          : { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)' }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: isTous ? '#003082' : isAdmin ? '#F59E0B' : '#10B981' }}
        >
          {isTous ? '★' : ((selected.prenom[0] ?? '') + (selected.nom[0] ?? ''))}
        </div>
        <div className="flex-1 min-w-0">
          {isTous ? (
            <>
              <p className="text-white font-semibold text-sm">Envoyer à tous les validateurs</p>
              <p className="text-blue-400 text-xs">Le premier à valider certifie le saut</p>
            </>
          ) : (
            <>
              <p className="text-white font-semibold text-sm">{selected.prenom} {selected.nom}</p>
              <p className="text-green-400 text-xs">
                {selected.type_brevet_moniteur ? `${selected.type_brevet_moniteur}` : (isAdmin ? 'DT / Admin' : 'Moniteur')}
                {selected.numero_brevet_moniteur ? ` N°${selected.numero_brevet_moniteur}` : ''}
                {selected.centre_nom ? ` · ${selected.centre_nom}` : ''}
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => { onSelect(null); setQuery(''); }}
          className="flex items-center justify-center rounded-full transition-all flex-shrink-0"
          style={{ color: 'rgba(255,255,255,0.4)', width: 32, height: 32 }}
          aria-label="Désélectionner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ── Split into groups ───────────────────────────────────────────────────────
  const lowerQuery = query.trim().toLowerCase();
  const matchesQuery = (m: MoniteurSuggestion) =>
    lowerQuery ? `${m.prenom} ${m.nom}`.toLowerCase().includes(lowerQuery) : true;

  const delegues = moniteurs.filter((m) => (m.role_centre === 'delegation' || m.role_centre === 'moniteur') && matchesQuery(m));
  const admins = moniteurs.filter((m) => m.role_centre === 'admin' && matchesQuery(m));
  const hasAny = delegues.length > 0 || admins.length > 0;

  const renderRow = (m: MoniteurSuggestion, idx: number, arr: MoniteurSuggestion[], isLastGroup: boolean) => {
    const isAdmin = m.role_centre === 'admin';
    const isDelegue = m.role_centre === 'delegation';
    const isLast = idx === arr.length - 1 && isLastGroup;
    return (
      <button
        key={m.id}
        type="button"
        onClick={() => { onSelect(m); setQuery(''); }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ borderBottom: !isLast ? '1px solid rgba(255,255,255,0.06)' : undefined }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: isAdmin ? '#F59E0B' : '#10B981' }}
        >
          {(m.prenom[0] ?? '') + (m.nom[0] ?? '')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm">{m.prenom} {m.nom}</p>
          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {isAdmin ? 'Directeur Technique' : isDelegue ? 'Moniteur délégué' : 'Moniteur'}
            {m.type_brevet_moniteur ? ` · ${m.type_brevet_moniteur}` : ''}
            {m.numero_brevet_moniteur ? ` N°${m.numero_brevet_moniteur}` : ''}
          </p>
          {m.centre_nom && (
            <p className="text-xs" style={{ color: 'rgba(96,165,250,0.8)' }}>{m.centre_nom}</p>
          )}
        </div>
        <span className="text-xs font-medium flex-shrink-0" style={{ color: isAdmin ? 'rgba(245,158,11,0.7)' : 'rgba(16,185,129,0.8)' }}>Sélectionner →</span>
      </button>
    );
  };

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
      >
        <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un moniteur..."
          className="flex-1 bg-transparent text-white placeholder-white/30 text-sm outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="text-white/40 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Monitor list */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#001A4D', border: '1px solid rgba(255,255,255,0.12)', maxHeight: 'min(280px, 40vh)', overflowY: 'auto' }}>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
          </div>
        ) : !hasAny && moniteurs.length === 0 ? (
          <div className="p-4 text-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Aucun moniteur trouvé dans vos centres. Contactez votre DT.
          </div>
        ) : !hasAny ? (
          <div className="p-4 text-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {`Aucun résultat pour "${query}"`}
          </div>
        ) : (
          <>
            {/* "Envoyer à tous" option — only when no search query */}
            {!lowerQuery && (
              <button
                type="button"
                onClick={() => { onSelect(ENVOI_TOUS_SENTINEL); setQuery(''); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(59,130,246,0.06)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.12)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.06)')}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: 'rgba(59,130,246,0.6)', border: '1px solid rgba(59,130,246,0.4)' }}
                >
                  ★
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">Envoyer à tous les validateurs</p>
                  <p className="text-xs" style={{ color: 'rgba(96,165,250,0.8)' }}>Le premier à valider certifie le saut</p>
                </div>
                <span className="text-xs font-medium flex-shrink-0" style={{ color: 'rgba(96,165,250,0.7)' }}>Sélectionner →</span>
              </button>
            )}

            {/* Moniteurs délégués section */}
            {delegues.length > 0 && (
              <>
                <div
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                  style={{ background: 'rgba(16,185,129,0.08)', color: 'rgba(16,185,129,0.9)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  Moniteurs délégués
                </div>
                {delegues.map((m, i) => renderRow(m, i, delegues, admins.length === 0))}
              </>
            )}

            {/* Directeurs Techniques section */}
            {admins.length > 0 && (
              <>
                <div
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                  style={{ background: 'rgba(245,158,11,0.08)', color: 'rgba(245,158,11,0.9)', borderBottom: '1px solid rgba(255,255,255,0.06)', borderTop: delegues.length > 0 ? '1px solid rgba(255,255,255,0.08)' : undefined }}
                >
                  Directeur Technique (secours)
                </div>
                {admins.map((m, i) => renderRow(m, i, admins, true))}
              </>
            )}
          </>
        )}
      </div>

      <p className="text-xs px-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
        La validation par un moniteur agréé est obligatoire pour certifier le saut dans votre carnet officiel.
      </p>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function AddSautModal({ open, onClose, onAdded, userBrevet, sautAEditer, targetParachutisteId }: AddSautModalProps) {
  const { user, profile } = useAuth();
  const { blockIfDemo } = useDemo();
  const isEditMode = !!sautAEditer;
  const isAdminMode = !!targetParachutisteId; // admin logging a jump for someone else
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showObs, setShowObs] = useState(false);
  const [moniteurSelectionne, setMoniteurSelectionne] = useState<MoniteurSuggestion | null>(null);
  const [allMoniteurs, setAllMoniteurs] = useState<MoniteurSuggestion[]>([]);
  const [showNoteToast, setShowNoteToast] = useState(false);

  // DZ dropdown
  const [dzCentres, setDzCentres] = useState<{ id: string; nom: string; ville: string | null }[]>([]);
  const [dzSelection, setDzSelection] = useState<string>('');
  const [dzAutreText, setDzAutreText] = useState('');

  // Re-auth modal for moniteur direct validation
  const [reAuthOpen, setReAuthOpen] = useState(false);
  const [monConfirmed, setMonConfirmed] = useState(false);
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [monAccept, setMonAccept] = useState(false);

  const isMoniteur = profile?.role === 'moniteur' || profile?.role === 'admin';
  // PAC/A brevetés → blocs position corps remplis par moniteur (lecture seule)
  // B+ → masqués complètement car non pertinents pour autonomes
  const isPACOuA = ['PAC', 'A'].includes(userBrevet ?? '');
  const isBPlus = ['B', 'BPA', 'C', 'D', 'B1', 'B2', 'B3', 'Bi4', 'B4', 'Bi5', 'B5', 'VH', 'WS1', 'WS2', 'WS3'].includes(userBrevet ?? '');
  const showPositionCorps = isMoniteur || isPACOuA || (!isBPlus && !isPACOuA);
  const moniteurProfile = profile as (typeof profile & { numero_brevet_moniteur?: string; type_brevet_moniteur?: string; moniteur_valide_par_dt?: boolean }) | null;

  // Fermeture par Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Toast auto-hide
  useEffect(() => {
    if (showNoteToast) {
      const t = setTimeout(() => setShowNoteToast(false), 3000);
      return () => clearTimeout(t);
    }
  }, [showNoteToast]);

  // Load all moniteurs for this user's centres once on mount
  useEffect(() => {
    if (!user?.id || isMoniteur) return;
    (async () => {
      const { data, error } = await supabase
        .rpc('get_moniteurs_pour_parachutiste', { para_id: user.id });

      if (error || !data?.length) return;

      const seen = new Set<string>();
      const result: MoniteurSuggestion[] = [];
      for (const m of data) {
        if (seen.has(m.moniteur_id as string)) continue;
        seen.add(m.moniteur_id as string);
        result.push({
          id: m.moniteur_id as string,
          nom: m.nom as string,
          prenom: m.prenom as string,
          avatar_url: m.avatar_url as string | null,
          numero_brevet_moniteur: m.numero_brevet_moniteur as string | null,
          type_brevet_moniteur: m.type_brevet_moniteur as string | null,
          centre_nom: m.centre_nom as string | null,
          role_centre: m.source === 'dt' ? 'admin' : 'delegation',
        });
      }
      setAllMoniteurs(result);
    })();
  }, [user?.id, isMoniteur]);

  // Load centres for DZ dropdown
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from('centres').select('id, nom, ville').eq('statut', 'actif').order('nom', { ascending: true });
      const list = data ?? [];
      setDzCentres(list);

      // Pre-select user's centre if editing or first open
      if (!sautAEditer) {
        const userCentreId = (profile as (typeof profile & { centre_id?: string | null }) | null)?.centre_id ?? null;
        if (userCentreId && list.find((c) => c.id === userCentreId)) {
          const found = list.find((c) => c.id === userCentreId)!;
          setDzSelection(found.id);
          setForm((f) => ({ ...f, lieu: found.nom }));
        }
      }
    })();
  // Only re-run on open
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [form, setForm] = useState({
    date_saut: new Date().toISOString().split('T')[0],
    lieu: '',
    aeronef_immat: '',
    nature_saut: 'entrainement',
    categorie: 'OA',
    hauteur_m: 4000,
    hauteur_ouverture: 1500,
    fonction: 'parachutiste',
    parachute: '',
    programme: '',
    voilure_principale: '',
    observations: '',
    observations_moniteur: '',
    // Soufflerie fields
    tunnel_flight_minutes: '' as string | number,
    tunnel_flight_count: '' as string | number,
    tunnel_coach: '',
    tunnel_discipline: '',
    sortie_avion: null as NotationTernaire,
    retour_face_sol: null as NotationTernaire,
    vigilance_altitude: null as NotationTernaire,
    ouverture_notes: null as NotationTernaire,
    position_tete: null as number | null,
    position_bassin: null as number | null,
    position_jambes: null as number | null,
    position_bras: null as number | null,
    exercice_chute: '',
    exercice_voile: '',
    // New fields
    note_globale: null as number | null,
    prog_separation: null as ProgressionTernaire,
    prog_trajectoire: null as ProgressionTernaire,
    prog_declenchement: null as ProgressionTernaire,
    prog_pilotage_voile: null as ProgressionTernaire,
    prog_circuit_atterro: null as ProgressionTernaire,
    prog_precision_atterro: null as ProgressionTernaire,
    prog_gestion_urgences: null as ProgressionTernaire,
    note_ouverture_voile: null as number | null,
    note_atterrissage: null as number | null,
    note_mental: null as number | null,
    precision_metres: null as number | null,
    type_pliage: 'non_renseigne' as string,
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (sautAEditer && open) {
      setForm({
        date_saut: sautAEditer.date_saut,
        lieu: sautAEditer.lieu ?? '',
        aeronef_immat: sautAEditer.aeronef_immat ?? '',
        nature_saut: sautAEditer.nature_saut ?? 'entrainement',
        categorie: sautAEditer.categorie ?? 'OA',
        hauteur_m: sautAEditer.hauteur_m ?? 4000,
        hauteur_ouverture: sautAEditer.hauteur_ouverture ?? 1500,
        fonction: sautAEditer.fonction ?? 'parachutiste',
        parachute: sautAEditer.parachute ?? '',
        programme: sautAEditer.programme ?? '',
        voilure_principale: sautAEditer.voilure_principale ?? '',
        observations: sautAEditer.observations ?? '',
        observations_moniteur: sautAEditer.observations_moniteur ?? '',
        sortie_avion: sautAEditer.sortie_avion,
        retour_face_sol: sautAEditer.retour_face_sol,
        vigilance_altitude: sautAEditer.vigilance_altitude,
        ouverture_notes: sautAEditer.ouverture_notes,
        position_tete: sautAEditer.position_tete,
        position_bassin: sautAEditer.position_bassin,
        position_jambes: sautAEditer.position_jambes,
        position_bras: sautAEditer.position_bras,
        exercice_chute: sautAEditer.exercice_chute ?? '',
        exercice_voile: sautAEditer.exercice_voile ?? '',
        note_globale: null,
        prog_separation: null,
        prog_trajectoire: null,
        prog_declenchement: null,
        prog_pilotage_voile: null,
        prog_circuit_atterro: null,
        prog_precision_atterro: null,
        prog_gestion_urgences: null,
        note_ouverture_voile: null,
        note_atterrissage: null,
        note_mental: null,
        precision_metres: null,
        type_pliage: (sautAEditer as { type_pliage?: string }).type_pliage ?? 'non_renseigne',
        tunnel_flight_minutes: (sautAEditer as { tunnel_flight_minutes?: number | null }).tunnel_flight_minutes ?? '',
        tunnel_flight_count: (sautAEditer as { tunnel_flight_count?: number | null }).tunnel_flight_count ?? '',
        tunnel_coach: (sautAEditer as { tunnel_coach?: string | null }).tunnel_coach ?? '',
        tunnel_discipline: (sautAEditer as { tunnel_discipline?: string | null }).tunnel_discipline ?? '',
      });
      // Resolve DZ selection from saved lieu string
      const lieuVal = sautAEditer.lieu ?? '';
      const match = dzCentres.find((c) => c.nom === lieuVal);
      if (match) {
        setDzSelection(match.id);
        setDzAutreText('');
      } else if (lieuVal) {
        setDzSelection('__autre__');
        setDzAutreText(lieuVal);
      } else {
        setDzSelection('');
        setDzAutreText('');
      }
      setFieldErrors({});
    } else if (!sautAEditer && open) {
      resetForm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sautAEditer, open]);

  if (!open) return null;

  const update = (field: string, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  const isSoufflerie = form.nature_saut === 'soufflerie';

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.date_saut) errors.date_saut = 'Obligatoire';
    if (!form.lieu.trim()) errors.lieu = 'Obligatoire';
    if (!form.nature_saut) errors.nature_saut = 'Obligatoire';
    if (!isSoufflerie) {
      if (!form.categorie) errors.categorie = 'Obligatoire';
      if (!isMoniteur && !moniteurSelectionne) errors.moniteur = 'Obligatoire';
      if (form.hauteur_ouverture !== null && form.hauteur_ouverture >= form.hauteur_m) {
        errors.hauteur_ouverture = "La hauteur d'ouverture doit être inférieure à la hauteur de largage";
      }
    }
    if (isSoufflerie) {
      const mins = Number(form.tunnel_flight_minutes);
      if (!form.tunnel_flight_minutes || isNaN(mins) || mins <= 0) {
        errors.tunnel_flight_minutes = 'Durée obligatoire';
      }
    }
    return errors;
  };

  const reglesBrevet = getRegles(userBrevet);
  const hauteurOuvertureMin = reglesBrevet.hauteurOuvertureMin;
  const ouvertureInferieure = form.hauteur_ouverture !== null && form.hauteur_ouverture < hauteurOuvertureMin;

  const posValues = [form.position_tete, form.position_bassin, form.position_jambes, form.position_bras].filter(Boolean) as number[];
  const posGlobale = posValues.length > 0 ? Math.round(posValues.reduce((a, b) => a + b, 0) / posValues.length) : null;

  const getPositionLabel = (score: number | null): { label: string; color: string } => {
    if (score === null) return { label: '', color: '' };
    if (score < 2) return { label: 'À travailler', color: '#EF4444' };
    if (score < 3) return { label: 'En progression', color: '#F59E0B' };
    if (score < 4) return { label: 'Correcte', color: '#003082' };
    return { label: 'Excellente', color: '#10B981' };
  };

  const doInsert = async (validateDirectly: boolean) => {
    if (blockIfDemo()) return;
    const errors = validate();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setLoading(true);

    try {
      const envoiATous = moniteurSelectionne?.id === ENVOI_TOUS_ID;
      let moniteur_id: string | null = null;
      if (!validateDirectly && moniteurSelectionne && !envoiATous) {
        moniteur_id = moniteurSelectionne.id;
      } else if (validateDirectly && user) {
        moniteur_id = user.id;
      } else if (isEditMode && sautAEditer?.moniteur_id) {
        moniteur_id = sautAEditer.moniteur_id;
      }

      const timestampUtc = validateDirectly ? new Date().toISOString() : null;

      let validationHash: string | null = null;
      if (validateDirectly && moniteur_id && timestampUtc) {
        validationHash = await hashSautData({
          saut_id: isEditMode ? sautAEditer!.id : 'pending',
          parachutiste_id: targetParachutisteId ?? user!.id,
          moniteur_id,
          date_saut: form.date_saut,
          lieu: form.lieu,
          aeronef: form.aeronef_immat,
          hauteur: form.hauteur_m,
          categorie: form.categorie,
          timestamp_validation: timestampUtc,
        });
      }

      // Upload signature if present
      let signatureUrl: string | null = null;
      if (validateDirectly && sigDataUrl && user) {
        const blob = await fetch(sigDataUrl).then((r) => r.blob());
        const file = new File([blob], `sig-${Date.now()}.png`, { type: 'image/png' });
        const path = `${user.id}/signatures/saut-${Date.now()}.png`;
        const { error: upErr } = await supabase.storage.from('parapass-docs').upload(path, file);
        if (!upErr) {
          signatureUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/parapass-docs/${path}`;
        }
      }

      const validateur = validateDirectly && profile ? `${profile.prenom} ${profile.nom}` : null;

      const payload = {
        date_saut: form.date_saut,
        lieu: form.lieu,
        aeronef_immat: isSoufflerie ? null : form.aeronef_immat,
        nature_saut: form.nature_saut,
        categorie: isSoufflerie ? null : form.categorie,
        hauteur_m: isSoufflerie ? 0 : form.hauteur_m,
        hauteur_ouverture: isSoufflerie ? null : (form.hauteur_ouverture ?? null),
        fonction: isSoufflerie ? null : form.fonction,
        parachute: isSoufflerie ? null : (form.parachute || null),
        programme: isSoufflerie ? null : (form.programme || null),
        voilure_principale: isSoufflerie ? null : (form.voilure_principale || null),
        observations: form.observations || null,
        moniteur_id: isSoufflerie ? null : moniteur_id,
        // Soufflerie fields
        tunnel_flight_minutes: isSoufflerie ? (Number(form.tunnel_flight_minutes) || null) : null,
        tunnel_flight_count: isSoufflerie ? (Number(form.tunnel_flight_count) || null) : null,
        tunnel_coach: isSoufflerie ? (form.tunnel_coach.trim() || null) : null,
        tunnel_discipline: isSoufflerie ? (form.tunnel_discipline.trim() || null) : null,
        ...(validateDirectly ? {
          statut: 'valide',
          valide_par: validateur,
          valide_le: timestampUtc,
          signature_moniteur_url: signatureUrl,
          validation_hash: validationHash,
          validation_timestamp: timestampUtc,
        } : {}),
        observations_moniteur: form.observations_moniteur || null,
        sortie_avion: form.sortie_avion || null,
        retour_face_sol: form.retour_face_sol || null,
        vigilance_altitude: form.vigilance_altitude || null,
        ouverture_notes: form.ouverture_notes || null,
        position_tete: form.position_tete,
        position_bassin: form.position_bassin,
        position_jambes: form.position_jambes,
        position_bras: form.position_bras,
        position_globale: posGlobale,
        exercice_chute: form.exercice_chute || null,
        exercice_voile: form.exercice_voile || null,
        type_pliage: form.type_pliage ?? 'non_renseigne',
      };

      let data: Saut | null = null;

      if (isEditMode && sautAEditer) {
        const { data: updated, error: updateError } = await supabase
          .from('sauts')
          .update(payload)
          .eq('id', sautAEditer.id)
          .neq('statut', 'valide')
          .select()
          .single();
        if (updateError) throw updateError;
        data = updated as Saut;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('sauts')
          .insert({
            parachutiste_id: targetParachutisteId ?? user!.id,
            // Soufflerie = declarative, always validated directly. Normal: admin or moniteur flow.
            statut: (isSoufflerie || isAdminMode) ? 'valide' : (validateDirectly ? 'valide' : 'en_attente'),
            ...(isAdminMode ? { valide_par: profile ? `${profile.prenom} ${profile.nom}` : 'Admin Centre', valide_le: new Date().toISOString(), source: 'odc' } : {}),
            ...(isSoufflerie ? { valide_par: profile ? `${profile.prenom} ${profile.nom}` : 'Auto', valide_le: new Date().toISOString(), source: 'soufflerie' } : {}),
            ...payload,
          })
          .select()
          .single();
        if (insertError) throw insertError;
        data = inserted as Saut;
      }

      // Save progression data to jump_progression (not for soufflerie)
      if (data && !isSoufflerie) {
        const mapTernaire = (v: ProgressionTernaire) => v;
        await supabase.from('jump_progression').upsert({
          jump_id: data.id,
          user_id: targetParachutisteId ?? user!.id,
          note_globale: form.note_globale,
          sortie_avion: form.sortie_avion === 'a_retravailler' ? 'non' : form.sortie_avion === 'correct' ? 'en_cours' : form.sortie_avion === 'bon' ? 'maitrise' : null,
          retour_face_sol: form.retour_face_sol === 'a_retravailler' ? 'non' : form.retour_face_sol === 'correct' ? 'en_cours' : form.retour_face_sol === 'bon' ? 'maitrise' : null,
          vigilance_altitude: form.vigilance_altitude === 'a_retravailler' ? 'non' : form.vigilance_altitude === 'correct' ? 'en_cours' : form.vigilance_altitude === 'bon' ? 'maitrise' : null,
          ouverture: form.ouverture_notes === 'a_retravailler' ? 'non' : form.ouverture_notes === 'correct' ? 'en_cours' : form.ouverture_notes === 'bon' ? 'maitrise' : null,
          separation: mapTernaire(form.prog_separation),
          trajectoire: mapTernaire(form.prog_trajectoire),
          declenchement: mapTernaire(form.prog_declenchement),
          pilotage_voile: mapTernaire(form.prog_pilotage_voile),
          circuit_atterro: mapTernaire(form.prog_circuit_atterro),
          precision_atterro: mapTernaire(form.prog_precision_atterro),
          gestion_urgences: mapTernaire(form.prog_gestion_urgences),
          note_tete: form.position_tete,
          note_bassin: form.position_bassin,
          note_jambes: form.position_jambes,
          note_bras: form.position_bras,
          score_position: posGlobale ? parseFloat((posGlobale).toFixed(2)) : null,
          note_ouverture_voile: form.note_ouverture_voile,
          note_atterrissage: form.note_atterrissage,
          note_mental: form.note_mental,
          precision_metres: form.precision_metres,
          exercices_chute: form.exercice_chute || null,
          exercices_voile: form.exercice_voile || null,
          observations_moniteur: form.observations_moniteur || null,
        }, { onConflict: 'jump_id' });
      }

      // Update hash with real saut id (insert only)
      if (!isEditMode && validateDirectly && data && validationHash) {
        const realHash = await hashSautData({
          saut_id: data.id,
          parachutiste_id: targetParachutisteId ?? user!.id,
          moniteur_id: moniteur_id!,
          date_saut: form.date_saut,
          lieu: form.lieu,
          aeronef: form.aeronef_immat,
          hauteur: form.hauteur_m,
          categorie: form.categorie,
          timestamp_validation: timestampUtc!,
        });
        await supabase.from('sauts').update({ validation_hash: realHash }).eq('id', data.id);

        // Audit log
        const validateur_nom = `${profile!.prenom} ${profile!.nom}`;
        await supabase.from('audit_log').insert({
          action: 'saut_valide',
          acteur_id: user!.id,
          acteur_nom: validateur_nom,
          acteur_role: profile!.role,
          acteur_licence_moniteur: moniteurProfile?.numero_brevet_moniteur ?? null,
          cible_id: data.id,
          cible_type: 'saut',
          donnees_avant: { statut: 'en_attente' },
          donnees_apres: { statut: 'valide', valide_par: validateur_nom, validation_hash: realHash },
          hash_donnees: realHash,
          timestamp_utc: timestampUtc,
        });
      }

      // Notify validators (insert only, non-direct-validate)
      if (!isEditMode && !validateDirectly && data) {
        const envoiATous = moniteurSelectionne?.id === ENVOI_TOUS_ID;
        const toNotify: string[] = envoiATous
          ? allMoniteurs.map((m) => m.id)
          : moniteur_id ? [moniteur_id] : [];

        if (toNotify.length > 0) {
          await supabase.from('notifications').insert(
            toNotify.map((mid) => ({
              user_id: mid,
              type: 'validation_demandee',
              titre: 'Nouveau saut à valider',
              message: `${profile?.prenom} ${profile?.nom} vous demande de valider un saut du ${form.date_saut} à ${form.lieu || 'lieu non précisé'}.`,
              lue: false,
            }))
          );
        }
      }

      onAdded({ ...data, validation_hash: validationHash } as Saut);
      localStorage.setItem('parapass_last_jump_values', JSON.stringify({ hauteur_m: form.hauteur_m, hauteur_ouverture: form.hauteur_ouverture }));
      onClose();
      resetForm();
    } catch {
      setError(isEditMode ? 'Erreur lors de la modification du saut' : 'Erreur lors de l\'ajout du saut');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    const saved = (() => { try { return JSON.parse(localStorage.getItem('parapass_last_jump_values') ?? '{}'); } catch { return {}; } })();
    setForm({
      date_saut: new Date().toISOString().split('T')[0],
      lieu: '', aeronef_immat: '', nature_saut: 'entrainement', categorie: 'OA',
      hauteur_m: saved.hauteur_m ?? 4000,
      hauteur_ouverture: saved.hauteur_ouverture ?? 1500,
      fonction: 'parachutiste', parachute: '', programme: '',
      voilure_principale: '', observations: '',
      observations_moniteur: '', sortie_avion: null, retour_face_sol: null,
      vigilance_altitude: null, ouverture_notes: null,
      position_tete: null, position_bassin: null, position_jambes: null, position_bras: null,
      exercice_chute: '', exercice_voile: '',
      note_globale: null,
      prog_separation: null,
      prog_trajectoire: null,
      prog_declenchement: null,
      prog_pilotage_voile: null,
      prog_circuit_atterro: null,
      prog_precision_atterro: null,
      prog_gestion_urgences: null,
      note_ouverture_voile: null,
      note_atterrissage: null,
      note_mental: null,
      precision_metres: null,
    });
    setMoniteurSelectionne(null);
    setFieldErrors({}); setShowObs(false); setSigDataUrl(null);
    setMonAccept(false); setMonConfirmed(false);
    setDzSelection(''); setDzAutreText('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    doInsert(false);
  };

  const handleMoniteurValidate = () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setReAuthOpen(true);
  };

  const handleReAuthConfirmed = () => {
    setReAuthOpen(false);
    setMonConfirmed(true);
    doInsert(true);
  };

  const FieldError = ({ field }: { field: string }) =>
    fieldErrors[field] ? <p className="text-red-500 text-xs mt-1">{fieldErrors[field]}</p> : null;

  const canMonSign = isMoniteur && monAccept && sigDataUrl;

  return (
    <>
      <ReAuthModal
        open={reAuthOpen}
        email={user?.email ?? ''}
        onConfirmed={handleReAuthConfirmed}
        onCancel={() => setReAuthOpen(false)}
        title="Confirmer la validation"
        description="Re-saisissez votre mot de passe pour signer et valider ce saut officiellement"
      />

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60" onClick={onClose}>
        <div
          className="rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg flex flex-col"
          style={{ background: '#002266', border: '1px solid rgba(255,255,255,0.15)', maxHeight: '100dvh', height: '100dvh', overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-5 flex-shrink-0" style={{ background: '#002266', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 className="text-lg font-bold text-white">{isEditMode ? (isSoufflerie ? 'Modifier la session' : 'Modifier le saut') : (isSoufflerie ? 'Session soufflerie' : 'Ajouter un saut')}</h2>
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors" style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {showNoteToast && (
            <div className="mx-5 mt-3 rounded-lg px-3 py-2 text-sm flex items-center gap-2"
              style={{background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)', color:'#FCD34D'}}>
              ⭐ Évalue ton saut pour suivre ta progression !
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {error && <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171' }}>{error}</div>}

            {/* Date + Lieu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Date <span style={{ color: '#F87171' }}>*</span></label>
                <input type="date" value={form.date_saut} onChange={(e) => update('date_saut', e.target.value)}
                  style={fieldErrors.date_saut ? darkInputErr : darkInput} />
                <FieldError field="date_saut" />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>{isSoufflerie ? 'Soufflerie / centre' : 'Lieu / DZ'} <span style={{ color: '#F87171' }}>*</span></label>
                {isSoufflerie ? (
                  <input
                    type="text"
                    value={form.lieu}
                    onChange={(e) => update('lieu', e.target.value)}
                    placeholder="Weembi, iFLY, Flyspot…"
                    style={fieldErrors.lieu ? darkInputErr : darkInput}
                  />
                ) : (
                  <>
                    <select
                      value={dzSelection}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDzSelection(val);
                        if (val === '__autre__') {
                          update('lieu', dzAutreText);
                        } else if (val) {
                          const found = dzCentres.find((c) => c.id === val);
                          update('lieu', found?.nom ?? '');
                        } else {
                          update('lieu', '');
                        }
                      }}
                      style={fieldErrors.lieu ? { ...darkInputErr, colorScheme: 'dark' } : { ...darkInput, colorScheme: 'dark' }}
                    >
                      <option value="">-- Sélectionner une DZ --</option>
                      {dzCentres.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom}{c.ville ? ` — ${c.ville}` : ''}
                        </option>
                      ))}
                      <option value="__autre__">Autre / DZ étrangère (saisie libre)</option>
                    </select>
                    {dzSelection === '__autre__' && (
                      <input
                        type="text"
                        value={dzAutreText}
                        onChange={(e) => { setDzAutreText(e.target.value); update('lieu', e.target.value); }}
                        placeholder="Saisir le nom de la DZ..."
                        style={{ ...darkInput, marginTop: 6, borderColor: fieldErrors.lieu ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.15)' }}
                      />
                    )}
                  </>
                )}
                <FieldError field="lieu" />
              </div>
            </div>

            {/* Aéronef + Programme — masqués pour soufflerie */}
            {!isSoufflerie && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Aéronef immat.</label>
                <input type="text" value={form.aeronef_immat} onChange={(e) => update('aeronef_immat', e.target.value)}
                  style={darkInput} placeholder="F-HBGP" />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Programme</label>
                <input type="text" value={form.programme} onChange={(e) => update('programme', e.target.value)}
                  style={darkInput} placeholder="PAC 1, Solo…" />
              </div>
            </div>
            )}

            {/* Nature + Catégorie */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Nature <span style={{ color: '#F87171' }}>*</span></label>
                <select value={form.nature_saut} onChange={(e) => update('nature_saut', e.target.value)}
                  style={fieldErrors.nature_saut ? { ...darkInputErr, colorScheme: 'dark' } : { ...darkInput, colorScheme: 'dark' }}>
                  {Object.entries(NATURE_SAUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <FieldError field="nature_saut" />
              </div>
              {!isSoufflerie && (
              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Catégorie <span style={{ color: '#F87171' }}>*</span></label>
                <select value={form.categorie} onChange={(e) => update('categorie', e.target.value)}
                  style={fieldErrors.categorie ? { ...darkInputErr, colorScheme: 'dark' } : { ...darkInput, colorScheme: 'dark' }}>
                  {Object.entries(CATEGORIE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <FieldError field="categorie" />
              </div>
              )}
            </div>

            {/* ── CHAMPS SOUFFLERIE ── */}
            {isSoufflerie && (
              <div className="space-y-3 rounded-xl p-4" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#60A5FA' }}>🌬️ Session soufflerie</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Temps de vol (min) <span style={{ color: '#F87171' }}>*</span></label>
                    <input type="number" min={1} placeholder="15"
                      value={form.tunnel_flight_minutes}
                      onChange={(e) => update('tunnel_flight_minutes', e.target.value)}
                      style={fieldErrors.tunnel_flight_minutes ? darkInputErr : darkInput} />
                    <FieldError field="tunnel_flight_minutes" />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Nb de vols</label>
                    <input type="number" min={1} placeholder="Optionnel"
                      value={form.tunnel_flight_count}
                      onChange={(e) => update('tunnel_flight_count', e.target.value)}
                      style={darkInput} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Discipline</label>
                    <select value={form.tunnel_discipline} onChange={(e) => update('tunnel_discipline', e.target.value)}
                      style={{ ...darkInput, colorScheme: 'dark' }}>
                      <option value="">—</option>
                      {['VR', 'Freefly', 'Dynamique', 'FS', 'VRW', 'Freestyle', 'Vitesse', 'Multi-discipline'].map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Coach / encadrant</label>
                    <input type="text" placeholder="Optionnel"
                      value={form.tunnel_coach}
                      onChange={(e) => update('tunnel_coach', e.target.value)}
                      style={darkInput} />
                  </div>
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Objectifs / notes</label>
                  <textarea rows={2} placeholder="Ce que tu as travaillé, ressenti, points à améliorer…"
                    value={form.observations}
                    onChange={(e) => update('observations', e.target.value)}
                    style={{ ...darkInput, resize: 'none' }} />
                </div>
              </div>
            )}

            {/* Pliage — masqué pour soufflerie */}
            {!isSoufflerie && <div>
              <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Pliage du parachute</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { val: 'plieur_paye', label: '💰 Plieur payé', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
                  { val: 'auto', label: '🙋 Auto-plié', color: '#A78BFA', bg: 'rgba(139,92,246,0.15)' },
                  { val: 'non_renseigne', label: '❓ Non renseigné', color: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.06)' },
                ] as const).map(opt => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => update('type_pliage', opt.val)}
                    className="py-2 px-1 rounded-lg text-xs font-semibold transition-all text-center"
                    style={{
                      border: `1px solid ${form.type_pliage === opt.val ? opt.color : 'rgba(255,255,255,0.12)'}`,
                      background: form.type_pliage === opt.val ? opt.bg : 'transparent',
                      color: form.type_pliage === opt.val ? opt.color : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>}

            {/* Hauteur + Fonction — masqués pour soufflerie */}
            {!isSoufflerie && <>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Hauteur de largage (m)</label>
                  <input type="number" value={form.hauteur_m} onChange={(e) => update('hauteur_m', parseInt(e.target.value) || 0)}
                    style={darkInput} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Hauteur d'ouverture (m)</label>
                  <input
                    type="number"
                    value={form.hauteur_ouverture ?? ''}
                    min={600}
                    max={3000}
                    onChange={(e) => update('hauteur_ouverture', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                    style={fieldErrors.hauteur_ouverture ? darkInputErr : darkInput}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {[600, 800, 1000, 1200, 1500, 2000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => update('hauteur_ouverture', v)}
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors"
                        style={form.hauteur_ouverture === v
                          ? { background: '#F59E0B', color: '#fff', border: '1px solid #F59E0B' }
                          : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  {ouvertureInferieure ? (
                    <div className="flex items-start gap-1 mt-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-400 font-medium">
                        Inférieur au minimum réglementaire ({hauteurOuvertureMin.toLocaleString('fr-FR')} m pour {reglesBrevet.label})
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Minimum réglementaire : {hauteurOuvertureMin.toLocaleString('fr-FR')} m ({reglesBrevet.label})
                    </p>
                  )}
                  {fieldErrors.hauteur_ouverture && (
                    <div className="flex items-start gap-1 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-400 font-medium">{fieldErrors.hauteur_ouverture}</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Fonction</label>
                <select value={form.fonction} onChange={(e) => update('fonction', e.target.value)}
                  style={{ ...darkInput, colorScheme: 'dark' }}>
                  {Object.entries(FONCTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            {/* Voilure + Parachute */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Voilure principale</label>
                <input type="text" value={form.voilure_principale} onChange={(e) => update('voilure_principale', e.target.value)}
                  style={darkInput} placeholder="PD-270" />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>Parachute</label>
                <input type="text" value={form.parachute} onChange={(e) => update('parachute', e.target.value)}
                  style={darkInput} placeholder="Optionnel" />
              </div>
            </div>

            {/* Moniteur validateur (non-moniteurs) */}
            {!isMoniteur && (
              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Moniteur validateur <span style={{ color: '#F87171' }}>*</span>
                </label>
                <RechercheMoniteur selected={moniteurSelectionne} onSelect={setMoniteurSelectionne} userId={user?.id} allMoniteurs={allMoniteurs} />
              </div>
            )}
            </>}

            {/* ── Auto-évaluation de mon saut — masqué pour soufflerie ── */}
            {!isSoufflerie &&
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
              <button type="button" onClick={() => setShowObs((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)' }}>
                <span className="text-left">
                  <span className="block text-sm font-semibold">Auto-évaluation de mon saut</span>
                  <span className="block text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Visible uniquement par toi · alimente Ma Progression</span>
                </span>
                {showObs ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />}
              </button>

              {showObs && (
                <div className="divide-y" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>

                  {/* ── SECTION 1 : CHUTE LIBRE ── */}
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#60A5FA' }}>🪂 Chute libre</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.12)', color: 'rgba(96,165,250,0.7)' }}>→ Profil Chute libre</span>
                      <span className="text-[10px] ml-auto" style={{ color: 'rgba(255,255,255,0.25)' }}>optionnel</span>
                    </div>

                    {/* Éléments techniques */}
                    <div>
                      <p className="text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Éléments techniques — <span style={{ color: 'rgba(239,68,68,0.7)' }}>✗</span> À retravailler &nbsp;
                        <span style={{ color: 'rgba(245,158,11,0.7)' }}>~</span> Correct &nbsp;
                        <span style={{ color: 'rgba(16,185,129,0.7)' }}>✓</span> Bon
                      </p>
                      <div className="divide-y rounded-xl px-3 py-1" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }}>
                        <TernaireSelector label="Sortie avion" value={form.sortie_avion} onChange={(v) => update('sortie_avion', v)} />
                        <TernaireSelector label="Retour face sol" value={form.retour_face_sol} onChange={(v) => update('retour_face_sol', v)} />
                        <TernaireSelector label="Vigilance altitude" value={form.vigilance_altitude} onChange={(v) => update('vigilance_altitude', v)} />
                        <TernaireSelector label="Ouverture" value={form.ouverture_notes} onChange={(v) => update('ouverture_notes', v)} />
                        <ProgTernaireSelector label="Séparation" value={form.prog_separation} onChange={(v) => update('prog_separation', v)} />
                        <ProgTernaireSelector label="Trajectoire" value={form.prog_trajectoire} onChange={(v) => update('prog_trajectoire', v)} />
                        <ProgTernaireSelector label="Déclenchement" value={form.prog_declenchement} onChange={(v) => update('prog_declenchement', v)} />
                        <ProgTernaireSelector label="Pilotage voile" value={form.prog_pilotage_voile} onChange={(v) => update('prog_pilotage_voile', v)} />
                        <ProgTernaireSelector label="Circuit atterro" value={form.prog_circuit_atterro} onChange={(v) => update('prog_circuit_atterro', v)} />
                        <ProgTernaireSelector label="Précision atterro" value={form.prog_precision_atterro} onChange={(v) => update('prog_precision_atterro', v)} />
                        <ProgTernaireSelector label="Gestion urgences" value={form.prog_gestion_urgences} onChange={(v) => update('prog_gestion_urgences', v)} />
                      </div>
                    </div>

                    {/* Exercices en chute */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Exercices pratiqués en chute</label>
                      <ChipTextField
                        value={form.exercice_chute}
                        onChange={(v) => update('exercice_chute', v)}
                        chips={['360° gauche','360° droite','Arche stable','Lâché de mains','Loop','Tracking','Docking','Vrille','Dos','Tonneau']}
                        placeholder="Exercices réalisés en chute libre…"
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* ── SECTION 2 : VOILE & ATTERRISSAGE ── */}
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#34D399' }}>🎯 Voile & Atterrissage</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(52,211,153,0.12)', color: 'rgba(52,211,153,0.7)' }}>→ Voile & Atterrissage</span>
                      <span className="text-[10px] ml-auto" style={{ color: 'rgba(255,255,255,0.25)' }}>optionnel</span>
                    </div>

                    {/* Qualité ouverture voile */}
                    <div>
                      <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Qualité de l'ouverture voile</label>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { v: 5, label: 'Excellente',      color: '#34D399', bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.4)' },
                          { v: 4, label: 'Bonne',           color: '#60A5FA', bg: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.4)' },
                          { v: 3, label: 'Correcte',        color: '#A3A3A3', bg: 'rgba(163,163,163,0.12)', border: 'rgba(163,163,163,0.3)' },
                          { v: 2, label: 'Problème mineur', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)' },
                          { v: 1, label: 'Incident',        color: '#F87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.4)' },
                        ] as const).map(({ v, label, color, bg, border }) => {
                          const sel = form.note_ouverture_voile === v;
                          return (
                            <button key={v} type="button" onClick={() => update('note_ouverture_voile', sel ? null : v)}
                              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                              style={{ background: sel ? bg : 'rgba(255,255,255,0.06)', color: sel ? color : 'rgba(255,255,255,0.45)', border: `1px solid ${sel ? border : 'rgba(255,255,255,0.1)'}`, transform: sel ? 'scale(1.05)' : 'scale(1)' }}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Type atterrissage */}
                    <div>
                      <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Type d'atterrissage</label>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { v: 5, label: 'Debout propre',   color: '#34D399', bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.4)' },
                          { v: 4, label: 'Debout instable', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.4)' },
                          { v: 3, label: 'Roulé',           color: '#A3A3A3', bg: 'rgba(163,163,163,0.12)', border: 'rgba(163,163,163,0.3)' },
                          { v: 2, label: 'Fessé',           color: '#FBBF24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)' },
                          { v: 1, label: 'Chute',           color: '#F87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.4)' },
                        ] as const).map(({ v, label, color, bg, border }) => {
                          const sel = form.note_atterrissage === v;
                          return (
                            <button key={v} type="button" onClick={() => update('note_atterrissage', sel ? null : v)}
                              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                              style={{ background: sel ? bg : 'rgba(255,255,255,0.06)', color: sel ? color : 'rgba(255,255,255,0.45)', border: `1px solid ${sel ? border : 'rgba(255,255,255,0.1)'}`, transform: sel ? 'scale(1.05)' : 'scale(1)' }}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Exercices sous voile */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Exercices sous voile</label>
                      <ChipTextField
                        value={form.exercice_voile}
                        onChange={(v) => update('exercice_voile', v)}
                        chips={['Posé précision','Virages 360°','Spiral','Virages 180°','Navigation vent fort']}
                        placeholder="Exercices réalisés sous voile…"
                        rows={2}
                      />
                    </div>

                    {/* Précision atterrissage */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Précision atterrissage (mètres du centre)</label>
                      <input type="number" min={0} max={500} value={form.precision_metres ?? ''}
                        onChange={(e) => update('precision_metres', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="Ex : 15"
                        style={{ ...darkInput, width: '50%' }} />
                    </div>
                  </div>

                  {/* ── SECTION 3 : MENTAL & RÉGULARITÉ ── */}
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#C084FC' }}>🧠 Mental & Régularité</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(192,132,252,0.12)', color: 'rgba(192,132,252,0.7)' }}>→ Mental & Régularité</span>
                      <span className="text-[10px] ml-auto" style={{ color: 'rgba(255,255,255,0.25)' }}>optionnel</span>
                    </div>

                    {/* Mental */}
                    <div>
                      <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Mental / Gestion du stress</label>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { v: 5, label: 'Très confiant', color: '#34D399', bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.4)' },
                          { v: 4, label: 'Confiant',      color: '#60A5FA', bg: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.4)' },
                          { v: 3, label: 'Neutre',        color: '#A3A3A3', bg: 'rgba(163,163,163,0.12)', border: 'rgba(163,163,163,0.3)' },
                          { v: 2, label: 'Stressé',       color: '#FBBF24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)' },
                          { v: 1, label: 'Très stressé',  color: '#F87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.4)' },
                        ] as const).map(({ v, label, color, bg, border }) => {
                          const sel = form.note_mental === v;
                          return (
                            <button key={v} type="button" onClick={() => update('note_mental', sel ? null : v)}
                              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                              style={{ background: sel ? bg : 'rgba(255,255,255,0.06)', color: sel ? color : 'rgba(255,255,255,0.45)', border: `1px solid ${sel ? border : 'rgba(255,255,255,0.1)'}`, transform: sel ? 'scale(1.05)' : 'scale(1)' }}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Impressions générales */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Impressions générales</label>
                      <textarea value={form.observations} onChange={(e) => update('observations', e.target.value)}
                        rows={2} style={{ ...darkInput, resize: 'none' }}
                        placeholder="Ressenti global, anecdotes, conditions météo…" />
                    </div>
                  </div>

                  {/* ── SECTION 4 : NOTE GLOBALE (obligatoire) ── */}
                  <div className="p-4" style={{ background: 'rgba(249,115,22,0.04)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#FB923C' }}>⭐ Note globale</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(249,115,22,0.2)', color: '#FB923C', border: '1px solid rgba(249,115,22,0.35)' }}>
                        Obligatoire *
                      </span>
                    </div>
                    <GlobalRating value={form.note_globale} onChange={(v) => update('note_globale', v)} />
                  </div>

                </div>
              )}
            </div>}

            {/* ── Validation officielle moniteur — masqué pour soufflerie ── */}
            {!isSoufflerie && isMoniteur && (
              <div className="rounded-xl overflow-hidden" style={{ border: '2px solid rgba(245,158,11,0.4)' }}>
                <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'rgba(245,158,11,0.12)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
                  <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">✍</span>
                  </div>
                  <p className="text-sm font-bold text-amber-400">Validation officielle moniteur</p>
                </div>

                <div className="p-4 space-y-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      Je soussigné <span className="font-semibold text-white">{profile?.prenom} {profile?.nom}</span>
                      {moniteurProfile?.numero_brevet_moniteur && (
                        <> — {moniteurProfile.type_brevet_moniteur ?? 'BEES'} N°<span className="font-mono">{moniteurProfile.numero_brevet_moniteur}</span></>
                      )}
                      , certifie avoir encadré ce saut.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Signature — signer avec le doigt ou la souris</label>
                    <SignatureCanvas onSave={(d) => setSigDataUrl(d)} onClear={() => setSigDataUrl(null)} />
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={monAccept} onChange={(e) => setMonAccept(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded accent-amber-500" style={{ borderColor: 'rgba(255,255,255,0.3)' }} />
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Je confirme l'exactitude des informations saisies</span>
                  </label>

                  {monConfirmed && (
                    <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                      <Check className="w-4 h-4 text-green-400" />
                      <p className="text-sm font-semibold text-green-400">Validation confirmée — saut signé</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleMoniteurValidate}
                    disabled={!canMonSign || loading}
                    className="w-full py-3 rounded-xl text-sm font-bold transition-colors"
                    style={canMonSign && !loading
                      ? { background: '#F59E0B', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', cursor: 'not-allowed' }}
                  >
                    {loading ? 'Enregistrement...' : 'Signer et valider le saut'}
                  </button>
                  {!monAccept && <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>Cochez la case de confirmation pour activer</p>}
                  {monAccept && !sigDataUrl && <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>Signez pour activer la validation</p>}
                </div>
              </div>
            )}

            {/* Boutons submit */}
            </div>

            {/* Sticky submit footer */}
            <div className="flex-shrink-0 p-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', background: '#002266' }}>
              <div className="flex gap-3">
                <button type="button" onClick={onClose}
                  className="flex-1 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', height: 52 }}>
                  Annuler
                </button>
                <button type="submit"
                  disabled={loading || (!isMoniteur && !moniteurSelectionne) || !form.note_globale}
                  className="flex-1 rounded-xl text-sm font-semibold transition-colors"
                  style={{
                    height: 52,
                    ...(loading
                      ? { background: 'rgba(245,158,11,0.4)', color: 'rgba(255,255,255,0.5)', cursor: 'not-allowed' }
                      : !form.note_globale
                      ? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', cursor: 'not-allowed', border: '1px solid rgba(255,255,255,0.1)' }
                      : (!isMoniteur && !moniteurSelectionne)
                      ? { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', cursor: 'not-allowed' }
                      : moniteurSelectionne?.id === ENVOI_TOUS_ID
                      ? { background: '#003082', color: '#fff' }
                      : { background: '#F59E0B', color: '#fff' })
                  }}>
                  {loading
                    ? (isEditMode ? 'Modification...' : 'Ajout...')
                    : !form.note_globale
                    ? '★ Note globale obligatoire'
                    : isMoniteur
                    ? (isEditMode ? 'Modifier (sans signer)' : 'Ajouter (sans signer)')
                    : moniteurSelectionne?.id === ENVOI_TOUS_ID
                    ? 'Envoyer à tous'
                    : moniteurSelectionne
                    ? (isEditMode ? 'Enregistrer' : 'Ajouter le saut')
                    : 'Sélectionnez un moniteur'}
                </button>
              </div>
              {!isMoniteur && !moniteurSelectionne && (
                <p className="text-center text-xs mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Un moniteur agréé doit valider chaque saut pour qu'il soit certifié DGAC.
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
