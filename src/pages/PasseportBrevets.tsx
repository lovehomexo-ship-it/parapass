import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Check } from 'lucide-react';
import type { ModuleBrevet, Brevet } from '../lib/types';
import { MODULES_PAR_BREVET, TYPE_BREVET_LABELS } from '../lib/types';

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D]';

const BREVETS_PRINCIPAUX = ['BPA', 'A', 'B', 'C', 'D'] as const;
const BREVETS_SPECIALISES = ['B1', 'B2', 'B3', 'Bi4', 'B4', 'Bi5', 'B5'] as const;
const BREVETS_AUTRES = ['VH', 'WS1', 'WS2', 'WS3'] as const;

function ModuleRow({
  module: def,
  validated,
  isEditor,
  onValidate,
}: {
  module: { code: string; nom: string; facultatif?: boolean };
  validated: ModuleBrevet | null;
  isEditor: boolean;
  onValidate: (code: string, data: { date_validation: string; lieu: string; validateur_nom: string }) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({ date_validation: '', lieu: '', validateur_nom: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onValidate(def.code, form);
    setSaving(false);
    setExpanded(false);
  };

  return (
    <div className={`border-b border-gray-100 last:border-0 ${validated ? 'bg-green-50/40' : ''}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
          validated ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'
        }`}>
          {validated && <Check className="w-3.5 h-3.5 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${validated ? 'text-green-800' : 'text-gray-700'}`}>
            {def.nom}
            {def.facultatif && <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase tracking-wider">Facultatif</span>}
          </p>
          {validated && (
            <p className="text-xs text-green-600 mt-0.5">
              {new Date(validated.date_validation!).toLocaleDateString('fr-FR')}
              {validated.lieu ? ` — ${validated.lieu}` : ''}
              {validated.validateur_nom ? ` (${validated.validateur_nom})` : ''}
            </p>
          )}
        </div>
        {isEditor && !validated && (
          <button
            onClick={() => setExpanded((o) => !o)}
            className="text-xs bg-[#001A4D] text-white px-2.5 py-1 rounded-lg font-medium flex-shrink-0"
          >
            Valider
          </button>
        )}
      </div>

      {expanded && isEditor && (
        <div className="px-4 pb-4 pt-1 bg-blue-50 border-t border-blue-100 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date de validation</label>
              <input type="date" className={inputCls} value={form.date_validation} onChange={(e) => setForm({ ...form, date_validation: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lieu</label>
              <input className={inputCls} value={form.lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} placeholder="DZ / Centre" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Validateur (DT / moniteur)</label>
            <input className={inputCls} value={form.validateur_nom} onChange={(e) => setForm({ ...form, validateur_nom: e.target.value })} placeholder="Nom du DT" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.date_validation}
              className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
              <Check className="w-3 h-3" /> {saving ? '...' : 'Confirmer'}
            </button>
            <button onClick={() => setExpanded(false)} className="text-xs text-gray-500 hover:underline">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BrevetSection({
  typeBrevet,
  brevets,
  modules,
  isEditor,
  userId,
  onRefresh,
}: {
  typeBrevet: string;
  brevets: Brevet[];
  modules: ModuleBrevet[];
  isEditor: boolean;
  userId?: string;
  onRefresh: () => void;
}) {
  const def = MODULES_PAR_BREVET[typeBrevet];
  // Les hooks doivent être appelés inconditionnellement : on calcule l'état
  // AVANT tout early-return pour garantir un ordre d'appel stable.
  const brevetFinal = brevets.find((b) => b.type_brevet === typeBrevet);
  const modulesDuBrevet = modules.filter((m) => m.type_brevet === typeBrevet);
  const [open, setOpen] = useState(brevetFinal !== undefined);
  if (!def) return null;

  const validated = (code: string) => modulesDuBrevet.find((m) => m.code_module === code) ?? null;

  const allDone = def.filter((d) => !d.facultatif).every((d) => validated(d.code));

  const handleValidate = async (code: string, data: { date_validation: string; lieu: string; validateur_nom: string }) => {
    if (!userId) return;
    await supabase.from('modules_brevets').upsert({
      parachutiste_id: userId,
      type_brevet: typeBrevet,
      code_module: code,
      nom_module: def.find((d) => d.code === code)?.nom ?? code,
      date_validation: data.date_validation,
      lieu: data.lieu,
      validateur_nom: data.validateur_nom,
      est_facultatif: def.find((d) => d.code === code)?.facultatif ?? false,
    }, { onConflict: 'parachutiste_id,type_brevet,code_module' });
    onRefresh();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#001A4D] hover:bg-[#1E3A5F] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-sm">{TYPE_BREVET_LABELS[typeBrevet] ?? typeBrevet}</span>
          {allDone && brevetFinal && (
            <span className="text-[10px] bg-green-400 text-white px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">Obtenu</span>
          )}
          {allDone && !brevetFinal && (
            <span className="text-[10px] bg-amber-400 text-white px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">Modules complets</span>
          )}
        </div>
        <span className="text-white/60 text-xs">{modulesDuBrevet.filter((m) => m.date_validation).length}/{def.filter((d) => !d.facultatif).length} modules</span>
      </button>

      {open && (
        <div className="divide-y divide-gray-50">
          {def.map((d) => (
            <ModuleRow
              key={d.code}
              module={d}
              validated={validated(d.code)}
              isEditor={isEditor}
              onValidate={handleValidate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BrevetsModulesTab({
  brevets,
  modules,
  userId,
  isEditor,
  onRefresh,
}: {
  brevets: Brevet[];
  modules: ModuleBrevet[];
  userId?: string;
  isEditor: boolean;
  onRefresh: () => void;
}) {
  const [section, setSection] = useState<'principaux' | 'specialises' | 'autres'>('principaux');

  const sectionTabs = [
    { key: 'principaux' as const, label: 'Brevets principaux' },
    { key: 'specialises' as const, label: 'B spécialisés' },
    { key: 'autres' as const, label: 'VH & Wingsuit' },
  ];

  const groupMap = {
    principaux: BREVETS_PRINCIPAUX as readonly string[],
    specialises: BREVETS_SPECIALISES as readonly string[],
    autres: [...BREVETS_AUTRES] as string[],
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#001A4D]/5 rounded-xl p-4">
        <p className="text-xs text-[#001A4D] font-semibold">Brevets FFP</p>
        <p className="text-xs text-gray-500 mt-0.5">Les modules sont validés par le Directeur Technique ou un moniteur habilité. Chaque ligne correspond à une page du carnet papier.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {sectionTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSection(t.key)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              section === t.key ? 'bg-[#001A4D] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {groupMap[section].map((typeBrevet) => (
          <BrevetSection
            key={typeBrevet}
            typeBrevet={typeBrevet}
            brevets={brevets}
            modules={modules}
            isEditor={isEditor}
            userId={userId}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}
