import { useState, useEffect } from 'react';
import { X, Wind } from 'lucide-react';
import type { SoufflerieSession } from '../hooks/useSoufflerieSession';

const TUNNELS = [
  'Flyspot Paris',
  'Flyspot Bordeaux',
  'Airkix Lyon',
  'Tunnel de Charleroi',
  'iFLY Dubai',
  'Autre...',
];

const TYPE_VOL = [
  { value: 'solo',        label: 'Solo' },
  { value: 'coaching',    label: 'Coaching' },
  { value: 'formation',   label: 'Formation' },
  { value: 'competition', label: 'Compétition' },
] as const;

const DISCIPLINES = ['FS', 'VRW', 'Freestyle', 'Vitesse', 'FS4'];

const STAR_LABELS = ['', 'À travailler', 'En progression', 'Correct', 'Bien', 'Excellent'];

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  userId: string;
  onAdd: (payload: Omit<SoufflerieSession, 'id' | 'created_at'>) => Promise<boolean>;
}

export function AddSoufflerieModal({ open, onClose, onAdded, userId, onAdd }: Props) {
  const today = new Date().toISOString().split('T')[0];

  const emptyForm = {
    date: today,
    duree_min: '' as string | number,
    tunnel: '',
    tunnelAutre: '',
    type_vol: 'solo' as SoufflerieSession['type_vol'],
    disciplines: [] as string[],
    instructeur: '',
    notes: '',
    note_globale: null as number | null,
  };

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm(emptyForm); setErrors({}); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const update = (field: string, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  const toggleDiscipline = (d: string) => {
    setForm((f) => ({
      ...f,
      disciplines: f.disciplines.includes(d)
        ? f.disciplines.filter((x) => x !== d)
        : [...f.disciplines, d],
    }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.date) errs.date = 'Obligatoire';
    const dur = Number(form.duree_min);
    if (!form.duree_min || isNaN(dur) || dur <= 0) errs.duree_min = 'Durée invalide';
    const tunnel = form.tunnel === 'Autre...' ? form.tunnelAutre.trim() : form.tunnel;
    if (!tunnel) errs.tunnel = 'Obligatoire';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    const tunnel = form.tunnel === 'Autre...' ? form.tunnelAutre.trim() : form.tunnel;
    const ok = await onAdd({
      user_id: userId,
      date: form.date,
      duree_min: Number(form.duree_min),
      tunnel,
      type_vol: form.type_vol,
      disciplines: form.disciplines,
      instructeur: form.instructeur.trim() || null,
      notes: form.notes.trim() || null,
      note_globale: form.note_globale,
    });
    setSaving(false);
    if (ok) { onAdded(); onClose(); }
  };

  const inputCls = (field: string) =>
    `w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all ${errors[field] ? 'border-red-500' : 'border-white/10'}`
    + ' bg-white/5 border text-white placeholder-white/30 focus:border-blue-400';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#0B1F3A', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <Wind className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-white">Nouvelle session soufflerie</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Date + Durée */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Date *</label>
              <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)}
                className={inputCls('date')} style={{ colorScheme: 'dark' }} />
              {errors.date && <p className="text-red-400 text-xs mt-1">{errors.date}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Durée (min) *</label>
              <input type="number" min={1} placeholder="15"
                value={form.duree_min}
                onChange={(e) => update('duree_min', e.target.value)}
                className={inputCls('duree_min')} />
              {errors.duree_min && <p className="text-red-400 text-xs mt-1">{errors.duree_min}</p>}
            </div>
          </div>

          {/* Tunnel */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Tunnel *</label>
            <select value={form.tunnel} onChange={(e) => update('tunnel', e.target.value)}
              className={inputCls('tunnel')}
              style={{ background: '#0B1F3A' }}>
              <option value="">Choisir un tunnel…</option>
              {TUNNELS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {form.tunnel === 'Autre...' && (
              <input type="text" placeholder="Nom du tunnel" value={form.tunnelAutre}
                onChange={(e) => update('tunnelAutre', e.target.value)}
                className={`${inputCls('tunnel')} mt-2`} />
            )}
            {errors.tunnel && <p className="text-red-400 text-xs mt-1">{errors.tunnel}</p>}
          </div>

          {/* Type de vol */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">Type de vol *</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_VOL.map(({ value, label }) => {
                const sel = form.type_vol === value;
                return (
                  <button key={value} type="button"
                    onClick={() => update('type_vol', value)}
                    className="py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: sel ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)',
                      border: sel ? '1.5px solid #60A5FA' : '1.5px solid rgba(255,255,255,0.08)',
                      color: sel ? '#60A5FA' : 'rgba(255,255,255,0.6)',
                    }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Disciplines */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">Disciplines</label>
            <div className="flex flex-wrap gap-2">
              {DISCIPLINES.map((d) => {
                const sel = form.disciplines.includes(d);
                return (
                  <button key={d} type="button" onClick={() => toggleDiscipline(d)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: sel ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.05)',
                      border: sel ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.08)',
                      color: sel ? '#93C5FD' : 'rgba(255,255,255,0.5)',
                    }}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Instructeur */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Instructeur (optionnel)</label>
            <input type="text" placeholder="Nom de l'instructeur"
              value={form.instructeur} onChange={(e) => update('instructeur', e.target.value)}
              className={inputCls('instructeur')} />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Notes (optionnel)</label>
            <textarea rows={2} placeholder="Objectifs, ressentis, points à améliorer…"
              value={form.notes} onChange={(e) => update('notes', e.target.value)}
              className={`${inputCls('notes')} resize-none`} />
          </div>

          {/* Note globale */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">Note globale</label>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button"
                  onPointerDown={(e) => { e.preventDefault(); update('note_globale', form.note_globale === n ? null : n); }}
                  className="transition-transform"
                  style={{
                    fontSize: 30,
                    lineHeight: 1,
                    color: (form.note_globale ?? 0) >= n ? '#60A5FA' : 'rgba(255,255,255,0.15)',
                    transform: form.note_globale === n ? 'scale(1.15)' : 'scale(1)',
                    WebkitTapHighlightColor: 'transparent',
                  }}>★</button>
              ))}
            </div>
            {form.note_globale && (
              <p className="text-xs text-center mt-1 font-medium" style={{ color: '#60A5FA' }}>
                {STAR_LABELS[form.note_globale]}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 transition"
            style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
            Annuler
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition"
            style={{ background: saving ? 'rgba(96,165,250,0.4)' : '#1C8CE8' }}>
            {saving ? 'Enregistrement…' : 'Ajouter la session'}
          </button>
        </div>
      </div>
    </div>
  );
}
