import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// AVATAR — la photo de profil, ou les initiales, et JAMAIS l'icône d'image
// cassée.
//
// CE QUI N'ALLAIT PAS. L'écran d'attestation de carnet fabriquait l'adresse de
// la photo à la main :
//
//     `${VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${photo_profil_url}`
//
// Or `photo_profil_url` est DÉJÀ une adresse complète. Le résultat était une
// adresse emboîtée dans une autre, pointant vers un seau « avatars » qui
// n'existe pas — d'où le carré gris barré sur la fiche d'Alexandre Dupont.
// Les autres affichaient leurs initiales simplement parce qu'ils n'ont pas de
// photo : le défaut ne se voyait que sur ceux qui en ont une.
//
// DEUX RÈGLES, ICI ET UNE SEULE FOIS :
//   • une adresse complète s'utilise telle quelle ; un chemin relatif se
//     résout dans le seau `profile-photos`, celui où l'application dépose
//     réellement les photos ;
//   • une image qui ne charge pas retombe sur les initiales. Un avatar est
//     décoratif : il ne doit jamais laisser un pictogramme de panne sur le
//     visage de quelqu'un. Trois fichiers du seau font 160 octets — des restes
//     d'un import raté — et se comportaient exactement ainsi.
// ═══════════════════════════════════════════════════════════════════════════

const SEAU_PHOTOS = 'profile-photos';

/** L'adresse réelle d'une photo de profil, complète ou relative. */
export function urlPhotoProfil(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  const v = valeur.trim();
  if (!v) return null;
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('/') || v.startsWith('data:')) return v;
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${SEAU_PHOTOS}/${v}`;
}

export function initialesDe(prenom?: string | null, nom?: string | null): string {
  const a = (prenom ?? '').trim().charAt(0);
  const b = (nom ?? '').trim().charAt(0);
  return (a + b).toUpperCase() || '?';
}

export function Avatar({ photo, prenom, nom, taille = 36, className = '' }: {
  photo?: string | null;
  prenom?: string | null;
  nom?: string | null;
  taille?: number;
  className?: string;
}) {
  const [casse, setCasse] = useState(false);
  const url = casse ? null : urlPhotoProfil(photo);
  const initiales = initialesDe(prenom, nom);

  return (
    <div className={`rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 overflow-hidden ${className}`}
      style={{ width: taille, height: taille, background: 'var(--c-border)', fontSize: Math.round(taille * 0.38) }}>
      {url
        ? <img src={url} alt="" onError={() => setCasse(true)}
            className="w-full h-full object-cover" />
        : initiales}
    </div>
  );
}
