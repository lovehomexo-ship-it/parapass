import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { useDemo } from '../lib/useDemo';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { usePassport, uploadDocument, getSignedUrl } from '../lib/usePassport';
import { TYPE_BREVET_LABELS, QUALIFICATION_LABELS } from '../lib/types';
import type { Licence, Brevet, CertificatMedical, CentreLicencie, Qualification } from '../lib/types';
import { User, FileText, Shield, Award, Building2, CreditCard as Edit3, Plus, Trash2, ChevronDown, ChevronUp, Check, X, Upload, ExternalLink, AlertTriangle, AlertOctagon, BookOpen, BookMarked, Bell } from 'lucide-react';
import { ContactsUrgenceTab, InterdictionsTab } from './PasseportSecurite';
import { IncidentsTab } from './PasseportIncidents';
import { BrevetsModulesTab } from './PasseportBrevets';
import { PasseportCardView } from '../components/PasseportCardView';

type PassportTab = 'carte' | 'licence' | 'medical' | 'brevets' | 'modules' | 'qualifications' | 'centres' | 'securite' | 'incidents';

// ─── Form helpers ──────────────────────────────────────────────────────────────

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full rounded-lg px-3 py-2 text-sm focus:outline-none text-white placeholder-white/30 bg-white/[0.08] border border-white/[0.15] focus:border-white/30';
const selectCls = inputCls;

// ─── Main page ─────────────────────────────────────────────────────────────────

