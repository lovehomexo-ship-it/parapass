import jsPDF from 'jspdf';
import type { Saut, Licence, Brevet, CertificatMedical, Qualification } from './types';
import type { Profile } from './auth';
import { NATURE_SAUT_LABELS, CATEGORIE_LABELS, FONCTION_LABELS, TYPE_BREVET_LABELS, QUALIFICATION_LABELS } from './types';

const fr = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

const LIEN_LABELS: Record<string, string> = {
  conjoint: 'Conjoint(e)', enfant: 'Enfant', parent: 'Parent',
  frere_soeur: 'Frère / Sœur', autre: 'Autre',
};
const TYPE_LICENCE_LABELS: Record<string, string> = {
  lps: 'LPS — Licence de Parachutisme Sportif',
  lp: 'LP — Licence Professionnelle',
  lj: 'LJ — Licence Jeune',
  ld: 'LD — Licence Dirigeant',
};
const APTITUDE_LABELS: Record<string, string> = {
  aptitude_totale: 'Aptitude totale',
  aptitude_restrictive: 'Aptitude restrictive',
  inapte: 'Inapte',
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function sectionHeader(doc: jsPDF, title: string, x: number, y: number, w: number) {
  doc.setFillColor(11, 29, 58);
  doc.rect(x, y, w, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(title, x + 2, y + 4.5);
  return y + 6;
}

function row(doc: jsPDF, label: string, value: string, x: number, y: number, w: number, even: boolean) {
  if (even) { doc.setFillColor(247, 249, 252); doc.rect(x, y, w, 5.5, 'F'); }
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text(label, x + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(11, 29, 58);
  doc.text(value, x + 55, y + 4, { maxWidth: w - 57 });
  return y + 5.5;
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number, qrTokenUrl?: string) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(11, 29, 58);
  doc.rect(0, ph - 10, pw, 10, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('CONFORME DGAC  •  Certifié ParaPass', 8, ph - 4);
  doc.text(`parapass.fr  •  Page ${pageNum}/${totalPages}`, pw - 8, ph - 4, { align: 'right' });
}

// ─── Page 1: DGAC Récapitulatif (portrait A4) ─────────────────────────────────

function addRecapPage(
  doc: jsPDF,
  profile: Profile,
  licences: Licence[],
  brevets: Brevet[],
  certificats: CertificatMedical[],
  qualifications: Qualification[],
  signatureDataUrl: string | null,
) {
  const margin = 12;
  const pw = doc.internal.pageSize.getWidth();
  const cw = pw - 2 * margin;
  let y = margin;

  // Header banner
  doc.setFillColor(11, 29, 58);
  doc.rect(0, 0, pw, 22, 'F');
  doc.setFillColor(249, 115, 22); // orange stripe
  doc.rect(0, 22, pw, 1.5, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ParaPass — Carnet Officiel DGAC', margin, 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 255);
  doc.text(`N° Licence : ${profile.numero_licence || '—'}  |  Généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, 17);
  y = 30;

  const licence = licences[0];
  const certif = certificats[0];
  const brevet = brevets[0];
  let rowIdx = 0;

  // 1 — IDENTITÉ
  y = sectionHeader(doc, '1 — IDENTITÉ', margin, y, cw);
  y = row(doc, 'Nom et prénom', `${profile.nom.toUpperCase()} ${profile.prenom}`, margin, y, cw, rowIdx++ % 2 === 0);
  y = row(doc, 'Date de naissance', fr(profile.date_naissance), margin, y, cw, rowIdx++ % 2 === 0);
  y = row(doc, 'Lieu de naissance', profile.lieu_naissance || '—', margin, y, cw, rowIdx++ % 2 === 0);
  y = row(doc, 'Nationalité', profile.nationalite || 'Française', margin, y, cw, rowIdx++ % 2 === 0);
  y += 3;

  // 2 — LICENCE & CLUB
  rowIdx = 0;
  y = sectionHeader(doc, '2 — LICENCE & CLUB', margin, y, cw);
  y = row(doc, 'N° Licence FFP', profile.numero_licence || '—', margin, y, cw, rowIdx++ % 2 === 0);
  if (licence) {
    y = row(doc, 'Type de licence', licence.type_licence ? TYPE_LICENCE_LABELS[licence.type_licence] : '—', margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, 'Code club', licence.code_club || '—', margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, 'Nom du club / DZ', licence.nom_club || '—', margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, 'Date de délivrance', fr(licence.date_delivrance), margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, 'Date de validité', fr(licence.date_expiration), margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, 'Statut licence', licence.statut === 'actif' ? 'ACTIF' : licence.statut === 'expire' ? 'EXPIRÉ' : 'SUSPENDU', margin, y, cw, rowIdx++ % 2 === 0);
  }
  y += 3;

  // 3 — BREVETS & QUALIFICATIONS
  rowIdx = 0;
  y = sectionHeader(doc, '3 — BREVETS & QUALIFICATIONS', margin, y, cw);
  if (brevet) {
    y = row(doc, 'Type de brevet', TYPE_BREVET_LABELS[brevet.type_brevet] || brevet.type_brevet, margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, 'N° de brevet', brevet.numero_brevet || '—', margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, "Date d'obtention", fr(brevet.date_obtention), margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, 'Centre de délivrance', brevet.centre_delivrance || '—', margin, y, cw, rowIdx++ % 2 === 0);
  }
  if (brevets.length > 1) {
    y = row(doc, 'Autres brevets', brevets.slice(1).map((b) => TYPE_BREVET_LABELS[b.type_brevet] || b.type_brevet).join(', '), margin, y, cw, rowIdx++ % 2 === 0);
  }
  y = row(doc, 'Qualifications', qualifications.length > 0 ? qualifications.map((q) => QUALIFICATION_LABELS[q.type] || q.type).join(', ') : '—', margin, y, cw, rowIdx++ % 2 === 0);
  y += 3;

  // 4 — ASSURANCES
  rowIdx = 0;
  y = sectionHeader(doc, '4 — ASSURANCES', margin, y, cw);
  if (licence) {
    y = row(doc, 'Assurance individuelle accidents', licence.assurance_individuelle ? '✓ OUI' : '✗ NON', margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, 'Assurance responsabilité civile', licence.assurance_rc ? '✓ OUI' : '✗ NON', margin, y, cw, rowIdx++ % 2 === 0);
    if (!licence.assurance_individuelle || !licence.assurance_rc) {
      doc.setFillColor(255, 245, 245);
      doc.rect(margin, y, cw, 7, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 50, 50);
      doc.text('⚠ Assurance manquante — licence potentiellement invalide lors d\'un contrôle DGAC', margin + 2, y + 5);
      y += 8;
    }
  }
  y += 3;

  // 5 — BÉNÉFICIAIRE
  rowIdx = 0;
  y = sectionHeader(doc, '5 — BÉNÉFICIAIRE EN CAS DE DÉCÈS (confidentiel)', margin, y, cw);
  if (licence?.beneficiaire_nom) {
    y = row(doc, 'Nom et prénom', licence.beneficiaire_nom, margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, 'Lien de parenté', licence.beneficiaire_lien ? LIEN_LABELS[licence.beneficiaire_lien] : '—', margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, 'Téléphone', licence.beneficiaire_telephone || '—', margin, y, cw, rowIdx++ % 2 === 0);
  } else {
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(150, 150, 150);
    doc.text('Aucun bénéficiaire renseigné', margin + 2, y + 4); y += 6;
  }
  y += 3;

  // 6 — CERTIFICAT MÉDICAL
  rowIdx = 0;
  y = sectionHeader(doc, '6 — CERTIFICAT MÉDICAL', margin, y, cw);
  if (certif) {
    const expired = certif.date_expiration ? new Date(certif.date_expiration) < new Date() : false;
    y = row(doc, 'Médecin', certif.medecin || '—', margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, 'Date de visite', fr(certif.date_visite), margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, "Date d'expiration", fr(certif.date_expiration), margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, "Type d'aptitude", APTITUDE_LABELS[certif.type] || certif.type, margin, y, cw, rowIdx++ % 2 === 0);
    y = row(doc, 'Statut', expired ? 'EXPIRÉ' : 'VALIDE', margin, y, cw, rowIdx++ % 2 === 0);
  } else {
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(150, 150, 150);
    doc.text('Aucun certificat médical enregistré', margin + 2, y + 4); y += 6;
  }
  y += 3;

  // 7 — TAMPONS & SIGNATURES
  y = sectionHeader(doc, '7 — TAMPONS & SIGNATURES OFFICIELS', margin, y, cw);
  const stampZoneH = 35;
  const halfW = (cw - 4) / 2;

  // Tampon DZ zone (left)
  doc.setDrawColor(200, 210, 220);
  doc.setLineDash([1.5, 1.5]);
  doc.rect(margin, y, halfW, stampZoneH);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text('CACHET DE LA DROPZONE', margin + 2, y + 4);
  if (licence?.tampon_statut === 'valide' && licence.tampon_valide_par) {
    doc.setTextColor(11, 29, 58);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Validé par ${licence.tampon_valide_par}`, margin + halfW / 2, y + stampZoneH / 2, { align: 'center' });
    if (licence.tampon_date_validation) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(fr(licence.tampon_date_validation), margin + halfW / 2, y + stampZoneH / 2 + 5, { align: 'center' });
    }
  } else {
    doc.text('En attente de validation DZ', margin + halfW / 2, y + stampZoneH / 2 + 2, { align: 'center' });
  }

  // Signature zone (right)
  doc.rect(margin + halfW + 4, y, halfW, stampZoneH);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text('SIGNATURE DU LICENCIÉ', margin + halfW + 6, y + 4);
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', margin + halfW + 6, y + 7, halfW - 8, stampZoneH - 12);
    } catch (_) { /* skip if image fails */ }
  }
  doc.setLineDash([]);
  y += stampZoneH + 3;

  addFooter(doc, 1, 2);
}

