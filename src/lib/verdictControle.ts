// ─── Verdict binaire de contrôle (Prompt S) ──────────────────────────────────
// Page publique /v : un contrôleur (DGAC / gendarmerie) doit lire un verdict
// immédiat. « EN RÈGLE » exige TOUT : signature authentique, QR non expiré,
// licence active et non expirée, certificat médical non expiré. Sinon « À VÉRIFIER ».
// Fonction pure → testable et identique où qu'elle soit utilisée.

export interface ControlePayload {
  active: boolean;
  lic_exp: string | null;
  med_exp: string | null;
}

function dateExpiree(iso: string | null): boolean {
  if (!iso) return false; // pas de date = ne bloque pas ici (affiché en détail)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const exp = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso);
  if (isNaN(exp.getTime())) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  return exp.getTime() < today.getTime();
}

export interface Verdict { enRegle: boolean; motif: string }

/** Verdict binaire à partir du payload signé + état de la signature/expiration du QR. */
export function verdictControle(payload: ControlePayload | null, signatureOk: boolean, qrExpire: boolean): Verdict {
  if (!signatureOk) return { enRegle: false, motif: 'Signature non authentique' };
  if (qrExpire) return { enRegle: false, motif: 'QR expiré — demander un QR à jour' };
  if (!payload) return { enRegle: false, motif: 'Données illisibles' };
  if (!payload.active) return { enRegle: false, motif: 'Licence non active' };
  if (dateExpiree(payload.lic_exp)) return { enRegle: false, motif: 'Licence expirée' };
  if (dateExpiree(payload.med_exp)) return { enRegle: false, motif: 'Certificat médical expiré' };
  return { enRegle: true, motif: 'Licence active, documents à jour' };
}