export function PasseportPage() {
  const { user, profile } = useAuth();
  const { isDemo } = useDemo();
  const { licences, brevets, certificats, centresLicencies, qualifications, modulesBrevets, contacts, incidents, interdictions, refresh } = usePassport(user?.id);
  const [tab, setTab] = useState<PassportTab>('carte');
  const [saving, setSaving] = useState(false);

  const isMoniteurOrAdmin = (profile?.role === 'admin' || profile?.role === 'moniteur') && !isDemo;

  const tabs: { key: PassportTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'carte', label: 'Carte', icon: <User className="w-4 h-4" /> },
    { key: 'licence', label: 'Licence', icon: <FileText className="w-4 h-4" /> },
    { key: 'medical', label: 'Médical', icon: <Shield className="w-4 h-4" /> },
    { key: 'brevets', label: 'Brevets', icon: <Award className="w-4 h-4" /> },
    { key: 'modules', label: 'Modules', icon: <BookMarked className="w-4 h-4" /> },
    { key: 'qualifications', label: 'Qualif.', icon: <ChevronDown className="w-4 h-4" /> },
    { key: 'centres', label: 'Centres', icon: <Building2 className="w-4 h-4" /> },
    { key: 'securite', label: 'Sécurité', icon: <AlertTriangle className="w-4 h-4" />, badge: interdictions.length },
    { key: 'incidents', label: 'Incidents', icon: <AlertOctagon className="w-4 h-4" />, badge: incidents.length },
  ];

  if (!profile) return null;

  return (
    <Layout>
      {isDemo && (
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-bold tracking-widest" style={{ background: '#F59E0B', color: '#1C1917' }}>
          ⚠ DONNÉES DE DÉMONSTRATION — Les informations affichées sont fictives
        </div>
      )}
      <div className="min-h-screen overflow-x-hidden" style={{ background: '#001A4D' }}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Mon Passeport</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Votre identité parachutiste numérique</p>
          </div>

          {/* Tab bar — scrollable on mobile */}
          <div
            className="flex gap-1.5 mb-6 pb-1 scrollbar-hide"
            style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex items-center gap-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-[#F97316] text-white shadow-sm'
                    : ''
                }`}
                style={{
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  padding: '8px 14px',
                  ...(tab !== t.key ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' } : {}),
                }}
            >
              {t.icon}
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Carte */}
        {tab === 'carte' && user && (
          <PasseportCardView userId={user.id} />
        )}

        {/* Licence */}
        {tab === 'licence' && (
          <LicenceTab licences={licences} userId={user?.id} centresLicencies={centresLicencies} onRefresh={refresh} saving={saving} setSaving={setSaving} />
        )}

        {/* Médical */}
        {tab === 'medical' && (
          <MedicalTab certificats={certificats} userId={user?.id} onRefresh={refresh} saving={saving} setSaving={setSaving} />
        )}

        {/* Brevets */}
        {tab === 'brevets' && (
          <BrevetTab brevets={brevets} userId={user?.id} onRefresh={refresh} saving={saving} setSaving={setSaving} />
        )}

        {/* Qualifications */}
        {tab === 'qualifications' && (
          <QualifTab qualifications={qualifications} userId={user?.id} onRefresh={refresh} saving={saving} setSaving={setSaving} />
        )}

        {/* Centres */}
        {tab === 'centres' && (
          <CentresTab centresLicencies={centresLicencies} userId={user?.id} onRefresh={refresh} saving={saving} setSaving={setSaving} />
        )}

        {/* Modules de brevets */}
        {tab === 'modules' && (
          <BrevetsModulesTab
            brevets={brevets}
            modules={modulesBrevets}
            userId={user?.id}
            isEditor={isMoniteurOrAdmin}
            onRefresh={refresh}
          />
        )}

        {/* Sécurité — contacts urgence + interdictions */}
        {tab === 'securite' && (
          <div className="space-y-8">
            <ContactsUrgenceTab contacts={contacts} userId={user?.id} onRefresh={refresh} />
            <div className="pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <InterdictionsTab
                interdictions={interdictions}
                isMoniteurOrAdmin={isMoniteurOrAdmin}
                userId={user?.id}
                onRefresh={refresh}
              />
            </div>
          </div>
        )}

        {/* Incidents */}
        {tab === 'incidents' && (
          <IncidentsTab
            incidents={incidents}
            isMoniteurOrAdmin={isMoniteurOrAdmin}
            targetUserId={user?.id}
            onRefresh={refresh}
          />
        )}
      </div>
    </div>
    </Layout>
  );
}

// ─── DGAC Recap ────────────────────────────────────────────────────────────────

const fr = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

const LIEN_LABELS: Record<string, string> = {
  conjoint: 'Conjoint(e)', enfant: 'Enfant', parent: 'Parent',
  frere_soeur: 'Frère / Sœur', autre: 'Autre',
};

const TYPE_LICENCE_LABELS: Record<string, string> = {
  lps: 'Licence de Parachutisme Sportif (LPS)',
  lp: 'Licence Professionnelle (LP)',
  lj: 'Licence Jeune (LJ)',
  ld: 'Licence Dirigeant (LD)',
};

const APTITUDE_LABELS: Record<string, string> = {
  aptitude_totale: 'Aptitude totale',
  aptitude_restrictive: 'Aptitude restrictive',
  inapte: 'Inapte',
};

function RecapRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2 last:border-0 gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <span className="text-xs whitespace-nowrap flex-shrink-0 w-44" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span className="text-sm font-medium text-right text-white">{children}</span>
    </div>
  );
}

function RecapSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl shadow-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-white" style={{ background: '#001A4D' }}>{title}</div>
      <div className="px-4 py-1">{children}</div>
    </div>
  );
}

function RecapAccordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl shadow-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:opacity-80"
        style={{ background: 'rgba(255,255,255,0.04)' }}>
        {title}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="px-4 py-1">{children}</div>}
    </div>
  );
}

function SignatureZone({ label, url, onSave }: { label: string; url: string | null; onSave?: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
    img.src = url;
  }, [url, editing]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width; const sy = c.height / r.height;
    if ('touches' in e) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    if (!editing) return; e.preventDefault(); drawing.current = true;
    const p = getPos(e); canvasRef.current!.getContext('2d')!.beginPath(); canvasRef.current!.getContext('2d')!.moveTo(p.x, p.y);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!editing || !drawing.current) return; e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = getPos(e); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = 'white';
    ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const stop = () => { drawing.current = false; };

  const handleSave = () => {
    const dataUrl = canvasRef.current!.toDataURL('image/png');
    onSave?.(dataUrl);
    setEditing(false);
  };

  const clear = () => {
    const c = canvasRef.current!; const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#F8FAFC'; ctx.fillRect(0, 0, c.width, c.height);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      <div className="rounded-lg border-2 border-dashed overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', minHeight: '120px' }}>
        {(!url && !editing) ? (
          <div className="flex items-center justify-center h-32 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {onSave ? 'Aucune signature — cliquez pour signer' : 'En attente de validation DZ'}
          </div>
        ) : (
          <canvas ref={canvasRef} width={300} height={120} className="w-full touch-none"
            style={{ cursor: editing ? 'crosshair' : 'default', background: 'rgba(255,255,255,0.04)' }}
            onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
            onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
          />
        )}
      </div>
      {onSave && (
        <div className="flex gap-2 mt-1">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="text-xs hover:underline flex items-center gap-1 text-blue-400">
              <Edit3 className="w-3 h-3" /> Modifier ma signature
            </button>
          ) : (
            <>
              <button onClick={clear} className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}>Effacer</button>
              <button onClick={handleSave} className="text-xs px-2 py-1 rounded bg-[#001A4D] text-white">Valider</button>
              <button onClick={() => setEditing(false)} className="text-xs hover:underline" style={{ color: 'rgba(255,255,255,0.5)' }}>Annuler</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Licence tab ───────────────────────────────────────────────────────────────

type LicenceForm = {
  numero_licence: string;
  date_delivrance: string;
  date_expiration: string;
  organisme: 'FFP' | 'DGAC' | 'autre';
  statut: 'actif' | 'expire' | 'suspendu';
  code_club: string;
  nom_club: string;
  beneficiaire_nom: string;
  beneficiaire_lien: 'conjoint' | 'enfant' | 'parent' | 'frere_soeur' | 'autre' | '';
  beneficiaire_telephone: string;
  assurance_individuelle: boolean;
  assurance_rc: boolean;
  tampon_dz_url: string | null;
  tampon_valide_par: string;
  tampon_date_validation: string;
  tampon_signature_url: string | null;
  tampon_statut: 'en_attente' | 'valide' | 'refuse';
  type_licence: 'lps' | 'lp' | 'lj' | 'ld' | '';
};

const emptyLicenceForm: LicenceForm = {
  numero_licence: '', date_delivrance: '', date_expiration: '',
  organisme: 'FFP', statut: 'actif',
  code_club: '', nom_club: '',
  beneficiaire_nom: '', beneficiaire_lien: '', beneficiaire_telephone: '',
  assurance_individuelle: false, assurance_rc: false,
  tampon_dz_url: null, tampon_valide_par: '', tampon_date_validation: '',
  tampon_signature_url: null, tampon_statut: 'en_attente',
  type_licence: '',
};

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-white">{label}</span>
      <div className="flex gap-2">
        <button type="button"
          onClick={() => onChange(true)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${value ? 'bg-green-500 text-white border-green-500' : 'text-white border-white/30'}`}
          style={!value ? { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' } : {}}>
          OUI
        </button>
        <button type="button"
          onClick={() => onChange(false)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${!value ? 'bg-red-500 text-white border-red-500' : 'text-white border-white/30'}`}
          style={value ? { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' } : {}}>
          NON
        </button>
      </div>
    </div>
  );
}

function SignatureCanvas({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#001A4D';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stop = () => {
    drawing.current = false;
    const canvas = canvasRef.current!;
    onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={600}
        height={150}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg bg-white touch-none cursor-crosshair"
        style={{ minHeight: '150px' }}
        onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
      />
      <div className="flex gap-2">
        <button type="button" onClick={clear}
          className="flex items-center gap-1 border border-gray-300 bg-white text-gray-600 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50">
          <X className="w-3 h-3" /> Effacer
        </button>
        {value && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="w-3 h-3" /> Signature enregistrée
          </span>
        )}
      </div>
    </div>
  );
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
      <button type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white transition-colors hover:opacity-80"
        style={{ background: 'rgba(255,255,255,0.06)' }}>
        {title}
        {open ? <ChevronUp className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />}
      </button>
      {open && <div className="p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)' }}>{children}</div>}
    </div>
  );
}

// ─── Statut validation DZ (lecture seule) ──────────────────────────────────────

function ValidationDZStatus({ activeLicencie, userId }: { activeLicencie: CentreLicencie | undefined; userId?: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const demanderValidation = async () => {
    if (!userId || !activeLicencie) return;
    setSending(true);
    // Trouver l'admin du centre pour lui envoyer une notification
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('centre_id', activeLicencie.centre_id)
      .eq('role', 'admin_centre')
      .limit(1);
    if (admins && admins.length > 0) {
      await supabase.from('notifications').insert({
        user_id: admins[0].id,
        titre: 'Demande de validation carnet',
        message: 'Un parachutiste demande la validation de son carnet.',
        type: 'info',
        lu: false,
      });
    }
    // Marquer la demande en attente (idempotent)
    await supabase.from('licencies_centres')
      .update({ carnet_statut: 'en_attente' })
      .eq('id', activeLicencie.id);
    setSending(false);
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  };

  if (!activeLicencie) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-sm font-semibold text-white mb-1">Validation DZ</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Aucune DZ active associée.</p>
      </div>
    );
  }

  const { carnet_statut, carnet_valide_par, carnet_date_validation, carnet_motif_refus } = activeLicencie;

  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-sm font-semibold text-white mb-3">Validation DZ</p>
      <div className="flex items-center gap-2 mb-3">
        {carnet_statut === 'valide' && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-400">
            <Check className="w-4 h-4" />
            {carnet_valide_par ? `Validé par ${carnet_valide_par}` : 'Validé par la DZ'}
            {carnet_date_validation && (
              <span className="text-xs font-normal text-green-300/70">
                — le {new Date(carnet_date_validation).toLocaleDateString('fr-FR')}
              </span>
            )}
          </span>
        )}
        {carnet_statut === 'refuse' && (
          <div>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-400">
              <X className="w-4 h-4" /> Validation refusée par la DZ
            </span>
            {carnet_motif_refus && (
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Motif : {carnet_motif_refus}</p>
            )}
          </div>
        )}
        {carnet_statut === 'en_attente' && (
          <span className="inline-flex items-center gap-1.5 text-sm text-amber-400">
            <AlertTriangle className="w-4 h-4" /> En attente de validation DZ
          </span>
        )}
      </div>
      {carnet_statut !== 'valide' && (
        <button
          onClick={demanderValidation}
          disabled={sending || sent}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition disabled:opacity-60"
          style={{ background: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.3)' }}
        >
          <Bell className="w-3.5 h-3.5" />
          {sent ? 'Demande envoyée ✓' : sending ? 'Envoi…' : 'Demander la validation à ma DZ'}
        </button>
      )}
    </div>
  );
}

// ─── LicenceTab ─────────────────────────────────────────────────────────────────

function LicenceTab({ licences, userId, centresLicencies, onRefresh, saving, setSaving }: {
  licences: Licence[];
  userId?: string;
  centresLicencies: CentreLicencie[];
  onRefresh: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const activeLicencie = centresLicencies.find(c => c.statut === 'actif');
  const [form, setForm] = useState<LicenceForm>(emptyLicenceForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const set = (patch: Partial<LicenceForm>) => setForm((f) => ({ ...f, ...patch }));

  const startEdit = (l: Licence) => {
    set({
      numero_licence: l.numero_licence,
      date_delivrance: l.date_delivrance ?? '',
      date_expiration: l.date_expiration ?? '',
      organisme: l.organisme,
      statut: l.statut,
      code_club: l.code_club ?? '',
      nom_club: l.nom_club ?? '',
      beneficiaire_nom: l.beneficiaire_nom ?? '',
      beneficiaire_lien: l.beneficiaire_lien ?? '',
      beneficiaire_telephone: l.beneficiaire_telephone ?? '',
      assurance_individuelle: l.assurance_individuelle,
      assurance_rc: l.assurance_rc,
      tampon_dz_url: l.tampon_dz_url,
      tampon_valide_par: l.tampon_valide_par ?? '',
      tampon_date_validation: l.tampon_date_validation ?? '',
      tampon_signature_url: l.tampon_signature_url,
      tampon_statut: l.tampon_statut,
      type_licence: l.type_licence ?? '',
    });
    setEditing(l.id);
    setShowForm(true);
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const payload = {
      numero_licence: form.numero_licence,
      date_delivrance: form.date_delivrance || null,
      date_expiration: form.date_expiration || null,
      organisme: form.organisme,
      statut: form.statut,
      code_club: form.code_club || null,
      nom_club: form.nom_club || null,
      beneficiaire_nom: form.beneficiaire_nom || null,
      beneficiaire_lien: form.beneficiaire_lien || null,
      beneficiaire_telephone: form.beneficiaire_telephone || null,
      assurance_individuelle: form.assurance_individuelle,
      assurance_rc: form.assurance_rc,
      tampon_dz_url: form.tampon_dz_url,
      tampon_valide_par: form.tampon_valide_par || null,
      tampon_date_validation: form.tampon_date_validation || null,
      tampon_signature_url: form.tampon_signature_url,
      tampon_statut: form.tampon_statut,
      type_licence: form.type_licence || null,
    };
    if (editing) {
      await supabase.from('licences').update(payload).eq('id', editing);
    } else {
      await supabase.from('licences').insert({ ...payload, parachutiste_id: userId });
    }
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    setForm(emptyLicenceForm);
    onRefresh();
  };

  const remove = async (id: string) => {
    await supabase.from('licences').delete().eq('id', id);
    onRefresh();
  };

  const viewDoc = async (url: string) => {
    const signed = await getSignedUrl(url);
    if (signed) window.open(signed, '_blank');
  };

  const missingInsurance = !form.assurance_individuelle || !form.assurance_rc;

  const tampStatutBadge = (statut: string) => {
    if (statut === 'valide') return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Tampon DZ validé</span>;
    if (statut === 'refuse') return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">✗ Validation refusée</span>;
    return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">En attente de validation</span>;
  };

  const carnetStatutBadge = (statut: string) => {
    if (statut === 'valide') return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Carnet validé DZ</span>;
    if (statut === 'refuse') return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">✗ Carnet refusé</span>;
    return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Carnet en attente DZ</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src="/logo-ffp-footer.png"
            alt="FFP"
            style={{ height: '20px', width: 'auto', opacity: 0.75 }}
          />
          <h2 className="text-base font-semibold text-white">Licences</h2>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm(emptyLicenceForm); }}
          className="flex items-center gap-1 bg-[#001A4D] text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 space-y-4" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>

          {/* Base fields */}
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="N° Licence">
              <input className={inputCls} value={form.numero_licence} onChange={(e) => set({ numero_licence: e.target.value })} />
            </FormRow>
            <FormRow label="Organisme">
              <select className={selectCls} value={form.organisme} onChange={(e) => set({ organisme: e.target.value as LicenceForm['organisme'] })}>
                <option value="FFP">FFP</option>
                <option value="DGAC">DGAC</option>
                <option value="autre">Autre</option>
              </select>
            </FormRow>
            <FormRow label="Date de délivrance">
              <input type="date" className={inputCls} value={form.date_delivrance} onChange={(e) => set({ date_delivrance: e.target.value })} />
            </FormRow>
            <FormRow label="Date d'expiration">
              <input type="date" className={inputCls} value={form.date_expiration} onChange={(e) => set({ date_expiration: e.target.value })} />
            </FormRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Statut">
              <select className={selectCls} value={form.statut} onChange={(e) => set({ statut: e.target.value as LicenceForm['statut'] })}>
                <option value="actif">Actif</option>
                <option value="expire">Expiré</option>
                <option value="suspendu">Suspendu</option>
              </select>
            </FormRow>
            <FormRow label="Type de licence">
              <select className={selectCls} value={form.type_licence} onChange={(e) => set({ type_licence: e.target.value as LicenceForm['type_licence'] })}>
                <option value="">-- Choisir --</option>
                <option value="lps">Licence de Parachutisme Sportif (LPS)</option>
                <option value="lp">Licence Professionnelle (LP)</option>
                <option value="lj">Licence Jeune (LJ)</option>
                <option value="ld">Licence Dirigeant (LD)</option>
              </select>
            </FormRow>
          </div>

          {/* Club */}
          <div className="pt-3" style={{ borderTop: '1px solid rgba(59,130,246,0.2)' }}>
            <p className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Informations club</p>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Code club (ex: 0916001)">
                <input className={inputCls} value={form.code_club} placeholder="0916001" onChange={(e) => set({ code_club: e.target.value })} />
              </FormRow>
              <FormRow label="Nom du club / centre">
                <input className={inputCls} value={form.nom_club} onChange={(e) => set({ nom_club: e.target.value })} />
              </FormRow>
            </div>
          </div>

          {/* Complementary info accordion */}
          <Accordion title="Informations complémentaires (bénéficiaire & assurances)">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Bénéficiaire en cas de décès</p>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Nom et prénom">
                <input className={inputCls} value={form.beneficiaire_nom} onChange={(e) => set({ beneficiaire_nom: e.target.value })} />
              </FormRow>
              <FormRow label="Lien de parenté">
                <select className={selectCls} value={form.beneficiaire_lien} onChange={(e) => set({ beneficiaire_lien: e.target.value as LicenceForm['beneficiaire_lien'] })}>
                  <option value="">-- Choisir --</option>
                  <option value="conjoint">Conjoint(e)</option>
                  <option value="enfant">Enfant</option>
                  <option value="parent">Parent</option>
                  <option value="frere_soeur">Frère / Sœur</option>
                  <option value="autre">Autre</option>
                </select>
              </FormRow>
              <div className="col-span-2">
                <FormRow label="Téléphone (optionnel)">
                  <input type="tel" className={inputCls} value={form.beneficiaire_telephone} onChange={(e) => set({ beneficiaire_telephone: e.target.value })} />
                </FormRow>
              </div>
            </div>

            <div className="mt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Assurances</p>
              <ToggleField label="Assurance individuelle accidents"
                value={form.assurance_individuelle} onChange={(v) => set({ assurance_individuelle: v })} />
              <ToggleField label="Assurance responsabilité civile"
                value={form.assurance_rc} onChange={(v) => set({ assurance_rc: v })} />
              {missingInsurance && (
                <div className="flex items-start gap-2 rounded-lg p-3 mt-2" style={{ background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.3)' }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F97316' }} />
                  <p className="text-xs" style={{ color: '#FCD34D' }}>
                    Attention — une assurance manquante peut invalider votre licence lors d'un contrôle DGAC.
                  </p>
                </div>
              )}
            </div>
          </Accordion>

          {/* DZ validation — lecture seule, géré côté DZ */}
          <ValidationDZStatus activeLicencie={activeLicencie} userId={userId} />

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving} className="flex items-center gap-1 bg-[#001A4D] text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Check className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1 text-white px-4 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <X className="w-4 h-4" /> Annuler
            </button>
          </div>
        </div>
      )}

      {licences.map((l) => (
        <div key={l.id} className="rounded-xl p-4 shadow-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{l.organisme} — {l.numero_licence}</span>
                <img
                  src="/logo-ffp-footer.png"
                  alt="FFP"
                  style={{ height: '14px', width: 'auto', opacity: 0.6 }}
                />
              </div>
              {l.nom_club && <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{l.nom_club}{l.code_club ? ` (${l.code_club})` : ''}</div>}
              {l.date_expiration && (
                <div className={`text-sm mt-1 ${new Date(l.date_expiration) < new Date() ? 'text-red-400 font-medium' : 'text-white opacity-50'}`}>
                  Expire le {new Date(l.date_expiration).toLocaleDateString('fr-FR')}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  l.statut === 'actif' ? 'bg-green-500/30 text-green-300' :
                  l.statut === 'expire' ? 'bg-red-500/30 text-red-300' : 'bg-amber-500/30 text-amber-300'
                }`}>{l.statut}</span>
                {activeLicencie ? carnetStatutBadge(activeLicencie.carnet_statut) : tampStatutBadge(l.tampon_statut)}
                {(l.assurance_individuelle && l.assurance_rc) ? (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-500/30 text-green-300">✓ Assuré</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-500/30 text-red-300">✗ Assurance incomplète</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <button onClick={() => startEdit(l)} className="p-1 hover:opacity-70" style={{ color: 'rgba(255,255,255,0.5)' }}><Edit3 className="w-4 h-4" /></button>
              <button onClick={() => remove(l.id)} className="p-1 hover:text-red-400" style={{ color: 'rgba(255,255,255,0.5)' }}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      ))}

      {licences.length === 0 && !showForm && (
        <div className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Aucune licence enregistrée</div>
      )}
    </div>
  );
}

