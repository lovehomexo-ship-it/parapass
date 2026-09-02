import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoaderParaPass } from '../../components/LoaderParaPass';
import { Wrench, Building2, User, QrCode, Filter, Send, Plus, Upload, CheckCircle2 } from 'lucide-react';
import { AjouterEquipement, EnregistrerOperation, ImporterParc } from './MaterielActions';

// ═══════════════════════════════════════════════════════════════════════════
// P5 — ÉCHÉANCES RÉGLEMENTAIRES DU MATÉRIEL.
//
// Le DT est responsable de la conformité de ce qui saute sur son terrain :
// l'écran couvre donc le parc du CENTRE et le matériel PERSONNEL de ses
// licenciés actifs.
//
// Un équipement jamais contrôlé n'est pas « en règle par défaut » : il ressort
// en « jamais contrôlé », juste après les dépassés. Même principe que partout
// ailleurs — une information absente n'est pas une information rassurante.
// ═══════════════════════════════════════════════════════════════════════════

interface Echeance {
  materiel_id: string;
  type: string;
  marque: string | null;
  modele: string | null;
  numero_serie: string | null;
  proprietaire: string;
  proprietaire_id: string | null;
  est_parc_centre: boolean;
  type_echeance: string;
  derniere_operation: string | null;
  echeance: string | null;
  jours_restants: number | null;
  palier: 'depasse' | 'j30' | 'j60' | 'ok' | 'inconnu';
  qr_token: string | null;
}

const PALIER = {
  depasse: { label: 'Dépassée',        couleur: '#F87171', fond: 'rgba(239,68,68,0.10)',  bord: 'rgba(239,68,68,0.35)' },
  inconnu: { label: 'Jamais contrôlé', couleur: '#FB923C', fond: 'rgba(249,115,22,0.10)', bord: 'rgba(249,115,22,0.35)' },
  j30:     { label: 'Sous 30 jours',   couleur: '#FBBF24', fond: 'rgba(251,191,36,0.10)', bord: 'rgba(251,191,36,0.35)' },
  j60:     { label: 'Sous 60 jours',   couleur: '#60A5FA', fond: 'rgba(96,165,250,0.10)', bord: 'rgba(96,165,250,0.30)' },
  ok:      { label: 'À jour',          couleur: '#34D399', fond: 'var(--c-surface)',      bord: 'var(--c-border)' },
} as const;

// type_maintenance est stocké en CODE : on le traduit pour l'affichage.
const OP_LABEL: Record<string, string> = {
  pliage_secours: 'Pliage secours',
  revision_aad: 'Contrôle du déclencheur',
  revision_constructeur: 'Révision constructeur',
  inspection_conteneur: 'Contrôle du harnais',
  controle_altimetre: 'Contrôle altimètre',
  remplacement_cartouche: 'Remplacement de cartouche',
  autre: 'Opération',
};

const TYPE_LABEL: Record<string, string> = {
  parachute_principal: 'Voile principale',
  parachute_secours: 'Voile de secours',
  aad: 'Déclencheur',
  harnais: 'Sac-harnais',
};

