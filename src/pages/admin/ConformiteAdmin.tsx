import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Check } from 'lucide-react';
import type { ComplianceRule } from '../../lib/compliance';
import type { CurrencyRule } from '../../lib/currency';
import type { CanopyGuideline } from '../../lib/canopy';
import { TYPE_BREVET_LABELS } from '../../lib/types';

/** Repères de charge alaire (canopy_guidelines), par tranche de sauts. */
function CanopyGuidelinesSection() {
  const [rows, setRows] = useState<CanopyGuideline[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('canopy_guidelines')
      .select('id, sauts_min, sauts_max, charge_max_recommandee, commentaire')
      .order('sauts_min');
    if (error) { console.error('Chargement canopy_guidelines échoué :', error); setError(error.message); return; }
    setRows((data ?? []) as CanopyGuideline[]);
    setDrafts(Object.fromEntries((data ?? []).map(r => [r.id, String(r.charge_max_recommandee)])));
  };

  useEffect(() => { load(); }, []);

  const save = async (id: string) => {
    const value = parseFloat((drafts[id] ?? '').replace(',', '.'));
    if (isNaN(value) || value <= 0 || value > 5) { setError('Charge max invalide (attendu : lb/ft², ex. 1.30).'); return; }
    setSavingId(id);
    setError(null);
    const { data: written, error } = await supabase
      .from('canopy_guidelines')
      .update({ charge_max_recommandee: value, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id');
    setSavingId(null);
    if (error || !written || written.length === 0) {
      console.error('Écriture canopy_guidelines échouée :', error);
      setError(error?.message ?? 'Écriture refusée — le repère n\'a pas été modifié.');
      return;
    }
    setSavedId(id);
    setTimeout(() => setSavedId(null), 2000);
    load();
  };

  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold text-white mb-2">Repères de charge alaire</h2>
      <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Charge alaire maximale recommandée (lb/ft²) par tranche de sauts. « À VÉRIFIER — recommandations fédérales / manuels constructeurs ».
      </p>
      {error && (
        <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
          ⚠️ {error}
        </div>
      )}
      <div className="space-y-3">
        {rows.map(row => (
          <div key={row.id} className="rounded-xl p-4 flex items-center justify-between gap-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{row.sauts_min} – {row.sauts_max ?? '∞'} sauts</p>
              {row.commentaire && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{row.commentaire}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
                type="number" min={0} step="0.05"
                value={drafts[row.id] ?? ''}
                onChange={e => setDrafts(d => ({ ...d, [row.id]: e.target.value }))}
                className="w-24 rounded-lg px-3 py-2 text-sm text-white text-center outline-none"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                aria-label={`Charge max pour ${row.sauts_min}–${row.sauts_max ?? '∞'} sauts`}
              />
              <button
                onClick={() => save(row.id)}
                disabled={savingId === row.id}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                style={{ background: savedId === row.id ? '#10B981' : '#2563EB' }}
              >
                {savedId === row.id ? <Check className="w-4 h-4" /> : savingId === row.id ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Règles de reprise après inactivité (currency_rules), par niveau. */
function CurrencyRulesSection() {
  const [rules, setRules] = useState<CurrencyRule[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { conseille: string; obligatoire: string }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('currency_rules')
      .select('niveau, seuil_conseille_jours, seuil_obligatoire_jours, message')
      .order('niveau');
    if (error) {
      console.error('Chargement currency_rules échoué :', error);
      setError(error.message);
      return;
    }
    setRules(data ?? []);
    setDrafts(Object.fromEntries((data ?? []).map(r => [r.niveau, {
      conseille: String(r.seuil_conseille_jours),
      obligatoire: String(r.seuil_obligatoire_jours),
    }])));
  };

  useEffect(() => { load(); }, []);

  const save = async (niveau: string) => {
    const d = drafts[niveau];
    const conseille = parseInt(d?.conseille ?? '', 10);
    const obligatoire = parseInt(d?.obligatoire ?? '', 10);
    if (isNaN(conseille) || isNaN(obligatoire) || conseille < 0 || obligatoire < conseille) {
      setError(`Valeurs invalides pour ${niveau} (le seuil obligatoire doit être ≥ au seuil conseillé).`);
      return;
    }
    setSavingKey(niveau);
    setError(null);
    const { data: written, error } = await supabase
      .from('currency_rules')
      .update({ seuil_conseille_jours: conseille, seuil_obligatoire_jours: obligatoire, updated_at: new Date().toISOString() })
      .eq('niveau', niveau)
      .select('niveau');
    setSavingKey(null);
    if (error || !written || written.length === 0) {
      console.error('Écriture currency_rules échouée :', error);
      setError(error?.message ?? 'Écriture refusée — la règle n\'a pas été modifiée.');
      return;
    }
    setSavedKey(niveau);
    setTimeout(() => setSavedKey(null), 2000);
    load();
  };

  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold text-white mb-2">Règles de reprise après inactivité</h2>
      <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Seuils en jours depuis le dernier saut, par niveau. « À VÉRIFIER — directives techniques FFP ».
      </p>
      {error && (
        <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
          ⚠️ {error}
        </div>
      )}
      <div className="space-y-3">
        {rules.map(rule => (
          <div key={rule.niveau} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <p className="text-sm font-semibold text-white">{TYPE_BREVET_LABELS[rule.niveau] ?? rule.niveau}</p>
                {rule.message && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{rule.message}</p>}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <label className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Conseillé (j)
                  <input
                    type="number" min={0}
                    value={drafts[rule.niveau]?.conseille ?? ''}
                    onChange={e => setDrafts(dr => ({ ...dr, [rule.niveau]: { ...dr[rule.niveau], conseille: e.target.value } }))}
                    className="block w-20 mt-1 rounded-lg px-3 py-2 text-sm text-white text-center outline-none"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                  />
                </label>
                <label className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Obligatoire (j)
                  <input
                    type="number" min={0}
                    value={drafts[rule.niveau]?.obligatoire ?? ''}
                    onChange={e => setDrafts(dr => ({ ...dr, [rule.niveau]: { ...dr[rule.niveau], obligatoire: e.target.value } }))}
                    className="block w-20 mt-1 rounded-lg px-3 py-2 text-sm text-white text-center outline-none"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                  />
                </label>
                <button
                  onClick={() => save(rule.niveau)}
                  disabled={savingKey === rule.niveau}
                  className="self-end px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                  style={{ background: savedKey === rule.niveau ? '#10B981' : '#2563EB' }}
                >
                  {savedKey === rule.niveau ? <Check className="w-4 h-4" /> : savingKey === rule.niveau ? '…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Administration des règles de conformité (rôle admin uniquement — route protégée + RLS). */
export function ConformiteAdminPage() {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('compliance_rules')
      .select('rule_key, value_int, label, description')
      .order('rule_key');
    if (error) {
      console.error('Chargement compliance_rules échoué :', error);
      setError(error.message);
    } else {
      setRules(data ?? []);
      setDrafts(Object.fromEntries((data ?? []).map(r => [r.rule_key, String(r.value_int)])));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (key: string) => {
    const value = parseInt(drafts[key], 10);
    if (isNaN(value) || value < 0) { setError(`Valeur invalide pour ${key}`); return; }
    setSavingKey(key);
    setError(null);
    const { data: written, error } = await supabase
      .from('compliance_rules')
      .update({ value_int: value, updated_at: new Date().toISOString() })
      .eq('rule_key', key)
      .select('rule_key');
    setSavingKey(null);
    if (error || !written || written.length === 0) {
      console.error('Écriture compliance_rules échouée :', error);
      setError(error?.message ?? 'Écriture refusée — la règle n\'a pas été modifiée.');
      return;
    }
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 2000);
    load();
  };

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: '#0B1D3A' }}>
      <div className="max-w-2xl mx-auto">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm mb-6 no-underline" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <ArrowLeft className="w-4 h-4" /> Retour admin
        </Link>
        <h1 className="text-2xl font-bold text-white mb-2">Règles de conformité</h1>
        <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Seuils utilisés pour les états et alertes (matériel, documents). Aucune valeur n'est codée en dur : ce que vous modifiez ici s'applique partout.
        </p>

        {error && (
          <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => (
              <div key={rule.rule_key} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{rule.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{rule.description}</p>
                    <p className="text-[10px] mt-1 font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>{rule.rule_key}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="number"
                      min={0}
                      value={drafts[rule.rule_key] ?? ''}
                      onChange={e => setDrafts(d => ({ ...d, [rule.rule_key]: e.target.value }))}
                      className="w-20 rounded-lg px-3 py-2 text-sm text-white text-center outline-none"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                      aria-label={`Valeur pour ${rule.label}`}
                    />
                    <button
                      onClick={() => save(rule.rule_key)}
                      disabled={savingKey === rule.rule_key || drafts[rule.rule_key] === String(rule.value_int)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                      style={{ background: savedKey === rule.rule_key ? '#10B981' : '#2563EB' }}
                    >
                      {savedKey === rule.rule_key ? <Check className="w-4 h-4" /> : savingKey === rule.rule_key ? '…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <CurrencyRulesSection />

        <CanopyGuidelinesSection />

        <p className="text-xs mt-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Note : les valeurs par défaut sont marquées « À VÉRIFIER » — confirmez-les avec la réglementation et les préconisations constructeur avant mise en production.
        </p>
      </div>
    </div>
  );
}