// ─── Medical tab ───────────────────────────────────────────────────────────────

function MedicalTab({ certificats, userId, onRefresh, saving, setSaving }: {
  certificats: CertificatMedical[];
  userId?: string;
  onRefresh: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const empty = { medecin: '', date_visite: '', date_expiration: '', type: 'aptitude_totale' as const, scan_certificat_url: null as string | null };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId || !e.target.files?.[0]) return;
    const path = await uploadDocument(userId, e.target.files[0], 'certificats');
    if (path) setForm((f) => ({ ...f, scan_certificat_url: path }));
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    if (editing) {
      await supabase.from('certificats_medicaux').update(form).eq('id', editing);
    } else {
      await supabase.from('certificats_medicaux').insert({ ...form, parachutiste_id: userId });
    }
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    setForm(empty);
    onRefresh();
  };

  const remove = async (id: string) => {
    await supabase.from('certificats_medicaux').delete().eq('id', id);
    onRefresh();
  };

  const viewDoc = async (url: string) => {
    const signed = await getSignedUrl(url);
    if (signed) window.open(signed, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Certificats médicaux</h2>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm(empty); }}
          className="flex items-center gap-1 bg-[#001A4D] text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Médecin">
              <input className={inputCls} value={form.medecin} onChange={(e) => setForm({ ...form, medecin: e.target.value })} />
            </FormRow>
            <FormRow label="Type">
              <select className={selectCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}>
                <option value="aptitude_totale">Aptitude totale</option>
                <option value="aptitude_restrictive">Aptitude restrictive</option>
                <option value="inapte">Inapte</option>
              </select>
            </FormRow>
            <FormRow label="Date de visite">
              <input type="date" className={inputCls} value={form.date_visite} onChange={(e) => setForm({ ...form, date_visite: e.target.value })} />
            </FormRow>
            <FormRow label="Date d'expiration">
              <input type="date" className={inputCls} value={form.date_expiration} onChange={(e) => setForm({ ...form, date_expiration: e.target.value })} />
            </FormRow>
          </div>
          <FormRow label="Scan du certificat (PDF/image)">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 border border-gray-300 bg-white text-gray-700 px-3 py-1.5 rounded-lg text-sm">
                <Upload className="w-4 h-4" /> Téléverser
              </button>
              {form.scan_certificat_url && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Fichier joint</span>}
              <input type="file" ref={fileRef} className="hidden" accept=".pdf,image/*" onChange={handleFile} />
            </div>
          </FormRow>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex items-center gap-1 bg-[#001A4D] text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Check className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1 text-white px-4 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <X className="w-4 h-4" /> Annuler
            </button>
          </div>
        </div>
      )}

      {certificats.map((c) => {
        const expired = new Date(c.date_expiration) < new Date();
        return (
          <div key={c.id} className={`rounded-xl p-4 shadow-sm`} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${expired ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-white">{/^Dr\.?\s/i.test(c.medecin) ? c.medecin : `Dr. ${c.medecin}`}</div>
                <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{c.type.replace(/_/g, ' ')}</div>
                <div className={`text-sm mt-1 ${expired ? 'text-red-400 font-medium' : 'text-green-400'}`}>
                  {expired ? 'Expiré' : 'Valide'} — jusqu'au {new Date(c.date_expiration).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.scan_certificat_url && (
                  <button onClick={() => viewDoc(c.scan_certificat_url!)} className="p-1 text-blue-400 hover:text-blue-300">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => remove(c.id)} className="p-1 hover:text-red-400" style={{ color: 'rgba(255,255,255,0.5)' }}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        );
      })}

      {certificats.length === 0 && !showForm && (
        <div className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Aucun certificat médical enregistré</div>
      )}
    </div>
  );
}

