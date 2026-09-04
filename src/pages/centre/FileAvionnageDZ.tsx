import { useState } from 'react';
import { Users, UserPlus, MapPin, AlertTriangle, GripVertical } from 'lucide-react';
import { surface, action, rayure, pastille, enTeteSection, type Severite } from '../../lib/jetons';
import { useFileDZ, LIBELLE_TYPE, type LigneFile, type TypeSautFile } from '../../lib/avionnage';

/** Type MIME maison du glisser-déposer : une planche n'accepte que ça. */
export const MIME_FILE = 'application/x-parapass-file';

// ═══════════════════════════════════════════════════════════════════════════
// AVIONNAGE — côté DZ. La file du jour, et de quoi la vider dans les avions.
//
// Le chef d'avionnage a une seule question : QUI attend, et où je le mets ?
// Une ligne par personne, dans l'ordre d'arrivée, avec son aptitude à côté.
//
// L'aptitude est AFFICHÉE, elle ne bloque rien (doctrine du produit). Elle
// vient de get_aptitude_du_jour via la RPC : pas d'un second calcul qui
// finirait par contredire « Sur le terrain ».
// ═══════════════════════════════════════════════════════════════════════════

const APTITUDE: Record<LigneFile['statut_aptitude'], { sev: Severite; libelle: string }> = {
  rouge:   { sev: 'critique',  libelle: 'À examiner' },
  orange:  { sev: 'vigilance', libelle: 'Vigilance' },
  vert:    { sev: 'conforme',  libelle: 'Peut sauter' },
  // Un dossier qu'on n'a pas pu lire n'est pas un dossier conforme.
  inconnu: { sev: 'neutre',    libelle: 'Aptitude inconnue' },
};

