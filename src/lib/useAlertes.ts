import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { Saut, Licence, CertificatMedical, Qualification, Alerte } from './types';
import { DEFAULT_RULES, type ComplianceRules } from './compliance';

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Échéance matériel à surveiller (calculée côté page depuis materiels + maintenances). */
export interface MaterielEcheance {
  label: string; // ex : « Pliage secours », « Maintenance AAD »
  echeance: string; // date ISO
}

export function computeAlertes(
  userId: string,
  sauts: Saut[],
  licences: Licence[],
  certificats: CertificatMedical[],
  qualifications: Qualification[],
  opts?: { typePratiquant?: string | null; suiviDgac?: boolean; materiel?: MaterielEcheance[]; rules?: ComplianceRules }
): Omit<Alerte, 'id' | 'created_at'>[] {
  const alertes: Omit<Alerte, 'id' | 'created_at'>[] = [];
  const now = new Date();
  const rules = opts?.rules ?? DEFAULT_RULES;

  // ─── Matériel (pliage secours, AAD…) ─────────────────────────────────────────
  for (const mat of opts?.materiel ?? []) {
    const exp = new Date(mat.echeance);
    const days = daysBetween(now, exp);
    if (days < 0) {
      alertes.push({
        parachutiste_id: userId,
        type: 'materiel_revision',
        titre: `${mat.label} : échéance dépassée`,
        message: `${mat.label} a dépassé son échéance le ${exp.toLocaleDateString('fr-FR')}. Faites contrôler votre matériel.`,
        date_echeance: mat.echeance,
        urgence: 'critique',
        lue: false,
      });
    } else if (days <= rules.alerte_j30) {
      alertes.push({
        parachutiste_id: userId,
        type: 'materiel_revision',
        titre: `${mat.label} : échéance proche`,
        message: `${mat.label} expire dans ${days} jour${days > 1 ? 's' : ''} (${exp.toLocaleDateString('fr-FR')}).`,
        date_echeance: mat.echeance,
        urgence: days <= rules.alerte_j7 ? 'critique' : 'attention',
        lue: false,
      });
    }
  }

  // ─── Licences ────────────────────────────────────────────────────────────────
  for (const lic of licences) {
    if (!lic.date_expiration) continue;
    const exp = new Date(lic.date_expiration);
    const days = daysBetween(now, exp);
    if (days < 0) {
      alertes.push({
        parachutiste_id: userId,
        type: 'licence_expire',
        titre: 'Licence expirée',
        message: `Votre licence ${lic.organisme} a expiré le ${exp.toLocaleDateString('fr-FR')}. Renouvelez-la immédiatement.`,
        date_echeance: lic.date_expiration,
        urgence: 'critique',
        lue: false,
      });
    } else if (days < 30) {
      alertes.push({
        parachutiste_id: userId,
        type: 'licence_expire',
        titre: 'Licence expire bientôt',
        message: `Votre licence ${lic.organisme} expire dans ${days} jour${days > 1 ? 's' : ''} (${exp.toLocaleDateString('fr-FR')}).`,
        date_echeance: lic.date_expiration,
        urgence: 'attention',
        lue: false,
      });
    } else if (days < 60) {
      alertes.push({
        parachutiste_id: userId,
        type: 'licence_expire',
        titre: 'Licence : renouvellement à prévoir',
        message: `Votre licence ${lic.organisme} expire le ${exp.toLocaleDateString('fr-FR')} (dans ${days} jours).`,
        date_echeance: lic.date_expiration,
        urgence: 'info',
        lue: false,
      });
    }
  }

  // ─── Certificats médicaux ─────────────────────────────────────────────────────
  for (const cert of certificats) {
    const exp = new Date(cert.date_expiration);
    const days = daysBetween(now, exp);
    if (days < 0) {
      alertes.push({
        parachutiste_id: userId,
        type: 'certificat_medical',
        titre: 'Certificat médical expiré',
        message: `Vous ne pouvez légalement pas sauter. Votre certificat médical a expiré le ${exp.toLocaleDateString('fr-FR')}.`,
        date_echeance: cert.date_expiration,
        urgence: 'critique',
        lue: false,
      });
    } else if (days < 30) {
      alertes.push({
        parachutiste_id: userId,
        type: 'certificat_medical',
        titre: 'Certificat médical expire bientôt',
        message: `Votre certificat médical expire dans ${days} jour${days > 1 ? 's' : ''} (${exp.toLocaleDateString('fr-FR')}).`,
        date_echeance: cert.date_expiration,
        urgence: 'attention',
        lue: false,
      });
    } else if (days < 60) {
      alertes.push({
        parachutiste_id: userId,
        type: 'certificat_medical',
        titre: 'Visite médicale à planifier',
        message: `Votre certificat médical expire le ${exp.toLocaleDateString('fr-FR')} (dans ${days} jours).`,
        date_echeance: cert.date_expiration,
        urgence: 'info',
        lue: false,
      });
    }
  }

  // ─── Seuil DGAC — only for professional parachutists with the toggle enabled ──
  const estPro = opts?.typePratiquant === 'professionnel';
  const suiviDgac = opts?.suiviDgac ?? false;

  if (estPro || suiviDgac) {
    const twelveMonthsAgo = new Date(now); twelveMonthsAgo.setMonth(now.getMonth() - 12);
    const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(now.getMonth() - 6);
    const sauts12m = sauts.filter((s) => new Date(s.date_saut) >= twelveMonthsAgo).length;
    const sauts6m = sauts.filter((s) => new Date(s.date_saut) >= sixMonthsAgo).length;

    if (sauts12m < 20 && sauts6m < 5) {
      const needed12 = 20 - sauts12m;
      const deadline12 = new Date(twelveMonthsAgo);
      deadline12.setFullYear(deadline12.getFullYear() + 1);
      alertes.push({
        parachutiste_id: userId,
        type: 'saut_requis',
        titre: 'Seuil DGAC non atteint',
        message: `Il vous reste ${needed12} saut${needed12 > 1 ? 's' : ''} à effectuer avant le ${deadline12.toLocaleDateString('fr-FR')} pour renouveler votre licence (seuil : 20 sauts / 12 mois ou 5 sauts / 6 mois).`,
        date_echeance: deadline12.toISOString().substring(0, 10),
        urgence: sauts12m < 5 ? 'critique' : 'attention',
        lue: false,
      });
    }
  }

  // ─── Qualifications ───────────────────────────────────────────────────────────
  for (const qual of qualifications) {
    if (!qual.date_expiration) continue;
    const exp = new Date(qual.date_expiration);
    const days = daysBetween(now, exp);
    if (days < 0) {
      alertes.push({
        parachutiste_id: userId,
        type: 'qualification_expire',
        titre: 'Qualification expirée',
        message: `Votre qualification "${qual.type.replace(/_/g, ' ')}" a expiré le ${exp.toLocaleDateString('fr-FR')}.`,
        date_echeance: qual.date_expiration,
        urgence: 'critique',
        lue: false,
      });
    } else if (days < 60) {
      alertes.push({
        parachutiste_id: userId,
        type: 'qualification_expire',
        titre: 'Qualification expire bientôt',
        message: `Votre qualification "${qual.type.replace(/_/g, ' ')}" expire dans ${days} jours (${exp.toLocaleDateString('fr-FR')}).`,
        date_echeance: qual.date_expiration,
        urgence: days < 30 ? 'attention' : 'info',
        lue: false,
      });
    }
  }

  return alertes;
}

