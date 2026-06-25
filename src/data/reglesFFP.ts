export interface ReglesBrevet {
  brevet: string;
  label: string;
  hauteurOuvertureMin: number;
  hauteurLargageMin: number;
  ventMaxSol: number;
  description: string;
}

export const REGLES_PAR_BREVET: Record<string, ReglesBrevet> = {
  PAC: {
    brevet: 'PAC',
    label: 'Élève PAC',
    hauteurOuvertureMin: 1500,
    hauteurLargageMin: 3000,
    ventMaxSol: 7,
    description: 'Élève en formation — moniteur obligatoire',
  },
  BPA: {
    brevet: 'BPA',
    label: 'Brevet de Parachutiste Autonome',
    hauteurOuvertureMin: 1200,
    hauteurLargageMin: 2000,
    ventMaxSol: 7,
    description: 'Premier brevet — parachutiste autonome',
  },
  A: {
    brevet: 'A',
    label: 'Brevet A',
    hauteurOuvertureMin: 1200,
    hauteurLargageMin: 2000,
    ventMaxSol: 7,
    description: 'Brevet A (ancienne nomenclature)',
  },
  B: {
    brevet: 'B',
    label: 'Brevet B',
    hauteurOuvertureMin: 1000,
    hauteurLargageMin: 2000,
    ventMaxSol: 11,
    description: 'Brevet B — parachutiste confirmé',
  },
  C: {
    brevet: 'C',
    label: 'Brevet C',
    hauteurOuvertureMin: 800,
    hauteurLargageMin: 2000,
    ventMaxSol: 11,
    description: 'Brevet C — parachutiste expérimenté',
  },
  D: {
    brevet: 'D',
    label: 'Brevet D',
    hauteurOuvertureMin: 800,
    hauteurLargageMin: 2000,
    ventMaxSol: 14,
    description: 'Brevet D — parachutiste expert',
  },
};

export function getRegles(brevet: string | null | undefined): ReglesBrevet {
  return REGLES_PAR_BREVET[brevet ?? ''] ?? REGLES_PAR_BREVET['BPA'];
}

export function verifierHauteurOuverture(brevet: string | null | undefined, hauteurOuverture: number): {
  conforme: boolean;
  minimum: number;
  message: string | null;
} {
  const regles = getRegles(brevet);
  const conforme = hauteurOuverture >= regles.hauteurOuvertureMin;
  return {
    conforme,
    minimum: regles.hauteurOuvertureMin,
    message: conforme
      ? null
      : `Hauteur d'ouverture ${hauteurOuverture} m insuffisante. Minimum pour ${regles.label} : ${regles.hauteurOuvertureMin} m`,
  };
}
