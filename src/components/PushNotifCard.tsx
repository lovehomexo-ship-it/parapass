import { BellRing, BellOff, Smartphone, Check, AlertTriangle } from 'lucide-react';
import { usePush } from '../lib/usePush';
import { ErrorBoundary } from './ErrorBoundary';

// Bloc « notifications push » des Paramètres. La permission n'est demandée que
// sur CLIC (exigence Safari/iOS) ; si l'app n'est pas installée sur l'écran
// d'accueil sur iOS, on explique la marche à suivre au lieu d'afficher un
// bouton qui échouerait en silence.
function PushNotifInner({ userId }: { userId: string | undefined }) {
  const { etat, enCours, erreur, activer, desactiver } = usePush(userId);

  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-s)' }}>
      <div className="flex items-start gap-2.5">
        <span className="flex-shrink-0 mt-0.5" style={{ color: etat === 'actif' ? '#10B981' : 'var(--c-dim)' }}>
          {etat === 'actif' ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>
            Notifications sur le téléphone
          </p>

          {etat === 'ios_hors_accueil' && (
            <>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                Sur iPhone, les notifications ne sont possibles que si ParaPass est
                installé sur l'écran d'accueil.
              </p>
              <p className="text-xs mt-1.5 inline-flex items-center gap-1.5" style={{ color: '#F97316' }}>
                <Smartphone className="w-3.5 h-3.5 flex-shrink-0" />
                Bouton <strong>Partager</strong> → <strong>Sur l'écran d'accueil</strong>, puis rouvrez l'app depuis l'icône.
              </p>
            </>
          )}

          {etat === 'non_supporte' && (
            <p className="text-xs mt-1" style={{ color: 'var(--c-muted)' }}>
              Ce navigateur ne gère pas les notifications. Vos messages restent
              visibles dans l'application.
            </p>
          )}

          {etat === 'refuse' && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--c-muted)' }}>
              Notifications refusées. Vous pouvez les réautoriser dans les réglages
              de votre navigateur, puis revenir ici.
            </p>
          )}

          {etat === 'a_activer' && (
            <>
              <p className="text-xs mt-1" style={{ color: 'var(--c-muted)' }}>
                Soyez prévenu quand votre centre vous écrit ou qu'un saut attend
                votre validation.
              </p>
              <button
                onClick={activer}
                disabled={enCours}
                className="mt-2 px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-60"
                style={{ background: '#F97316', minHeight: 36 }}
              >
                {enCours ? 'Activation…' : 'Activer les notifications'}
              </button>
            </>
          )}

          {etat === 'actif' && (
            <>
              <p className="text-xs mt-1 inline-flex items-center gap-1.5" style={{ color: '#34D399' }}>
                <Check className="w-3.5 h-3.5" /> Activées sur cet appareil
              </p>
              <button
                onClick={desactiver}
                disabled={enCours}
                className="mt-2 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
                style={{ background: 'transparent', color: 'var(--c-dim)', border: '1px solid var(--c-border-f)', minHeight: 36 }}
              >
                {enCours ? 'Désactivation…' : 'Désactiver'}
              </button>
            </>
          )}

          {erreur && (
            <p role="alert" className="text-xs mt-2 inline-flex items-center gap-1.5" style={{ color: '#F87171' }}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {erreur}
            </p>
          )}

          <p className="text-[10px] mt-2" style={{ color: 'var(--c-dim)' }}>
            Les notifications sont un complément : vos messages restent toujours
            accessibles dans l'application.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Sous ErrorBoundary : un souci de notifications n'emporte jamais les Paramètres. */
export function PushNotifCard({ userId }: { userId: string | undefined }) {
  return <ErrorBoundary><PushNotifInner userId={userId} /></ErrorBoundary>;
}
