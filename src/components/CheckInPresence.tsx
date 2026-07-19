import { useEffect, useState } from 'react';
import { MapPin, CheckCircle, LogOut, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useMaPresence, hhmm } from '../lib/presence';
import { useBriefingDuJour, useBriefingAck } from '../lib/briefing';
import type { Materiel } from '../lib/types';

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
  color: 'white', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%',
};

const maintenantArrondi = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${d.getMinutes() < 30 ? '30' : '00'}`;
};

/** Fin par défaut TOUJOURS cohérente : 18:00 si on est le matin, sinon
 *  début + 2 h plafonné à 23:30 — jamais une heure déjà passée. */
const finParDefaut = (debut: string) => {
  const [h, m] = debut.split(':').map(Number);
  if (h < 16) return '18:00';
  const finH = Math.min(h + 2, 23);
  return `${String(finH).padStart(2, '0')}:${finH === 23 ? '30' : String(m).padStart(2, '0')}`;
};

/** Check-in « Je suis présent aujourd'hui » — 15 secondes, pas un questionnaire.
 *  Fonctionne seul : voiles perso proposées si le module matériel en a,
 *  saisie libre sinon ; n° de voile de location en saisie libre (flotte DZ
 *  enregistrée plus tard → voile_location_ref deviendra une référence). */
export function CheckInPresence({ dzs, userId }: { dzs: { id: string; nom: string }[]; userId: string | undefined }) {
  const [dzId, setDzId] = useState<string | null>(null);
  useEffect(() => { if (!dzId && dzs.length > 0) setDzId(dzs[0].id); }, [dzs, dzId]);

  const { presence, checkIn, quitter, saving, error } = useMaPresence(dzId ?? undefined, userId);
  const { briefing, circuit } = useBriefingDuJour(dzId ?? undefined);
  const { ackAt } = useBriefingAck(briefing?.id, userId, briefing?.published_at);

  const [ouvert, setOuvert] = useState(false);
  const [debut, setDebut] = useState(maintenantArrondi());
  const [fin, setFin] = useState(() => finParDefaut(maintenantArrondi()));
  const [erreurPlage, setErreurPlage] = useState<string | null>(null);
  const [materielType, setMaterielType] = useState<'perso' | 'location'>('perso');
  const [voilesPerso, setVoilesPerso] = useState<Materiel[]>([]);
  const [voilePersoRef, setVoilePersoRef] = useState<string | null>(null);
  const [voilePersoLibre, setVoilePersoLibre] = useState('');
  const [voileLocation, setVoileLocation] = useState('');
  const [okMsg, setOkMsg] = useState(false);

  // Voiles perso du module matériel — optionnel, jamais bloquant
  useEffect(() => {
    if (!userId) return;
    supabase.from('materiels')
      .select('*')
      .eq('parachutiste_id', userId)
      .eq('type', 'parachute_principal')
      .eq('statut', 'actif')
      .then(({ data, error }) => {
        if (error) { console.error('Chargement voiles perso échoué :', error); return; }
        const list = (data ?? []) as Materiel[];
        setVoilesPerso(list);
        if (list.length > 0) setVoilePersoRef(list[0].id);
      });
  }, [userId]);

  // Pré-remplissage à la modification
  useEffect(() => {
    if (!presence || presence.statut !== 'present') return;
    setDebut(hhmm(presence.heure_debut));
    setFin(hhmm(presence.heure_fin));
    setMaterielType(presence.materiel_type);
    setVoilePersoRef(presence.voile_perso_ref);
    setVoilePersoLibre(presence.voile_perso_libre ?? '');
    setVoileLocation(presence.voile_location_ref ?? '');
  }, [presence?.id, presence?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  if (dzs.length === 0 || !userId) return null;

  const dzNom = dzs.find(d => d.id === dzId)?.nom ?? '';
  const sensLabel = circuit?.sens === 'main_droite' ? 'main droite' : 'main gauche';

  const valider = async () => {
    if (!dzId) return;
    // Plage cohérente obligatoire : la fin doit être après le début
    if (fin <= debut) {
      setErreurPlage('L\'heure de fin doit être après l\'heure de début.');
      return;
    }
    setErreurPlage(null);
    const ok = await checkIn({
      dz_id: dzId,
      heure_debut: debut,
      heure_fin: fin,
      materiel_type: materielType,
      voile_perso_ref: materielType === 'perso' ? voilePersoRef : null,
      voile_perso_libre: materielType === 'perso' && !voilePersoRef ? (voilePersoLibre.trim() || null) : null,
      voile_location_ref: materielType === 'location' ? (voileLocation.trim() || null) : null,
    });
    if (ok) {
      setOuvert(false);
      setOkMsg(true);
      setTimeout(() => setOkMsg(false), 3000);
    }
  };

  // ── Statut « présent » : résumé modifiable / annulable ──
  if (presence?.statut === 'present' && !ouvert) {
    return (
      <div className="rounded-2xl px-4 py-3 mb-3 flex items-center gap-2 flex-wrap"
        style={{ background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.4)' }}>
        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#34D399' }} />
        <span className="text-sm font-bold" style={{ color: '#6EE7B7' }}>
          Présent{dzs.length > 1 ? ` à ${dzNom}` : ''} — de {hhmm(presence.heure_debut)} à {hhmm(presence.heure_fin)}
        </span>
        {okMsg && <span className="text-xs" style={{ color: '#34D399' }}>enregistré ✓</span>}
        <span className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setOuvert(true)} className="flex items-center gap-1 text-xs font-semibold px-2.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#E2E8F0', minHeight: 36 }}>
            <Pencil className="w-3 h-3" /> Modifier
          </button>
          <button onClick={quitter} className="flex items-center gap-1 text-xs font-semibold px-2.5 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', minHeight: 36 }}>
            <LogOut className="w-3 h-3" /> Je quitte la DZ
          </button>
        </span>
        {error && <p className="w-full text-xs" style={{ color: '#FCA5A5' }}>⚠️ {error}</p>}
      </div>
    );
  }

  // ── Bouton fermé ──
  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)}
        className="w-full rounded-2xl px-4 py-3 mb-3 flex items-center justify-center gap-2 text-sm font-bold text-white"
        style={{ background: '#2563EB', boxShadow: '0 4px 14px rgba(37,99,235,0.35)', minHeight: 48 }}>
        <MapPin className="w-4 h-4" /> Je suis présent aujourd'hui
      </button>
    );
  }

  // ── Formulaire court ──
  return (
    <div className="rounded-2xl p-4 mb-3 space-y-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(37,99,235,0.4)' }}>
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <MapPin className="w-4 h-4" style={{ color: '#60A5FA' }} /> Ma présence aujourd'hui
      </h3>

      {dzs.length > 1 && (
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>DZ</label>
          <select value={dzId ?? ''} onChange={e => setDzId(e.target.value)} style={inputStyle}>
            {dzs.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>De</label>
          <input type="time" value={debut} onChange={e => setDebut(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>À</label>
          <input type="time" value={fin} onChange={e => setFin(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Matériel</label>
        <div className="flex rounded-lg overflow-hidden mb-2" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
          {([['perso', 'Voile perso'], ['location', 'Location DZ']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setMaterielType(k)}
              className="flex-1 py-2.5 text-xs font-semibold"
              style={{ background: materielType === k ? '#2563EB' : 'transparent', color: materielType === k ? 'white' : 'rgba(255,255,255,0.5)' }}>
              {label}
            </button>
          ))}
        </div>
        {materielType === 'perso' ? (
          voilesPerso.length > 0 ? (
            <select value={voilePersoRef ?? 'libre'} onChange={e => setVoilePersoRef(e.target.value === 'libre' ? null : e.target.value)} style={inputStyle}>
              {voilesPerso.map(v => (
                <option key={v.id} value={v.id}>{v.marque} {v.modele}{v.taille_voile_ft2 ? ` — ${v.taille_voile_ft2} ft²` : ''}</option>
              ))}
              <option value="libre">Autre voile (saisie libre)</option>
            </select>
          ) : null
        ) : (
          <input type="text" placeholder="N° de la voile louée (ex : 7)" value={voileLocation}
            onChange={e => setVoileLocation(e.target.value)} style={inputStyle} />
        )}
        {materielType === 'perso' && (voilesPerso.length === 0 || voilePersoRef === null) && (
          <input type="text" placeholder="Modèle + taille (ex : Sabre 3 150)" value={voilePersoLibre}
            onChange={e => setVoilePersoLibre(e.target.value)} style={{ ...inputStyle, marginTop: 8 }} />
        )}
      </div>

      {/* Briefing du jour — intégré, jamais bloquant : l'appli informe */}
      {briefing && (
        ackAt ? (
          <p className="text-xs flex items-center gap-1.5" style={{ color: '#34D399' }}>
            <CheckCircle className="w-3.5 h-3.5" /> Briefing acquitté — circuit {sensLabel}
          </p>
        ) : (
          <div className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap"
            style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.35)' }}>
            <span className="text-xs font-semibold" style={{ color: '#FDBA74' }}>Briefing du jour non acquitté</span>
            <button
              onClick={() => document.querySelector('[id^="briefing-card-"]')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-xs font-bold px-3 rounded-lg text-white" style={{ background: '#F97316', minHeight: 36 }}>
              Lire le briefing
            </button>
          </div>
        )
      )}

      {erreurPlage && <p className="text-xs" style={{ color: '#FCA5A5' }}>⚠️ {erreurPlage}</p>}
      {error && <p className="text-xs" style={{ color: '#FCA5A5' }}>⚠️ {error}</p>}

      <div className="flex gap-2">
        <button onClick={valider} disabled={saving}
          className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
          style={{ background: '#2563EB', minHeight: 48 }}>
          {saving ? 'Enregistrement…' : 'Valider ma présence'}
        </button>
        <button onClick={() => setOuvert(false)} className="px-4 rounded-xl text-sm" style={{ color: 'rgba(255,255,255,0.5)', minHeight: 48 }}>
          Annuler
        </button>
      </div>
    </div>
  );
}
