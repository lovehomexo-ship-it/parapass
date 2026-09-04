import { useState } from 'react';
import { Plane, Users, Check, X } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { surface, action, enTeteSection, SEVERITE_COULEUR } from '../lib/jetons';
import {
  useMaFileAvionnage, LIBELLE_TYPE, type TypeSautFile,
} from '../lib/avionnage';

// ═══════════════════════════════════════════════════════════════════════════
// AVIONNAGE — côté parachutiste. La moitié du module qui n'existait pas.
//
// Une seule question pour le sauteur : « suis-je dans l'avion, et dans lequel ? »
// Trois états, jamais mélangés :
//   1. la file est fermée      → on ne montre rien du tout (pas un bouton grisé
//                                 qui invite à cliquer sur une porte close)
//   2. je ne suis pas en file  → un bouton, et le nombre de gens devant
//   3. je suis placé           → le numéro de rotation, l'heure, l'avion
//
// La position affichée est celle du serveur, rafraîchie en temps réel : un jour
// de beau temps la file bouge sans arrêt, et une position périmée fait rater
// un avion.
// ═══════════════════════════════════════════════════════════════════════════

function FileInner({ centreId, centreNom, userId }: {
  centreId: string; centreNom?: string; userId: string;
}) {
  const { ouvert, ma, chargement, erreur, rejoindre, quitter } =
    useMaFileAvionnage(centreId, userId);
  const [type, setType] = useState<TypeSautFile>('solo');
  const [enCours, setEnCours] = useState(false);

  // La file fermée n'est pas une erreur : c'est l'état normal hors journée de
  // saut. On n'occupe pas l'écran du parachutiste avec une porte close.
  if (chargement || !ouvert) return null;

  const place = ma.rotationNumero !== null;

  const agir = async (fn: () => Promise<boolean>) => {
    setEnCours(true);
    await fn();
    setEnCours(false);
  };

  return (
    <section aria-label="Avionnage" className="p-4" style={surface(place ? 1 : 2)}>
      <h2 style={enTeteSection}>
        <Plane className="w-4 h-4 inline-block mr-1.5 align-[-2px]" aria-hidden />
        Avionnage{centreNom ? ` — ${centreNom}` : ''}
      </h2>

      {place ? (
        // ── Placé : ce que le sauteur a besoin de savoir, en gros ──────────
        <div>
          <p className="font-extrabold" style={{ fontSize: 22, color: 'var(--c-text)' }}>
            Rotation {ma.rotationNumero}
          </p>
          <p style={{ fontSize: 13, color: 'var(--c-text2)' }}>
            {[ma.rotationHeure ? `décollage prévu ${ma.rotationHeure.slice(0, 5)}` : null,
              ma.aeronef]
              .filter(Boolean).join(' · ') || 'horaire non communiqué'}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5"
            style={{ fontSize: 13, color: SEVERITE_COULEUR.conforme }}>
            <Check className="w-4 h-4" aria-hidden /> Vous êtes manifesté
          </p>
          <p className="mt-2" style={{ fontSize: 12, color: 'var(--c-muted)' }}>
            Pour vous décommander, voyez le chef d’avionnage : une place libérée
            au dernier moment ne se reprend pas depuis un téléphone.
          </p>
        </div>
      ) : ma.position !== null ? (
        // ── En file : la position, et rien qui la contredise ───────────────
        <div>
          <p className="font-extrabold" style={{ fontSize: 22, color: 'var(--c-text)' }}>
            {ma.position}<span style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-muted)' }}>
              {' '}sur {ma.totalEnAttente}
            </span>
          </p>
          <p style={{ fontSize: 13, color: 'var(--c-text2)' }}>
            {ma.position === 1
              ? 'Vous êtes en tête de file.'
              : `${ma.position - 1} personne${ma.position > 2 ? 's' : ''} devant vous.`}
          </p>
          <button type="button" disabled={enCours}
            onClick={() => agir(quitter)}
            className="mt-3 disabled:opacity-50"
            style={action('secondaire')}>
            <X className="w-4 h-4" aria-hidden /> Quitter la file
          </button>
        </div>
      ) : (
        // ── Pas en file : un bouton, un choix, rien de plus ────────────────
        <div>
          <p className="flex items-center gap-1.5" style={{ fontSize: 13, color: 'var(--c-text2)' }}>
            <Users className="w-4 h-4" aria-hidden />
            {ma.totalEnAttente === 0
              ? 'Personne en attente pour le moment.'
              : `${ma.totalEnAttente} personne${ma.totalEnAttente > 1 ? 's' : ''} en attente.`}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="type-saut">Type de saut</label>
            <select id="type-saut" value={type}
              onChange={e => setType(e.target.value as TypeSautFile)}
              className="px-3 rounded-xl"
              style={{ minHeight: 44, fontSize: 14, background: 'var(--c-input)',
                       color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }}>
              {(Object.keys(LIBELLE_TYPE) as TypeSautFile[]).map(t => (
                <option key={t} value={t}>{LIBELLE_TYPE[t]}</option>
              ))}
            </select>

            <button type="button" disabled={enCours}
              onClick={() => agir(() => rejoindre(type))}
              className="disabled:opacity-50" style={action('principal')}>
              <Plane className="w-4 h-4" aria-hidden />
              {enCours ? 'Inscription…' : 'Me mettre en file'}
            </button>
          </div>

          <p className="mt-2" style={{ fontSize: 12, color: 'var(--c-muted)' }}>
            Se mettre en file ne réserve pas de place : c’est le chef
            d’avionnage qui compose les rotations.
          </p>
        </div>
      )}

      {erreur && (
        <p role="alert" className="mt-3 px-3 py-2 rounded-xl" style={{
          fontSize: 13,
          background: 'color-mix(in srgb, var(--sev-critique) 10%, transparent)',
          borderLeft: `5px solid ${SEVERITE_COULEUR.critique}`,
          color: 'var(--c-text2)' }}>
          {erreur}
        </p>
      )}
    </section>
  );
}

/** Sous ErrorBoundary : un souci d'avionnage n'emporte pas le tableau de bord. */
export function FileAvionnage({ centreId, centreNom, userId }: {
  centreId: string | undefined; centreNom?: string; userId: string | undefined;
}) {
  if (!centreId || !userId) return null;
  return (
    <ErrorBoundary>
      <FileInner centreId={centreId} centreNom={centreNom} userId={userId} />
    </ErrorBoundary>
  );
}
