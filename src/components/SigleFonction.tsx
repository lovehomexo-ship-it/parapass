import { Plane, ShieldCheck, Users, GraduationCap } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// LES FONCTIONS OPÉRATIONNELLES — le sigle qui dit QUI FAIT QUOI aujourd'hui.
//
// Un brevet dit ce qu'on sait faire ; une fonction dit ce qu'on exerce ce
// jour-là. Au pied de l'avion, la question n'est pas « qui a un brevet D »
// mais « QUI EST LE LARGUEUR ». Le sigle vit donc dans l'AVIONNAGE, pas sur
// la licence — celle-ci est un document d'identité, pas un organigramme.
//
// Vocabulaire : celui du CHECK de qualifications.type (minuscules).
// (qualifications_ref et moniteurs_qualifications emploient des MAJUSCULES ;
//  deux vocabulaires coexistent en base, c'est une dette connue.)
// ═══════════════════════════════════════════════════════════════════════════

export const FONCTIONS: Record<string, {
  sigle: string; libelle: string; couleur: string; Icone: typeof Plane;
}> = {
  largueur: {
    sigle: 'LARGUEUR', couleur: '#38BDF8', Icone: Plane,
    libelle: 'Largueur — dirige le largage depuis l’avion',
  },
  directeur_technique: {
    sigle: 'DT', couleur: '#A78BFA', Icone: ShieldCheck,
    libelle: 'Directeur technique',
  },
  moniteur_tandem: {
    sigle: 'TANDEM', couleur: '#34D399', Icone: Users,
    libelle: 'Moniteur tandem',
  },
  formateur_PAC: {
    sigle: 'PAC', couleur: '#FBBF24', Icone: GraduationCap,
    libelle: 'Formateur PAC',
  },
};

/**
 * Volontairement plus voyant qu'un badge de brevet : c'est ce qu'on cherche
 * des yeux dans un hangar. L'icône double la couleur, pour que le sigle reste
 * distinguable en niveaux de gris et pour un œil daltonien.
 */
export function SigleFonction({ code, compact = false }: { code: string; compact?: boolean }) {
  const f = FONCTIONS[code];
  if (!f) return null;
  const { Icone } = f;
  return (
    <span title={f.libelle} aria-label={f.libelle}
      className="inline-flex items-center gap-1 whitespace-nowrap"
      style={{
        fontSize: compact ? 9 : 10, fontWeight: 900, letterSpacing: '0.08em',
        color: f.couleur, background: `${f.couleur}22`,
        border: `1px solid ${f.couleur}66`, borderRadius: 6,
        padding: compact ? '2px 5px' : '3px 7px', textTransform: 'uppercase',
      }}>
      <Icone className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} aria-hidden />
      {f.sigle}
    </span>
  );
}

/** Plusieurs fonctions, dans un ordre stable : le largueur d'abord. */
export function SiglesFonctions({ codes, compact }: { codes: readonly string[]; compact?: boolean }) {
  const ordre = Object.keys(FONCTIONS);
  const tries = [...codes].filter(c => FONCTIONS[c])
    .sort((a, b) => ordre.indexOf(a) - ordre.indexOf(b));
  if (tries.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {tries.map(c => <SigleFonction key={c} code={c} compact={compact} />)}
    </span>
  );
}
