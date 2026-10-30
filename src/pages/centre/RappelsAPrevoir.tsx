import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCurrencyRules, formatDuree } from '../../lib/currency';
import { brevetPrincipal } from '../../lib/brevets';
import { rappelsAPrevoir, type RappelAPrevoir } from '../../lib/rappelsSecurite';
import { SEVERITE_COULEUR, surface } from '../../lib/jetons';
import { ymdLocal } from '../../lib/datetime';

// ═══════════════════════════════════════════════════════════════════════════
// RAPPELS DE SÉCURITÉ À PRÉVOIR — sur la Journée, pour s'organiser avant que
// le sauteur soit au pied de l'avion : réserver un moniteur, caler l'heure.
// Muet quand il n'y a rien : un bloc vide ne s'affiche pas.
// ═══════════════════════════════════════════════════════════════════════════

const HORIZON_JOURS = 7;

export function RappelsAPrevoir({ centreId }: { centreId: string }) {
  const { rules, loaded } = useCurrencyRules();
  const [rappels, setRappels] = useState<(RappelAPrevoir & { nom: string })[] | null>(null);

  useEffect(() => {
    if (!loaded) return;
    let annule = false;
    (async () => {
      const auj = new Date();
      const debut = ymdLocal(auj);
      const fin = ymdLocal(new Date(auj.getTime() + HORIZON_JOURS * 86_400_000));
      const { data: pres, error } = await supabase.from('dz_presences')
        .select('user_id, date_presence').eq('dz_id', centreId).eq('statut', 'present')
        .gte('date_presence', debut).lte('date_presence', fin);
      if (error || annule) return;
      const presences = ((pres ?? []) as { user_id: string; date_presence: string }[])
        .map(p => ({ userId: p.user_id, date: p.date_presence }));
      const ids = [...new Set(presences.map(p => p.userId))];
      if (ids.length === 0) { setRappels([]); return; }
      const [{ data: conf }, { data: brev }, { data: prof }] = await Promise.all([
        supabase.rpc('get_conformite_licencies', { p_centre_id: centreId }),
        supabase.from('brevets').select('parachutiste_id, type_brevet, date_obtention').in('parachutiste_id', ids),
        supabase.from('profiles').select('id, prenom, nom').in('id', ids),
      ]);
      if (annule) return;
      const dernier: Record<string, string | null> = {};
      for (const r of (conf ?? []) as { parachutiste_id: string; dernier_saut: string | null }[]) dernier[r.parachutiste_id] = r.dernier_saut;
      const parPersonne = new Map<string, { type_brevet: string; date_obtention: string }[]>();
      for (const b of (brev ?? []) as { parachutiste_id: string; type_brevet: string; date_obtention: string }[]) {
        parPersonne.set(b.parachutiste_id, [...(parPersonne.get(b.parachutiste_id) ?? []), b]);
      }
      const niveaux: Record<string, string | null> = {};
      for (const [id, l] of parPersonne) niveaux[id] = brevetPrincipal(l)?.type_brevet ?? null;
      const noms = new Map(((prof ?? []) as { id: string; prenom: string; nom: string }[]).map(p => [p.id, `${p.prenom} ${p.nom}`]));
      setRappels(rappelsAPrevoir(presences, dernier, niveaux, rules).map(r => ({ ...r, nom: noms.get(r.userId) ?? 'Licencié' })));
    })();
    return () => { annule = true; };
  }, [centreId, rules, loaded]);

  if (!rappels || rappels.length === 0) return null;
  const obligatoires = rappels.filter(r => r.obligatoire).length;
  const jourLib = (d: string) => d === ymdLocal(new Date()) ? 'aujourd’hui'
    : new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <section aria-label="Rappels de sécurité à prévoir" className="p-4 rounded-2xl" style={surface(2)}>
      <h2 className="flex items-center gap-2 text-[15px] font-bold" style={{ color: 'var(--c-text)' }}>
        <ShieldAlert className="w-5 h-5" aria-hidden style={{ color: obligatoires ? SEVERITE_COULEUR.critique : SEVERITE_COULEUR.vigilance }} />
        Rappels de sécurité à prévoir
      </h2>
      <p className="text-[13px] mt-0.5" style={{ color: 'var(--c-muted)' }}>
        {rappels.length} personne{rappels.length > 1 ? 's' : ''} annoncée{rappels.length > 1 ? 's' : ''} d’ici {HORIZON_JOURS} jours
        {obligatoires ? `, dont ${obligatoires} rappel${obligatoires > 1 ? 's' : ''} obligatoire${obligatoires > 1 ? 's' : ''}` : ''} —
        prévoir un moniteur et le temps du rappel.
      </p>
      <ul className="list-none m-0 mt-2 p-0">
        {rappels.map(r => (
          <li key={r.userId} className="flex items-center gap-3 py-2 text-[14px]"
            style={{ borderTop: '1px solid var(--c-border-s, var(--c-border))' }}>
            <span className="w-20 sm:w-24 flex-shrink-0 text-[13px] font-semibold capitalize" style={{ color: 'var(--c-muted)' }}>{jourLib(r.date)}</span>
            <span className="flex-1 min-w-0">
              <span className="block truncate font-semibold" style={{ color: 'var(--c-text)' }}>{r.nom}</span>
              <span className="block text-[13px]" style={{ color: 'var(--c-muted)' }}>
                {r.niveau ? `Brevet ${r.niveau} · ` : ''}dernier saut {formatDuree(r.jours ?? 0)}
              </span>
            </span>
            <span className="flex-shrink-0 text-[13px] font-bold px-2.5 rounded-full whitespace-nowrap"
              style={{ minHeight: 26, display: 'inline-flex', alignItems: 'center',
                color: '#fff', background: r.obligatoire ? SEVERITE_COULEUR.critique : SEVERITE_COULEUR.vigilance }}>
              {r.obligatoire ? 'Obligatoire' : 'Conseillé'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
