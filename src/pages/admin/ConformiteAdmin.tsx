import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Check } from 'lucide-react';
import type { ComplianceRule } from '../../lib/compliance';

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

        <p className="text-xs mt-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Note : les valeurs par défaut sont marquées « À VÉRIFIER » — confirmez-les avec la réglementation et les préconisations constructeur avant mise en production.
        </p>
      </div>
    </div>
  );
}
