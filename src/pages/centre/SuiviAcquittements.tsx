import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoaderParaPass } from '../../components/LoaderParaPass';
import { CheckCheck, Send, Monitor, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAcquittementJour, libelleAck } from '../../lib/acquittementJour';
import { surface, SEVERITE_COULEUR, action } from '../../lib/jetons';

// ═══════════════════════════════════════════════════════════════════════════
// P8 — Du briefing PUBLIÉ au briefing REÇU.
//
// Publier ne prouve rien. Ce bloc répond à la seule question utile : QUI ne
// l'a pas lu ? Et il distingue deux cas que le DT ne doit pas confondre :
//   • n'a jamais acquitté           → « lisez le briefing »
//   • a acquitté une version ANTÉRIEURE → « relisez la mise à jour »
// ═══════════════════════════════════════════════════════════════════════════

function SuiviInner({ centreId, listerManquants = true }: { centreId: string; listerManquants?: boolean }) {
  // F01 — SOURCE UNIQUE : ce composant faisait sa propre lecture (RPC +
  // comptage des présences + révision courante). Trois lectures pour un même
  // chiffre, c'était la cause de la divergence.
  const ack = useAcquittementJour(centreId);
  const { manquants, presents, revision, chargement, erreur, publie } = ack;
  const charger = ack.recharger;
  const [relance, setRelance] = useState<'idle' | 'envoi' | 'fait'>('idle');


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

  if (!publie) {
    return (
      <div className="rounded-2xl p-4 text-sm"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-dim)' }}>
        Aucun briefing publié aujourd’hui.
      </div>
    );
  }

  const pct = presents > 0 ? Math.round((ack.acquittes / presents) * 100) : 100;
  const aRelire = manquants.filter(m => m.acquitte_revision_anterieure);

  return (
    <div className="p-4 space-y-3" style={surface(2)}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--c-text)' }}>
            <CheckCheck className="w-4 h-4" style={{ color: 'var(--action-texte)' }} aria-hidden />
            {libelleAck(ack)}
            {(revision ?? 1) > 1 && (
              <span className="text-[11px] font-semibold px-1.5 rounded-full"
                style={{ background: 'color-mix(in srgb, var(--sev-vigilance) 15%, transparent)', color: 'var(--sev-vigilance)' }}>
                révision {revision}
              </span>
            )}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
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
          background: pct === 100 ? SEVERITE_COULEUR.conforme : pct >= 60 ? SEVERITE_COULEUR.vigilance : SEVERITE_COULEUR.critique,
          transition: 'width .3s' }} />
      </div>

      {manquants.length > 0 && (
        <>
          {/* Règle 3 — un seul endroit fait autorité sur QUI manque. En mode
              Journée, c'est le tableau « Sur le terrain », où chaque personne
              a déjà sa ligne et son motif ; répéter les noms ici ferait
              apparaître la même personne deux fois dans le même écran. Le
              mode Gestion, lui, n'a pas ce tableau : il garde la liste. */}
          {listerManquants && (
          <ul className="space-y-1">
            {manquants.map(m => (
              <li key={m.parachutiste_id} className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: m.acquitte_revision_anterieure ? SEVERITE_COULEUR.vigilance : SEVERITE_COULEUR.critique }} />
                <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--c-text2)' }}>
                  {m.prenom} {m.nom}
                </span>
                {m.acquitte_revision_anterieure && (
                  <span className="flex items-center gap-1 text-xs flex-shrink-0" style={{ color: 'var(--sev-vigilance)' }}>
                    <AlertTriangle className="w-3 h-3" aria-hidden /> version antérieure
                  </span>
                )}
              </li>
            ))}
          </ul>
          )}
          {!listerManquants && (
            <button type="button" style={action('texte')}
              onClick={() => document.getElementById('sur-le-terrain')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              voir lesquels, sur le terrain
            </button>
          )}

          {aRelire.length > 0 && (
            <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
              {aRelire.length} {aRelire.length > 1 ? 'ont' : 'a'} lu une version antérieure : la relance
              leur demandera de prendre connaissance de la <strong>mise à jour</strong>.
            </p>
          )}

          <button onClick={relancer} disabled={relance === 'envoi'}
            className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ ...action('principal'), width: '100%', justifyContent: 'center',
              // Le succès n'est pas une couleur d'action : il se dit par le libellé.
              opacity: relance === 'fait' ? 0.7 : 1 }}>
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

/**
 * @param listerManquants  Faux en mode Journée, où « Sur le terrain » fait
 *   autorité sur les noms. Variante, pas modification en place : le mode
 *   Gestion et l'écran Briefing gardent le comportement d'origine.
 */
export function SuiviAcquittements({ centreId, listerManquants = true }: {
  centreId: string; listerManquants?: boolean;
}) {
  return <ErrorBoundary><SuiviInner centreId={centreId} listerManquants={listerManquants} /></ErrorBoundary>;
}
