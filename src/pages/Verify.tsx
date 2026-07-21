import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, AlertTriangle, Shield, Copy, Check, Hash, ShieldAlert } from 'lucide-react';
import type { Licence, CertificatMedical, Brevet, Saut } from '../lib/types';
import { TYPE_BREVET_LABELS } from '../lib/types';
import type { Profile } from '../lib/auth';
import { verifySautHash } from '../lib/validationCrypto';

type GlobalStatus = 'valide' | 'attention' | 'expire' | 'invalide' | 'introuvable';

interface VerifyData {
  profile: Profile;
  licence: Licence | null;
  certif: CertificatMedical | null;
  brevet: Brevet | null;
  sautsValidés: number;
  sautsTotal: number;
  dernierSaut: string | null;
  centrePrincipal: string | null;
  sautsWithHash: (Saut & { validation_hash?: string | null; validation_timestamp?: string | null; valide_par?: string | null })[];
}

function daysDiff(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR');
}

function fmtDateTime(d: Date) {
  return (
    d.toLocaleDateString('fr-FR') +
    ' à ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  );
}

function cleanLicenceNum(n: string | null | undefined): string {
  if (!n) return '—';
  return n.replace(/[°]/g, '-').replace(/\s+/g, '').trim();
}

function computeStatus(l: Licence | null, c: CertificatMedical | null): GlobalStatus {
  // Absence de données ≠ expiré : on le dit distinctement, jamais « expiré » par défaut
  if (!l) return 'introuvable';
  const lDays = l.date_expiration ? daysDiff(l.date_expiration) : -1;
  if (lDays < 0 || l.statut !== 'actif') return 'expire';
  if (!c) return 'attention'; // licence valide mais certificat médical non renseigné
  const cDays = daysDiff(c.date_expiration);
  if (cDays < 0) return 'expire';
  if (lDays <= 30 || cDays <= 30) return 'attention';
  return 'valide';
}

// ─── Skeleton Loader ────────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Fake header */}
      <div className="h-36 bg-gray-200 animate-pulse" />
      <div className="px-4 py-5 max-w-lg mx-auto w-full space-y-4">
        {/* Fake card */}
        <div className="rounded-2xl h-48 bg-gray-200 animate-pulse" />
        {/* Fake blocks */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-gray-100 p-4 space-y-2">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function VerifyPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<VerifyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [copied, setCopied] = useState(false);
  const verifiedAt = new Date();

  useEffect(() => {
    if (!token) { setTokenInvalid(true); setLoading(false); return; }

    const fetchData = async () => {
      // Une seule RPC security definer bornée au token : fonctionne pour un
      // scanneur anonyme COMME connecté (les policies RLS anon ne couvraient
      // pas le rôle authenticated → page vide et faux « expiré »)
      const { data: v, error } = await supabase.rpc('verify_passeport', { p_token: token });
      if (error) console.error('Vérification passeport échouée :', error);

      if (!v) { setTokenInvalid(true); setLoading(false); return; }

      // Log RGPD-friendly
      supabase.from('verifications').insert({ token }).then(() => {});

      const payload = v as {
        profile: Profile; licence: Licence | null; certif: CertificatMedical | null;
        brevet: Brevet | null; sauts_valides: number; sauts_total: number;
        dernier_saut: string | null; centre: string | null;
        sauts_hash: VerifyData['sautsWithHash'];
      };
      setData({
        profile: payload.profile,
        licence: payload.licence,
        certif: payload.certif,
        brevet: payload.brevet,
        sautsValidés: payload.sauts_valides ?? 0,
        sautsTotal: payload.sauts_total ?? 0,
        dernierSaut: payload.dernier_saut,
        centrePrincipal: payload.centre,
        sautsWithHash: payload.sauts_hash ?? [],
      });
      setLoading(false);
    };

    fetchData();
  }, [token]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  if (loading) return <SkeletonLoader />;

  if (tokenInvalid) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="h-36 flex flex-col items-center justify-center" style={{ background: 'linear-gradient(135deg, #6B7280, #9CA3AF)' }}>
          <XCircle className="w-12 h-12 text-white mb-2" />
          <p className="text-white text-xl font-bold">QR Code invalide ou expiré</p>
          <p className="text-white/75 text-xs mt-1 text-center px-4">Demandez au parachutiste de régénérer son QR code dans ParaPass</p>
        </div>
        <Footer verifiedAt={verifiedAt} token={token ?? ''} />
      </div>
    );
  }

  const d = data!;
  const status = computeStatus(d.licence, d.certif);
  // le numéro vient de la LICENCE réelle — jamais du champ profil (source périmable)
  const licNum = cleanLicenceNum(d.licence?.numero_licence);
  const tokenShort = (token ?? '').slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── HEADER STATUT ── */}
      <StatusHeader status={status} verifiedAt={verifiedAt} />

      {/* ── TOP BAR ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center justify-between">
        <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-8 w-auto object-contain" />
        <div className="flex items-center gap-1 bg-[#001A4D]/5 rounded-full px-3 py-1">
          <Shield className="w-3 h-3 text-[#001A4D]" />
          <span className="text-[10px] font-semibold text-[#001A4D] uppercase tracking-wider">Vérification ParaPass</span>
        </div>
      </div>

      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full space-y-4">

        {/* ── CARTE PASSEPORT ── */}
        <PasseportCard
          profile={d.profile}
          licence={d.licence}
          brevet={d.brevet}
          certif={d.certif}
          sautsTotal={d.sautsTotal}
          licNum={licNum}
          status={status}
        />

        {/* ── IDENTITÉ ── */}
        <InfoCard title="Identité" icon="🪪">
          <InfoRow label="Nom complet" value={`${d.profile?.prenom ?? '—'} ${d.profile?.nom ?? '—'}`} />
          <InfoRow label="Date de naissance" value={d.profile?.date_naissance ? fmtDate(d.profile.date_naissance) : 'Non renseignée'} />
          <InfoRow label="Nationalité" value={d.profile?.nationalite || 'Française'} last />
        </InfoCard>

        {/* ── LICENCE & VALIDITÉ ── */}
        <InfoCard title="Licence & Validité" icon="📋">
          <InfoRow label="N° Licence FFP" value={licNum} mono />
          <InfoRow label="Code club" value={d.licence?.code_club || '—'} />
          <InfoRow
            label="Valide jusqu'au"
            value={d.licence?.date_expiration ? fmtDate(d.licence.date_expiration) : '—'}
            badge={
              d.licence?.date_expiration
                ? daysDiff(d.licence.date_expiration) >= 0
                  ? 'green'
                  : 'red'
                : 'gray'
            }
          />
          <InfoRow label="Type de brevet" value={d.brevet ? TYPE_BREVET_LABELS[d.brevet.type_brevet] : '—'} last />
        </InfoCard>

        {/* ── CERTIFICAT MÉDICAL ── */}
        <InfoCard title="Certificat médical" icon="🏥">
          <InfoRow label="Médecin" value={d.certif?.medecin || 'Non renseigné'} />
          <InfoRow
            label="Valide jusqu'au"
            value={d.certif?.date_expiration ? fmtDate(d.certif.date_expiration) : '—'}
            badge={
              d.certif?.date_expiration
                ? daysDiff(d.certif.date_expiration) >= 0
                  ? 'green'
                  : 'red'
                : 'gray'
            }
          />
          <InfoRow
            label="Type d'aptitude"
            value={
              d.certif?.type === 'aptitude_totale' ? 'Totale' :
              d.certif?.type === 'aptitude_restrictive' ? 'Restrictive' :
              d.certif?.type === 'inapte' ? 'Inapte' : '—'
            }
            last
          />
        </InfoCard>

        {/* ── ACTIVITÉ ── */}
        <InfoCard title="Activité récente" icon="🪂">
          <InfoRow label="Sauts validés ParaPass" value={String(d.sautsValidés)} highlight />
          <InfoRow label="Total sauts enregistrés" value={String(d.sautsTotal)} />
          <InfoRow label="Dernier saut" value={d.dernierSaut ? fmtDate(d.dernierSaut) : 'Aucun'} />
          <InfoRow label="Centre principal" value={d.centrePrincipal || '—'} last />
        </InfoCard>

        {/* ── ASSURANCES ── */}
        {d.licence && (
          <InfoCard title="Assurances" icon="🛡️">
            <AssuranceRow label="Assurance individuelle" active={d.licence.assurance_individuelle} />
            <AssuranceRow label="Responsabilité civile" active={d.licence.assurance_rc} last />
          </InfoCard>
        )}

        {/* ── TAMPONS & SIGNATURES ── */}
        {(d.licence?.tampon_snapshot_url || d.profile?.signature_url) && (
          <div className={`grid gap-4 ${d.licence?.tampon_snapshot_url && d.profile?.signature_url ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {d.licence?.tampon_snapshot_url && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Tampon DZ</p>
                <img src={d.licence.tampon_snapshot_url} alt="Tampon DZ" className="w-20 h-20 mx-auto object-contain" />
                {d.licence.tampon_validateur_nom && (
                  <p className="text-[11px] text-gray-500 mt-2">Validé par {d.licence.tampon_validateur_nom}</p>
                )}
              </div>
            )}
            {d.profile?.signature_url && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Signature du licencié</p>
                <div className="border border-dashed border-gray-200 rounded-lg p-2">
                  <img src={d.profile.signature_url} alt="Signature" className="w-full h-14 object-contain" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── INTÉGRITÉ CRYPTOGRAPHIQUE ── */}
        {d.sautsWithHash.length > 0 && (
          <IntegriteSection sauts={d.sautsWithHash} />
        )}

        {/* ── BOUTON PARTAGE ── */}
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 bg-white text-[14px] font-medium text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition-all"
          style={{ minHeight: '44px' }}
        >
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Lien copié !' : 'Partager cette vérification'}
        </button>

      </main>

      <Footer verifiedAt={verifiedAt} token={tokenShort} />
    </div>
  );
}

// ─── Status Header ───────────────────────────────────────────────────────────────

function StatusHeader({ status, verifiedAt }: { status: GlobalStatus; verifiedAt: Date }) {
  const configs: Record<GlobalStatus, { gradient: string; icon: React.ReactNode; title: string; sub: string }> = {
    valide: {
      gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
      icon: <CheckCircle className="w-12 h-12 text-white" />,
      title: 'CARNET VALIDE',
      sub: `Vérifié le ${fmtDateTime(verifiedAt)}`,
    },
    attention: {
      gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
      icon: <AlertTriangle className="w-12 h-12 text-white" />,
      title: 'EXPIRATION PROCHE',
      sub: 'Un ou plusieurs documents expirent dans moins de 30 jours',
    },
    expire: {
      gradient: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
      icon: <XCircle className="w-12 h-12 text-white" />,
      title: 'ATTENTION — VÉRIFICATION REQUISE',
      sub: 'Documents expirés ou manquants',
    },
    invalide: {
      gradient: 'linear-gradient(135deg, #6B7280, #9CA3AF)',
      icon: <XCircle className="w-12 h-12 text-white" />,
      title: 'QR Code invalide',
      sub: '',
    },
    introuvable: {
      gradient: 'linear-gradient(135deg, #475569, #64748B)',
      icon: <AlertTriangle className="w-12 h-12 text-white" />,
      title: 'LICENCE INTROUVABLE',
      sub: 'Aucune licence enregistrée pour ce passeport — vérification impossible, demandez un justificatif',
    },
  };

  const c = configs[status];

  return (
    <div
      className="flex flex-col items-center justify-center text-center px-4"
      style={{ background: c.gradient, minHeight: '140px', paddingTop: '16px', paddingBottom: '16px' }}
    >
      {c.icon}
      <p className="text-white font-bold mt-2" style={{ fontSize: '22px', lineHeight: 1.2 }}>{c.title}</p>
      {c.sub && <p className="text-white/85 mt-1" style={{ fontSize: '12px' }}>{c.sub}</p>}
    </div>
  );
}

// ─── Passeport Card ───────────────────────────────────────────────────────────────

function PasseportCard({ profile, licence, brevet, certif, sautsTotal, licNum, status }: {
  profile: Profile;
  licence: Licence | null;
  brevet: Brevet | null;
  certif: CertificatMedical | null;
  sautsTotal: number;
  licNum: string;
  status: GlobalStatus;
}) {
  const statusBadge: Record<GlobalStatus, { bg: string; text: string; label: string }> = {
    valide: { bg: '#10B981', text: 'white', label: 'ACTIF' },
    attention: { bg: '#F59E0B', text: 'white', label: 'ATTENTION' },
    expire: { bg: '#EF4444', text: 'white', label: 'EXPIRÉ' },
    invalide: { bg: '#6B7280', text: 'white', label: 'INVALIDE' },
  };
  const sb = statusBadge[status];

  return (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #001A4D 0%, #1E3A5F 100%)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
      }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-7 w-auto object-contain " />
        <span
          className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full"
          style={{ background: sb.bg, color: sb.text }}
        >
          {sb.label}
        </span>
      </div>

      {/* Identity row */}
      <div className="flex items-center gap-3 px-4 pb-3">
        <div
          className="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-bold text-white uppercase"
          style={{ background: 'rgba(255,255,255,0.15)' }}
        >
          {profile?.prenom?.[0]}{profile?.nom?.[0]}
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold truncate" style={{ fontSize: '18px' }}>
            {profile?.prenom} {profile?.nom}
          </p>
          <p className="text-blue-200" style={{ fontSize: '12px' }}>Licence FFP N°{licNum}</p>
          {licence?.code_club && (
            <p className="text-white/50" style={{ fontSize: '11px' }}>Code club : {licence.code_club}</p>
          )}
        </div>
      </div>

      {/* Separator */}
      <div className="mx-4 border-t border-white/20 mb-3" />

      {/* 2×2 grid */}
      <div className="grid grid-cols-2 mx-4 gap-px bg-white/10 rounded-xl overflow-hidden mb-3">
        <GridCell label="BREVET" value={brevet ? TYPE_BREVET_LABELS[brevet.type_brevet] : '—'} />
        <GridCell label="SAUTS TOTAUX" value={String(sautsTotal)} />
        <GridCell
          label="LICENCE"
          value={licence?.date_expiration ? `Valide ${fmtDate(licence.date_expiration)}` : '—'}
          expired={!!licence?.date_expiration && daysDiff(licence.date_expiration) < 0}
        />
        <GridCell
          label="CERT. MÉDICAL"
          value={certif?.date_expiration ? `Valide ${fmtDate(certif.date_expiration)}` : '—'}
          expired={!!certif?.date_expiration && daysDiff(certif.date_expiration) < 0}
          last
        />
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between px-4 pb-4">
        <span className="text-white/40 tracking-[0.15em]" style={{ fontSize: '9px' }}>PARAPASS.FR</span>
        <span className="text-white/40" style={{ fontSize: '9px' }}>parapass.fr</span>
      </div>
    </div>
  );
}

function GridCell({ label, value, expired = false, last = false }: {
  label: string; value: string; expired?: boolean; last?: boolean;
}) {
  return (
    <div className={`bg-white/5 px-3 py-2.5 ${last ? '' : ''}`}>
      <p className="text-white/40 tracking-wider mb-0.5" style={{ fontSize: '9px' }}>{label}</p>
      <p className={`font-semibold ${expired ? 'text-red-400' : 'text-white'}`} style={{ fontSize: '13px' }}>{value}</p>
    </div>
  );
}

// ─── Info Card ───────────────────────────────────────────────────────────────────

function InfoCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, badge, last = false, mono = false, highlight = false }: {
  label: string;
  value: string;
  badge?: 'green' | 'red' | 'gray';
  last?: boolean;
  mono?: boolean;
  highlight?: boolean;
}) {
  const badgeColors = {
    green: 'bg-green-50 text-green-700 border border-green-200',
    red: 'bg-red-50 text-red-700 border border-red-200',
    gray: 'bg-gray-50 text-gray-500 border border-gray-200',
  };

  return (
    <div className={`px-4 py-3 flex items-center justify-between gap-2 ${!last ? '' : ''}`} style={{ minHeight: '44px' }}>
      <span className="text-[13px] text-gray-500 flex-shrink-0">{label}</span>
      {badge ? (
        <span className={`text-[12px] font-semibold px-2.5 py-0.5 rounded-full ${badgeColors[badge]}`}>{value}</span>
      ) : (
        <span className={`text-[13px] font-semibold text-right ${highlight ? 'text-[#001A4D]' : 'text-gray-800'} ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
      )}
    </div>
  );
}

