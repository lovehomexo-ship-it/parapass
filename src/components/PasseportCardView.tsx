import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { action } from '../lib/jetons';
import { supabase } from '../lib/supabase';
import { ParachuteIcon } from './ParachuteIcon';
import type { TamponConfig } from './TamponDZ';
import { TYPE_BREVET_LABELS } from '../lib/types';
import type { Licence, Brevet, CertificatMedical, CentreLicencie, Qualification } from '../lib/types';
import { QRCodeSVG } from 'qrcode.react';
import { useCurrencyRules, getCurrencyStatus, CURRENCY_STATUS_CONFIG } from '../lib/currency';
import { User, RefreshCw, Maximize2, X, AlertTriangle, CheckCircle, Clock, Shield, Eye, Download, RotateCcw, Check, ShieldCheck, ShieldX } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  nom: string;
  prenom: string;
  avatar_url: string | null;
  photo_profil_url: string | null;
  numero_licence: string | null;
  date_naissance: string | null;
  lieu_naissance: string | null;
  partage_carte_centre: boolean;
  signature_url?: string | null;
}

interface CentreData {
  id: string;
  nom: string;
  nom_dt?: string | null;
  signature_dt_url?: string | null;
  logo_url?: string | null;
  tampon_nom_officiel?: string | null;
  tampon_couleur_primaire?: string;
  tampon_couleur_texte?: string;
  tampon_logo_url?: string | null;
  tampon_numero_agrement?: string | null;
}

interface DernierControle {
  controle_le: string;
  licence_ok: boolean;
  medical_ok: boolean;
  assurance_ok: boolean;
  note: string | null;
  centre_nom: string | null;
  controle_par_nom: string | null;
}

interface PasseportData {
  profile: ProfileData;
  licences: Licence[];
  brevets: Brevet[];
  certificats: CertificatMedical[];
  centresLicencies: CentreLicencie[];
  qualifications: Qualification[];
  sautsCount: number;
  validSautsCount: number;
  qrToken: string | null;
  tamponConfig: TamponConfig | null;
  centre: CentreData | null;
  loadedAt: Date;
  dernierSautValide: { valide_par: string | null; valide_le: string | null; lieu: string | null } | null;
  dernierSautDate: string | null;
  dernierControle: DernierControle | null;
}

// ─── Status helpers ─────────────────────────────────────────────────────────────

type ValidityStatus = 'valide' | 'bientot' | 'expire' | 'manquant';

function getStatus(dateExp: string | null | undefined): ValidityStatus {
  if (!dateExp) return 'manquant';
  const d = new Date(dateExp);
  const now = new Date();
  if (d < now) return 'expire';
  const warn = new Date(); warn.setDate(now.getDate() + 30);
  if (d < warn) return 'bientot';
  return 'valide';
}

function daysLeft(dateExp: string | null | undefined): number | null {
  if (!dateExp) return null;
  return Math.ceil((new Date(dateExp).getTime() - Date.now()) / 86400000);
}

function StatusPill({ status, days }: { status: ValidityStatus; days: number | null }) {
  const cfg = {
    valide:   { cls: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle className="w-3 h-3" />, label: 'Valide' },
    bientot:  { cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock className="w-3 h-3" />, label: days !== null ? `${days}j` : 'Bientôt' },
    expire:   { cls: 'bg-red-100 text-red-600 border-red-200', icon: <AlertTriangle className="w-3 h-3" />, label: 'Expiré' },
    manquant: { cls: 'bg-gray-100 text-gray-500 border-gray-200', icon: null, label: 'Manquant' },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

/**
 * Couleurs de validité SUR LA CARTE (fond sombre). La carte affichait une
 * date en blanc quand elle était valide : on lisait « 30/01/2027 » sans
 * savoir si c'était bon. Le vert le dit, l'ambre prévient, le rouge alerte.
 */
const COULEUR_VALIDITE: Record<ValidityStatus, string> = {
  valide:   '#6EE7B7',
  bientot:  '#FCD34D',
  expire:   '#FCA5A5',
  manquant: 'rgba(255,255,255,0.4)',
};
const MOT_VALIDITE: Record<ValidityStatus, string> = {
  valide: 'valide', bientot: 'bientôt', expire: 'expiré', manquant: '—',
};

export type CouleurFeu = 'vert' | 'orange' | 'rouge' | 'gris';

const LAMPES: { cle: CouleurFeu; couleur: string }[] = [
  { cle: 'rouge',  couleur: '#EF4444' },
  { cle: 'orange', couleur: '#F59E0B' },
  { cle: 'vert',   couleur: '#22C55E' },
];

/**
 * Un vrai feu : trois lampes, une seule allumée. Les deux autres restent
 * visibles mais éteintes — c'est ce qui rend un feu lisible d'un coup d'œil,
 * la POSITION de la lampe autant que sa couleur. En niveaux de gris, la
 * lampe allumée reste la seule claire.
 *
 * Éteint (null) = on ne sait pas. On n'allume jamais le vert par défaut.
 */
export function FeuTricolore({ etat, taille = 14, onClick, titre }: {
  etat: CouleurFeu | null; taille?: number; onClick?: () => void; titre?: string;
}) {
  const lampes = (
    <span className="inline-flex items-center" style={{
      gap: taille * 0.3, padding: taille * 0.28, borderRadius: 999,
      background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.14)',
    }}>
      {LAMPES.map(l => {
        const allumee = etat === l.cle;
        return (
          <span key={l.cle} aria-hidden style={{
            width: taille, height: taille, borderRadius: '50%',
            background: allumee ? l.couleur : 'rgba(255,255,255,0.10)',
            boxShadow: allumee ? `0 0 ${taille * 0.7}px ${l.couleur}` : 'none',
            border: allumee ? 'none' : '1px solid rgba(255,255,255,0.10)',
          }} />
        );
      })}
    </span>
  );
  const libelle = titre ?? (etat === null || etat === 'gris'
    ? 'Conformité non évaluée' : `Feu ${etat}`);
  if (!onClick) return <span title={libelle} aria-label={libelle}>{lampes}</span>;
  return (
    <button type="button" onClick={onClick} title={libelle} aria-label={`${libelle} — voir le détail`}
      style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, lineHeight: 0 }}>
      {lampes}
    </button>
  );
}

