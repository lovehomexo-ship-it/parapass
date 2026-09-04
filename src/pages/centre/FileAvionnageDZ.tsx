import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, UserPlus, MapPin, AlertTriangle } from 'lucide-react';
import { surface, action, rayure, pastille, enTeteSection, type Severite } from '../../lib/jetons';
import { useFileDZ, LIBELLE_TYPE, messageErreur, type LigneFile, type TypeSautFile } from '../../lib/avionnage';

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

export function FileAvionnageDZ({ centreId, rotations, ouvert, onOuvrir, onPlace }: {
  centreId: string;
  /** Rotations non clôturées, pour proposer où placer. */
  rotations: { id: string; numero: number; places_libres: number | null }[];
  ouvert: boolean;
  onOuvrir: (v: boolean) => void;
  onPlace: () => void;
}) {
  const { file, chargement, erreur, recharger } = useFileDZ(centreId);
  const [action_, setAction] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const placer = async (fileId: string, rotationId: string) => {
    setAction(fileId); setEchec(null);
    const { error } = await supabase.rpc('placer_depuis_file', {
      p_file_id: fileId, p_rotation_id: rotationId,
    });
    setAction(null);
    if (error) {
      console.error('Placement depuis la file échoué :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      // Le message vient de la base et dit quoi faire (« Créez la rotation
      // suivante, ou laissez la personne en file »). On le montre tel quel.
      setEchec(messageErreur(error));
      return;
    }
    await recharger();
    onPlace();
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
              <li key={l.id} className="flex gap-3 py-2.5 px-3 flex-wrap items-start"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--n3-filet)', ...rayure(a.sev) }}>
                <span className="font-extrabold flex-shrink-0"
                  style={{ fontSize: 15, color: 'var(--c-muted)', minWidth: 22 }}>
                  {l.position_file}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="font-bold" style={{ fontSize: 14, color: 'var(--c-text)' }}>
                    {l.prenom} {l.nom}
                    <span className="font-normal" style={{ color: 'var(--c-muted)' }}>
                      {' · '}{LIBELLE_TYPE[l.type_saut as TypeSautFile] ?? l.type_saut}
                    </span>
                  </p>
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

                <span className="flex-shrink-0 whitespace-nowrap self-start" style={pastille(a.sev)}>
                  {a.libelle}
                </span>

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
