import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Upload, CheckCircle2, X } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// P5 (suite) — les deux gestes qui rendent le module vivant.
//
//   • AJOUTER un équipement — sans quoi le parc reste vide.
//   • ENREGISTRER une opération — sans quoi tout reste « jamais contrôlé » à
//     vie, et l'écran ne fait que constater.
//
// Plus l'IMPORT CSV, parce qu'un centre équipé arrive avec un parc existant et
// ne le ressaisira pas ligne à ligne.
// ═══════════════════════════════════════════════════════════════════════════

const TYPES = [
  ['parachute_principal', 'Voile principale'],
  ['parachute_secours', 'Voile de secours'],
  ['aad', 'Déclencheur'],
  ['harnais', 'Sac-harnais'],
] as const;

// La colonne type_maintenance n'accepte que des CODES (contrainte en base) :
// on envoie le code, on affiche le libellé.
const OPERATIONS = [
  ['pliage_secours', 'Pliage secours'],
  ['revision_aad', 'Contrôle du déclencheur'],
  ['revision_constructeur', 'Révision constructeur'],
  ['inspection_conteneur', 'Contrôle du harnais'],
  ['controle_altimetre', 'Contrôle altimètre'],
  ['remplacement_cartouche', 'Remplacement de cartouche'],
  ['autre', 'Autre'],
] as const;

// ─── Ajouter un équipement ───────────────────────────────────────────────────

