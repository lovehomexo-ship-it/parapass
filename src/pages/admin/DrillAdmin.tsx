import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Layout } from '../../components/Layout';
import { DRILL_CATEGORIES } from '../../lib/drill';
import { Plus, Pencil, Check, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Proposition { id: string; texte: string }

interface DrillScenarioFull {
  id: string;
  situation: string;
  propositions: Proposition[];
  bonne_reponse: string;
  explication: string;
  reference: string | null;
  categorie: string;
  niveau_brevet_mini: string | null;
  valide: boolean;
  date_revision: string | null;
  created_at: string;
}

const EMPTY_FORM = {
  situation: '',
  bonne_reponse: '',
  explication: '',
  reference: '',
  categorie: 'incidents_ouverture',
  niveau_brevet_mini: '',
  propositions: [
    { id: 'A', texte: '' },
    { id: 'B', texte: '' },
    { id: 'C', texte: '' },
    { id: 'D', texte: '' },
  ] as Proposition[],
};

// ─── Formulaire ────────────────────────────────────────────────────────────────

function ScenarioForm({ initial, onSave, onCancel }: {
  initial?: Partial<typeof EMPTY_FORM & { id: string }>;
  onSave: (f: typeof EMPTY_FORM) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!form.situation.trim()) { setErr('La situation est requise'); return; }
    if (form.propositions.some(p => !p.texte.trim())) { setErr('Toutes les propositions doivent être remplies'); return; }
    if (!form.bonne_reponse) { setErr('Sélectionnez la bonne réponse'); return; }
    if (!form.explication.trim()) { setErr('L\'explication est requise'); return; }
    setSaving(true);
    try { await onSave(form); } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erreur'); }
    setSaving(false);
  };

  return (
    <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      <h3 className="font-bold mb-4" style={{ color: 'var(--c-text)' }}>{initial?.id ? 'Modifier le scénario' : 'Nouveau scénario'}</h3>

      {err && <p className="text-sm mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</p>}

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--c-muted)' }}>Situation concrète *</label>
          <textarea
            value={form.situation}
            onChange={e => setForm(f => ({ ...f, situation: e.target.value }))}
            rows={3}
            placeholder="Ex: Torsades sous voile à 900 m, la voile tourne lentement. Première action ?"
            className="w-full rounded-lg px-3 py-2 text-sm resize-none"
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--c-muted)' }}>Propositions * (cochez la bonne réponse)</label>
          {form.propositions.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 mb-2">
              <input type="radio" name="bonne_reponse" value={p.id}
                checked={form.bonne_reponse === p.id}
                onChange={() => setForm(f => ({ ...f, bonne_reponse: p.id }))}
                title={`Bonne réponse: ${p.id}`} />
              <span className="w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}>
                {p.id}
              </span>
              <input type="text" value={p.texte}
                onChange={e => setForm(f => ({ ...f, propositions: f.propositions.map((pp, j) => j === i ? { ...pp, texte: e.target.value } : pp) }))}
                className="flex-1 rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}
                placeholder={`Proposition ${p.id}`} />
            </div>
          ))}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--c-muted)' }}>Explication de la procédure correcte *</label>
          <textarea
            value={form.explication}
            onChange={e => setForm(f => ({ ...f, explication: e.target.value }))}
            rows={3}
            placeholder="Expliquer pas à pas la procédure correcte et pourquoi"
            className="w-full rounded-lg px-3 py-2 text-sm resize-none"
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--c-muted)' }}>Référence réglementaire</label>
          <input type="text" value={form.reference ?? ''}
            onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}
            placeholder="ex: Manuel de formation FFP — Procédures d'urgence" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--c-muted)' }}>Catégorie</label>
            <select value={form.categorie}
              onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
              className="w-full rounded-lg px-2 py-2 text-sm"
              style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}>
              {Object.entries(DRILL_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v.icone} {v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--c-muted)' }}>Brevet minimum</label>
            <select value={form.niveau_brevet_mini ?? ''}
              onChange={e => setForm(f => ({ ...f, niveau_brevet_mini: e.target.value || null }))}
              className="w-full rounded-lg px-2 py-2 text-sm"
              style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}>
              <option value="">Tous niveaux</option>
              <option value="A">Brevet A</option>
              <option value="B">Brevet B</option>
              <option value="C">Brevet C</option>
              <option value="D">Brevet D</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-5">
        <button onClick={onCancel} className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
          Annuler
        </button>
        <button onClick={save} disabled={saving} className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
          style={{ background: '#EF4444', color: '#fff', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

// ─── Page admin drill ──────────────────────────────────────────────────────────

export function DrillAdminPage() {
  const { profile } = useAuth();
  const [scenarios, setScenarios] = useState<DrillScenarioFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DrillScenarioFull | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterValide, setFilterValide] = useState<'all' | 'valide' | 'draft'>('all');

  const load = async () => {
    const { data } = await supabase
      .from('drill_scenarios')
      .select('*')
      .order('created_at', { ascending: false });
    setScenarios((data ?? []) as DrillScenarioFull[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (profile?.role !== 'admin') {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-4 py-12 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="font-semibold" style={{ color: 'var(--c-text)' }}>Accès réservé aux super-admins ParaPass</p>
        </div>
      </Layout>
    );
  }

  const save = async (form: typeof EMPTY_FORM & { id?: string }) => {
    const payload = {
      situation:          form.situation,
      bonne_reponse:      form.bonne_reponse,
      explication:        form.explication,
      reference:          form.reference || null,
      categorie:          form.categorie,
      niveau_brevet_mini: form.niveau_brevet_mini || null,
      propositions:       form.propositions,
      valide:             true,
      date_revision:      new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('drill_scenarios').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('drill_scenarios').insert(payload);
    }
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const toggleValide = async (s: DrillScenarioFull) => {
    await supabase.from('drill_scenarios').update({ valide: !s.valide }).eq('id', s.id);
    await load();
  };

  const del = async (id: string) => {
    if (!confirm('Supprimer ce scénario définitivement ?')) return;
    await supabase.from('drill_scenarios').delete().eq('id', id);
    await load();
  };

  const filtered = scenarios.filter(s =>
    filterValide === 'all' ? true : filterValide === 'valide' ? s.valide : !s.valide
  );

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>🔴 Drill Admin</h1>
            <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
              {scenarios.length} scénarios · {scenarios.filter(s => s.valide).length} validés
            </p>
          </div>
          <button onClick={() => { setShowForm(true); setEditing(null); }}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: '#EF4444', color: '#fff' }}>
            <Plus className="w-4 h-4" /> Nouveau scénario
          </button>
        </div>

        {(showForm || editing) && (
          <ScenarioForm
            initial={editing ? {
              id:                editing.id,
              situation:         editing.situation,
              bonne_reponse:     editing.bonne_reponse,
              explication:       editing.explication,
              reference:         editing.reference ?? '',
              categorie:         editing.categorie,
              niveau_brevet_mini:editing.niveau_brevet_mini ?? '',
              propositions:      editing.propositions,
            } : undefined}
            onSave={save}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        )}

        <div className="flex gap-2 mb-4">
          {(['all', 'valide', 'draft'] as const).map(f => (
            <button key={f} onClick={() => setFilterValide(f)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: filterValide === f ? '#EF4444' : 'var(--c-surface)', color: filterValide === f ? '#fff' : 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
              {f === 'all' ? 'Tous' : f === 'valide' ? '✅ Validés' : '📝 Brouillons'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#EF4444' }} />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(s => {
              const cat = DRILL_CATEGORIES[s.categorie];
              const isExpanded = expanded === s.id;
              return (
                <div key={s.id} className="rounded-xl overflow-hidden"
                  style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                  <button className="w-full text-left px-4 py-3 flex items-center gap-3"
                    onClick={() => setExpanded(isExpanded ? null : s.id)}>
                    <span className="text-lg">{cat?.icone ?? '❓'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>{s.situation}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: cat?.color ?? 'var(--c-muted)' }}>{cat?.label}</span>
                        {!s.valide && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>Brouillon</span>}
                        {s.niveau_brevet_mini && <span className="text-xs" style={{ color: 'var(--c-muted)' }}>Brevet {s.niveau_brevet_mini}+</span>}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-muted)' }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-muted)' }} />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--c-border)' }}>
                      <div className="pt-3 space-y-2">
                        {(s.propositions as Proposition[]).map(p => (
                          <div key={p.id} className="flex items-start gap-2 text-sm">
                            {p.id === s.bonne_reponse
                              ? <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} />
                              : <X className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#EF4444' }} />}
                            <span style={{ color: p.id === s.bonne_reponse ? '#6EE7B7' : 'var(--c-muted)' }}>
                              {p.id}. {p.texte}
                            </span>
                          </div>
                        ))}
                        {s.explication && <p className="text-xs mt-2 italic" style={{ color: 'var(--c-muted)' }}>💡 {s.explication}</p>}
                        {s.reference && <p className="text-xs" style={{ color: '#64748B' }}>📎 {s.reference}</p>}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button onClick={() => toggleValide(s)}
                          className="flex-1 rounded-lg py-2 text-xs font-semibold"
                          style={{ background: s.valide ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: s.valide ? '#F59E0B' : '#10B981', border: `1px solid ${s.valide ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                          {s.valide ? 'Dépublier' : 'Valider & Publier'}
                        </button>
                        <button onClick={() => { setEditing(s); setShowForm(false); setExpanded(null); }}
                          className="rounded-lg px-3 py-2"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => del(s.id)}
                          className="rounded-lg px-3 py-2"
                          style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: '1px solid rgba(100,116,139,0.3)' }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
