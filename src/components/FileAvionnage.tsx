import { useState, useEffect } from 'react';
import { Plane, Users, Check, X, Clock } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { surface, action, SEVERITE_COULEUR, type Severite } from '../lib/jetons';
import {
  useMaFileAvionnage, LIBELLE_TYPE, calculerCall, formaterRetard, SEVERITE_CALL,
  type TypeSautFile, type AvionDuJour,
} from '../lib/avionnage';

// ═══════════════════════════════════════════════════════════════════════════
// AVIONNAGE — côté parachutiste.
//
// REFONTE. La version précédente occupait un tiers de l'écran d'accueil pour
// dire une seule chose : « personne en attente ». Elle poussait la licence
// numérique sous la ligne de flottaison, et laissait un grand vide à droite
// du bouton. Surtout, elle ne répondait pas à la question que se pose
// vraiment quelqu'un debout au hangar : LE PROCHAIN AVION PART QUAND ?
//
// Trois états, trois densités — c'est le principe : l'écran donne de la place
// à ce qui compte MAINTENANT, et se rétracte le reste du temps.
//   1. pas en file  → une bande compacte : l'action à gauche, les avions du
//                     jour à droite. Le vide est comblé par de l'information.
//   2. en file      → la position en grand, et devant qui.
//   3. manifesté    → carte de niveau 1, l'avion et son call en très gros.
//                     C'est le seul moment où ce bloc mérite de la hauteur.
//
// La carte vit du côté PARACHUTISTE : ses actions prennent l'accent orange,
// qui est l'identité de cet espace. Un bouton bleu y détonnait — c'était le
// mien, pas les autres.
//
// Le call est calculé par la même fonction que l'écran du chef d'avionnage
// (lib/avionnage) : le sauteur et le chef lisent le même décompte, à la
// seconde près. Deux calculs auraient fini par diverger.
// ═══════════════════════════════════════════════════════════════════════════

