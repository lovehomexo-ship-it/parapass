import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { DzBriefing, DzCircuit } from '../../lib/briefing';
import { CheckCircle, Clock, Download, ChevronDown, ChevronUp } from 'lucide-react';

interface Membre { id: string; nom: string; prenom: string }
interface Ack { user_id: string; acknowledged_at: string }

async function fetchMembres(centreId: string): Promise<Membre[]> {
  const { data, error } = await supabase
    .from('licencies_centres')
    .select('parachutiste_id, profiles!parachutiste_id(id, nom, prenom)')
    .eq('centre_id', centreId)
    .eq('statut', 'actif');
  if (error) { console.error('Chargement membres échoué :', error); return []; }
  const seen = new Set<string>();
  return (data ?? [])
    .map((r: Record<string, unknown>) => r.profiles as Membre)
    .filter(p => { if (!p || seen.has(p.id)) return false; seen.add(p.id); return true; });
}

async function fetchAcks(briefingIds: string[]): Promise<Record<string, Ack[]>> {
  if (briefingIds.length === 0) return {};
  const { data, error } = await supabase
    .from('briefing_acknowledgements')
    .select('briefing_id, user_id, acknowledged_at')
    .in('briefing_id', briefingIds);
  if (error) { console.error('Chargement acquittements échoué :', error); return {}; }
  const map: Record<string, Ack[]> = {};
  for (const a of data ?? []) (map[a.briefing_id] ??= []).push(a);
  return map;
}

const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// ─── Suivi du jour, en direct ─────────────────────────────────────────────────