export function AjouterEquipement({ centreId, onFait, onFermer }: {
  centreId: string; onFait: () => void; onFermer: () => void;
}) {
  const [type, setType] = useState<string>('parachute_secours');
  const [marque, setMarque] = useState('');
  const [modele, setModele] = useState('');
  const [serie, setSerie] = useState('');
  const [proprietaire, setProprietaire] = useState('');   // '' ⇒ parc du centre
  const [licencies, setLicencies] = useState<{ id: string; nom: string }[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('licencies_centres')
      .select('parachutiste_id, profiles!parachutiste_id!inner(id, nom, prenom, est_demo)')
      .eq('centre_id', centreId).eq('statut', 'actif').eq('profiles.est_demo', false)
      .then(({ data, error }) => {
        if (error) {
          console.error('Liste des licenciés — chargement échoué :', {
            code: error.code, message: error.message, details: error.details, hint: error.hint,
          });
          return;
        }
        // PostgREST peut rendre la relation comme objet OU comme tableau selon
        // la forme de la requête : on ne suppose ni l'un ni l'autre.
        type P = { id: string; nom: string; prenom: string };
        const l = (data ?? []).flatMap((d: { profiles: P | P[] | null }) => {
          const pr = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
          return pr ? [{ id: pr.id, nom: `${pr.prenom} ${pr.nom}` }] : [];
        }).sort((a, b) => a.nom.localeCompare(b.nom));
        setLicencies(l);
      });
  }, [centreId]);

  const valider = async () => {
    setEnvoi(true); setErreur(null);
    const { error } = await supabase.rpc('ajouter_equipement', {
      p_centre_id: centreId, p_type: type,
      p_marque: marque || null, p_modele: modele || null, p_numero_serie: serie || null,
      p_parachutiste_id: proprietaire || null,
    });
    setEnvoi(false);
    if (error) {
      console.error('Ajout d’équipement — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(error.message);
      return;
    }
    onFait(); onFermer();
  };

  const st = { minHeight: 44, background: 'var(--c-bg)',
    border: '1px solid var(--c-border)', color: 'var(--c-text)' } as const;

  return (
    <Modale titre="Ajouter un équipement" onFermer={onFermer}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Type *</span>
          <select value={type} onChange={e => setType(e.target.value)}
            className="w-full rounded-xl px-3 text-sm" style={st}>
            {TYPES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Propriétaire</span>
          <select value={proprietaire} onChange={e => setProprietaire(e.target.value)}
            className="w-full rounded-xl px-3 text-sm" style={st}>
            <option value="">Parc du centre</option>
            {licencies.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Marque</span>
          <input value={marque} onChange={e => setMarque(e.target.value)} placeholder="ex : Cypres"
            className="w-full rounded-xl px-3 text-sm" style={st} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Modèle</span>
          <input value={modele} onChange={e => setModele(e.target.value)} placeholder="ex : Expert 2"
            className="w-full rounded-xl px-3 text-sm" style={st} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Numéro de série</span>
          <input value={serie} onChange={e => setSerie(e.target.value)}
            className="w-full rounded-xl px-3 text-sm" style={st} />
        </label>
      </div>
      {erreur && <p className="text-xs" style={{ color: '#F87171' }}>{erreur}</p>}
      <Boutons onFermer={onFermer} onValider={valider} envoi={envoi} libelle="Ajouter" />
    </Modale>
  );
}

// ─── Enregistrer une opération ───────────────────────────────────────────────

export function EnregistrerOperation({ materielId, libelleMateriel, typeDefaut, onFait, onFermer }: {
  materielId: string; libelleMateriel: string; typeDefaut: string;
  onFait: () => void; onFermer: () => void;
}) {
  const [type, setType] = useState<string>(
    OPERATIONS.some(([c]) => c === typeDefaut) ? typeDefaut : OPERATIONS[0][0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [technicien, setTechnicien] = useState('');
  const [reference, setReference] = useState('');
  const [periodicite, setPeriodicite] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async () => {
    setEnvoi(true); setErreur(null);
    const { error } = await supabase.rpc('enregistrer_maintenance', {
      p_materiel_id: materielId, p_type: type, p_date: date,
      p_periodicite_mois: periodicite.trim() === '' ? null : Number(periodicite),
      p_technicien: technicien || null, p_reference: reference || null,
    });
    setEnvoi(false);
    if (error) {
      console.error('Enregistrement d’opération — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(error.message);
      return;
    }
    onFait(); onFermer();
  };

  const st = { minHeight: 44, background: 'var(--c-bg)',
    border: '1px solid var(--c-border)', color: 'var(--c-text)' } as const;

  return (
    <Modale titre="Enregistrer une opération" sousTitre={libelleMateriel} onFermer={onFermer}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Opération *</span>
          <select value={type} onChange={e => setType(e.target.value)}
            className="w-full rounded-xl px-3 text-sm" style={st}>
            {OPERATIONS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Date *</span>
          <input type="date" value={date} max={new Date().toISOString().slice(0, 10)}
            onChange={e => setDate(e.target.value)}
            className="w-full rounded-xl px-3 text-sm" style={st} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Intervenant</span>
          <input value={technicien} onChange={e => setTechnicien(e.target.value)} placeholder="Prénom NOM"
            className="w-full rounded-xl px-3 text-sm" style={st} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>
            Périodicité (mois)
          </span>
          <input value={periodicite} onChange={e => setPeriodicite(e.target.value)}
            placeholder="défaut du centre" inputMode="numeric"
            className="w-full rounded-xl px-3 text-sm" style={st} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>
            Référence du justificatif
          </span>
          <input value={reference} onChange={e => setReference(e.target.value)}
            placeholder="n° de carnet, bon d’intervention…"
            className="w-full rounded-xl px-3 text-sm" style={st} />
        </label>
      </div>
      <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
        La prochaine échéance est calculée depuis cette date. L’opération entre au
        journal de bord.
      </p>
      {erreur && <p className="text-xs" style={{ color: '#F87171' }}>{erreur}</p>}
      <Boutons onFermer={onFermer} onValider={valider} envoi={envoi} libelle="Enregistrer" />
    </Modale>
  );
}

// ─── Import CSV du parc ──────────────────────────────────────────────────────

export function ImporterParc({ centreId, onFait, onFermer }: {
  centreId: string; onFait: () => void; onFermer: () => void;
}) {
  const [rapport, setRapport] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);

  const importer = async (fichier: File) => {
    setEnvoi(true);
    const texte = await fichier.text();
    const lignes = texte.split(/\r?\n/).filter(l => l.trim() !== '');
    const sep = lignes[0].includes(';') ? ';' : ',';
    const entetes = lignes[0].split(sep).map(h => h.trim().toLowerCase());
    const idx = (n: string) => entetes.indexOf(n);
    const iType = idx('type'), iMarque = idx('marque'), iModele = idx('modele'),
          iSerie = idx('numero_serie');

    if (iType < 0) {
      setRapport(['❌ Colonne « type » absente. En-têtes attendus : type, marque, modele, numero_serie.']);
      setEnvoi(false);
      return;
    }

    const res: string[] = [];
    let ok = 0;
    // Une ligne à la fois : un fichier partiellement importé vaut mieux qu'un
    // échec global, et le rapport dit exactement ce qui a été refusé.
    for (const [n, ligne] of lignes.slice(1).entries()) {
      const c = ligne.split(sep).map(x => x.trim());
      const t = c[iType];
      if (!TYPES.some(([cle]) => cle === t)) {
        res.push(`Ligne ${n + 2} : type « ${t} » inconnu — ignorée.`);
        continue;
      }
      const { error } = await supabase.rpc('ajouter_equipement', {
        p_centre_id: centreId, p_type: t,
        p_marque: iMarque >= 0 ? c[iMarque] || null : null,
        p_modele: iModele >= 0 ? c[iModele] || null : null,
        p_numero_serie: iSerie >= 0 ? c[iSerie] || null : null,
        p_parachutiste_id: null,           // import = parc du centre
      });
      if (error) res.push(`Ligne ${n + 2} : ${error.message}`);
      else ok++;
    }
    res.unshift(`✅ ${ok} équipement(s) importé(s) dans le parc du centre.`);
    setRapport(res);
    setEnvoi(false);
    onFait();
  };

  return (
    <Modale titre="Importer un parc" onFermer={onFermer}
      sousTitre="Fichier CSV — colonnes : type, marque, modele, numero_serie">
      <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
        Types acceptés : {TYPES.map(([c]) => c).join(', ')}. Les lignes refusées
        sont listées ci-dessous ; les autres sont importées.
      </p>
      <label className="flex items-center justify-center gap-2 rounded-xl cursor-pointer"
        style={{ minHeight: 56, border: '1px dashed var(--c-border-f)', color: 'var(--c-muted)' }}>
        <Upload className="w-4 h-4" aria-hidden />
        <span className="text-sm font-semibold">{envoi ? 'Import en cours…' : 'Choisir un fichier CSV'}</span>
        <input type="file" accept=".csv,text/csv" className="hidden" disabled={envoi}
          onChange={e => { const f = e.target.files?.[0]; if (f) importer(f); }} />
      </label>
      {rapport.length > 0 && (
        <ul className="text-[11px] space-y-0.5 max-h-40 overflow-y-auto"
          style={{ color: 'var(--c-text2)' }}>
          {rapport.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      <div className="flex justify-end">
        <button onClick={onFermer} className="px-4 rounded-xl text-sm font-semibold"
          style={{ minHeight: 44, color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
          Fermer
        </button>
      </div>
    </Modale>
  );
}

// ─── Habillage commun ────────────────────────────────────────────────────────

function Modale({ titre, sousTitre, children, onFermer }: {
  titre: string; sousTitre?: string; children: React.ReactNode; onFermer: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onFermer} role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl p-4 space-y-3 max-h-[92vh] overflow-y-auto"
        style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-bold text-sm" style={{ color: 'var(--c-text)' }}>{titre}</h4>
            {sousTitre && <p className="text-xs mt-0.5" style={{ color: 'var(--c-dim)' }}>{sousTitre}</p>}
          </div>
          <button onClick={onFermer} className="p-1.5 rounded-lg flex-shrink-0"
            style={{ color: 'var(--c-muted)' }} aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Boutons({ onFermer, onValider, envoi, libelle }: {
  onFermer: () => void; onValider: () => void; envoi: boolean; libelle: string;
}) {
  return (
    <div className="flex gap-2 justify-end">
      <button onClick={onFermer} className="px-4 rounded-xl text-sm font-semibold"
        style={{ minHeight: 44, color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
        Annuler
      </button>
      <button onClick={onValider} disabled={envoi}
        className="flex items-center gap-1.5 px-4 rounded-xl text-sm font-bold disabled:opacity-50"
        style={{ minHeight: 44, background: '#2563EB', color: '#fff' }}>
        {envoi ? 'Enregistrement…' : <><CheckCircle2 className="w-4 h-4" aria-hidden />{libelle}</>}
      </button>
    </div>
  );
}

export { Plus };
