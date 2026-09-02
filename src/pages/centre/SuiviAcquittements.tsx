import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoaderParaPass } from '../../components/LoaderParaPass';
import { CheckCheck, Send, Monitor, RefreshCw, AlertTriangle } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// P8 — Du briefing PUBLIÉ au briefing REÇU.
//
// Publier ne prouve rien. Ce bloc répond à la seule question utile : QUI ne
// l'a pas lu ? Et il distingue deux cas que le DT ne doit pas confondre :
//   • n'a jamais acquitté           → « lisez le briefing »
//   • a acquitté une version ANTÉRIEURE → « relisez la mise à jour »
// ═══════════════════════════════════════════════════════════════════════════

interface NonAcquitte {
  parachutiste_id: string;
  nom: string;
  prenom: string;
  acquitte_revision_anterieure: boolean;
}

function SuiviInner({ centreId }: { centreId: string }) {
  const [manquants, setManquants] = useState<NonAcquitte[]>([]);
  const [presents, setPresents] = useState(0);
  const [revision, setRevision] = useState<number | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [relance, setRelance] = useState<'idle' | 'envoi' | 'fait'>('idle');

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null);
    const jour = new Date().toISOString().slice(0, 10);
    const [{ data, error }, { count }, { data: b }] = await Promise.all([
      supabase.rpc('get_non_acquittes', { p_centre_id: centreId, p_date: jour }),
      supabase.from('dz_presences').select('*', { count: 'exact', head: true })
        .eq('dz_id', centreId).eq('date_presence', jour),
      supabase.from('dz_briefings').select('revision')
        .eq('dz_id', centreId).eq('date_briefing', jour).not('published_at', 'is', null)
        .order('revision', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (error) {
      console.error('Suivi des acquittements — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(error.message); setChargement(false); return;
    }
    setManquants((data ?? []) as NonAcquitte[]);
    setPresents(count ?? 0);
    setRevision(b?.revision ?? null);
    setChargement(false);
  }, [centreId]);

  useEffect(() => { charger(); }, [charger]);

  const relancer = async () => {
    if (manquants.length === 0) return;
    setRelance('envoi');
    // Une notification par personne, avec le message qui correspond à SON cas.
    const lignes = manquants.map(m => ({
      user_id: m.parachutiste_id,
      titre: m.acquitte_revision_anterieure ? 'Briefing mis à jour' : 'Briefing du jour',
      message: m.acquitte_revision_anterieure
        ? 'Le briefing du jour a été révisé depuis votre lecture. Merci de prendre connaissance de la mise à jour.'
        : 'Merci de prendre connaissance du briefing du jour et de l’acquitter.',
      type: m.acquitte_revision_anterieure ? 'warning' : 'info',
      lue: false,
    }));
    const { error } = await supabase.from('notifications').insert(lignes);
    if (error) {
      console.error('Relance briefing — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      alert('La relance a échoué : ' + error.message);
      setRelance('idle');
      return;
    }
    setRelance('fait');
    setTimeout(() => setRelance('idle'), 4000);
  };

  if (chargement) return <LoaderParaPass taille={72} message={null} />;

  if (erreur) {
    return (
      <div className="rounded-2xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.10)',
        border: '1px solid rgba(239,68,68,0.35)', color: '#F87171' }}>
        Suivi indisponible : {erreur}
        <button onClick={charger} className="ml-2 underline" style={{ minHeight: 32 }}>Réessayer</button>
      </div>
    );
  }

  if (revision === null) {
    return (
      <div className="rounded-2xl p-4 text-sm"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-dim)' }}>
        Aucun briefing publié aujourd’hui.
      </div>
    );
  }

  const acquitte = Math.max(0, presents - manquants.length);
  const pct = presents > 0 ? Math.round((acquitte / presents) * 100) : 100;
  const aRelire = manquants.filter(m => m.acquitte_revision_anterieure);

  return (
    <div className="rounded-2xl p-4 space-y-3"
      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--c-text)' }}>
            <CheckCheck className="w-4 h-4" style={{ color: '#38BDF8' }} aria-hidden />
            Briefing reçu par {acquitte} / {presents}
            {revision > 1 && (
              <span className="text-[11px] font-semibold px-1.5 rounded-full"
                style={{ background: 'rgba(251,146,60,0.15)', color: '#FB923C' }}>
                révision {revision}
              </span>
            )}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--c-dim)' }}>
            {manquants.length === 0
              ? 'Tous les présents l’ont acquitté.'
              : `${manquants.length} présent${manquants.length > 1 ? 's' : ''} ne l’${manquants.length > 1 ? 'ont' : 'a'} pas acquitté.`}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/briefing/tv/${centreId}?kiosque=1`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold"
            style={{ minHeight: 40, color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
            <Monitor className="w-3.5 h-3.5" aria-hidden /> Écran hangar
          </a>
          <button onClick={charger} title="Rafraîchir"
            className="px-3 rounded-xl" style={{ minHeight: 40, color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
            <RefreshCw className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Jauge */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
        <div style={{ width: `${pct}%`, height: '100%',
          background: pct === 100 ? '#34D399' : pct >= 60 ? '#FBBF24' : '#F87171',
          transition: 'width .3s' }} />
      </div>

      {manquants.length > 0 && (
        <>
          <ul className="space-y-1">
            {manquants.map(m => (
              <li key={m.parachutiste_id} className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: m.acquitte_revision_anterieure ? '#FB923C' : '#F87171' }} />
                <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--c-text2)' }}>
                  {m.prenom} {m.nom}
                </span>
                {m.acquitte_revision_anterieure && (
                  <span className="flex items-center gap-1 text-[11px] flex-shrink-0" style={{ color: '#FB923C' }}>
                    <AlertTriangle className="w-3 h-3" aria-hidden /> version antérieure
                  </span>
                )}
              </li>
            ))}
          </ul>

          {aRelire.length > 0 && (
            <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
              {aRelire.length} {aRelire.length > 1 ? 'ont' : 'a'} lu une version antérieure : la relance
              leur demandera de prendre connaissance de la <strong>mise à jour</strong>.
            </p>
          )}

          <button onClick={relancer} disabled={relance === 'envoi'}
            className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ minHeight: 44, background: relance === 'fait' ? '#10B981' : '#2563EB', color: '#fff' }}>
            <Send className="w-4 h-4" aria-hidden />
            {relance === 'envoi' ? 'Envoi…'
              : relance === 'fait' ? `Relance envoyée à ${manquants.length} personne(s)`
              : `Relancer ${manquants.length} personne${manquants.length > 1 ? 's' : ''}`}
          </button>
        </>
      )}
    </div>
  );
}

export function SuiviAcquittements({ centreId }: { centreId: string }) {
  return <ErrorBoundary><SuiviInner centreId={centreId} /></ErrorBoundary>;
}
