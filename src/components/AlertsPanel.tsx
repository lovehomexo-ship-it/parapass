import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Clock, Info, CheckCheck, Check, X, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import type { Alerte } from '../lib/types';

// ─── Alerte enrichie avec lien + action ──────────────────────────────────────

export interface AlerteRiche extends Alerte {
  lien: string;
  action: string;
  detail: string;
}

export function enrichirAlerte(a: Alerte): AlerteRiche {
  const liens: Record<string, string> = {
    licence_expire: '/passeport?onglet=licence',
    certificat_medical: '/passeport?onglet=medical',
    saut_requis: '/stats',
    qualification_expire: '/passeport?onglet=qualifications',
    materiel_revision: '/materiel',
    brevet_anniversaire: '/passeport?onglet=brevets',
  };
  const actions: Record<string, string> = {
    licence_expire: 'Voir ma licence',
    certificat_medical: 'Voir mon médical',
    saut_requis: 'Voir mes stats',
    qualification_expire: 'Voir mes qualifs',
    materiel_revision: 'Voir mon matériel',
    brevet_anniversaire: 'Voir mes brevets',
  };
  return {
    ...a,
    lien: liens[a.type] ?? '/passeport',
    action: actions[a.type] ?? 'Voir →',
    detail: a.message,
  };
}

// ─── sessionStorage acquittements ────────────────────────────────────────────

const STORAGE_KEY = 'alertes_acquittees';
const todayStr = new Date().toDateString();

export function loadAcquittees(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed.date !== todayStr) return [];
    return parsed.ids ?? [];
  } catch {
    return [];
  }
}

export function saveAcquittees(ids: string[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayStr, ids }));
}

// ─── Bell panel ───────────────────────────────────────────────────────────────

