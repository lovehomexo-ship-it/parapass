/**
 * Génère un hash SHA-256 de toutes les données d'un saut au moment de la validation.
 * Utilisé pour la preuve d'intégrité cryptographique.
 */
export async function hashSautData(data: {
  saut_id: string;
  parachutiste_id: string;
  moniteur_id: string;
  date_saut: string;
  lieu: string;
  aeronef: string;
  hauteur: number;
  categorie: string;
  timestamp_validation: string;
}): Promise<string> {
  const str = JSON.stringify(data);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Recompute the same hash from saut data for integrity verification. */
export async function verifySautHash(
  saut: {
    id: string;
    parachutiste_id: string;
    moniteur_id: string | null;
    date_saut: string;
    lieu: string;
    aeronef_immat: string;
    hauteur_m: number;
    categorie: string;
    validation_timestamp: string | null;
  },
  storedHash: string
): Promise<boolean> {
  if (!saut.moniteur_id || !saut.validation_timestamp) return false;
  const computed = await hashSautData({
    saut_id: saut.id,
    parachutiste_id: saut.parachutiste_id,
    moniteur_id: saut.moniteur_id,
    date_saut: saut.date_saut,
    lieu: saut.lieu,
    aeronef: saut.aeronef_immat,
    hauteur: saut.hauteur_m,
    categorie: saut.categorie,
    timestamp_validation: saut.validation_timestamp,
  });
  return computed === storedHash;
}
