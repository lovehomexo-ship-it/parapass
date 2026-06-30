import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from '../lib/supabase';
import { ParachuteIcon } from './ParachuteIcon';
import { TamponDZ } from './TamponDZ';
import type { TamponConfig } from './TamponDZ';
import { TYPE_BREVET_LABELS } from '../lib/types';
import type { Licence, Brevet, CertificatMedical, CentreLicencie, Qualification } from '../lib/types';
import { QRCodeSVG } from 'qrcode.react';
import { User, RefreshCw, Maximize2, X, AlertTriangle, CheckCircle, Clock, Shield, Eye, Download, RotateCcw } from 'lucide-react';
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

interface PasseportData {
  profile: ProfileData;
  licences: Licence[];
  brevets: Brevet[];
  certificats: CertificatMedical[];
  centresLicencies: CentreLicencie[];
  qualifications: Qualification[];
  sautsCount: number;
  qrToken: string | null;
  tamponConfig: TamponConfig | null;
  centre: CentreData | null;
  loadedAt: Date;
  dernierSautValide: { valide_par: string | null; valide_le: string | null; lieu: string | null } | null;
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

// ─── Cachet SVG officiel ────────────────────────────────────────────────────────

function CachetSVG({ nomCentre, nomDT, couleur = '#1D4ED8' }: { nomCentre: string; nomDT: string; couleur?: string }) {
  const cleanNom = nomCentre.toUpperCase().slice(0, 30);
  const cleanDT = nomDT.toUpperCase().slice(0, 24);
  return (
    <svg width="160" height="80" viewBox="0 0 160 80" style={{ overflow: 'visible' }}>
      <ellipse cx="80" cy="40" rx="75" ry="35" fill="none" stroke={couleur} strokeWidth="2" />
      <ellipse cx="80" cy="40" rx="70" ry="30" fill="none" stroke={couleur} strokeWidth="1" />
      <path id="arc-haut-cachet" d="M 15,40 A 65,30 0 0,1 145,40" fill="none" />
      <text fontSize="9" fill={couleur} fontWeight="bold" fontFamily="sans-serif">
        <textPath href="#arc-haut-cachet" startOffset="50%" textAnchor="middle">
          {cleanNom}
        </textPath>
      </text>
      <text x="80" y="37" textAnchor="middle" fontSize="7" fill={couleur} fontWeight="bold" fontFamily="sans-serif">
        DIRECTEUR TECHNIQUE
      </text>
      <path id="arc-bas-cachet" d="M 15,40 A 65,30 0 0,0 145,40" fill="none" />
      <text fontSize="8" fill={couleur} fontFamily="sans-serif">
        <textPath href="#arc-bas-cachet" startOffset="50%" textAnchor="middle">
          {cleanDT}
        </textPath>
      </text>
    </svg>
  );
}

// ─── Recto card ─────────────────────────────────────────────────────────────────

function CardRecto({ data, id }: { data: PasseportData; id: string }) {
  const { profile, licences, brevets, certificats, centresLicencies, sautsCount, qrToken, tamponConfig } = data;
  const now = new Date();
  const licence = licences[0];
  const certif = certificats[0];
  const licenceExp = licence?.date_expiration ? new Date(licence.date_expiration) : null;
  const certifExp = certif?.date_expiration ? new Date(certif.date_expiration) : null;
  const brevetPrincipal = brevets[0];
  const centre = centresLicencies.find(c => c.statut === 'actif')?.centre;
  const activeLicencie = centresLicencies.find(c => c.statut === 'actif');
  const carnetValide = activeLicencie?.carnet_statut === 'valide' || licence?.tampon_statut === 'valide';
  const validationDzDate = activeLicencie?.carnet_date_validation ?? null;
  const validateurNom = activeLicencie?.carnet_valide_par || licence?.tampon_valide_par || null;
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

  // Condensed info line parts
  const infoParts: string[] = [];
  if (profile.numero_licence) infoParts.push(`FFP–${profile.numero_licence}`);
  if (licence?.code_club) infoParts.push(`Code Club ${licence.code_club}`);
  if (brevetPrincipal) infoParts.push(TYPE_BREVET_LABELS[brevetPrincipal.type_brevet] || `Brevet ${brevetPrincipal.type_brevet}`);
  if (licence?.nom_club) infoParts.push(licence.nom_club);
  if (centre) infoParts.push(centre.nom);

  return (
    <div
      id={id}
      className="relative rounded-xl overflow-hidden select-none"
      style={{
        background: 'linear-gradient(135deg, #001A4D 0%, #0f1a30 60%, #1E3A5F 100%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        minHeight: 320,
      }}
    >
      {/* Filigrane */}
      <div className="absolute inset-0 flex items-center justify-end opacity-[0.06] pointer-events-none pr-3">
        <ParachuteIcon className="w-48 h-48 text-white" />
      </div>
      {/* Bande orange FFP */}
      <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: '#F97316' }} />