// ─── Brevet tab ────────────────────────────────────────────────────────────────

function BrevetTab({ brevets, userId, onRefresh, saving, setSaving }: {
  brevets: Brevet[];
  userId?: string;
  onRefresh: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const empty = { type_brevet: 'BPA' as const, date_obtention: '', centre_delivrance: '', numero_brevet: '', scan_diplome_url: null as string | null };
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId || !e.target.files?.[0]) return;
    const path = await uploadDocument(userId, e.target.files[0], 'brevets');
    if (path) setForm((f) => ({ ...f, scan_diplome_url: path }));
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase.from('brevets').insert({ ...form, parachutiste_id: userId, numero_brevet: form.numero_brevet || null });
    setSaving(false);
    setShowForm(false);
    setForm(empty);
    onRefresh();
  };

  const remove = async (id: string) => {
    await supabase.from('brevets').delete().eq('id', id);
    onRefresh();
  };

  const viewDoc = async (url: string) => {
    const signed = await getSignedUrl(url);
    if (signed) window.open(signed, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Brevets</h2>
        <button onClick={() => { setShowForm(true); setForm(empty); }}
          className="flex items-center gap-1 bg-[#001A4D] text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Type de brevet">
              <select className={selectCls} value={form.type_brevet} onChange={(e) => setForm({ ...form, type_brevet: e.target.value as typeof form.type_brevet })}>
                {Object.entries(TYPE_BREVET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormRow>
            <FormRow label="Date d'obtention">
              <input type="date" className={inputCls} value={form.date_obtention} onChange={(e) => setForm({ ...form, date_obtention: e.target.value })} />
            </FormRow>
            <FormRow label="Centre de délivrance">
              <input className={inputCls} value={form.centre_delivrance} onChange={(e) => setForm({ ...form, centre_delivrance: e.target.value })} />
            </FormRow>
            <FormRow label="Numéro de brevet (optionnel)">
              <input className={inputCls} value={form.numero_brevet} onChange={(e) => setForm({ ...form, numero_brevet: e.target.value })} />
            </FormRow>
          </div>
          <FormRow label="Scan du diplôme (PDF/image)">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 border border-gray-300 bg-white text-gray-700 px-3 py-1.5 rounded-lg text-sm">
                <Upload className="w-4 h-4" /> Téléverser
              </button>
              {form.scan_diplome_url && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Fichier joint</span>}
              <input type="file" ref={fileRef} className="hidden" accept=".pdf,image/*" onChange={handleFile} />
            </div>
          </FormRow>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex items-center gap-1 bg-[#001A4D] text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Check className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1 text-white px-4 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <X className="w-4 h-4" /> Annuler
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {brevets.map((b) => (
          <div key={b.id} className="rounded-xl p-4 shadow-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-bold text-white">{TYPE_BREVET_LABELS[b.type_brevet] || b.type_brevet}</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{new Date(b.date_obtention).toLocaleDateString('fr-FR')}</div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{b.centre_delivrance}</div>
              </div>
              <div className="flex gap-1">
                {b.scan_diplome_url && (
                  <button onClick={() => viewDoc(b.scan_diplome_url!)} className="text-blue-400 p-1"><ExternalLink className="w-3.5 h-3.5" /></button>
                )}
                <button onClick={() => remove(b.id)} className="hover:text-red-400 p-1" style={{ color: 'rgba(255,255,255,0.5)' }}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {brevets.length === 0 && !showForm && (
        <div className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Aucun brevet enregistré</div>
      )}
    </div>
  );
}

// ─── Qualification tab ─────────────────────────────────────────────────────────

function QualifTab({ qualifications, userId, onRefresh, saving, setSaving }: {
  qualifications: Qualification[];
  userId?: string;
  onRefresh: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const empty = { type: 'moniteur_tandem' as const, date_obtention: '', date_expiration: '', organisme_delivrance: '' };
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase.from('qualifications').insert({ ...form, parachutiste_id: userId, date_expiration: form.date_expiration || null });
    setSaving(false);
    setShowForm(false);
    setForm(empty);
    onRefresh();
  };

  const remove = async (id: string) => {
    await supabase.from('qualifications').delete().eq('id', id);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Qualifications</h2>
        <button onClick={() => { setShowForm(true); setForm(empty); }}
          className="flex items-center gap-1 bg-[#001A4D] text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Type">
              <select className={selectCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}>
                {Object.entries(QUALIFICATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormRow>
            <FormRow label="Organisme délivrant">
              <input className={inputCls} value={form.organisme_delivrance} onChange={(e) => setForm({ ...form, organisme_delivrance: e.target.value })} />
            </FormRow>
            <FormRow label="Date d'obtention">
              <input type="date" className={inputCls} value={form.date_obtention} onChange={(e) => setForm({ ...form, date_obtention: e.target.value })} />
            </FormRow>
            <FormRow label="Date d'expiration (optionnel)">
              <input type="date" className={inputCls} value={form.date_expiration} onChange={(e) => setForm({ ...form, date_expiration: e.target.value })} />
            </FormRow>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex items-center gap-1 bg-[#001A4D] text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Check className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1 text-white px-4 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <X className="w-4 h-4" /> Annuler
            </button>
          </div>
        </div>
      )}

      {qualifications.map((q) => {
        const expir = q.date_expiration ? new Date(q.date_expiration) : null;
        const expired = expir && expir < new Date();
        return (
          <div key={q.id} className={`rounded-xl p-4 shadow-sm`} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${expired ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-white">{QUALIFICATION_LABELS[q.type] || q.type}</div>
                <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{q.organisme_delivrance}</div>
                {expir && (
                  <div className={`text-sm mt-1 ${expired ? 'text-red-400 font-medium' : 'text-white opacity-50'}`}>
                    {expired ? 'Expirée' : 'Valide'} — {expir.toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>
              <button onClick={() => remove(q.id)} className="p-1 hover:text-red-400" style={{ color: 'rgba(255,255,255,0.5)' }}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        );
      })}

      {qualifications.length === 0 && !showForm && (
        <div className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Aucune qualification enregistrée</div>
      )}
    </div>
  );
}

// ─── Centres tab ───────────────────────────────────────────────────────────────

function CentresTab({ centresLicencies, userId, onRefresh, saving, setSaving }: {
  centresLicencies: CentreLicencie[];
  userId?: string;
  onRefresh: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const [centres, setCentres] = useState<{ id: string; nom: string; ville: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ centre_id: '', date_adhesion: '', statut: 'actif' as 'actif' | 'inactif', numero_adhesion: '' });

  useCallback(() => {
    supabase.from('centres').select('id, nom, ville').then(({ data }) => setCentres(data ?? []));
  }, [])();

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase.from('centres_licencies').upsert({
      parachutiste_id: userId,
      centre_id: form.centre_id,
      date_adhesion: form.date_adhesion,
      statut: form.statut,
      numero_adhesion: form.numero_adhesion || null,
    }, { onConflict: 'parachutiste_id,centre_id' });
    setSaving(false);
    setShowForm(false);
    onRefresh();
  };

  const remove = async (id: string) => {
    await supabase.from('centres_licencies').delete().eq('id', id);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Centres licenciés</h2>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1 bg-[#001A4D] text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Centre">
              <select className={selectCls} value={form.centre_id} onChange={(e) => setForm({ ...form, centre_id: e.target.value })}>
                <option value="">-- Choisir --</option>
                {centres.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.ville})</option>)}
              </select>
            </FormRow>
            <FormRow label="N° d'adhésion (optionnel)">
              <input className={inputCls} value={form.numero_adhesion} onChange={(e) => setForm({ ...form, numero_adhesion: e.target.value })} />
            </FormRow>
            <FormRow label="Date d'adhésion">
              <input type="date" className={inputCls} value={form.date_adhesion} onChange={(e) => setForm({ ...form, date_adhesion: e.target.value })} />
            </FormRow>
            <FormRow label="Statut">
              <select className={selectCls} value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value as 'actif' | 'inactif' })}>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
              </select>
            </FormRow>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex items-center gap-1 bg-[#001A4D] text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Check className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1 text-white px-4 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <X className="w-4 h-4" /> Annuler
            </button>
          </div>
        </div>
      )}

      {centresLicencies.map((cl) => (
        <div key={cl.id} className="rounded-xl p-4 shadow-sm flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <div className="font-semibold text-white">{(cl.centre as { nom: string })?.nom ?? cl.centre_id}</div>
            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Depuis le {new Date(cl.date_adhesion).toLocaleDateString('fr-FR')}
              {cl.numero_adhesion && ` — ${cl.numero_adhesion}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cl.statut === 'actif' ? 'bg-green-500/30 text-green-300' : 'bg-white/10 text-white/50'}`}>
              {cl.statut}
            </span>
            <button onClick={() => remove(cl.id)} className="p-1 hover:text-red-400" style={{ color: 'rgba(255,255,255,0.5)' }}><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}

      {centresLicencies.length === 0 && !showForm && (
        <div className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Aucun centre enregistré</div>
      )}
    </div>
  );
}