export function FileAvionnageDZ({ centreId, rotations, ouvert, onOuvrir, onPlacer, onOuvrirFiche, rechargerRef }: {
  centreId: string;
  /** Rotations non clôturées, pour proposer où placer. */
  rotations: { id: string; numero: number; places_libres: number | null }[];
  ouvert: boolean;
  onOuvrir: (v: boolean) => void;
  /** Le placement vit dans le parent : bouton ET glisser-déposer y aboutissent. */
  onPlacer: (fileId: string, rotationId: string) => Promise<string | null>;
  /** Un clic sur la personne ouvre sa fiche — c'est là qu'on comprend l'anomalie. */
  onOuvrirFiche: (parachutisteId: string) => void;
  /** Permet au parent de recharger la file après un dépôt sur une planche. */
  rechargerRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}) {
  const { file, chargement, erreur, recharger } = useFileDZ(centreId);
  const [action_, setAction] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  if (rechargerRef) rechargerRef.current = recharger;

  const placer = async (fileId: string, rotationId: string) => {
    setAction(fileId); setEchec(null);
    const err = await onPlacer(fileId, rotationId);
    setAction(null);
    if (err) { setEchec(err); return; }
    await recharger();
  };

  return (
    <section aria-label="File d’avionnage" className="p-4" style={surface(2)}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h3 style={{ ...enTeteSection, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
          <Users className="w-4 h-4 inline-block mr-1.5 align-[-2px]" aria-hidden />
          File d’avionnage
          <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: 0, textTransform: 'none',
                         color: 'var(--c-muted)', marginLeft: 8 }}>
            {ouvert ? `${file.length} en attente` : 'fermée'}
          </span>
        </h3>

        {/* L'interrupteur : tant qu'il est fermé, aucun licencié ne voit la
            file ni ne peut s'y inscrire. Fermé par défaut — une file que
            personne ne relève est pire que pas de file. */}
        <button type="button" role="switch" aria-checked={ouvert}
          onClick={() => onOuvrir(!ouvert)}
          className="flex items-center gap-2 px-3 rounded-xl text-sm font-bold"
          style={{ minHeight: 40,
            background: ouvert ? 'var(--action-fond)' : 'transparent',
            color: ouvert ? '#fff' : 'var(--action-texte)',
            border: `1px solid ${ouvert ? 'var(--action-fond)' : 'var(--action-texte)'}` }}>
          {ouvert ? 'Inscriptions ouvertes' : 'Ouvrir les inscriptions'}
        </button>
      </div>

      {!ouvert ? (
        <p className="mt-3" style={{ fontSize: 13, color: 'var(--c-muted)' }}>
          Les licenciés du centre ne voient pas l’avionnage. Ouvrez les
          inscriptions pour qu’ils puissent se mettre en file depuis leur
          téléphone.
        </p>
      ) : chargement ? (
        <p className="mt-3" style={{ fontSize: 13, color: 'var(--c-muted)' }}>Chargement de la file…</p>
      ) : erreur ? (
        <p role="alert" className="mt-3 px-3 py-2 rounded-xl" style={{
          fontSize: 13, borderLeft: '5px solid var(--sev-critique)', color: 'var(--c-text2)',
          background: 'color-mix(in srgb, var(--sev-critique) 10%, transparent)' }}>{erreur}</p>
      ) : file.length === 0 ? (
        <p className="mt-3" style={{ fontSize: 13, color: 'var(--c-muted)' }}>
          Personne en attente. Les inscriptions sont ouvertes.
        </p>
      ) : (
        <ul className="mt-3">
          {file.map((l, i) => {
            const a = APTITUDE[l.statut_aptitude];
            return (
              <li key={l.id}
                // Glisser-déposer natif : la ligne emporte l'id de la demande,
                // une planche l'accepte. Sur écran tactile le glisser natif ne
                // répond pas — les boutons « Rot. N » restent le chemin, et
                // c'est voulu : au bord de la piste, un bouton se vise mieux.
                draggable={action_ === null}
                onDragStart={e => {
                  e.dataTransfer.setData(MIME_FILE, l.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className="flex gap-2 py-2.5 px-3 flex-wrap items-start"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--n3-filet)', ...rayure(a.sev),
                         cursor: 'grab' }}>
                <GripVertical className="w-4 h-4 flex-shrink-0 self-center" aria-hidden
                  style={{ color: 'var(--c-dim)' }} />
                <span className="font-extrabold flex-shrink-0"
                  style={{ fontSize: 15, color: 'var(--c-muted)', minWidth: 22 }}>
                  {l.position_file}
                </span>

                <div className="flex-1 min-w-0">
                  {/* Le nom est un bouton : un clic ouvre la fiche, où les
                      motifs se lisent et se traitent. */}
                  <button type="button" onClick={() => onOuvrirFiche(l.parachutiste_id)}
                    className="font-bold text-left hover:underline"
                    style={{ fontSize: 14, color: 'var(--c-text)', minHeight: 32 }}>
                    {l.prenom} {l.nom}
                    <span className="font-normal no-underline" style={{ color: 'var(--c-muted)' }}>
                      {' · '}{LIBELLE_TYPE[l.type_saut as TypeSautFile] ?? l.type_saut}
                    </span>
                  </button>
                  {l.commentaire && (
                    <p style={{ fontSize: 12, color: 'var(--c-text2)' }}>{l.commentaire}</p>
                  )}
                  {/* Se mettre en file sans s'être déclaré présent est un cas
                      réel : la personne est peut-être en train d'arriver. On
                      le signale, on ne l'empêche pas. */}
                  {!l.present && (
                    <p className="flex items-center gap-1" style={{ fontSize: 12, color: 'var(--sev-vigilance)' }}>
                      <MapPin className="w-3 h-3" aria-hidden /> pas encore déclaré présent
                    </p>
                  )}
                  {l.motifs_bloquants > 0 && (
                    <p className="flex items-center gap-1" style={{ fontSize: 12, color: 'var(--sev-critique)' }}>
                      <AlertTriangle className="w-3 h-3" aria-hidden />
                      {l.motifs_bloquants} motif{l.motifs_bloquants > 1 ? 's' : ''} bloquant
                      {l.motifs_bloquants > 1 ? 's' : ''} — voir « Sur le terrain »
                    </p>
                  )}
                </div>

                <button type="button" onClick={() => onOuvrirFiche(l.parachutiste_id)}
                  title="Ouvrir la fiche"
                  className="flex-shrink-0 whitespace-nowrap self-start"
                  style={{ ...pastille(a.sev), cursor: 'pointer', minHeight: 28 }}>
                  {a.libelle}
                </button>

                {/* Un bouton par rotation qui a encore de la place. Une rotation
                    complète ne s'affiche pas : proposer un placement que la
                    base refusera est une promesse qu'on ne tient pas. */}
                <div className="flex gap-1.5 flex-wrap flex-shrink-0 w-full sm:w-auto">
                  {rotations.filter(r => r.places_libres === null || r.places_libres > 0).map(r => (
                    <button key={r.id} type="button" disabled={action_ !== null}
                      onClick={() => placer(l.id, r.id)}
                      className="disabled:opacity-50"
                      style={{ ...action('secondaire'), minHeight: 36, fontSize: 12, padding: '0 10px' }}>
                      <UserPlus className="w-3.5 h-3.5" aria-hidden />
                      Rot. {r.numero}
                    </button>
                  ))}
                  {rotations.length === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                      créez une rotation
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {echec && (
        <p role="alert" className="mt-3 px-3 py-2 rounded-xl" style={{
          fontSize: 13, borderLeft: '5px solid var(--sev-critique)', color: 'var(--c-text2)',
          background: 'color-mix(in srgb, var(--sev-critique) 10%, transparent)' }}>
          {echec}
        </p>
      )}
    </section>
  );
}