function EcheancesInner({ centreId }: { centreId: string }) {
  const [lignes, setLignes] = useState<Echeance[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [seulementUrgent, setSeulementUrgent] = useState(true);
  const [relance, setRelance] = useState<'idle' | 'envoi' | 'fait'>('idle');
  // Les trois gestes du DT : ajouter, importer, et surtout ENREGISTRER une
  // opération — sans quoi un équipement reste « jamais contrôlé » à vie.
  const [ajout, setAjout] = useState(false);
  const [importCsv, setImportCsv] = useState(false);
  const [operation, setOperation] = useState<Echeance | null>(null);

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null);
    const { data, error } = await supabase.rpc('get_echeances_materiel', { p_centre_id: centreId });
    if (error) {
      console.error('Échéances matériel — chargement échoué :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(error.message); setChargement(false); return;
    }
    setLignes((data ?? []) as Echeance[]);
    setChargement(false);
  }, [centreId]);

  useEffect(() => { charger(); }, [charger]);

  if (chargement) return <LoaderParaPass taille={72} message={null} />;

  if (erreur) {
    return (
      <div className="rounded-2xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.10)',
        border: '1px solid rgba(239,68,68,0.35)', color: '#F87171' }}>
        Échéances indisponibles : {erreur}
        <button onClick={charger} className="ml-2 underline" style={{ minHeight: 32 }}>Réessayer</button>
      </div>
    );
  }

  const urgentes = lignes.filter(l => l.palier === 'depasse' || l.palier === 'inconnu' || l.palier === 'j30');
  const affichees = seulementUrgent ? urgentes : lignes;

  const relancer = async () => {
    // On prévient le PROPRIÉTAIRE : c'est lui qui fait réviser son matériel.
    // Une notification par équipement concerné, nommant l'équipement — « votre
    // matériel est en retard » sans dire lequel n'aide personne.
    const cibles = urgentes.filter(l => !l.est_parc_centre && l.proprietaire_id);
    if (cibles.length === 0) return;
    setRelance('envoi');
    const { error } = await supabase.from('notifications').insert(cibles.map(l => ({
      user_id: l.proprietaire_id!,
      titre: l.palier === 'depasse' ? 'Échéance matériel dépassée' : 'Échéance matériel à venir',
      message: `${TYPE_LABEL[l.type] ?? l.type}${l.marque ? ` ${l.marque}` : ''}`
        + `${l.numero_serie ? ` (n° ${l.numero_serie})` : ''} : `
        + (l.palier === 'inconnu'
            ? 'aucune opération enregistrée. Merci de faire le point avec le centre.'
            : l.palier === 'depasse'
              ? `échéance dépassée depuis le ${new Date(l.echeance!).toLocaleDateString('fr-FR')}.`
              : `échéance le ${new Date(l.echeance!).toLocaleDateString('fr-FR')}.`),
      type: l.palier === 'depasse' ? 'warning' : 'info',
      lue: false,
    })));
    if (error) {
      console.error('Relance échéances matériel — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      alert('La relance a échoué : ' + error.message);
      setRelance('idle');
      return;
    }
    setRelance('fait');
    setTimeout(() => setRelance('idle'), 4000);
  };

  return (
    <div className="rounded-2xl p-4 space-y-3"
      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--c-text)' }}>
            <Wrench className="w-4 h-4" style={{ color: '#60A5FA' }} aria-hidden />
            Échéances matériel
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--c-dim)' }}>
            {lignes.length} équipement{lignes.length > 1 ? 's' : ''} suivi{lignes.length > 1 ? 's' : ''}
            {urgentes.length > 0 && ` · ${urgentes.length} à traiter`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setAjout(true)}
            className="flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold"
            style={{ minHeight: 40, background: '#2563EB', color: '#fff' }}>
            <Plus className="w-3.5 h-3.5" aria-hidden /> Équipement
          </button>
          <button onClick={() => setImportCsv(true)}
            className="flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold"
            style={{ minHeight: 40, color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
            <Upload className="w-3.5 h-3.5" aria-hidden /> Importer
          </button>
        {lignes.length > urgentes.length && (
          <button onClick={() => setSeulementUrgent(v => !v)}
            className="flex items-center gap-1.5 px-3 rounded-full text-xs font-semibold"
            style={{ minHeight: 40,
              background: seulementUrgent ? '#2563EB' : 'var(--c-bg)',
              color: seulementUrgent ? '#fff' : 'var(--c-muted)',
              border: `1px solid ${seulementUrgent ? '#2563EB' : 'var(--c-border)'}` }}>
            <Filter className="w-3.5 h-3.5" aria-hidden />
            {seulementUrgent ? 'Ce qui presse' : 'Tout le parc'}
          </button>
        )}
        </div>
      </div>

      {affichees.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--c-dim)' }}>
          {lignes.length === 0
            ? 'Aucun équipement enregistré pour ce centre.'
            : 'Aucune échéance à traiter : tout le parc est à jour.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {affichees.map(l => {
            const p = PALIER[l.palier] ?? PALIER.ok;
            return (
              <li key={l.materiel_id + l.type_echeance} className="rounded-xl px-3 py-2.5"
                style={{ background: p.fond, border: `1px solid ${p.bord}` }}>
                <div className="flex items-start gap-2">
                  {l.est_parc_centre
                    ? <Building2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--c-dim)' }} aria-hidden />
                    : <User className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--c-dim)' }} aria-hidden />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>
                      {TYPE_LABEL[l.type] ?? l.type}
                      {l.marque && ` — ${l.marque}`}{l.modele && ` ${l.modele}`}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-dim)' }}>
                      {l.est_parc_centre ? 'Parc du centre' : l.proprietaire}
                      {l.numero_serie && ` · n° ${l.numero_serie}`}
                    </p>
                    <p className="text-xs mt-1" style={{ color: p.couleur, fontWeight: 600 }}>
                      {OP_LABEL[l.type_echeance] ?? l.type_echeance} — {p.label}
                      {l.echeance && ` (${new Date(l.echeance).toLocaleDateString('fr-FR')}`}
                      {l.echeance && l.jours_restants !== null &&
                        `, ${l.jours_restants < 0 ? `${-l.jours_restants} j de retard` : `dans ${l.jours_restants} j`})`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {l.qr_token && (
                      <span title="QR de l'équipement">
                        <QrCode className="w-4 h-4" style={{ color: 'var(--c-dim)' }} aria-hidden />
                      </span>
                    )}
                    <button onClick={() => setOperation(l)}
                      className="flex items-center gap-1 px-2 rounded-lg text-[11px] font-semibold"
                      style={{ minHeight: 32, color: '#60A5FA', border: '1px solid var(--c-border)' }}>
                      <CheckCircle2 className="w-3 h-3" aria-hidden /> Opération
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {urgentes.some(l => !l.est_parc_centre) && (
        <button onClick={relancer} disabled={relance === 'envoi'}
          className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-50"
          style={{ minHeight: 44, background: relance === 'fait' ? '#10B981' : 'var(--c-bg)',
            color: relance === 'fait' ? '#fff' : 'var(--c-text)', border: '1px solid var(--c-border)' }}>
          <Send className="w-4 h-4" aria-hidden />
          {relance === 'envoi' ? 'Envoi…'
            : relance === 'fait' ? 'Propriétaires prévenus'
            : `Prévenir ${urgentes.filter(l => !l.est_parc_centre && l.proprietaire_id).length} propriétaire(s)`}
        </button>
      )}
      {ajout && <AjouterEquipement centreId={centreId} onFait={charger} onFermer={() => setAjout(false)} />}
      {importCsv && <ImporterParc centreId={centreId} onFait={charger} onFermer={() => setImportCsv(false)} />}
      {operation && (
        <EnregistrerOperation
          materielId={operation.materiel_id}
          libelleMateriel={`${TYPE_LABEL[operation.type] ?? operation.type}${operation.marque ? ` — ${operation.marque}` : ''}`}
          typeDefaut={operation.type_echeance}
          onFait={charger} onFermer={() => setOperation(null)} />
      )}
    </div>
  );
}

export function EcheancesMateriel({ centreId }: { centreId: string }) {
  return <ErrorBoundary><EcheancesInner centreId={centreId} /></ErrorBoundary>;
}