export function BriefingSuiviDuJour({ centreId }: { centreId: string }) {
  const [briefing, setBriefing] = useState<DzBriefing | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [acks, setAcks] = useState<Ack[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const today = new Date().toISOString().substring(0, 10);
    const { data: b, error } = await supabase
      .from('dz_briefings').select('*').eq('dz_id', centreId).eq('date_briefing', today).maybeSingle();
    if (error) { console.error('Chargement briefing du jour échoué :', error); setLoading(false); return; }
    setBriefing((b as DzBriefing | null) ?? null);
    const [m, a] = await Promise.all([
      fetchMembres(centreId),
      b ? fetchAcks([b.id]).then(map => map[b.id] ?? []) : Promise.resolve([]),
    ]);
    setMembres(m);
    setAcks(a);
    setLoading(false);
  }, [centreId]);

  // Chargement initial + Realtime sur les acquittements, avec filet polling 30 s
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!briefing) return;
    const channel = supabase
      .channel(`briefing-acks-${briefing.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'briefing_acknowledgements', filter: `briefing_id=eq.${briefing.id}` },
        () => load())
      .subscribe();
    const poll = setInterval(load, 30_000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [briefing?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  if (!briefing) return <p className="text-sm py-8 text-center" style={{ color: 'var(--c-dim)' }}>Aucun briefing publié aujourd'hui.</p>;

  // Un acquittement antérieur à la (re)publication est périmé : il ne compte pas
  const acksValides = acks.filter(a => new Date(a.acknowledged_at) >= new Date(briefing.published_at));
  const ackIds = new Set(acksValides.map(a => a.user_id));
  const acquittes = membres
    .filter(m => ackIds.has(m.id))
    .map(m => ({ ...m, at: acksValides.find(a => a.user_id === m.id)!.acknowledged_at }))
    .sort((a, b) => b.at.localeCompare(a.at));
  const nonAcquittes = membres.filter(m => !ackIds.has(m.id));

  return (
    <div className="space-y-4">
      <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#10B981' }} />
        <p className="text-sm font-bold text-white">
          {acquittes.length} / {membres.length} licenciés ont pris connaissance
        </p>
        <span className="text-[11px] ml-auto" style={{ color: 'var(--c-dim)' }}>mise à jour en direct</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#34D399' }}>Ont acquitté</h3>
          {acquittes.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--c-dim)' }}>Personne pour l'instant.</p>
          ) : (
            <ul className="space-y-1.5">
              {acquittes.map(m => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-white">{m.prenom} {m.nom}</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--c-dim)' }}>{heure(m.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <h3 className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--c-dim)' }}>
            <Clock className="w-3.5 h-3.5 inline mr-1" />Pas encore consulté
          </h3>
          <p className="text-[10px] mb-3" style={{ color: 'var(--c-dim)' }}>À titre informatif — l'appli ne relance personne.</p>
          {nonAcquittes.length === 0 ? (
            <p className="text-xs" style={{ color: '#34D399' }}>Tout le monde a acquitté 🎉</p>
          ) : (
            <ul className="space-y-1.5">
              {nonAcquittes.map(m => (
                <li key={m.id} className="text-sm" style={{ color: 'var(--c-text2)' }}>{m.prenom} {m.nom}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export function BriefingArchive({ centreId, circuits }: { centreId: string; circuits: DzCircuit[] }) {
  const [briefings, setBriefings] = useState<DzBriefing[]>([]);
  const [ackCounts, setAckCounts] = useState<Record<string, Ack[]>>({});
  const [membres, setMembres] = useState<Membre[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('dz_briefings').select('*').eq('dz_id', centreId)
        .order('date_briefing', { ascending: false }).limit(120);
      if (error) { console.error('Chargement archive briefings échoué :', error); setLoading(false); return; }
      const list = (data ?? []) as DzBriefing[];
      setBriefings(list);
      const [acksMap, m] = await Promise.all([fetchAcks(list.map(b => b.id)), fetchMembres(centreId)]);
      setAckCounts(acksMap);
      setMembres(m);
      setLoading(false);
    })();
  }, [centreId]);

  const nomMembre = (id: string) => {
    const m = membres.find(m => m.id === id);
    return m ? `${m.prenom} ${m.nom}` : id;
  };

  const exportCsv = (b: DzBriefing) => {
    const circuit = circuits.find(c => c.id === b.circuit_id);
    const acks = (ackCounts[b.id] ?? []).sort((x, y) => x.acknowledged_at.localeCompare(y.acknowledged_at));
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lignes = [
      ['Briefing du', b.date_briefing].map(esc).join(';'),
      ['Circuit', circuit?.nom ?? '—'].map(esc).join(';'),
      ['Vent', `${b.vent_direction_deg}°${b.vent_vitesse_kt != null ? ` ${b.vent_vitesse_kt} kt` : ''}`].map(esc).join(';'),
      ['Consignes', b.consignes ?? ''].map(esc).join(';'),
      ['Publié à', new Date(b.published_at).toLocaleString('fr-FR')].map(esc).join(';'),
      '',
      ['Licencié', 'Acquitté le'].map(esc).join(';'),
      ...acks.map(a => [nomMembre(a.user_id), new Date(a.acknowledged_at).toLocaleString('fr-FR')].map(esc).join(';')),
    ];
    const blob = new Blob(['﻿' + lignes.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `briefing-${b.date_briefing}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  if (briefings.length === 0) return <p className="text-sm py-8 text-center" style={{ color: 'var(--c-dim)' }}>Aucun briefing archivé.</p>;

  return (
    <div className="space-y-2">
      <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
        Aucun briefing n'est jamais supprimé : l'archive prouve que l'information a été diffusée, et à qui.
      </p>
      {briefings.map(b => {
        const circuit = circuits.find(c => c.id === b.circuit_id);
        const acks = ackCounts[b.id] ?? [];
        const isOpen = open === b.id;
        return (
          <div key={b.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
            <button onClick={() => setOpen(isOpen ? null : b.id)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left flex-wrap">
              <span className="text-sm font-bold text-white">{new Date(b.date_briefing).toLocaleDateString('fr-FR')}</span>
              <span className="text-xs" style={{ color: 'var(--c-dim)' }}>{circuit?.nom ?? 'circuit supprimé'}</span>
              <span className="text-xs" style={{ color: '#7DD3FC' }}>
                {b.vent_direction_deg}°{b.vent_vitesse_kt != null ? ` · ${b.vent_vitesse_kt} kt` : ''}
              </span>
              <span className="text-xs ml-auto" style={{ color: '#34D399' }}>{acks.length} acquittement{acks.length > 1 ? 's' : ''}</span>
              {isOpen ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--c-dim)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--c-dim)' }} />}
            </button>
            {isOpen && (
              <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--c-border)' }}>
                {b.consignes && <p className="text-xs pt-3" style={{ color: 'var(--c-text2)' }}>📢 {b.consignes}</p>}
                {acks.length > 0 ? (
                  <ul className="space-y-1 pt-1">
                    {[...acks].sort((x, y) => y.acknowledged_at.localeCompare(x.acknowledged_at)).map(a => (
                      <li key={a.user_id} className="flex items-center justify-between text-xs">
                        <span className="text-white">{nomMembre(a.user_id)}</span>
                        <span className="font-mono" style={{ color: 'var(--c-dim)' }}>{new Date(a.acknowledged_at).toLocaleString('fr-FR')}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs pt-3" style={{ color: 'var(--c-dim)' }}>Aucun acquittement pour ce briefing.</p>
                )}
                <button onClick={() => exportCsv(b)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
                  style={{ background: 'var(--c-border)', color: 'var(--c-text2)', border: '1px solid var(--c-border-f)' }}>
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