      <div className="relative flex flex-col gap-2" style={{ padding: '14px 14px 12px', minHeight: 'calc(320px - 6px)', justifyContent: 'space-between' }}>

        {/* ── Row 1 : Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-7 w-auto flex-shrink-0" />
            <div>
              <div style={{ fontSize: 10, color: 'rgba(147,197,253,0.9)', letterSpacing: '0.04em' }}>Carnet de sauts numérique</div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#F97316' }}>CARNET OFFICIEL FFP</div>
            </div>
          </div>
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

        {/* ── Row 3 : Data grid ── */}
        <div
          className="grid gap-x-3"
          style={{ gridTemplateColumns: licenceExp && certifExp ? '1fr 1fr 1fr' : licenceExp || certifExp ? '1fr 1fr' : '1fr' }}
        >
          {licenceExp && (
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Validité licence</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: licenceExp < now ? '#F87171' : '#fff', fontFamily: 'monospace', lineHeight: 1.3 }}>
                {licenceExp.toLocaleDateString('fr-FR')}
              </div>
            </div>
          )}
          {certifExp && (
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cert. méd.</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: certifExp < now ? '#F87171' : '#fff', fontFamily: 'monospace', lineHeight: 1.3 }}>
                {certifExp.toLocaleDateString('fr-FR')}
              </div>
            </div>
          )}
          {sautsCount > 0 && (
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sauts totaux</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{sautsCount}</div>
            </div>
          )}
        </div>

        {/* ── Row 4 : Assurances ── */}
        {licence && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            <span>Assurance indiv.&nbsp;</span>
            <span style={{ color: licence.assurance_individuelle ? '#34D399' : '#F87171', fontWeight: 600 }}>
              {licence.assurance_individuelle ? '✓ OUI' : '✗ NON'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>&nbsp;·&nbsp;</span>
            <span>Resp. civile&nbsp;</span>
            <span style={{ color: licence.assurance_rc ? '#34D399' : '#F87171', fontWeight: 600 }}>
              {licence.assurance_rc ? '✓ OUI' : '✗ NON'}
            </span>
            {licence.beneficiaire_nom && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>&nbsp;·&nbsp;</span>
                <span style={{ color: 'rgba(255,255,255,0.55)' }}>Bénéficiaire&nbsp;</span>
                <span style={{ color: '#fff' }}>
                  {licence.beneficiaire_nom}
                  {licence.beneficiaire_lien ? ` (${licence.beneficiaire_lien === 'parent' ? 'Parent' : licence.beneficiaire_lien})` : ''}
                </span>
              </>
            )}
          </div>
        )}

        {/* ── Row 5 : Badges + QR ── */}
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {licence && (
              (licence.assurance_individuelle && licence.assurance_rc) ? (
                <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.18)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>✓ Assuré</span>
              ) : (
                <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.18)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>✗ Non assuré</span>
              )
            )}
            {carnetValide ? (
              <div className="flex items-center gap-1">
                {tamponConfig && (
                  <TamponDZ config={{ ...tamponConfig, rotation: -1.5, opacity: 0.9, dateValidation: validationDzDate ?? undefined }} className="w-6 h-6" stampEffect />
                )}
                <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.18)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                  ✓ Validé par {validateurNom || 'DZ'}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 20 }}>Non validé</span>
            )}
          </div>
          <div className="bg-white rounded-lg flex-shrink-0" style={{ padding: 4 }}>
            <QRCodeSVG value={`https://parapass.fr/verify/${profile.id}`} size={66} level="M" />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, marginTop: 2 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Conforme DGAC</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', fontFamily: 'monospace' }}>parapass.fr</div>
        </div>
      </div>
    </div>
  );
}

