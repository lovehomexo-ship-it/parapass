import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { messageErreur } from '../lib/avionnage';
import { ErrorBoundary } from './ErrorBoundary';
import { useDialogues } from './useDialogues';

// ═══════════════════════════════════════════════════════════════════════════
// DÉMONSTRATION QUOTIDIENNE — le réglage, dans les Paramètres du centre.
//
// Activée, la journée de démonstration se régénère seule chaque matin
// (tâche planifiée `demo-quotidienne`, 9 h UTC) : un centre présenté n'importe
// quel jour a sa journée du jour, sans que personne pense à cliquer.
//
// Désactivée, TOUT ce que la démonstration a créé est retiré sur-le-champ et
// rien ne revient : on repart de zéro, avec les seules données réelles.
//
// Les deux sens écrivent en base : chacun passe par une confirmation qui dit
// ce qui va se passer, et par une seule fonction côté serveur
// (`regler_demo_quotidienne`) qui change le réglage ET agit, ensemble.
// ═══════════════════════════════════════════════════════════════════════════

function Inner({ centreId, centreNom, onDone }: { centreId: string; centreNom?: string; onDone?: () => void }) {
  const { demanderConfirmation, dialogue } = useDialogues();
  const [actif, setActif] = useState<boolean | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('centres').select('demo_quotidienne').eq('id', centreId).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setErreur(messageErreur(error)); return; }
        setActif(!!(data as { demo_quotidienne?: boolean } | null)?.demo_quotidienne);
      });
  }, [centreId]);

  const basculer = async () => {
    if (actif === null) return;
    const cible = !actif;
    const ok = await demanderConfirmation(
      cible ? 'Activer la démonstration quotidienne ?' : 'Désactiver la démonstration quotidienne ?',
      cible
        ? `Sur « ${centreNom ?? centreId} ». La journée de démonstration est générée maintenant, `
          + `puis régénérée chaque matin vers 10 h sur les licenciés du centre. Aucun licencié n'est créé ni supprimé.`
        : `Sur « ${centreNom ?? centreId} ». Toute la démonstration est retirée maintenant — planches, sauts, `
          + `présences, pliages, réservations — et ne sera plus régénérée. Seules les données réelles restent.`);
    if (!ok) return;
    setOccupe(true); setErreur(null); setInfo(null);
    const { error } = await supabase.rpc('regler_demo_quotidienne', { p_centre_id: centreId, p_actif: cible });
    setOccupe(false);
    if (error) { setErreur(messageErreur(error)); return; }
    setActif(cible);
    setInfo(cible
      ? 'Activée : la journée de démonstration est générée, et le sera de nouveau chaque matin.'
      : 'Désactivée : la démonstration est retirée. Le centre repart de ses seules données réelles.');
    onDone?.();
  };

  return (
    <section className="rounded-2xl p-5" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      <div className="flex items-start gap-4">
        <span className="w-9 h-9 rounded-xl inline-flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--action-texte) 14%, transparent)', color: 'var(--action-texte)' }}>
          <CalendarClock className="w-5 h-5" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold" style={{ color: 'var(--c-text)' }}>Démonstration quotidienne</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--c-muted)' }}>
            {actif
              ? 'Chaque matin, la journée de démonstration est régénérée : briefing, planches (dont des avions déjà partis), sauts, présences, pliages, tandem.'
              : 'Désactivée : aucune démonstration n’est générée. Activez-la pour retrouver chaque jour une journée complète à présenter.'}
          </p>
          {info && <p className="text-sm mt-2 font-medium" style={{ color: 'var(--sev-conforme)' }}>{info}</p>}
          {erreur && <p role="alert" className="text-sm mt-2 font-medium" style={{ color: 'var(--sev-critique)' }}>{erreur}</p>}
        </div>
        {/* L'interrupteur : un vrai rôle « switch », lisible au clavier et par
            un lecteur d'écran. */}
        <button type="button" role="switch" aria-checked={!!actif} aria-label="Démonstration quotidienne"
          onClick={basculer} disabled={actif === null || occupe}
          className="relative flex-shrink-0 rounded-full transition disabled:opacity-50"
          style={{ width: 52, height: 30, marginTop: 4,
                   background: actif ? 'var(--action-fond)' : 'var(--c-hover)',
                   border: '1px solid var(--c-border)' }}>
          <span className="absolute rounded-full transition-all"
            style={{ top: 3, left: actif ? 25 : 3, width: 22, height: 22, background: '#fff',
                     boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
        </button>
      </div>
      {occupe && <p className="text-sm mt-3" style={{ color: 'var(--c-muted)' }}>{actif ? 'Retrait de la démonstration…' : 'Génération de la journée…'}</p>}
      {dialogue}
    </section>
  );
}

export function DemoQuotidienne({ centreId, centreNom, onDone }: { centreId: string | undefined; centreNom?: string; onDone?: () => void }) {
  if (!centreId) return null;
  return <ErrorBoundary><Inner centreId={centreId} centreNom={centreNom} onDone={onDone} /></ErrorBoundary>;
}