function AssuranceRow({ label, active, last = false }: { label: string; active: boolean; last?: boolean }) {
  return (
    <div className={`px-4 py-3 flex items-center justify-between ${!last ? '' : ''}`} style={{ minHeight: '44px' }}>
      <span className="text-[13px] text-gray-500">{label}</span>
      <span
        className={`text-[12px] font-bold px-3 py-0.5 rounded-full border ${
          active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}
      >
        {active ? '✓ OUI' : '✗ NON'}
      </span>
    </div>
  );
}

// ─── Intégrité cryptographique ───────────────────────────────────────────────────

type SautHashRow = VerifyData['sautsWithHash'][number];

function IntegriteSection({ sauts }: { sauts: SautHashRow[] }) {
  const [results, setResults] = useState<Record<string, boolean | null>>({});
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    const res: Record<string, boolean | null> = {};
    for (const s of sauts) {
      if (!s.validation_hash || !s.validation_timestamp || !s.moniteur_id) {
        res[s.id] = null;
        continue;
      }
      res[s.id] = await verifySautHash(
        {
          id: s.id,
          parachutiste_id: s.parachutiste_id,
          moniteur_id: s.moniteur_id,
          date_saut: s.date_saut,
          lieu: s.lieu,
          aeronef_immat: s.aeronef_immat,
          hauteur_m: s.hauteur_m,
          categorie: s.categorie,
          validation_timestamp: s.validation_timestamp,
        },
        s.validation_hash
      );
    }
    setResults(res);
    setChecking(false);
    setDone(true);
  };

  const allOk = done && Object.values(results).every((v) => v === true);
  const anyAlert = done && Object.values(results).some((v) => v === false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
        <Hash className="w-4 h-4 text-[#001A4D]" />
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex-1">Intégrité des données</p>
        {!done && (
          <button
            onClick={runCheck}
            disabled={checking}
            className="text-xs bg-[#001A4D] text-white px-3 py-1 rounded-lg font-medium disabled:opacity-50"
          >
            {checking ? 'Vérification...' : 'Vérifier les hashs'}
          </button>
        )}
        {allOk && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Tout intègre</span>
        )}
        {anyAlert && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Alerte détectée</span>
        )}
      </div>

      {!done && (
        <div className="px-4 py-3">
          <p className="text-xs text-gray-500">
            Recalcule en temps réel les empreintes SHA-256 de {sauts.length} saut(s) validé(s) et les compare aux hashs stockés.
            Toute modification des données après validation sera détectée.
          </p>
        </div>
      )}

      {done && (
        <div className="divide-y divide-gray-50">
          {sauts.map((s) => {
            const ok = results[s.id];
            return (
              <div key={s.id} className={`flex items-center justify-between px-4 py-2.5 ${ok === false ? 'bg-red-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700">
                    {new Date(s.date_saut).toLocaleDateString('fr-FR')} — {s.lieu} — {s.hauteur_m}m
                  </p>
                  {s.validation_hash && (
                    <p className="text-[10px] font-mono text-gray-400 truncate">{s.validation_hash.slice(0, 16)}…</p>
                  )}
                </div>
                <div className="flex-shrink-0 ml-3">
                  {ok === true && (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" /> Intègre
                    </span>
                  )}
                  {ok === false && (
                    <span className="flex items-center gap-1 text-xs text-red-600 font-bold">
                      <ShieldAlert className="w-3.5 h-3.5" /> ALERTE
                    </span>
                  )}
                  {ok === null && (
                    <span className="text-xs text-gray-400">Sans hash</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────────

function Footer({ verifiedAt, token }: { verifiedAt: Date; token: string }) {
  return (
    <footer className="mt-4 px-4 py-6 text-center" style={{ background: '#001A4D' }}>
      <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-7 w-auto object-contain  mx-auto mb-3" />
      <p className="text-white/80 font-semibold mb-1" style={{ fontSize: '12px' }}>Vérification ParaPass</p>
      <p className="text-white/50" style={{ fontSize: '11px' }}>
        Données chiffrées AES-256 · Hébergé en Europe
      </p>
      <p className="text-white/50" style={{ fontSize: '11px' }}>
        Conforme RGPD · parapass.fr
      </p>
      <p className="text-white/30 mt-2" style={{ fontSize: '10px' }}>
        Consultation enregistrée le {fmtDateTime(verifiedAt)}
        {token ? ` — réf. ${token}` : ''}
      </p>
    </footer>
  );
}
