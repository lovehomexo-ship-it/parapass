import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Check, X } from 'lucide-react';
import type { ContactUrgence, InterdictionSaut } from '../lib/types';

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D]';

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ─── Contacts d'urgence ────────────────────────────────────────────────────────

export function ContactsUrgenceTab({
  contacts,
  userId,
  onRefresh,
}: {
  contacts: ContactUrgence[];
  userId?: string;
  onRefresh: () => void;
}) {
  const empty = { nom: '', telephone: '', adresse: '' };
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const startEdit = (c: ContactUrgence) => {
    setForm({ nom: c.nom, telephone: c.telephone, adresse: c.adresse });
    setEditingId(c.id);
    setShowForm(true);
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    if (editingId) {
      await supabase.from('contacts_urgence').update(form).eq('id', editingId);
    } else {
      await supabase.from('contacts_urgence').insert({ ...form, parachutiste_id: userId });
    }
    setSaving(false);
    setShowForm(false);
    setForm(empty);
    setEditingId(null);
    onRefresh();
  };

  const remove = async (id: string) => {
    await supabase.from('contacts_urgence').delete().eq('id', id);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">Personne à prévenir en cas d'accident</p>
        <p className="text-xs text-amber-700">Ces informations correspondent à la page 2 de votre carnet de sauts papier FFP.</p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#001A4D]">Contacts d'urgence</h2>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(empty); }}
          className="flex items-center gap-1 bg-[#001A4D] text-white px-3 py-1.5 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 space-y-3">
          <FormRow label="Nom et prénom">
            <input className={inputCls} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Marie Dupont" />
          </FormRow>
          <FormRow label="Téléphone">
            <input type="tel" className={inputCls} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="06 12 34 56 78" />
          </FormRow>
          <FormRow label="Adresse (optionnel)">
            <input className={inputCls} value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} placeholder="12 rue de la Paix, 75001 Paris" />
          </FormRow>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex items-center gap-1 bg-[#001A4D] text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Check className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm">
              <X className="w-4 h-4" /> Annuler
            </button>
          </div>
        </div>
      )}

      {contacts.map((c) => (
        <div key={c.id} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-[#001A4D]">{c.nom}</p>
              {c.telephone && <p className="text-sm text-gray-600 mt-0.5">{c.telephone}</p>}
              {c.adresse && <p className="text-xs text-gray-400 mt-0.5">{c.adresse}</p>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => startEdit(c)} className="text-gray-400 hover:text-[#001A4D] p-1 text-xs border border-gray-200 rounded px-2">Modifier</button>
              <button onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      ))}

      {contacts.length === 0 && !showForm && (
        <div className="text-center py-8 text-gray-400 text-sm">Aucun contact d'urgence enregistré</div>
      )}
    </div>
  );
}

// ─── Interdictions de sauts ────────────────────────────────────────────────────

export function InterdictionsTab({
  interdictions,
  isMoniteurOrAdmin,
  userId,
  onRefresh,
}: {
  interdictions: InterdictionSaut[];
  isMoniteurOrAdmin: boolean;
  userId?: string;
  onRefresh: () => void;
}) {
  const empty = { date_interdiction: '', duree: '', motif: '', parachutiste_id: '' };
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase.from('interdictions_sauts').insert({ ...form, parachutiste_id: userId, duree: form.duree || null });
    setSaving(false);
    setShowForm(false);
    setForm(empty);
    onRefresh();
  };

  const now = new Date();
  const activeInterdictions = interdictions.filter((i) => {
    if (!i.duree) return false;
    const end = new Date(i.date_interdiction);
    const match = i.duree.match(/(\d+)/);
    if (match) end.setDate(end.getDate() + parseInt(match[1]));
    return end > now;
  });

  return (
    <div className="space-y-4">
      {activeInterdictions.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs font-bold">!</span>
          </div>
          <div>
            <p className="text-sm font-bold text-red-700">Interdiction de saut active</p>
            <p className="text-xs text-red-600 mt-0.5">{activeInterdictions[0].motif}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#001A4D]">Interdictions de sauts</h2>
        {isMoniteurOrAdmin && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1 bg-[#001A4D] text-white px-3 py-1.5 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        )}
      </div>

      {showForm && isMoniteurOrAdmin && (
        <div className="bg-red-50 rounded-xl p-4 border border-red-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Date d'interdiction">
              <input type="date" className={inputCls} value={form.date_interdiction} onChange={(e) => setForm({ ...form, date_interdiction: e.target.value })} />
            </FormRow>
            <FormRow label="Durée (ex: 30 jours)">
              <input className={inputCls} value={form.duree} onChange={(e) => setForm({ ...form, duree: e.target.value })} placeholder="30 jours" />
            </FormRow>
          </div>
          <FormRow label="Motif">
            <input className={inputCls} value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} placeholder="ex: visite médicale requise" />
          </FormRow>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex items-center gap-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Check className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm">
              <X className="w-4 h-4" /> Annuler
            </button>
          </div>
        </div>
      )}

      {interdictions.map((i) => (
        <div key={i.id} className="bg-white rounded-xl p-4 border border-red-100 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-red-700">{new Date(i.date_interdiction).toLocaleDateString('fr-FR')}{i.duree ? ` — ${i.duree}` : ''}</p>
              <p className="text-sm text-gray-600 mt-0.5">{i.motif}</p>
            </div>
          </div>
        </div>
      ))}

      {interdictions.length === 0 && !showForm && (
        <div className="text-center py-8 text-gray-400 text-sm">Aucune interdiction enregistrée</div>
      )}
    </div>
  );
}