// ─── Page 2: Jump log (landscape) ─────────────────────────────────────────────

function addJumpLog(doc: jsPDF, profile: Profile, sauts: Saut[], pageNum: number, totalPages: number) {
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = margin;

  // Header
  doc.setFillColor(11, 29, 58);
  doc.rect(0, 0, pageWidth, 18, 'F');
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 18, pageWidth, 1.5, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('PARAPASS — Carnet de Sauts en Parachute', margin, 9);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 255);
  doc.text(`${profile.nom.toUpperCase()} ${profile.prenom}  |  Licence : ${profile.numero_licence}  |  Document conforme DGAC`, margin, 15);
  y = 26;

  // Table
  const cols = [
    { title: 'Date', w: 22 },
    { title: 'Lieu / DZ', w: 36 },
    { title: 'Aéronef', w: 22 },
    { title: 'Nature', w: 28 },
    { title: 'Catégorie', w: 22 },
    { title: 'Hauteur', w: 18 },
    { title: 'Fonction', w: 22 },
    { title: 'Observations & Visa', w: 73 },
  ];

  const rowH = 6.5;
  let x = margin;

  doc.setFillColor(11, 29, 58);
  doc.rect(margin, y, pageWidth - 2 * margin, rowH, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  x = margin;
  cols.forEach((col) => { doc.text(col.title, x + 1, y + 4.5); x += col.w; });
  y += rowH;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(6.8);

  const sortedSauts = [...sauts].sort((a, b) => b.date_saut.localeCompare(a.date_saut));
  sortedSauts.forEach((saut, i) => {
    if (y > doc.internal.pageSize.getHeight() - 22) {
      addFooter(doc, pageNum, totalPages);
      doc.addPage();
      y = margin;
    }
    if (i % 2 === 0) { doc.setFillColor(245, 247, 250); doc.rect(margin, y, pageWidth - 2 * margin, rowH, 'F'); }
    x = margin;
    [
      new Date(saut.date_saut).toLocaleDateString('fr-FR'),
      saut.lieu,
      saut.aeronef_immat,
      NATURE_SAUT_LABELS[saut.nature_saut] || saut.nature_saut,
      CATEGORIE_LABELS[saut.categorie] || saut.categorie,
      `${saut.hauteur_m}m`,
      FONCTION_LABELS[saut.fonction] || saut.fonction,
      `${saut.observations || ''}${saut.valide_par ? ` — Visa: ${saut.valide_par}` : ''}`,
    ].forEach((cell, j) => {
      doc.text(String(cell), x + 1, y + 4.5, { maxWidth: cols[j].w - 2 });
      x += cols[j].w;
    });
    y += rowH;
  });

  // Totals
  y += 5;
  const totalSauts = sauts.length;
  const totalOA = sauts.filter((s) => s.categorie === 'OA').length;
  const totalOC = sauts.filter((s) => s.categorie === 'OC').length;
  const totalOR = sauts.filter((s) => ['OR30', 'OR60', 'OR60plus'].includes(s.categorie)).length;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 29, 58);
  doc.text(
    `TOTAUX — ${totalSauts} sauts  |  OA : ${totalOA}  |  OC : ${totalOC}  |  OR : ${totalOR}`,
    margin, y
  );

  addFooter(doc, pageNum, totalPages);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generatePDF(profile: Profile, sauts: Saut[]) {
  // Simple jump log only (from dashboard)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  addJumpLog(doc, profile, sauts, 1, 1);
  doc.save(`ParaPass_${profile.nom}_${profile.prenom}_carnet.pdf`);
}

export function generatePassportPDF(
  profile: Profile,
  sauts: Saut[],
  licences: Licence[],
  brevets: Brevet[],
  certificats: CertificatMedical[],
  qualifications: Qualification[],
  signatureDataUrl: string | null,
) {
  // Page 1: portrait recap
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addRecapPage(doc, profile, licences, brevets, certificats, qualifications, signatureDataUrl);

  // Page 2+: landscape jump log
  doc.addPage('a4', 'landscape');
  addJumpLog(doc, profile, sauts, 2, 2);

  doc.save(`ParaPass_${profile.nom}_${profile.prenom}_passeport-officiel.pdf`);
}