/** Une horloge pour la carte : le call se réévalue sans rechargement réseau. */
function useMinute(): Date {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function CallAvion({ avion, jour, maintenant, gros = false }: {
  avion: AvionDuJour; jour: string; maintenant: Date; gros?: boolean;
}) {
  const call = calculerCall(jour, avion.heurePrevue, avion.decolle ? 'parti' : null, maintenant);
  const sev: Severite = SEVERITE_CALL[call.urgence];
  return (
    <span className="font-extrabold" style={{
      fontSize: gros ? 22 : 14,
      color: call.urgence === 'lointain' ? 'var(--c-text2)' : SEVERITE_COULEUR[sev],
    }}>
      {formaterRetard(call.libelle)}
    </span>
  );
}

function FileInner({ centreId, centreNom, userId }: {
  centreId: string; centreNom?: string; userId: string;
}) {
  const { ouvert, ma, avions, jour, chargement, erreur, rejoindre, quitter } =
    useMaFileAvionnage(centreId, userId);
  const maintenant = useMinute();
  const [type, setType] = useState<TypeSautFile>('solo');
  const [enCours, setEnCours] = useState(false);

  // La file fermée n'est pas une erreur : c'est l'état normal hors journée de
  // saut. On n'occupe pas l'écran du parachutiste avec une porte close.
  if (chargement || !ouvert) return null;

  const manifeste = ma.rotationNumero !== null;
  const monAvion = avions.find(a => a.id === ma.rotationId) ?? null;
  const prochain = avions.find(a => !a.decolle) ?? null;

  const agir = async (fn: () => Promise<boolean>) => {
    setEnCours(true); await fn(); setEnCours(false);
  };

  const titre = (
    <h2 className="flex items-center gap-1.5" style={{
      fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--c-text2)',
    }}>
      <Plane className="w-4 h-4" aria-hidden />
      Avionnage{centreNom ? ` · ${centreNom}` : ''}
    </h2>
  );

  // ── 3 · MANIFESTÉ — le seul état qui mérite de la hauteur ───────────────
  if (manifeste) {
    return (
      <section aria-label="Avionnage" className="p-4" style={surface(1)}>
        {titre}
        <div className="mt-3 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-extrabold leading-none" style={{ fontSize: 32, color: 'var(--c-text)' }}>
              Avion n°{ma.rotationNumero}
            </p>
            <p className="mt-1.5" style={{ fontSize: 14, color: 'var(--c-text2)' }}>
              {[ma.aeronef, ma.rotationHeure ? `décollage ${ma.rotationHeure.slice(0, 5)}` : null]
                .filter(Boolean).join(' · ') || 'horaire non communiqué'}
            </p>
          </div>
          {monAvion && (
            <div className="text-right">
              <CallAvion avion={monAvion} jour={jour} maintenant={maintenant} gros />
            </div>
          )}
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5"
          style={{ fontSize: 14, fontWeight: 700, color: SEVERITE_COULEUR.conforme }}>
          <Check className="w-4 h-4" aria-hidden /> Vous êtes manifesté
        </p>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--c-muted)' }}>
          Pour vous décommander, voyez le chef d’avionnage : une place libérée
          au dernier moment ne se reprend pas depuis un téléphone.
        </p>
      </section>
    );
  }

  // ── 1 et 2 · Bande compacte : action à gauche, journée à droite ─────────
  return (
    <section aria-label="Avionnage" className="p-3.5" style={surface(2)}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {titre}
        {/* Les avions du jour comblent le vide qui était à droite du bouton,
            et répondent à la vraie question du sauteur. */}
        {prochain ? (
          <p className="flex items-center gap-1.5 flex-wrap justify-end" style={{ fontSize: 14, color: 'var(--c-muted)' }}>
            <Clock className="w-4 h-4 flex-shrink-0" aria-hidden />
            <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>Avion n°{prochain.numero}</span>
            <CallAvion avion={prochain} jour={jour} maintenant={maintenant} />
            {avions.length > 1 && (
              <span>· {avions.filter(a => !a.decolle).length} avion(s) à venir</span>
            )}
          </p>
        ) : (
          <p style={{ fontSize: 14, color: 'var(--c-muted)' }}>
            {avions.length === 0 ? 'Aucun avion programmé' : 'Tous les avions sont partis'}
          </p>
        )}
      </div>

      {ma.position !== null ? (
        // ── 2 · EN FILE ────────────────────────────────────────────────────
        <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="font-extrabold leading-none" style={{ fontSize: 30, color: 'var(--c-text)' }}>
              {ma.position}<span style={{ fontSize: 18 }}>{ma.position === 1 ? 'ᵉʳ' : 'ᵉ'}</span>
            </span>
            <span style={{ fontSize: 14, color: 'var(--c-text2)' }}>
              sur {ma.totalEnAttente} en file
              {ma.position > 1 && ` · ${ma.position - 1} devant vous`}
            </span>
          </div>
          <button type="button" disabled={enCours} onClick={() => agir(quitter)}
            className="disabled:opacity-50" style={action('secondaire', 'accent')}>
            <X className="w-4 h-4" aria-hidden /> Quitter la file
          </button>
        </div>
      ) : (
        // ── 1 · PAS EN FILE ────────────────────────────────────────────────
        <div className="mt-3 flex items-center gap-2 flex-wrap">
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
            className="disabled:opacity-50" style={action('principal', 'accent')}>
            <Plane className="w-4 h-4" aria-hidden />
            {enCours ? 'Inscription…' : 'Me mettre en file'}
          </button>
          <span className="flex items-center gap-1.5" style={{ fontSize: 13, color: 'var(--c-muted)' }}>
            <Users className="w-4 h-4" aria-hidden />
            {ma.totalEnAttente === 0
              ? 'personne en attente'
              : `${ma.totalEnAttente} en attente`}
          </span>
        </div>
      )}

      {ma.position === null && (
        <p className="mt-2" style={{ fontSize: 12, color: 'var(--c-muted)' }}>
          Se mettre en file ne réserve pas de place : c’est le chef d’avionnage
          qui compose les avions.
        </p>
      )}

      {erreur && (
        <p role="alert" className="mt-2.5 px-3 py-2 rounded-xl" style={{
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