export function useAlertes(
  userId: string | undefined,
  sauts: Saut[],
  licences: Licence[],
  certificats: CertificatMedical[],
  qualifications: Qualification[],
  opts?: { typePratiquant?: string | null; suiviDgac?: boolean; materiel?: MaterielEcheance[]; rules?: ComplianceRules }
) {
  const [alertes, setAlertes] = useState<Alerte[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('alertes').select('*').eq('parachutiste_id', userId).order('created_at', { ascending: false });
    setAlertes(data ?? []);
  }, [userId]);

  const sync = useCallback(async () => {
    if (!userId) return;

    const computed = computeAlertes(userId, sauts, licences, certificats, qualifications, opts);

    // Delete old unread non-materialRevision computed alerts, then re-insert
    await supabase
      .from('alertes')
      .delete()
      .eq('parachutiste_id', userId)
      .eq('lue', false)
      .in('type', ['licence_expire', 'certificat_medical', 'saut_requis', 'qualification_expire', 'materiel_revision']);

    if (computed.length > 0) {
      await supabase.from('alertes').insert(computed);
    }

    await load();
  }, [userId, sauts, licences, certificats, qualifications, opts?.typePratiquant, opts?.suiviDgac, load]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (userId) sync();
  }, [userId, sauts.length, licences.length, certificats.length, qualifications.length, opts?.typePratiquant, opts?.suiviDgac, opts?.materiel?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = async (id: string) => {
    await supabase.from('alertes').update({ lue: true }).eq('id', id);
    setAlertes((prev) => prev.map((a) => (a.id === id ? { ...a, lue: true } : a)));
  };

  const markAllRead = async () => {
    if (!userId) return;
    await supabase.from('alertes').update({ lue: true }).eq('parachutiste_id', userId).eq('lue', false);
    setAlertes((prev) => prev.map((a) => ({ ...a, lue: true })));
  };

  const unreadCount = alertes.filter((a) => !a.lue).length;

  return { alertes, unreadCount, markRead, markAllRead, refresh: load };
}