// Hauteur mini PARTAGÉE recto/verso → dimensions strictement identiques, le
// retournement ne change pas la taille de la carte.
const CARD_MIN_HEIGHT = 384;

// Badge Oui/Non rattaché à son libellé (statut clair, jamais une valeur orpheline).
function OuiNonBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-0.5" style={{ fontSize: 10, fontWeight: 700, color: '#6EE7B7', background: 'rgba(16,185,129,0.16)', border: '1px solid rgba(16,185,129,0.3)', padding: '1px 7px', borderRadius: 20 }}>
      <Check className="w-3 h-3" /> Oui
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5" style={{ fontSize: 10, fontWeight: 700, color: '#FCA5A5', background: 'rgba(239,68,68,0.16)', border: '1px solid rgba(239,68,68,0.3)', padding: '1px 7px', borderRadius: 20 }}>
      <X className="w-3 h-3" /> Non
    </span>
  );
}

/**
 * Ce que le feu cache derrière lui. C'est la pièce qui « automatise la partie
 * décisionnelle » : le DT clique sur le feu et lit ce qui a été constaté,
 * avec le texte fédéral qui le fonde, sans changer d'écran.
 *
 * Aucun contenu médical n'y transite (P5) : les motifs ne portent que des
 * dates et des états.
 */
/**
 * Le feu est allumé (état courant) mais AUCUN contrôle n'a été consigné.
 * On le dit franchement plutôt que d'afficher un panneau vide : la couleur
 * décrit une situation, elle n'atteste de rien tant que personne n'a scanné.
 */