// ─── Verso card ─────────────────────────────────────────────────────────────────

function CardVerso({ data, id, isOwner }: { data: PasseportData; id: string; isOwner: boolean }) {
  const { profile, licences, centresLicencies, qrToken, centre, tamponConfig, dernierSautValide } = data;
  const licence = licences[0];
  const activeLicencie = centresLicencies.find(c => c.statut === 'actif');

  const numeroLicence = licence?.numero_licence || profile.numero_licence || null;
  const nomCentre = centre?.tampon_nom_officiel || centre?.nom || 'CENTRE';
  const nomDT = activeLicencie?.carnet_valide_par || licence?.tampon_valide_par || centre?.nom_dt || 'DIRECTEUR TECHNIQUE';
  const couleurCachet = centre?.tampon_couleur_primaire || '#1D4ED8';

  const signatureDtUrl = activeLicencie?.carnet_signature_url
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/parapass-docs/${activeLicencie.carnet_signature_url}`
    : centre?.signature_dt_url
      ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/parapass-docs/${centre.signature_dt_url}`
      : null;
  const logoUrl = centre?.logo_url
    ? (centre.logo_url.startsWith('/') || centre.logo_url.startsWith('http') ? centre.logo_url : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/centre-logos/${centre.logo_url}`)
    : null;

  // "Validé par" — prefer carnet DZ data, fallback to tampon then last saut
  const validateurNom = activeLicencie?.carnet_valide_par
    || licence?.tampon_valide_par
    || dernierSautValide?.valide_par
    || centre?.nom_dt
    || null;

  // "Validation DZ" date — prefer carnet DZ, fallback to tampon then last saut valide_le
  const validationDzDate = activeLicencie?.carnet_date_validation
    || licence?.tampon_date_validation
    || dernierSautValide?.valide_le
    || null;

  const carnetValide = activeLicencie?.carnet_statut === 'valide' || licence?.tampon_statut === 'valide';

  return (
    <div
      id={id}
      className="relative rounded-xl overflow-hidden select-none"
      style={{
        background: 'linear-gradient(135deg, #001A4D 0%, #0d1f3e 55%, #1a3060 100%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        minHeight: 320,
      }}
    >
      {/* Top accent stripe — FFP orange */}
      <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: '#F97316' }} />

      {/* Background watermark */}
      <div className="absolute inset-0 flex items-center justify-end opacity-[0.04] pointer-events-none pr-2">
        <ParachuteIcon className="w-48 h-48 text-white" />
      </div>

      <div className="relative flex flex-col gap-2" style={{ padding: '14px 14px 12px', minHeight: 'calc(320px - 6px)', justifyContent: 'space-between' }}>

        {/* ── Row 1 : Header ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '0.04em', color: '#fff', lineHeight: 1.1, textTransform: 'uppercase' }}>
              {profile.nom} <span style={{ fontWeight: 400, fontSize: 14, textTransform: 'none', letterSpacing: 0 }}>{profile.prenom}</span>
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#F97316', marginTop: 2 }}>CARNET OFFICIEL FFP</div>
            <div style={{ fontSize: 9, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
              Fédération Française de Parachutisme
            </div>
          </div>
          <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-7 w-auto flex-shrink-0" style={{ opacity: 0.7 }} />
        </div>

        {/* ── Row 2 : Cachet + QR ── */}
        <div className="flex items-start gap-4">

          {/* Cachet DZ */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0" style={{ minWidth: 96 }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Cachet DZ</div>
            <div
              className="flex items-center justify-center overflow-hidden"
              style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                border: `2px solid ${couleurCachet}40`,
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo DZ" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />
              ) : tamponConfig ? (
                <TamponDZ
                  config={{ ...tamponConfig, rotation: 0, opacity: 0.95, dateValidation: licence?.tampon_date_validation ?? undefined }}
                  className="w-full h-full"
                  stampEffect
                />
              ) : (
                <CachetSVG nomCentre={nomCentre} nomDT={nomDT} couleur={couleurCachet} />
              )}
            </div>

            {/* Signature validateur */}
            <div className="flex flex-col items-center gap-0.5" style={{ width: 96 }}>
              {signatureDtUrl ? (
                <img
                  src={signatureDtUrl}
                  alt="Signature DT"
                  style={{ height: 44, maxWidth: 96, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.75 }}
                />
              ) : (
                <div style={{ width: 80, height: 28, borderBottom: '1px dashed rgba(255,255,255,0.2)' }} />
              )}
              {validateurNom && (
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.3 }}>
                  {validateurNom}
                </div>
              )}
            </div>
          </div>

          {/* QR code */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Vérification</div>
            {qrToken ? (
              <>
                <div
                  className="bg-white rounded-xl flex-shrink-0"
                  style={{ padding: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                >
                  <QRCodeSVG value={`${window.location.origin}/verify/${qrToken}`} size={88} level="M" />
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>Scanner pour vérifier</div>
              </>
            ) : (
              <div style={{ flex: 1 }} />
            )}
          </div>
        </div>

        {/* ── Row 3 : Certifications ── */}
        <div
          className="rounded-lg"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px' }}
        >
          <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(249,163,22,0.85)', marginBottom: 8, fontWeight: 600 }}>
            Informations de certification
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Numéro licence</div>
              <div style={{ fontSize: 14, color: '#fff', fontFamily: 'monospace', fontWeight: 700, lineHeight: 1.2 }}>
                {numeroLicence || <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Validé par</div>
              {signatureDtUrl ? (
                <div>
                  <img
                    src={signatureDtUrl}
                    alt="Signature DT"
                    style={{ height: 28, maxWidth: 110, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.8 }}
                  />
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', lineHeight: 1.2, marginTop: 1 }}>
                    {validateurNom}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, lineHeight: 1.2 }}>
                  {validateurNom || <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Valide jusqu'au</div>
              <div style={{ fontSize: 14, color: licence?.date_expiration ? '#fff' : 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontWeight: 600, lineHeight: 1.2 }}>
                {licence?.date_expiration ? new Date(licence.date_expiration).toLocaleDateString('fr-FR') : '—'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Validation DZ</div>
              <div style={{ fontSize: 14, color: validationDzDate ? '#fff' : 'rgba(255,255,255,0.3)', fontFamily: 'monospace', lineHeight: 1.2 }}>
                {validationDzDate ? new Date(validationDzDate).toLocaleDateString('fr-FR') : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 4 : Signature titulaire ── */}
        <div className="flex items-end gap-3">
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0, paddingBottom: 2 }}>Signature du titulaire</div>
          {isOwner && profile.signature_url ? (
            <img
              src={profile.signature_url}
              alt="Signature"
              style={{ height: 56, maxWidth: 160, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.8 }}
            />
          ) : (
            <div style={{ flex: 1, height: 32, borderBottom: '1px dashed rgba(255,255,255,0.2)', maxWidth: 160 }} />
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, marginTop: 2 }}>
          <div className="flex items-center justify-center" style={{ marginBottom: 5 }}>
            <img src="/logo-ffp-footer.png" alt="FFP" style={{ height: 18, width: 'auto', opacity: 0.8 }} />
          </div>
          <div className="flex items-center justify-between">
            <span
              style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                background: 'rgba(16,185,129,0.12)', color: '#34D399',
                border: '1px solid rgba(16,185,129,0.22)', padding: '2px 8px', borderRadius: 20,
              }}
            >
              ✓ Conforme DGAC
            </span>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.28)' }}>parapass.fr</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Flippable card ─────────────────────────────────────────────────────────────

function FlippableCard({
  data, isOwner, rectoId, versoId,
}: {
  data: PasseportData;
  isOwner: boolean;
  rectoId: string;
  versoId: string;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="w-full max-w-lg mx-auto overflow-hidden">
      {/* Perspective container */}
      <div
        className="relative w-full cursor-pointer"
        style={{ perspective: '1000px' }}
        onClick={() => setFlipped(f => !f)}
      >
        <div
          className="relative w-full"
          style={{
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s ease',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            minHeight: 320,
          }}
        >
          {/* Recto — face avant */}
          <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
            <CardRecto data={data} id={rectoId} />
          </div>

          {/* Verso — face arrière */}
          <div
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
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

function ValiditySummary({ data }: { data: PasseportData }) {
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
          <span className="text-sm text-gray-700">Validation DZ</span>
          <StatusPill status={carnetValide ? 'valide' : 'manquant'} days={null} />
        </div>
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
}

export function PasseportCardView({ userId, centreId, adminId }: PasseportCardViewProps) {
  const [data, setData] = useState<PasseportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isOwner = !adminId || adminId === userId;
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
        { count: sautsCountData },
        { data: qrData },
        { data: dernierSautData },
      ] = await Promise.all([
        supabase.from('profiles').select('id, nom, prenom, avatar_url, photo_profil_url, numero_licence, date_naissance, lieu_naissance, partage_carte_centre, signature_url').eq('id', userId).maybeSingle(),
        supabase.from('licences').select('*').eq('parachutiste_id', userId).order('date_expiration', { ascending: false }),
        supabase.from('brevets').select('*').eq('parachutiste_id', userId).order('date_obtention', { ascending: false }),
        supabase.from('certificats_medicaux').select('*').eq('parachutiste_id', userId).order('date_expiration', { ascending: false }),
        supabase.from('licencies_centres').select('*, centre:centres(id, nom, ville, created_at)').eq('parachutiste_id', userId),
        supabase.from('qualifications').select('*').eq('parachutiste_id', userId),
        supabase.from('sauts').select('*', { count: 'exact', head: true }).eq('parachutiste_id', userId).eq('statut', 'valide'),
        supabase.from('qr_tokens').select('token').eq('parachutiste_id', userId).order('created_at', { ascending: false }).limit(1),
        supabase.from('sauts').select('valide_par, valide_le, lieu').eq('parachutiste_id', userId).eq('statut', 'valide').order('valide_le', { ascending: false }).limit(1).maybeSingle(),
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
        sautsCount: sautsCountData ?? 0,
        qrToken: qrData?.[0]?.token ?? null,
        tamponConfig,
        centre: centreInfo,
        loadedAt: new Date(),
        dernierSautValide: dernierSautData as { valide_par: string | null; valide_le: string | null; lieu: string | null } | null,
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
      await exportCartesPDF(data, isOwner, data.profile.nom, data.profile.prenom);
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

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-col gap-2">
        {/* Shield badge */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Shield className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Données officielles en temps réel</span>
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
      <FlippableCard data={data} isOwner={isOwner} rectoId={rectoId} versoId={versoId} />

      {/* Validity summary */}
      <ValiditySummary data={data} />

      {/* Fullscreen modal */}
      {fullscreen && <FullscreenModal data={data} onClose={() => setFullscreen(false)} isOwner={isOwner} />}
    </div>
  );
}