interface AlertsPanelProps {
  alertes: Alerte[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  acquittees?: string[];
  onAcquitter?: (ids: string[]) => void;
}

function AlertCard({ alerte, onMarkRead }: { alerte: Alerte; onMarkRead: (id: string) => void }) {
  const styles = {
    critique: {
      bg: 'bg-red-50 border-red-200',
      icon: <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />,
      titleCls: 'text-red-800 font-semibold',
      msgCls: 'text-red-700',
    },
    attention: {
      bg: 'bg-amber-50 border-amber-200',
      icon: <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />,
      titleCls: 'text-amber-800 font-semibold',
      msgCls: 'text-amber-700',
    },
    info: {
      bg: 'bg-blue-50 border-blue-200',
      icon: <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />,
      titleCls: 'text-blue-800 font-semibold',
      msgCls: 'text-blue-700',
    },
  };

  const s = styles[alerte.urgence];

  return (
    <div className={`rounded-lg border p-3 ${s.bg} ${alerte.lue ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-2">
        {s.icon}
        <div className="flex-1 min-w-0">
          <div className={`text-sm ${s.titleCls}`}>{alerte.titre}</div>
          <p className={`text-xs mt-0.5 leading-relaxed ${s.msgCls}`}>{alerte.message}</p>
          {alerte.date_echeance && (
            <div className="text-xs text-gray-400 mt-1">
              Échéance : {new Date(alerte.date_echeance).toLocaleDateString('fr-FR')}
            </div>
          )}
        </div>
        {!alerte.lue && (
          <button
            onClick={() => onMarkRead(alerte.id)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-0.5 rounded"
            title="Marquer comme lue"
          >
            <Check className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function AlertsPanel({ alertes, unreadCount, onMarkRead, onMarkAllRead, acquittees = [], onAcquitter }: AlertsPanelProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Déduplication par type dans le panel Bell
  const urgenceRankPanel = (u: string) => u === 'critique' ? 2 : u === 'attention' ? 1 : 0;
  const dedupPanel = new Map<string, Alerte>();
  for (const a of alertes) {
    const existing = dedupPanel.get(a.type);
    if (!existing || urgenceRankPanel(a.urgence) > urgenceRankPanel(existing.urgence)) {
      dedupPanel.set(a.type, a);
    }
  }
  const dedupedAlertes = Array.from(dedupPanel.values());

  const sorted = [...dedupedAlertes].sort((a, b) => {
    const order = { critique: 0, attention: 1, info: 2 };
    if (order[a.urgence] !== order[b.urgence]) return order[a.urgence] - order[b.urgence];
    return a.lue === b.lue ? 0 : a.lue ? 1 : -1;
  });

  const critiquesNonAcquittees = dedupedAlertes.filter(
    (a) => a.urgence === 'critique' && !a.lue && !acquittees.includes(a.id)
  );

  const bellCount = unreadCount + critiquesNonAcquittees.length > 0
    ? unreadCount
    : 0;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Alertes"
      >
        <Bell className="w-5 h-5 text-white" />
        {bellCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {bellCount > 9 ? '9+' : bellCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-[80vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#001A4D]" />
              <span className="text-sm font-semibold text-[#001A4D]">Alertes</span>
              {unreadCount > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={onMarkAllRead} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#001A4D] font-medium">
                  <CheckCheck className="w-3.5 h-3.5" /> Tout lire
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Alertes critiques non acquittées (section dédiée) */}
          {critiquesNonAcquittees.length > 0 && onAcquitter && (
            <div className="px-3 pt-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 px-1">Alertes critiques</p>
              {critiquesNonAcquittees.map((a) => {
                const enriched = enrichirAlerte(a);
                return (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                    <span className="text-base flex-shrink-0">🔴</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-red-800 font-semibold text-xs">{a.titre}</p>
                      <p className="text-red-700 text-[11px] mt-0.5 leading-relaxed line-clamp-2">{a.message}</p>
                      <button
                        onClick={() => { navigate(enriched.lien); setOpen(false); }}
                        className="text-red-600 text-[11px] font-medium mt-1 hover:underline"
                      >
                        {enriched.action} →
                      </button>
                    </div>
                    <button
                      onClick={() => onAcquitter([a.id])}
                      className="text-red-400 hover:text-red-600 flex-shrink-0 p-0.5"
                      title="Acquitter"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* List standard */}
          <div className="overflow-y-auto p-3 space-y-2 flex-1">
            {sorted.length === 0 && critiquesNonAcquittees.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Aucune alerte
              </div>
            ) : sorted.length === 0 ? null : (
              <>
                {critiquesNonAcquittees.length > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1 pt-1">Historique</p>
                )}
                {sorted.map((a) => <AlertCard key={a.id} alerte={a} onMarkRead={onMarkRead} />)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bandeau interactif principal ────────────────────────────────────────────

interface BandeauProps {
  alertes: Alerte[];
  acquittees: string[];
  onAcquitter: (ids: string[]) => void;
  statutDocs?: 'valide' | 'expire_bientot' | 'expire' | null;
  licenceExpiration?: string | null;
  certifExpiration?: string | null;
  userId?: string;
}

function frDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
function isPast(d: string) { return new Date(d) < new Date(); }
function isSoon(d: string) {
  const dt = new Date(d); const n = new Date();
  const in30 = new Date(n); in30.setDate(n.getDate() + 30);
  return dt > n && dt < in30;
}

function lsKey(userId: string) { return `bandeau_acquitte_${userId}`; }
function todayIso() { return new Date().toISOString().split('T')[0]; }

export function BandeauAlertes({ alertes, acquittees, onAcquitter, statutDocs, licenceExpiration, certifExpiration, userId }: BandeauProps) {
  const [detailOuvert, setDetailOuvert] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(() => {
    if (!userId) return false;
    return localStorage.getItem(lsKey(userId)) === todayIso();
  });
  const navigate = useNavigate();

  // Déduplication par type — garde l'alerte la plus sévère de chaque type
  const urgenceRank = (u: string) => u === 'critique' ? 2 : u === 'attention' ? 1 : 0;
  const deduplicatedMap = new Map<string, ReturnType<typeof enrichirAlerte>>();
  for (const a of alertes.map(enrichirAlerte)) {
    const existing = deduplicatedMap.get(a.type);
    if (!existing || urgenceRank(a.urgence) > urgenceRank(existing.urgence)) {
      deduplicatedMap.set(a.type, a);
    }
  }
  const toutesEnrichies = Array.from(deduplicatedMap.values());
  const critiquesPermanentes = toutesEnrichies.filter((a) => a.urgence === 'critique');
  const alertesVisibles = toutesEnrichies.filter((a) => !acquittees.includes(a.id));

  const nbCritiques = critiquesPermanentes.length;
  const nbAttention = alertesVisibles.filter((a) => a.urgence === 'attention').length;

  // Le statut réel est calculé depuis les dates de documents (statutDocs),
  // pas depuis les alertes Supabase qui peuvent être en retard de sync.
  const isRouge = statutDocs === 'expire' || nbCritiques > 0;
  const isOrange = !isRouge && (statutDocs === 'expire_bientot' || nbAttention > 0);
  const isVert = !isRouge && !isOrange && statutDocs === 'valide';

  if (sessionDismissed || (!isRouge && !isOrange && !isVert)) return null;

  if (isVert) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ background: 'rgba(22,163,74,0.15)', borderBottom: '1px solid rgba(22,163,74,0.2)' }}
      >
        <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
        <span className="text-green-400 text-sm font-medium">Documents à jour — Licence · Médical · Assurances valides</span>
        <span className="ml-auto text-green-400/60 text-xs hidden sm:inline">Licence · Médical · Assurances ✓</span>
      </div>
    );
  }

  // Si critiques acquittées mais toujours présentes → forcer affichage rouge
  const alertesPourAffichage = nbCritiques > 0 && alertesVisibles.length === 0
    ? critiquesPermanentes
    : alertesVisibles;

  // Lignes synthétiques quand les alertes Supabase n'ont pas encore synchro
  type LigneDoc = { id: string; titre: string; detail: string; urgence: 'critique' | 'attention'; lien: string; action: string };
  const lignesSynthetiques: LigneDoc[] = [];
  if (alertesPourAffichage.length === 0) {
    if (licenceExpiration && isPast(licenceExpiration)) {
      lignesSynthetiques.push({ id: 'syn-lic', titre: 'Licence FFP expirée', detail: `Expirée depuis ${frDate(licenceExpiration)}. Renouvelez votre licence immédiatement pour sauter légalement.`, urgence: 'critique', lien: '/passeport?onglet=licence', action: 'Renouveler' });
    } else if (licenceExpiration && isSoon(licenceExpiration)) {
      lignesSynthetiques.push({ id: 'syn-lic', titre: 'Licence FFP expire bientôt', detail: `Expire le ${new Date(licenceExpiration).toLocaleDateString('fr-FR')}. Anticipez le renouvellement.`, urgence: 'attention', lien: '/passeport?onglet=licence', action: 'Renouveler' });
    }
    if (certifExpiration && isPast(certifExpiration)) {
      lignesSynthetiques.push({ id: 'syn-cert', titre: 'Certificat médical expiré', detail: `Expiré depuis ${frDate(certifExpiration)}. Vous ne pouvez pas sauter légalement sans certificat valide.`, urgence: 'critique', lien: '/passeport?onglet=medical', action: 'Mettre à jour' });
    } else if (certifExpiration && isSoon(certifExpiration)) {
      lignesSynthetiques.push({ id: 'syn-cert', titre: 'Certificat médical expire bientôt', detail: `Expire le ${new Date(certifExpiration).toLocaleDateString('fr-FR')}. Prenez rendez-vous rapidement.`, urgence: 'attention', lien: '/passeport?onglet=medical', action: 'Planifier' });
    }
  }

  const couleur = isRouge ? '#DC2626' : '#D97706';

  return (
    <>
      {/* ── Bandeau cliquable ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
        style={{ background: couleur }}
        onClick={() => setDetailOuvert((o) => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />

          <span className="text-white font-medium text-sm whitespace-nowrap">
            {isRouge ? (
              nbCritiques > 0 ? (
                <>
                  {nbCritiques} alerte{nbCritiques > 1 ? 's' : ''} critique{nbCritiques > 1 ? 's' : ''}
                  {nbAttention > 0 && ` · ${nbAttention} attention`}
                </>
              ) : (
                <>Documents à renouveler — Document(s) expiré(s)</>
              )
            ) : nbAttention > 0 ? (
              <>{nbAttention} point{nbAttention > 1 ? 's' : ''} à vérifier</>
            ) : (
              <>Attention — Un document expire bientôt</>
            )}
          </span>

          {/* Résumé tags — masqués sur mobile */}
          <div className="hidden sm:flex gap-1.5 flex-wrap min-w-0 overflow-hidden">
            {alertesPourAffichage.slice(0, 3).map((a) => (
              <span
                key={a.id}
                className="text-white text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                {a.titre.split(' ').slice(0, 3).join(' ')}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className="text-white/80 text-xs hidden sm:inline">
            {detailOuvert ? 'Masquer' : 'Voir le détail'}
          </span>
          {detailOuvert
            ? <ChevronUp className="w-4 h-4 text-white/80" />
            : <ChevronDown className="w-4 h-4 text-white/80" />
          }

          <button
            onClick={(e) => {
              e.stopPropagation();
              onAcquitter(alertesVisibles.filter((a) => a.urgence !== 'critique').map((a) => a.id));
              if (userId) localStorage.setItem(lsKey(userId), todayIso());
              setSessionDismissed(true);
            }}
            className="flex items-center gap-1 text-white text-xs px-3 rounded-full transition-colors"
            style={{
              background: 'rgba(255,255,255,0.2)',
              minHeight: 32,
              paddingTop: 4,
              paddingBottom: 4,
            }}
            title="Fermer pour cette session"
          >
            <X className="w-3 h-3" />
            <span className="hidden sm:inline">Acquitter</span>
          </button>
        </div>
      </div>

      {/* ── Panel détail dépliable ── */}
      {detailOuvert && (
        <div style={{ background: '#001540', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">

            {(alertesPourAffichage.length > 0 ? alertesPourAffichage : lignesSynthetiques).map((alerte) => {
              const isCritique = alerte.urgence === 'critique';
              return (
                <div
                  key={alerte.id}
                  className="flex items-start gap-4 p-4 rounded-xl"
                  style={{
                    background: isCritique ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                    border: `1px solid ${isCritique ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  }}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">{isCritique ? '🔴' : '🟡'}</span>

                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold text-sm mb-1"
                      style={{ color: isCritique ? '#F87171' : '#FCD34D' }}
                    >
                      {alerte.titre}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {alerte.detail}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => { navigate(alerte.lien); setDetailOuvert(false); }}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                      style={{
                        background: isCritique ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                        color: isCritique ? '#FCA5A5' : '#FDE68A',
                      }}
                    >
                      {alerte.action} →
                    </button>

                    {'urgence' in alerte && alertesPourAffichage.length > 0 && (
                      <button
                        onClick={() => onAcquitter([alerte.id])}
                        className="transition-colors flex items-center justify-center rounded-lg"
                        style={{ color: 'rgba(255,255,255,0.3)', width: 28, height: 28, minHeight: 44 }}
                        title="Acquitter cette alerte"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Bandeau statique (rétro-compatibilité) ───────────────────────────────────

export function CritiqueBanner({ alertes }: { alertes: Alerte[] }) {
  const critiques = alertes.filter((a) => a.urgence === 'critique' && !a.lue);
  if (critiques.length === 0) return null;
  return (
    <div className="bg-red-600 text-white px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium">
          {critiques.length === 1
            ? critiques[0].titre
            : `${critiques.length} alertes critiques requièrent votre attention`}
        </span>
      </div>
    </div>
  );
}