function PanneauSansControle({ feu, onFermer }: { feu: CouleurFeu | null; onFermer: () => void }) {
  return (
    <div className="mt-3 rounded-xl p-4" style={{ background: 'var(--c-bg)', border: '1px solid var(--n2-bord)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
            Aucun contrôle consigné
          </p>
          <p style={{ fontSize: 13, color: 'var(--c-muted)', maxWidth: 460 }}>
            Le feu montre l’état des documents en ce moment. Il n’atteste de
            rien tant que personne n’a scanné la licence à l’embarquement —
            c’est le scan qui produit une trace datée et opposable.
          </p>
        </div>
        <FeuTricolore etat={feu} taille={13} />
      </div>
      <button type="button" onClick={onFermer} className="mt-3" style={action('texte')}>Fermer</button>
    </div>
  );
}

function PanneauAnomalies({ controle, feu, onFermer }: {
  controle: DernierControleFeuVert; feu: CouleurFeu | null; onFermer: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl p-4" style={{ background: 'var(--c-bg)', border: '1px solid var(--n2-bord)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
            Contrôle du {new Date(controle.evalue_le).toLocaleDateString('fr-FR')}
            {controle.centre_nom ? ` · ${controle.centre_nom}` : ''}
          </p>
          <p style={{ fontSize: 13, color: 'var(--c-muted)' }}>
            {controle.regles_controlees !== null
              ? `${controle.regles_controlees} règle(s) réellement contrôlée(s)`
              : 'couverture non enregistrée'}
          </p>
        </div>
        <FeuTricolore etat={feu} taille={13} />
      </div>

      {controle.motifs.length === 0 ? (
        <p className="mt-3" style={{ fontSize: 13, color: 'var(--sev-conforme)' }}>
          Aucune anomalie constatée lors de ce contrôle.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {controle.motifs.map(m => (
            <li key={m.codeRegle} className="pl-3" style={{
              borderLeft: `5px ${m.gravite === 'indisponible' ? 'dashed' : 'solid'} ${
                m.gravite === 'vigilance' ? 'var(--sev-vigilance)' : 'var(--sev-critique)'}` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--c-muted)', marginRight: 6 }}>
                  {m.codeRegle}
                </span>
                {m.libelle}
              </p>
              <p style={{ fontSize: 12, color: 'var(--c-text2)' }}>
                {m.detail}{m.source ? <> — <em>{m.source}</em></> : null}
              </p>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onFermer} className="mt-3" style={action('texte')}>Fermer</button>
    </div>
  );
}

// ─── Recto card ─────────────────────────────────────────────────────────────────

function CardRecto({ data, id, feu, onFeuClick }: {
  data: PasseportData; id: string;
  /** Verdict du DERNIER contrôle. Nul = jamais contrôlé, feu éteint. */
  feu?: CouleurFeu | null;
  /** Absent lors de la capture PNG : le feu redevient une image. */
  onFeuClick?: () => void;
}) {
  const { profile, licences, brevets, certificats, centresLicencies, sautsCount, validSautsCount } = data;
  const now = new Date();
  const licence = licences[0];
  const certif = certificats[0];
  const licenceExp = licence?.date_expiration ? new Date(licence.date_expiration) : null;
  const certifExp = certif?.date_expiration ? new Date(certif.date_expiration) : null;
  // Même règle que le récapitulatif du dessous : un seul calcul de statut,
  // pour que la carte et le récapitulatif ne se contredisent jamais.
  const statutLicence = getStatus(licence?.date_expiration);
  const statutMedical = getStatus(certif?.date_expiration);
  // Les FONCTIONS (largueur, DT…) ne s'affichent PAS ici : la licence est un
  // document d'identité, pas un organigramme. Elles vivent dans l'Avionnage,
  // là où la question « qui est le largueur ? » se pose vraiment.
  const brevetPrincipal = brevets[0];
  const centre = centresLicencies.find(c => c.statut === 'actif')?.centre;
  const avatar = profile.avatar_url || profile.photo_profil_url;

  const getGlobalStatus = () => {
    if (!licence || !licenceExp || !certifExp) return 'NON RENSEIGNÉ';
    if (licenceExp < now || certifExp < now) return 'EXPIRÉ';
    const w = new Date(now); w.setDate(now.getDate() + 30);
    if (licenceExp < w || certifExp < w) return 'BIENTÔT';
    return 'ACTIF';
  };
  const statut = getGlobalStatus();
  const statutColor = statut === 'ACTIF' ? '#10B981' : statut === 'BIENTÔT' ? '#F59E0B' : statut === 'EXPIRÉ' ? '#EF4444' : '#64748B';

  // Pastille reprise (récence du dernier saut selon les règles paramétrées)
  const { rules: currencyRules } = useCurrencyRules();
  const currencyStatus = getCurrencyStatus(data.dernierSautDate, brevetPrincipal?.type_brevet, currencyRules);
  const currencyCfg = CURRENCY_STATUS_CONFIG[currencyStatus];

  // Condensed info line parts
  const infoParts: string[] = [];
  const rectoNumero = licence?.numero_licence || profile.numero_licence;
  // Ligne réglementaire allégée : n° FFP + club/centre. Le brevet est désormais
  // un badge héros ; on ne le répète pas ici (évite le débordement sur 2 lignes).
  if (rectoNumero) infoParts.push(`FFP–${rectoNumero.replace(/^FFP[-–]/i, '')}`);
  if (licence?.code_club) infoParts.push(`Code Club ${licence.code_club}`);
  if (licence?.nom_club) infoParts.push(licence.nom_club);
  else if (centre) infoParts.push(centre.nom);

  return (
    <div
      id={id}
      className="relative rounded-xl overflow-hidden select-none flex flex-col"
      style={{
        minHeight: CARD_MIN_HEIGHT,
        height: '100%', // remplit la cellule du grid-stack (= hauteur de la face la plus haute)
        background: 'linear-gradient(135deg, #001A4D 0%, #0f1a30 60%, #1E3A5F 100%)',
        boxShadow: '0 10px 34px rgba(0,0,0,0.45)',
        border: '1px solid rgba(255,255,255,0.14)',
      }}
    >
      {/* Reflet « matière » en haut de carte */}
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: 90, background: 'linear-gradient(180deg, rgba(255,255,255,0.08), transparent)' }} />
      {/* Filigrane voile — signature visuelle, en bas à GAUCHE (le QR est à droite) */}
      <div className="absolute pointer-events-none" style={{ left: -22, bottom: -22, opacity: 0.07, transform: 'rotate(-8deg)' }}>
        <ParachuteIcon className="w-44 h-44 text-white" />
      </div>
      {/* Bande orange FFP */}
      <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: '#F97316' }} />

      <div className="relative flex-1 flex flex-col gap-2" style={{ padding: '14px 14px 12px' }}>

        {/* ── Row 1 : Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-7 w-auto flex-shrink-0" />
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#F97316' }}>Licence numérique FFP</div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Pastille reprise (récence) — discrète, à côté du statut documents */}
            <span
              title={`Reprise : ${currencyCfg.label}`}
              aria-label={`Reprise : ${currencyCfg.label}`}
              style={{
                width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
                background: currencyCfg.color, boxShadow: `0 0 0 2px ${currencyCfg.bg}`,
              }}
            />
            <div
              style={{
                background: statutColor,
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                padding: '3px 10px',
                borderRadius: 20,
              }}
            >
              {statut}
            </div>
          </div>
        </div>

        {/* ── Row 2 : Identité ── */}
        <div className="flex items-start gap-3">
          {/* Photo */}
          <div
            className="flex-shrink-0 flex items-center justify-center overflow-hidden"
            style={{
              width: 76, height: 76, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
            }}
          >
            {avatar ? (
              <img src={avatar} className="w-full h-full object-cover" alt="" />
            ) : (
              <User style={{ width: 32, height: 32, color: 'rgba(255,255,255,0.5)' }} />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.04em', color: '#fff', lineHeight: 1.1, textTransform: 'uppercase' }}>
              {profile.nom}
            </div>
            <div style={{ fontSize: 16, fontWeight: 400, color: '#fff', lineHeight: 1.2 }}>{profile.prenom}</div>
            <div style={{ fontSize: 12, color: '#F97316', marginTop: 1 }}>Fédération Française de Parachutisme</div>
            {(profile.date_naissance || profile.lieu_naissance) && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
                {profile.date_naissance && `Né(e) le ${new Date(profile.date_naissance).toLocaleDateString('fr-FR')}`}
                {profile.lieu_naissance && ` à ${profile.lieu_naissance}`}
              </div>
            )}
            {infoParts.length > 0 && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 3, lineHeight: 1.4 }}>
                {infoParts.join(' · ')}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 3 : HÉROS — sauts totaux (fierté) + brevet mis en avant ── */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sauts au total</div>
            {sautsCount > 0 ? (
              <>
                <div style={{ fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 0.95, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{sautsCount}</div>
                {validSautsCount < sautsCount && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>dont {validSautsCount} validés</div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', marginTop: 2 }}>Aucun saut enregistré</div>
            )}
          </div>
          {brevetPrincipal && (
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.03em', background: 'rgba(249,115,22,0.18)', color: '#FDBA74', border: '1px solid rgba(249,115,22,0.4)', padding: '5px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>
              {TYPE_BREVET_LABELS[brevetPrincipal.type_brevet] || `Brevet ${brevetPrincipal.type_brevet}`}
            </span>
          )}
        </div>

        {/* Validités — la date SEULE ne disait pas si elle était bonne :
            « Médical 30/01/2027 » se lisait sans savoir si c'était bon. La
            couleur et le mot le disent, le feu résume la décision. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1" style={{ fontSize: 11 }}>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>Licence&nbsp;</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: COULEUR_VALIDITE[statutLicence] }}>
              {licenceExp ? licenceExp.toLocaleDateString('fr-FR') : '—'}
            </span>
            <span style={{ color: COULEUR_VALIDITE[statutLicence], fontWeight: 600 }}>
              {' · '}{MOT_VALIDITE[statutLicence]}
            </span>
          </div>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>Médical&nbsp;</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: COULEUR_VALIDITE[statutMedical] }}>
              {certifExp ? certifExp.toLocaleDateString('fr-FR') : '—'}
            </span>
            <span style={{ color: COULEUR_VALIDITE[statutMedical], fontWeight: 600 }}>
              {' · '}{MOT_VALIDITE[statutMedical]}
            </span>
          </div>
          {/* Le feu : la décision du DT, résumée. Cliquable hors capture. */}
          <span className="ml-auto">
            <FeuTricolore etat={feu ?? null} onClick={onFeuClick} taille={11} />
          </span>
        </div>

        {/* ── Row 4 : Assurances ── (une mention par ligne, pas de débordement) */}
        {/* Assurances & bénéficiaire — chaque valeur en BADGE rattaché à son
            libellé (plus de « Oui » orphelin flottant à droite). */}
        {licence && (
          <div className="flex flex-col gap-1.5" style={{ fontSize: 11 }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>Assurance individuelle</span>
              <OuiNonBadge ok={licence.assurance_individuelle} />
              <span style={{ color: 'rgba(255,255,255,0.6)', marginLeft: 4 }}>Resp. civile</span>
              <OuiNonBadge ok={licence.assurance_rc} />
            </div>
            {licence.beneficiaire_nom && (
              <div style={{ color: 'rgba(255,255,255,0.6)' }}>
                Bénéficiaire :{' '}
                <span style={{ color: '#fff', fontWeight: 600 }}>
                  {licence.beneficiaire_nom}
                  {licence.beneficiaire_lien ? ` (${licence.beneficiaire_lien === 'parent' ? 'Parent' : licence.beneficiaire_lien})` : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Row 5 : Badge assurance harmonisé + QR ── */}
        <div className="flex items-end justify-between gap-3 mt-auto">
          <div className="flex items-center gap-1.5 flex-wrap">
            {licence && (
              (licence.assurance_individuelle && licence.assurance_rc) ? (
                <span className="inline-flex items-center gap-1" style={{ fontSize: 10, background: 'rgba(16,185,129,0.18)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}><ShieldCheck className="w-3 h-3" /> Assuré</span>
              ) : (
                <span className="inline-flex items-center gap-1" style={{ fontSize: 10, background: 'rgba(239,68,68,0.18)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}><ShieldX className="w-3 h-3" /> Non assuré</span>
              )
            )}
          </div>
          <div className="bg-white rounded-lg flex-shrink-0" style={{ padding: 4 }}>
            <QRCodeSVG value={`https://parapass.fr/verify/${profile.id}`} size={66} level="M" />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, marginTop: 2 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', fontFamily: 'monospace' }}>parapass.fr</div>
        </div>
      </div>
    </div>
  );
}

// ─── Verso card ─────────────────────────────────────────────────────────────────

function CardVerso({ data, id, isOwner }: { data: PasseportData; id: string; isOwner: boolean }) {
  const { profile, licences, qrToken } = data;
  const licence = licences[0];

  const numeroLicence = licence?.numero_licence || profile.numero_licence || null;

  return (
    <div
      id={id}
      className="relative rounded-xl overflow-hidden select-none flex flex-col"
      style={{
        minHeight: CARD_MIN_HEIGHT,
        height: '100%', // aligne le verso sur la hauteur du recto (fin du vide en bas)
        background: 'linear-gradient(135deg, #001A4D 0%, #0d1f3e 55%, #1a3060 100%)',
        boxShadow: '0 10px 34px rgba(0,0,0,0.45)',
        border: '1px solid rgba(255,255,255,0.14)',
      }}
    >
      {/* Reflet « matière » */}
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: 90, background: 'linear-gradient(180deg, rgba(255,255,255,0.08), transparent)' }} />
      {/* Top accent stripe — FFP orange */}
      <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: '#F97316' }} />

      {/* Filigrane voile — signature visuelle, en bas à gauche */}
      <div className="absolute pointer-events-none" style={{ left: -22, bottom: -22, opacity: 0.06, transform: 'rotate(-8deg)' }}>
        <ParachuteIcon className="w-44 h-44 text-white" />
      </div>

      {/* flex-1 + justify-between : le contenu occupe TOUTE la hauteur, aucun vide. */}
      <div className="relative flex-1 flex flex-col justify-between gap-2" style={{ padding: '12px 14px 10px' }}>

        {/* ── Row 1 : Header ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.04em', color: '#fff', lineHeight: 1.1, textTransform: 'uppercase' }}>
              {profile.nom} <span style={{ fontWeight: 400, fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>{profile.prenom}</span>
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: '#F97316', marginTop: 2 }}>Licence numérique FFP</div>
            <div style={{ fontSize: 8, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
              Fédération Française de Parachutisme
            </div>
          </div>
          <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-6 w-auto flex-shrink-0" style={{ opacity: 0.7 }} />
        </div>

        {/* ── Row 2 : Certifications (EN HAUT) ── */}
        <div className="rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '7px 10px' }}>
          <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(249,163,22,0.85)', marginBottom: 5, fontWeight: 600 }}>
            Informations de licence
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Numéro licence</div>
              <div style={{ fontSize: 12, color: '#fff', fontFamily: 'monospace', fontWeight: 700, lineHeight: 1.2 }}>
                {numeroLicence || <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Valide jusqu'au</div>
              <div style={{ fontSize: 12, color: licence?.date_expiration ? '#fff' : 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontWeight: 600, lineHeight: 1.2 }}>
                {licence?.date_expiration ? new Date(licence.date_expiration).toLocaleDateString('fr-FR') : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 3 : QR (gauche) · Signature (droite) ── */}
        <div className="flex items-center gap-4">

          {/* Gauche — QR code */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Vérification</div>
            {qrToken ? (
              <>
                <div className="bg-white rounded-xl" style={{ padding: 5, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                  <QRCodeSVG value={`${window.location.origin}/verify/${qrToken}`} size={80} level="M" />
                </div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>Scanner pour vérifier</div>
              </>
            ) : (
              <div style={{ width: 90, height: 90, background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }} />
            )}
          </div>

          {/* Droite — Signature titulaire */}
          <div className="flex flex-col gap-1 flex-1">
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Signature du titulaire</div>
            <div style={{ flex: 1, minHeight: 72, display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: 4 }}>
              {isOwner && profile.signature_url ? (
                <img src={profile.signature_url} alt="Signature" style={{ maxHeight: 68, maxWidth: '100%', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.85 }} />
              ) : (
                <div style={{ width: '100%', height: 68 }} />
              )}
            </div>
          </div>
        </div>

        {/* ── Footer : badge + url + micro-mention ── */}
        <div className="flex flex-col gap-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}>
          <div className="flex items-center justify-between">
              <span style={{ fontSize: 8, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.28)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: 20 }}>
                Non contrôlé
              </span>
            <div style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(255,255,255,0.28)' }}>parapass.fr</div>
          </div>
          <div style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.18)', lineHeight: 1.3 }}>
            Contrôle documentaire effectué par le centre, sans valeur de certification fédérale.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Flippable card ─────────────────────────────────────────────────────────────

function FlippableCard({
  feu, onFeuClick,
  data, isOwner, rectoId, versoId,
}: {
  data: PasseportData;
  isOwner: boolean;
  rectoId: string;
  versoId: string;
  /** Verdict du dernier contrôle Feu Vert. Nul = jamais contrôlé. */
  feu?: CouleurFeu | null;
  onFeuClick?: () => void;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Grid-stack container — adopts height of tallest face, no aspect-ratio clip */}
      <div
        className="relative w-full cursor-pointer"
        style={{ perspective: '1000px' }}
        onClick={() => setFlipped(f => !f)}
      >
        {/* 3D flip inner — grid so both faces stack and container = max(recto,verso) */}
        <div
          style={{
            display: 'grid',
            gridTemplateAreas: '"card"',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s ease',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Recto — face avant */}
          <div style={{ gridArea: 'card', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
            <CardRecto data={data} id={rectoId} feu={feu} onFeuClick={onFeuClick} />
          </div>

          {/* Verso — face arrière */}
          <div
            style={{
              gridArea: 'card',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <CardVerso data={data} id={versoId} isOwner={isOwner} />
          </div>
        </div>
      </div>

      {/* Flip button */}
      <div className="mt-2 flex justify-center">
        <button
          onClick={() => setFlipped(f => !f)}
          className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors w-full sm:w-auto"
          style={{ minHeight: 44, padding: '0 16px' }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {flipped ? 'Voir le recto' : 'Retourner la carte'}
        </button>
      </div>
    </div>
  );
}

// ─── PDF export ─────────────────────────────────────────────────────────────────
// Renders CardRecto + CardVerso into a clean off-screen div via createRoot
// — no FlippableCard wrapper, no 3D transforms, no mirror artifacts.

async function exportCartesPDF(data: PasseportData, isOwner: boolean, nom: string, prenom: string) {
  const CARD_W = 520;

  const captureComponent = (
    component: React.ReactElement,
    elId: string,
  ): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      const host = document.createElement('div');
      host.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: ${CARD_W}px;
        pointer-events: none;
        z-index: -1;
      `;
      document.body.appendChild(host);
      const root = createRoot(host);
      root.render(component);

      // Wait one frame for React to flush, then another for images
      requestAnimationFrame(() => {
        setTimeout(async () => {
          const el = document.getElementById(elId);
          if (!el) {
            root.unmount();
            document.body.removeChild(host);
            reject(new Error(`Element #${elId} not found`));
            return;
          }
          try {
            const canvas = await html2canvas(el, {
              scale: 3,
              useCORS: true,
              allowTaint: false,
              backgroundColor: null,
              logging: false,
              imageTimeout: 15000,
            });
            resolve(canvas);
          } catch (err) {
            reject(err);
          } finally {
            root.unmount();
            document.body.removeChild(host);
          }
        }, 400);
      });
    });
  };

  const rectoId = 'pdf-export-recto';
  const versoId = 'pdf-export-verso';

  const [canvasRecto, canvasVerso] = await Promise.all([
    captureComponent(<CardRecto data={data} id={rectoId} />, rectoId),
    captureComponent(<CardVerso data={data} id={versoId} isOwner={isOwner} />, versoId),
  ]);

  // Derive mm dimensions from actual rendered pixels (96 dpi → 0.2646 mm/px)
  const W_MM = (canvasRecto.width / 3) * 0.2646;
  const H_MM = (canvasRecto.height / 3) * 0.2646;
  const orientation = W_MM >= H_MM ? 'landscape' : 'portrait';

  const pdf = new jsPDF({ unit: 'mm', format: [W_MM, H_MM], orientation });
  pdf.addImage(canvasRecto.toDataURL('image/jpeg', 0.97), 'JPEG', 0, 0, W_MM, H_MM);
  pdf.addPage([W_MM, H_MM], orientation);
  pdf.addImage(canvasVerso.toDataURL('image/jpeg', 0.97), 'JPEG', 0, 0, W_MM, H_MM);
  pdf.save(`ParaPass-${nom.toUpperCase()}-${prenom}-${new Date().getFullYear()}.pdf`);
}

// ─── Validity summary ───────────────────────────────────────────────────────────

/**
 * Le DERNIER CONTRÔLE Feu Vert — un acte daté, pas une couleur du moment.
 *
 * Une couleur instantanée se recalcule à chaque affichage et ne prouve rien :
 * elle dit « en ce moment, les documents en base sont valides ». Un contrôle
 * dit « le 07/09/2026, BigAir a vérifié, et voici ce qui a été constaté ».
 * C'est le second qui est opposable — et il est chaîné au journal.
 *
 * Nul tant qu'aucun scan n'a eu lieu : la licence affiche alors « jamais
 * contrôlée », ce qui est la vérité.
 */
export interface DernierControleFeuVert {
  evalue_le: string;
  verdict: 'vert' | 'orange' | 'rouge' | 'gris';
  centre_nom: string | null;
  /** Nombre de règles ayant réellement contrôlé quelque chose. */
  regles_controlees: number | null;
  /** Ce qui a été constaté. Aucun contenu médical : seulement des dates et
   *  des états (P5). C'est ce que le panneau d'anomalies affiche. */
  motifs: { codeRegle: string; libelle: string; detail: string; source: string; gravite: string }[];
}

const FEU_VERT_LIBELLE: Record<DernierControleFeuVert['verdict'], { texte: string; statut: 'valide' | 'expire' | 'bientot' | 'manquant' }> = {
  vert:   { texte: 'Conforme',         statut: 'valide' },
  orange: { texte: 'Vigilance',        statut: 'bientot' },
  rouge:  { texte: 'Non conforme',     statut: 'expire' },
  gris:   { texte: 'Donnée manquante', statut: 'manquant' },
};

function ValiditySummary({ data, feuVert }: { data: PasseportData; feuVert?: DernierControleFeuVert | null | 'jamais' }) {
  const licence = data.licences[0];
  const certif = data.certificats[0];
  const licStatus = getStatus(licence?.date_expiration);
  const medStatus = getStatus(certif?.date_expiration);
  const licDays = daysLeft(licence?.date_expiration);
  const medDays = daysLeft(certif?.date_expiration);
  const activeLicencie = data.centresLicencies.find(c => c.statut === 'actif');
  const carnetValide = activeLicencie?.carnet_statut === 'valide' || licence?.tampon_statut === 'valide';

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Récapitulatif des validités</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm text-gray-700">Licence FFP</span>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {licence?.date_expiration && (
              <span className="text-xs text-gray-400 font-mono">{new Date(licence.date_expiration).toLocaleDateString('fr-FR')}</span>
            )}
            <StatusPill status={licStatus} days={licDays} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm text-gray-700">Certificat médical</span>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {certif?.date_expiration && (
              <span className="text-xs text-gray-400 font-mono">{new Date(certif.date_expiration).toLocaleDateString('fr-FR')}</span>
            )}
            <StatusPill status={medStatus} days={medDays} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-gray-700">Assurance</span>
          <StatusPill status={licence?.assurance_individuelle && licence?.assurance_rc ? 'valide' : 'expire'} days={null} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-gray-700">Validation carnet DZ</span>
          <StatusPill status={carnetValide ? 'valide' : 'manquant'} days={null} />
        </div>
        {/* « Contrôle documentaire DZ » a disparu : c'était une case à cocher
            manuelle (3 usages depuis juillet) pour attester d'avoir vu des
            papiers. Feu Vert établit la même chose sur 14 règles, cite le
            texte fédéral et le consigne dans un journal chaîné. Un seul acte,
            une seule trace, opposable. La ligne n'apparaît qu'en contexte
            CENTRE : le parachutiste voit ses validités, pas un jugement. */}
        {feuVert && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm text-gray-700">Dernier contrôle Feu Vert</span>
            {feuVert === 'jamais' ? (
              <StatusPill status="manquant" days={null} />
            ) : (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="text-xs text-gray-400 font-mono">
                  {new Date(feuVert.evalue_le).toLocaleDateString('fr-FR')}
                  {feuVert.centre_nom ? ` · ${feuVert.centre_nom}` : ''}
                  {feuVert.regles_controlees !== null ? ` · ${feuVert.regles_controlees} règle(s) contrôlée(s)` : ''}
                </span>
                <StatusPill status={FEU_VERT_LIBELLE[feuVert.verdict].statut} days={null} />
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-[10px] text-gray-400 text-right">
        Données à jour au {data.loadedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}

// ─── Fullscreen modal ────────────────────────────────────────────────────────────

function FullscreenModal({
  data, onClose, isOwner,
}: {
  data: PasseportData;
  onClose: () => void;
  isOwner: boolean;
}) {
  const rectoId = 'fs-recto';
  const versoId = 'fs-verso';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: '#001A4D' }}>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition">
        <X className="w-6 h-6" />
      </button>
      <div className="w-full max-w-md">
        <FlippableCard data={data} isOwner={isOwner} rectoId={rectoId} versoId={versoId} />
        <div className="mt-3 flex justify-center gap-3">
          <button
            onClick={() => exportCartesPDF(data, isOwner, data.profile.nom, data.profile.prenom)}
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/10"
          >
            <Download className="w-3.5 h-3.5" /> Télécharger PDF
          </button>
        </div>
        <div className="mt-2 text-center">
          <p className="text-white/40 text-xs">Vue terrain — {data.profile.prenom} {data.profile.nom}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

interface PasseportCardViewProps {
  userId: string;
  centreId?: string;
  adminId?: string;
  compact?: boolean; // dashboard mode — card only, no action buttons or validity summary
  sautsCountOverride?: number;
  validSautsCountOverride?: number;
}

export function PasseportCardView({ userId, centreId, adminId, compact = false, sautsCountOverride, validSautsCountOverride }: PasseportCardViewProps) {
  const [data, setData] = useState<PasseportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isOwner = !adminId || adminId === userId;
  // Contexte CENTRE : la fiche est ouverte par un admin sur quelqu'un d'autre.
  const contexteCentre = Boolean(centreId) && !isOwner;
  const [feuVert, setFeuVert] = useState<DernierControleFeuVert | null | 'jamais'>(null);
  const [anomaliesOuvertes, setAnomalies] = useState(false);
  // DEUX CHOSES DISTINCTES, et il a fallu les séparer :
  //   • le FEU montre l'état COURANT (verdicts_du_jour). C'est lui qu'on
  //     regarde tous les jours, et il doit être allumé même avant le premier
  //     scan — sinon il ne sert à rien ;
  //   • la ligne « dernier contrôle » montre l'ACTE daté, opposable.
  // Confondre les deux laissait le feu éteint pour tout le monde.
  const [etatCourant, setEtatCourant] = useState<CouleurFeu | null>(null);
  // Éteint tant qu'on ne sait pas. On n'allume jamais le vert par défaut.
  const feu: CouleurFeu | null = etatCourant;

  useEffect(() => {
    if (!contexteCentre || !centreId) { setFeuVert(null); return; }
    let vivant = true;
    // On lit une TRACE, pas un calcul : la dernière évaluation écrite pour
    // cette personne. La RLS d'evaluations donne au centre les siennes et au
    // parachutiste les siennes ; personne ne voit celles d'un autre centre.
    // L'état courant, pour la lampe.
    supabase.rpc('verdicts_du_jour', { p_centre_id: centreId, p_ids: [userId] })
      .then(({ data: v, error }) => {
        if (!vivant) return;
        if (error) {
          console.error('Feu Vert — état courant non lu :', {
            code: error.code, message: error.message, details: error.details, hint: error.hint,
          });
          setEtatCourant(null); return;   // une panne n'allume rien
        }
        const r = (v ?? [])[0] as { verdict?: CouleurFeu } | undefined;
        setEtatCourant(r?.verdict ?? null);
      });

    // L'acte daté, pour la ligne du récapitulatif et le panneau.
    supabase.from('evaluations')
      .select('evalue_le, verdict, regles_controlees, motifs, centres(nom)')
      .eq('parachutiste_id', userId).eq('centre_id', centreId)
      .order('evalue_le', { ascending: false }).limit(1)
      .then(({ data, error }) => {
        if (!vivant) return;
        if (error) {
          console.error('Feu Vert — dernier contrôle non lu :', {
            code: error.code, message: error.message, details: error.details, hint: error.hint,
          });
          // Une lecture en échec n'affiche rien plutôt qu'un « jamais
          // contrôlé » qui serait une affirmation, pas un constat.
          setFeuVert(null); return;
        }
        const e = data?.[0];
        if (!e) { setFeuVert('jamais'); return; }
        const c = e.centres as { nom?: string } | { nom?: string }[] | null;
        setFeuVert({
          evalue_le: e.evalue_le,
          verdict: e.verdict as DernierControleFeuVert['verdict'],
          centre_nom: (Array.isArray(c) ? c[0]?.nom : c?.nom) ?? null,
          regles_controlees: e.regles_controlees ?? null,
          motifs: Array.isArray(e.motifs) ? e.motifs as DernierControleFeuVert['motifs'] : [],
        });
      });
    return () => { vivant = false; };
  }, [contexteCentre, centreId, userId]);
  const rectoId = `card-recto-${userId}`;
  const versoId = `card-verso-${userId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: profileData },
        { data: licencesData },
        { data: brevetsData },
        { data: certsData },
        { data: centresData },
        { data: qualsData },
        { data: snapshotData },
        { data: qrData },
        { data: dernierSautData },
        { data: controleData },
        { data: dernierSautDateData },
      ] = await Promise.all([
        supabase.from('profiles').select('id, nom, prenom, avatar_url, photo_profil_url, numero_licence, date_naissance, lieu_naissance, partage_carte_centre, signature_url').eq('id', userId).maybeSingle(),
        supabase.from('licences').select('*').eq('parachutiste_id', userId).order('date_expiration', { ascending: false }),
        supabase.from('brevets').select('*').eq('parachutiste_id', userId).order('date_obtention', { ascending: false }),
        supabase.from('certificats_medicaux').select('*').eq('parachutiste_id', userId).order('date_expiration', { ascending: false }),
        supabase.from('licencies_centres').select('*, centre:centres(id, nom, ville, created_at)').eq('parachutiste_id', userId),
        supabase.from('qualifications').select('*').eq('parachutiste_id', userId),
        // Source unique de vérité (Prompt N) : plus de comptage inline ici.
        supabase.rpc('get_regulatory_snapshot', { p_user_id: userId }).maybeSingle(),
        supabase.from('qr_tokens').select('token').eq('parachutiste_id', userId).order('created_at', { ascending: false }).limit(1),
        supabase.from('sauts').select('valide_par, valide_le, lieu').eq('parachutiste_id', userId).eq('statut', 'valide').order('valide_le', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('controle_documents').select('controle_le, licence_ok, medical_ok, assurance_ok, note, controle_par_nom, centre_nom').eq('licencie_id', userId).order('controle_le', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('sauts').select('date_saut').eq('parachutiste_id', userId).eq('is_tunnel', false).order('date_saut', { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (!profileData) { setLoading(false); return; }

      let tamponConfig: TamponConfig | null = null;
      let centreInfo: CentreData | null = null;
      const resolvedCentreId = centreId ?? (centresData ?? []).find((c: Record<string, unknown>) => c.statut === 'actif')?.centre_id;

      if (resolvedCentreId) {
        const { data: ci } = await supabase
          .from('centres')
          .select('id, nom, nom_dt, tampon_nom_officiel, tampon_couleur_primaire, tampon_couleur_texte, tampon_logo_url, tampon_numero_agrement, signature_dt_url, logo_url')
          .eq('id', resolvedCentreId)
          .maybeSingle();
        if (ci) {
          centreInfo = ci as CentreData;
          const logoUrl = ci.tampon_logo_url
            ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/parapass-docs/${ci.tampon_logo_url}`
            : null;
          tamponConfig = {
            nomDZ: ci.tampon_nom_officiel || ci.nom,
            numeroAgrement: ci.tampon_numero_agrement ?? '',
            couleurPrimaire: ci.tampon_couleur_primaire ?? '#001A4D',
            couleurTexte: ci.tampon_couleur_texte ?? '#ffffff',
            logoUrl,
          };
        }
      }

      setData({
        profile: profileData as ProfileData,
        licences: (licencesData ?? []) as Licence[],
        brevets: (brevetsData ?? []) as Brevet[],
        certificats: (certsData ?? []) as CertificatMedical[],
        centresLicencies: (centresData ?? []) as CentreLicencie[],
        qualifications: (qualsData ?? []) as Qualification[],
        sautsCount: (snapshotData as { total?: number } | null)?.total ?? 0,
        validSautsCount: (snapshotData as { valid?: number } | null)?.valid ?? 0,
        qrToken: qrData?.[0]?.token ?? null,
        tamponConfig,
        centre: centreInfo,
        loadedAt: new Date(),
        dernierSautValide: dernierSautData as { valide_par: string | null; valide_le: string | null; lieu: string | null } | null,
        dernierSautDate: (dernierSautDateData as { date_saut: string } | null)?.date_saut ?? null,
        dernierControle: controleData ? {
          controle_le: (controleData as Record<string, unknown>).controle_le as string,
          licence_ok: (controleData as Record<string, unknown>).licence_ok as boolean,
          medical_ok: (controleData as Record<string, unknown>).medical_ok as boolean,
          assurance_ok: (controleData as Record<string, unknown>).assurance_ok as boolean,
          note: (controleData as Record<string, unknown>).note as string | null,
          centre_nom: (controleData as Record<string, unknown>).centre_nom as string | null,
          controle_par_nom: (controleData as Record<string, unknown>).controle_par_nom as string | null,
        } : null,
      });

      if (centreId && adminId && adminId !== userId) {
        await supabase.from('journal_acces_cartes').insert({
          parachutiste_id: userId,
          consulte_par_id: adminId,
          centre_id: centreId,
        });
      }
    } catch (e) {
      console.error('PasseportCardView load error:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, centreId, adminId]);

  useEffect(() => { load(); }, [load]);

  const handleExportPDF = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const d = { ...data, sautsCount: sautsCountOverride ?? data.sautsCount, validSautsCount: validSautsCountOverride ?? data.validSautsCount };
      await exportCartesPDF(d, isOwner, d.profile.nom, d.profile.prenom);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-4 border-[#001A4D] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-400">Chargement de la carte...</p>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-gray-400 text-sm">Impossible de charger les données</div>;
  }

  // Apply parent overrides at render time — avoids race with async load() overwriting them
  const displayData: PasseportData = {
    ...data,
    sautsCount: sautsCountOverride ?? data.sautsCount,
    validSautsCount: validSautsCountOverride ?? data.validSautsCount,
  };

  if (!data.profile.partage_carte_centre && adminId && adminId !== userId) {
    return (
      <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-200 space-y-3">
        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
          <Eye className="w-6 h-6 text-gray-400" />
        </div>
        <p className="font-medium text-gray-700">Partage désactivé</p>
        <p className="text-sm text-gray-500">Ce licencié a désactivé le partage de sa carte.</p>
      </div>
    );
  }

  // Compact mode (dashboard): card only, no action buttons or validity summary
  if (compact) {
    return (
      <>
      <div className="w-full" style={{ maxWidth: 480 }}>
        <FlippableCard data={displayData} isOwner={isOwner} rectoId={rectoId} versoId={versoId}
          feu={feu} onFeuClick={contexteCentre ? () => setAnomalies(o => !o) : undefined} />
      </div>

      {anomaliesOuvertes && (
        feuVert && feuVert !== 'jamais'
          ? <PanneauAnomalies controle={feuVert} feu={feu} onFermer={() => setAnomalies(false)} />
          : <PanneauSansControle feu={feu} onFermer={() => setAnomalies(false)} />
      )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-col gap-2">
        {/* Shield badge */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Shield className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Données à jour en temps réel</span>
        </div>
        {/* Buttons — PDF full width on mobile, then row */}
        {isOwner && (
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white w-full rounded-xl transition disabled:opacity-50 sm:hidden"
            style={{ background: '#2563EB', minHeight: 48 }}
          >
            <Download className="w-4 h-4 flex-shrink-0" />
            {exporting ? 'Export…' : 'Télécharger PDF'}
          </button>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex-1 sm:flex-none sm:px-3"
            style={{ minHeight: 44 }}
          >
            <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" /> Actualiser
          </button>
          {isOwner && (
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="hidden sm:flex items-center justify-center gap-1.5 text-xs text-white px-3 rounded-lg transition disabled:opacity-50"
              style={{ background: '#2563EB', minHeight: 44 }}
            >
              <Download className="w-3.5 h-3.5 flex-shrink-0" />
              {exporting ? 'Export…' : 'Télécharger PDF'}
            </button>
          )}
          <button
            onClick={() => setFullscreen(true)}
            className="flex items-center justify-center gap-1.5 text-xs text-white bg-[#001A4D] hover:bg-[#001A4D]/90 rounded-lg transition flex-1 sm:flex-none sm:px-3"
            style={{ minHeight: 44 }}
          >
            <Maximize2 className="w-3.5 h-3.5 flex-shrink-0" /> Plein écran
          </button>
        </div>
      </div>

      {/* Flippable card */}
      <FlippableCard data={displayData} isOwner={isOwner} rectoId={rectoId} versoId={versoId} />

      {/* Validity summary */}
      <ValiditySummary data={displayData} feuVert={feuVert} />
      {anomaliesOuvertes && feuVert && feuVert !== 'jamais' && (
        <PanneauAnomalies controle={feuVert} feu={feu} onFermer={() => setAnomalies(false)} />
      )}

      {/* Fullscreen modal */}
      {fullscreen && <FullscreenModal data={displayData} onClose={() => setFullscreen(false)} isOwner={isOwner} />}
    </div>
  );
}
