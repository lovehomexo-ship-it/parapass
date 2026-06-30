import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { MODULES, LIVE_MODULE_IDS, PRIX_MODULES_SEPARES, STUDIO, ECONOMIE_STUDIO } from '../../data/modules';
import type { Module } from '../../data/modules';
import { Check, Loader2, Clock, Zap, Package } from 'lucide-react';

interface Props {
  centreId: string;
}

export function ModulesSection({ centreId }: Props) {
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set());
  const [waitlist, setWaitlist] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: mods }, { data: wl }] = await Promise.all([
        supabase.from('centre_modules').select('module_id').eq('centre_id', centreId).eq('active', true),
        supabase.from('module_waitlist').select('module_id').eq('centre_id', centreId),
      ]);
      setActiveModules(new Set((mods ?? []).map((r) => r.module_id)));
      setWaitlist(new Set((wl ?? []).map((r) => r.module_id)));
      setLoading(false);
    };
    load();
  }, [centreId]);

  const studioActive = activeModules.has('studio');

  const isModuleActive = (id: string) => {
    if (studioActive && LIVE_MODULE_IDS.includes(id)) return true;
    return activeModules.has(id);
  };

  const isIncludedInStudio = (id: string) =>
    studioActive && LIVE_MODULE_IDS.includes(id) && !activeModules.has(id);

  const toggleModule = async (mod: Module) => {
    if (mod.status === 'soon') return;
    setSaving(mod.id);

    const currentlyActive = isModuleActive(mod.id);

    if (mod.id === 'studio') {
      if (studioActive) {
        // Désactiver studio
        await supabase.from('centre_modules').delete().eq('centre_id', centreId).eq('module_id', 'studio');
        setActiveModules((s) => { const n = new Set(s); n.delete('studio'); return n; });
        showToast('ParaPass Studio désactivé.');
      } else {
        // Activer studio
        await supabase.from('centre_modules').upsert({ centre_id: centreId, module_id: 'studio', active: true }, { onConflict: 'centre_id,module_id' });
        setActiveModules((s) => new Set([...s, 'studio']));
        showToast('ParaPass Studio activé — tous les modules sont inclus !');
      }
    } else {
      if (currentlyActive && !isIncludedInStudio(mod.id)) {
        await supabase.from('centre_modules').delete().eq('centre_id', centreId).eq('module_id', mod.id);
        setActiveModules((s) => { const n = new Set(s); n.delete(mod.id); return n; });
        showToast(`${mod.nom} désactivé.`);
      } else if (!currentlyActive) {
        await supabase.from('centre_modules').upsert({ centre_id: centreId, module_id: mod.id, active: true }, { onConflict: 'centre_id,module_id' });
        setActiveModules((s) => new Set([...s, mod.id]));
        showToast(`${mod.nom} activé.`);
      }
    }

    setSaving(null);
  };

  const joinWaitlist = async (mod: Module) => {
    if (waitlist.has(mod.id)) return;
    setSaving(mod.id);
    await supabase.from('module_waitlist').upsert({ centre_id: centreId, module_id: mod.id }, { onConflict: 'centre_id,module_id' });
    setWaitlist((s) => new Set([...s, mod.id]));
    setSaving(null);
    showToast(`Inscrit sur la liste d'attente pour ${mod.nom} — vous serez prévenu au lancement.`);
  };

  const liveModules = MODULES.filter((m) => m.status === 'live');
  const packModule = MODULES.find((m) => m.status === 'pack')!;
  const roadmapModules = MODULES.filter((m) => m.status === 'soon');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--c-dim)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-10 p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium text-white shadow-xl"
          style={{ background: '#001A4D', border: '1px solid rgba(255,255,255,0.15)', maxWidth: '90vw' }}>
          {toast}
        </div>
      )}

      {/* ── En-tête ── */}
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--c-text)' }}>Modules optionnels</h2>
        <p className="text-sm" style={{ color: 'var(--c-dim)' }}>
          Activez les modules dont vous avez besoin. Ils s'ajoutent à votre abonnement socle.
        </p>
      </div>

      {/* ── Pack Studio (mis en avant) ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4" style={{ color: '#F97316' }} />
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#F97316' }}>Pack tout inclus</h3>
        </div>
        <PackCard
          mod={packModule}
          active={studioActive}
          saving={saving === packModule.id}
          economie={ECONOMIE_STUDIO}
          prixSepares={PRIX_MODULES_SEPARES}
          onToggle={() => toggleModule(packModule)}
        />
      </div>

      {/* ── Modules live ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4" style={{ color: '#10B981' }} />
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#10B981' }}>Modules disponibles</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {liveModules.map((mod) => (
            <LiveCard
              key={mod.id}
              mod={mod}
              active={isModuleActive(mod.id)}
              includedInStudio={isIncludedInStudio(mod.id)}
              saving={saving === mod.id}
              onToggle={() => toggleModule(mod)}
            />
          ))}
        </div>
      </div>

      {/* ── Roadmap ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4" style={{ color: 'var(--c-dim)' }} />
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--c-dim)' }}>Prochainement</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roadmapModules.map((mod) => (
            <RoadmapCard
              key={mod.id}
              mod={mod}
              onWaitlist={waitlist.has(mod.id)}
              saving={saving === mod.id}
              onJoin={() => joinWaitlist(mod)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Carte Pack Studio ──────────────────────────────────────────────────────────
function PackCard({ mod, active, saving, economie, prixSepares, onToggle }: {
  mod: Module; active: boolean; saving: boolean;
  economie: number; prixSepares: number; onToggle: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-5"
      style={{
        border: `2px solid ${active ? '#F97316' : 'rgba(249,115,22,0.4)'}`,
        background: active
          ? 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(249,115,22,0.04) 100%)'
          : 'var(--c-surface)',
        position: 'relative',
      }}
    >
      {/* Badge */}
      <div className="absolute -top-3 left-6 px-3 py-1 rounded-full text-[11px] font-bold text-white" style={{ background: '#F97316' }}>
        Le plus avantageux
      </div>

      <div className="text-3xl flex-shrink-0">{mod.icon}</div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-base" style={{ color: 'var(--c-text)' }}>{mod.nom}</p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--c-dim)' }}>{mod.desc}</p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="text-lg font-extrabold" style={{ color: '#F97316' }}>{mod.prix?.toFixed(2).replace('.', ',')} €<span className="text-sm font-normal text-gray-500">/mois</span></span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
            Économisez ~{economie}€/mois vs {prixSepares.toFixed(2).replace('.', ',')} € séparés
          </span>
        </div>
      </div>

      <button
        onClick={onToggle}
        disabled={saving}
        className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
        style={{
          background: active ? 'rgba(239,68,68,0.1)' : '#F97316',
          color: active ? '#EF4444' : '#fff',
          border: active ? '1px solid rgba(239,68,68,0.3)' : 'none',
          minWidth: 120,
          justifyContent: 'center',
        }}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : active ? 'Désactiver' : 'Activer Studio'}
      </button>
    </div>
  );
}

