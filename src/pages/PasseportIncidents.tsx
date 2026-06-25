import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Check, X, AlertTriangle } from 'lucide-react';
import type { Incident } from '../lib/types';

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D]';

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

const MOTIFS_PRESET = [
  'Ouverture secours',
  'Mal-fonctionnement principal',
  'Atterrissage hors zone',
  'Blessure à l\'atterrissage',
  'Collision en chute',
  'Collision sous voile',
  'Autre',
];

export function IncidentsTab({
  incidents,
  isMoniteurOrAdmin,
  targetUserId,
  onRefresh,
}: {
  incidents: Incident[];
  isMoniteurOrAdmin: boolean;
  targetUserId?: string;
  onRefresh: () => void;
}) {
  const empty = { date_incident: '', lieu: '', motif: '', motif_custom: '' };
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!targetUserId) return;
    setSaving(true);
    const motifFinal = form.motif === 'Autre' ? form.motif_custom : form.motif;
    await supabase.from('incidents').insert({
      parachutiste_id: targetUserId,
      date_incident: form.date_incident,
      lieu: form.lieu,
      motif: motifFinal,
    });
    setSaving(false);
    setShowForm(false);
    setForm(empty);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-orange-800 uppercase tracking-wider mb-1">Procédures de secours — page 5 carnet FFP</p>
        <p className="text-xs text-orange-700">Tout incident (ouverture secours, mal-fonctionnement…) doit être consigné. Seuls les moniteurs et administrateurs peuvent créer des entrées.</p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#001A4D]">Incidents &amp; Procédures de secours</h2>
        {isMoniteurOrAdmin && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1 bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        )}
      </div>

      {showForm && isMoniteurOrAdmin && (
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Date de l'incident">
              <input type="date" className={inputCls} value={form.date_incident} onChange={(e) => setForm({ ...form, date_incident: e.target.value })} />
            </FormRow>
            <FormRow label="Lieu / DZ">
              <input className={inputCls} value={form.lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} placeholder="Gap-Tallard" />
            </FormRow>
          </div>
          <FormRow label="Motif">
            <select className={`${inputCls} bg-white`} value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })}>
              <option value="">-- Choisir --</option>
              {MOTIFS_PRESET.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </FormRow>
          {form.motif === 'Autre' && (
            <FormRow label="Préciser le motif">
              <input className={inputCls} value={form.motif_custom} onChange={(e) => setForm({ ...form, motif_custom: e.target.value })} />
            </FormRow>
          )}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !form.date_incident || !form.motif}
              className="flex items-center gap-1 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              <Check className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm">
              <X className="w-4 h-4" /> Annuler
            </button>
          </div>
        </div>
      )}

      {incidents.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-medium">{incidents.length} incident(s) consigné(s) dans ce carnet</p>
        </div>
      )}

      <div className="space-y-3">
        {incidents.map((inc, idx) => (
          <div key={inc.id} className="bg-white rounded-xl border border-orange-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border-b border-orange-100">
              <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{idx + 1}</span>
              </div>
              <p className="text-sm font-semibold text-orange-800">
                {new Date(inc.date_incident).toLocaleDateString('fr-FR')}
                {inc.lieu ? ` — ${inc.lieu}` : ''}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-gray-700">{inc.motif}</p>
            </div>
          </div>
        ))}
      </div>

      {incidents.length === 0 && !showForm && (
        <div className="text-center py-8 text-gray-400 text-sm">Aucun incident enregistré</div>
      )}
    </div>
  );
}
