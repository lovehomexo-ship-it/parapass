import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Layout } from '../../components/Layout';
import { THEMES, diffLabel } from '../../lib/quiz';
import { Plus, Pencil, Check, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Proposition {
  id: string;
  texte: string;
}

interface Question {
  id: string;
  enonce: string;
  bonne_reponse: string;
  explication: string;
  reference: string | null;
  theme: string;
  difficulte: 1 | 2 | 3;
  niveau_brevet_mini: string | null;
  propositions: Proposition[];
  statut: string;
  created_at: string;
}

const EMPTY_FORM = {
  enonce: '',
  bonne_reponse: '',
  explication: '',
  reference: '',
  theme: 'reglementation',
  difficulte: 1 as 1 | 2 | 3,
  niveau_brevet_mini: '',
  propositions: [
    { id: 'A', texte: '' },
    { id: 'B', texte: '' },
    { id: 'C', texte: '' },
    { id: 'D', texte: '' },
  ],
};

// ─── Formulaire question ────────────────────────────────────────────────────────

function QuestionForm({ initial, onSave, onCancel }: {
  initial?: Partial<typeof EMPTY_FORM & { id: string }>;
  onSave: (q: typeof EMPTY_FORM) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!form.enonce.trim()) { setErr('L\'énoncé est requis'); return; }
    if (form.propositions.some(p => !p.texte.trim())) { setErr('Toutes les propositions doivent être remplies'); return; }
    if (!form.bonne_reponse) { setErr('Sélectionnez la bonne réponse'); return; }
    if (!form.explication.trim()) { setErr('L\'explication est requise'); return; }
    setSaving(true);
    try { await onSave(form); } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erreur'); }
    setSaving(false);
  };

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      <h3 className="font-bold mb-4" style={{ color: 'var(--c-text)' }}>{initial?.id ? 'Modifier la question' : 'Nouvelle question'}</h3>

      {err && <p className="text-sm mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</p>}

      <div className="space-y-4">
        {/* Énoncé */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--c-muted)' }}>Énoncé *</label>
          <textarea
            value={form.enonce}
            onChange={e => setForm(f => ({ ...f, enonce: e.target.value }))}
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none"
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}
          />
        </div>

        {/* Propositions */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--c-muted)' }}>Propositions *</label>
          {form.propositions.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 mb-2">
              <input
                type="radio"
                name="bonne_reponse"
                value={p.id}
                checked={form.bonne_reponse === p.id}
                onChange={() => setForm(f => ({ ...f, bonne_reponse: p.id }))}
                title={`Bonne réponse: ${p.id}`}
              />
              <span className="w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0" style={{ background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}>
                {p.id}
              </span>
              <input
                type="text"
                value={p.texte}
                onChange={e => setForm(f => ({ ...f, propositions: f.propositions.map((pp, j) => j === i ? { ...pp, texte: e.target.value } : pp) }))}
                className="flex-1 rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}
                placeholder={`Proposition ${p.id}`}
              />
            </div>
          ))}
          <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Sélectionnez le bouton radio de la bonne réponse</p>
        </div>

        {/* Explication */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--c-muted)' }}>Explication *</label>
          <textarea
            value={form.explication}
            onChange={e => setForm(f => ({ ...f, explication: e.target.value }))}
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none"
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}
          />
        </div>

        {/* Référence */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--c-muted)' }}>Référence réglementaire</label>
          <input
            type="text"
            value={form.reference ?? ''}
            onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}
            placeholder="ex: Art. R.613-5 du code des transports"
          />
        </div>

        {/* Thème + Difficulté + Brevet */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--c-muted)' }}>Thème</label>
            <select
              value={form.theme}
              onChange={e => setForm(f => ({ ...f, theme: e.target.value }))}
              className="w-full rounded-lg px-2 py-2 text-sm"
              style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}>
              {Object.entries(THEMES).map(([k, v]) => (
                <option key={k} value={k}>{v.icone} {v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--c-muted)' }}>Difficulté</label>
            <select
              value={form.difficulte}
              onChange={e => setForm(f => ({ ...f, difficulte: parseInt(e.target.value) as 1 | 2 | 3 }))}
              className="w-full rounded-lg px-2 py-2 text-sm"
              style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}>
              <option value={1}>1 — Facile</option>
              <option value={2}>2 — Moyen</option>
              <option value={3}>3 — Difficile</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--c-muted)' }}>Brevet mini</label>
            <select
              value={form.niveau_brevet_mini ?? ''}
              onChange={e => setForm(f => ({ ...f, niveau_brevet_mini: e.target.value || null }))}
              className="w-full rounded-lg px-2 py-2 text-sm"
              style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}>
              <option value="">Tous</option>
              <option value="A">Brevet A</option>
              <option value="B">Brevet B</option>
              <option value="C">Brevet C</option>
              <option value="D">Brevet D</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-5">
        <button onClick={onCancel} className="flex-1 rounded-xl py-2.5 text-sm font-semibold" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
          Annuler
        </button>
        <button onClick={save} disabled={saving} className="flex-1 rounded-xl py-2.5 text-sm font-semibold" style={{ background: '#7C3AED', color: '#fff', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

// ─── Page admin quiz ────────────────────────────────────────────────────────────

export function QuizAdminPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterValide, setFilterValide] = useState<'all' | 'valide' | 'draft'>('all');

  const load = async () => {
    const { data } = await supabase
      .from('quiz_questions')
      .select('*')
      .order('created_at', { ascending: false });
    setQuestions((data ?? []) as Question[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Seuls les super-admins ont accès
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
      enonce: form.enonce,
      bonne_reponse: form.bonne_reponse,
      explication: form.explication,
      reference: form.reference || null,
      theme: form.theme,
      difficulte: form.difficulte,
      niveau_brevet_mini: form.niveau_brevet_mini || null,
      propositions: form.propositions,
      statut: 'validee',
    };

    if (editing) {
      await supabase.from('quiz_questions').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('quiz_questions').insert(payload);
    }
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const toggleValide = async (q: Question) => {
    await supabase.from('quiz_questions').update({ statut: q.statut === 'validee' ? 'brouillon' : 'validee' }).eq('id', q.id);
    await load();
  };

  const deleteQ = async (id: string) => {
    if (!confirm('Supprimer cette question ?')) return;
    await supabase.from('quiz_questions').delete().eq('id', id);
    await load();
  };

  const filtered = questions.filter(q =>
    filterValide === 'all' ? true : filterValide === 'valide' ? q.statut === 'validee' : q.statut !== 'validee'
  );

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Quiz Admin</h1>
            <p className="text-sm" style={{ color: 'var(--c-muted)' }}>{questions.length} questions · {questions.filter(q => q.statut === 'validee').length} validées</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditing(null); }}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: '#7C3AED', color: '#fff' }}>
            <Plus className="w-4 h-4" /> Nouvelle question
          </button>
        </div>

        {(showForm || editing) && (
          <div className="mb-6">
            <QuestionForm
              initial={editing ? {
                id: editing.id,
                enonce: editing.enonce,
                bonne_reponse: editing.bonne_reponse,
                explication: editing.explication,
                reference: editing.reference ?? '',
                theme: editing.theme,
                difficulte: editing.difficulte,
                niveau_brevet_mini: editing.niveau_brevet_mini ?? '',
                propositions: editing.propositions,
              } : undefined}
              onSave={save}
              onCancel={() => { setShowForm(false); setEditing(null); }}
            />
          </div>
        )}

        {/* Filtres */}
        <div className="flex gap-2 mb-4">
          {(['all', 'valide', 'draft'] as const).map(f => (
            <button key={f} onClick={() => setFilterValide(f)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: filterValide === f ? '#7C3AED' : 'var(--c-surface)', color: filterValide === f ? '#fff' : 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
              {f === 'all' ? 'Toutes' : f === 'valide' ? '✅ Validées' : '📝 Brouillons'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#7C3AED' }} />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(q => {
              const th = THEMES[q.theme];
              const diff = diffLabel(q.difficulte);
              const isExpanded = expanded === q.id;
              return (
                <div key={q.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                  <button
                    className="w-full text-left px-4 py-3 flex items-center gap-3"
                    onClick={() => setExpanded(isExpanded ? null : q.id)}>
                    <span className="text-lg">{th?.icone ?? '❓'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>{q.enonce}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${diff.color}15`, color: diff.color }}>{diff.label}</span>
                        {q.statut !== 'validee' && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>Brouillon</span>}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-muted)' }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-muted)' }} />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--c-border)' }}>
                      <div className="pt-3 space-y-2">
                        {(q.propositions as Proposition[]).map(p => (
                          <div key={p.id} className="flex items-center gap-2 text-sm">
                            {p.id === q.bonne_reponse
                              ? <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#10B981' }} />
                              : <X className="w-4 h-4 flex-shrink-0" style={{ color: '#EF4444' }} />}
                            <span style={{ color: p.id === q.bonne_reponse ? '#6EE7B7' : 'var(--c-muted)' }}>{p.id}. {p.texte}</span>
                          </div>
                        ))}
                        {q.explication && <p className="text-xs mt-2 italic" style={{ color: 'var(--c-muted)' }}>💡 {q.explication}</p>}
                        {q.reference && <p className="text-xs" style={{ color: '#64748B' }}>📎 {q.reference}</p>}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => toggleValide(q)}
                          className="flex-1 rounded-lg py-2 text-xs font-semibold"
                          style={{ background: q.statut === 'validee' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: q.statut === 'validee' ? '#F59E0B' : '#10B981', border: `1px solid ${q.statut === 'validee' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                          {q.statut === 'validee' ? 'Dépublier' : 'Valider & Publier'}
                        </button>
                        <button
                          onClick={() => { setEditing(q); setShowForm(false); setExpanded(null); }}
                          className="rounded-lg px-3 py-2"
                          style={{ background: 'rgba(139,92,246,0.1)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.3)' }}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteQ(q.id)}
                          className="rounded-lg px-3 py-2"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
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