// ── Carte module live ─────────────────────────────────────────────────────────
function LiveCard({ mod, active, includedInStudio, saving, onToggle }: {
  mod: Module; active: boolean; includedInStudio: boolean; saving: boolean; onToggle: () => void;
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{
        border: `1.5px solid ${active ? 'rgba(16,185,129,0.5)' : 'var(--c-border)'}`,
        background: active ? 'rgba(16,185,129,0.05)' : 'var(--c-surface)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl">{mod.icon}</span>
        {active && (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Check className="w-3 h-3" />
            {includedInStudio ? 'Inclus dans Studio' : 'Activé'}
          </span>
        )}
      </div>
      <div>
        <p className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>{mod.nom}</p>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--c-dim)' }}>{mod.desc}</p>
      </div>
      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="font-bold text-sm" style={{ color: 'var(--c-text)' }}>
          {mod.prix?.toFixed(2).replace('.', ',')} €<span className="font-normal text-xs text-gray-500">/mois</span>
        </span>
        <button
          onClick={onToggle}
          disabled={saving || includedInStudio}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: includedInStudio
              ? 'rgba(0,0,0,0.05)'
              : active
                ? 'rgba(239,68,68,0.08)'
                : 'rgba(16,185,129,0.12)',
            color: includedInStudio
              ? 'var(--c-dim)'
              : active
                ? '#EF4444'
                : '#10B981',
            border: `1px solid ${includedInStudio ? 'transparent' : active ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.3)'}`,
            cursor: includedInStudio ? 'default' : 'pointer',
          }}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : includedInStudio ? '—' : active ? 'Désactiver' : 'Activer'}
        </button>
      </div>
    </div>
  );
}

// ── Carte roadmap ─────────────────────────────────────────────────────────────
function RoadmapCard({ mod, onWaitlist, saving, onJoin }: {
  mod: Module; onWaitlist: boolean; saving: boolean; onJoin: () => void;
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3 opacity-75"
      style={{ border: '1.5px solid var(--c-border)', background: 'var(--c-surface)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl grayscale">{mod.icon}</span>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(100,116,139,0.12)', color: '#64748B', border: '1px solid rgba(100,116,139,0.25)' }}>
          Prochainement
        </span>
      </div>
      <div>
        <p className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>{mod.nom}</p>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--c-dim)' }}>{mod.desc}</p>
      </div>
      <div className="mt-auto pt-1">
        <button
          onClick={onJoin}
          disabled={saving || onWaitlist}
          className="w-full py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: onWaitlist ? 'rgba(100,116,139,0.08)' : 'rgba(37,99,235,0.08)',
            color: onWaitlist ? '#64748B' : '#2563EB',
            border: `1px solid ${onWaitlist ? 'rgba(100,116,139,0.2)' : 'rgba(37,99,235,0.25)'}`,
            cursor: onWaitlist ? 'default' : 'pointer',
          }}
        >
          {saving
            ? <Loader2 className="w-3 h-3 animate-spin mx-auto" />
            : onWaitlist
              ? '✓ Sur la liste d\'attente'
              : 'Rejoindre la liste d\'attente'}
        </button>
      </div>
    </div>
  );
}
