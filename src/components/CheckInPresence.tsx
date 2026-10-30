import { useEffect, useState } from 'react';
import { MapPin, CheckCircle, LogOut, Pencil, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useMaPresence, hhmm, dernierePresence, EQUIPEMENTS, libelleEquipement, type Equipement, type DzPresence } from '../lib/presence';
import { useBriefingDuJour, useBriefingAck } from '../lib/briefing';
import type { Materiel } from '../lib/types';

const inputStyle: React.CSSProperties = {
  background: 'var(--c-hover)', border: '1px solid var(--c-border)',
  color: 'var(--c-text)', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%',
  boxSizing: 'border-box',
};

// Champs <input type="time"> : la hauteur intrinsèque varie selon le navigateur
// (icône horloge, segments HH:MM du picker natif) → « De » et « À » se
// désalignaient au focus/édition/mobile. On fige donc hauteur + box-sizing pour
// une taille strictement identique en toutes circonstances, tout en gardant
// minWidth:0 pour que la grille ne se déforme pas sur petit écran.
const timeInputStyle: React.CSSProperties = {
  ...inputStyle, height: 44, minWidth: 0, lineHeight: '1.2',
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
export function CheckInPresence({ dzs, userId, openSignal }: { dzs: { id: string; nom: string }[]; userId: string | undefined; openSignal?: number }) {
  const [dzId, setDzId] = useState<string | null>(null);
  useEffect(() => { if (!dzId && dzs.length > 0) setDzId(dzs[0].id); }, [dzs, dzId]);

  const { presence, checkIn, quitter, saving, error } = useMaPresence(dzId ?? undefined, userId);
  const { briefing, circuit } = useBriefingDuJour(dzId ?? undefined);
  const { ackAt } = useBriefingAck(briefing?.id, userId, briefing?.published_at);

  const [ouvert, setOuvert] = useState(false);
  // Ouverture pilotée de l'extérieur (bouton « Présence » de la barre mobile).
  useEffect(() => { if (openSignal) setOuvert(true); }, [openSignal]);
  const [debut, setDebut] = useState(maintenantArrondi());
  const [fin, setFin] = useState(() => finParDefaut(maintenantArrondi()));
  const [erreurPlage, setErreurPlage] = useState<string | null>(null);
  const [materielType, setMaterielType] = useState<'perso' | 'location'>('perso');
  const [voilesPerso, setVoilesPerso] = useState<Materiel[]>([]);
  const [voilePersoRef, setVoilePersoRef] = useState<string | null>(null);
  const [voilePersoLibre, setVoilePersoLibre] = useState('');
  const [voileLocation, setVoileLocation] = useState('');
  const [okMsg, setOkMsg] = useState(false);
  // Masse : lue sur le profil, pas sur la présence — on ne la redemande pas
  // chaque matin. Chaîne vide = « je ne dis pas », et c'est un choix valide.
  const [masse, setMasse] = useState('');
  // Ce qu'il emporte : coché en un toucher, repris de la dernière fois.
  const [equipements, setEquipements] = useState<Equipement[]>([]);
  // La dernière venue : de quoi proposer « comme la dernière fois » en un geste.
  const [derniere, setDerniere] = useState<DzPresence | null>(null);

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

  // La masse déjà connue : on la propose, on ne la redemande pas.
  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles').select('masse_kg').eq('id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error('Lecture de la masse échouée :', error); return; }
        const m = (data as { masse_kg?: number | null } | null)?.masse_kg;
        if (m != null) setMasse(String(m));
      });
  }, [userId]);

  // La dernière venue préremplit tout : matériel, voile, équipement.
  useEffect(() => {
    if (!userId || !dzId) return;
    let annule = false;
    dernierePresence(userId, dzId).then(d => {
      if (annule || !d) return;
      setDerniere(d);
      setMaterielType(d.materiel_type);
      if (d.voile_perso_ref) setVoilePersoRef(d.voile_perso_ref);
      setVoilePersoLibre(d.voile_perso_libre ?? '');
      setVoileLocation(d.voile_location_ref ?? '');
      setEquipements((d.equipements ?? []) as Equipement[]);
    });
    return () => { annule = true; };
  }, [userId, dzId]);

  // Pré-remplissage à la modification
  useEffect(() => {
    if (!presence || presence.statut !== 'present') return;
    setDebut(hhmm(presence.heure_debut));
    setFin(hhmm(presence.heure_fin));
    setMaterielType(presence.materiel_type);
    setVoilePersoRef(presence.voile_perso_ref);
    setVoilePersoLibre(presence.voile_perso_libre ?? '');
    setVoileLocation(presence.voile_location_ref ?? '');
    if (presence.equipements) setEquipements(presence.equipements as Equipement[]);
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
      // Laissé vide = on ne touche pas au profil. Effacer volontairement sa
      // masse reste possible en la remettant à vide APRÈS l'avoir saisie :
      // on écrit null, ce qui est différent de « ne rien dire ».
      masse_kg: masse.trim() === '' ? null : Number(masse.replace(',', '.')),
      equipements,
    });
    if (ok) {
      setOuvert(false);
      setOkMsg(true);
      setTimeout(() => setOkMsg(false), 3000);
    }
  };

  /** « Pilot 245 ft² · 82 kg · casque, altimètre » — ce qui partira sur la planche. */
  const resume = () => {
    const voile = materielType === 'location'
      ? `location${voileLocation.trim() ? ` n°${voileLocation.trim()}` : ''}`
      : (() => {
          const v = voilesPerso.find(x => x.id === voilePersoRef);
          return v ? [v.marque, v.modele, v.taille_voile_ft2 ? `${v.taille_voile_ft2} ft²` : null].filter(Boolean).join(' ')
            : voilePersoLibre.trim() || 'voile perso';
        })();
    return [voile, masse.trim() ? `${masse.trim()} kg` : null,
      equipements.length ? equipements.map(libelleEquipement).join(', ').toLowerCase() : null].filter(Boolean).join(' · ');
  };

  // ── Statut « présent » : résumé modifiable / annulable ──
  if (presence?.statut === 'present' && !ouvert) {
    return (
      <div className="rounded-2xl px-4 py-3 mb-3 flex items-center gap-2 flex-wrap"
        style={{ background: 'color-mix(in srgb, var(--sev-conforme) 10%, var(--c-card))', border: '1.5px solid color-mix(in srgb, var(--sev-conforme) 40%, transparent)' }}>
        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sev-conforme)' }} />
        <span className="text-sm font-bold" style={{ color: 'var(--sev-conforme)' }}>
          Présent{dzs.length > 1 ? ` à ${dzNom}` : ''} — de {hhmm(presence.heure_debut)} à {hhmm(presence.heure_fin)}
        </span>
        {okMsg && <span className="text-xs" style={{ color: 'var(--sev-conforme)' }}>enregistré ✓</span>}
        <span className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setOuvert(true)} className="flex items-center gap-1 text-xs font-semibold px-2.5 rounded-lg"
            style={{ background: 'var(--c-hover)', color: 'var(--c-text)', minHeight: 36 }}>
            <Pencil className="w-3 h-3" /> Modifier
          </button>
          <button onClick={quitter} className="flex items-center gap-1 text-xs font-semibold px-2.5 rounded-lg"
            style={{ background: 'color-mix(in srgb, var(--sev-critique) 12%, transparent)', color: 'var(--sev-critique)', minHeight: 36 }}>
            <LogOut className="w-3 h-3" /> Je quitte la DZ
          </button>
        </span>
        {error && <p className="w-full text-xs" style={{ color: 'var(--sev-critique)' }}><AlertTriangle className="w-3.5 h-3.5 inline-block mr-1 align-[-2px]" aria-hidden /> {error}</p>}
      </div>
    );
  }

  // ── Bouton fermé ──
  // DÉJÀ VENU : un seul geste. Retour du DT de Rochefort — les solos arrivent
  // à la dernière minute ; s'ils doivent remplir un formulaire, ils ne le font
  // pas. Tout est repris de la dernière fois ; on ne l'ouvre que pour changer.
  if (!ouvert && derniere) {
    return (
      <div className="rounded-2xl p-3 mb-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
        <button onClick={valider} disabled={saving}
          className="w-full rounded-xl px-4 flex items-center justify-center gap-2 text-[15px] font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--action-fond, #2563EB)', minHeight: 52 }}>
          <MapPin className="w-4 h-4" aria-hidden /> {saving ? 'Enregistrement…' : 'Je suis là — comme la dernière fois'}
        </button>
        <p className="text-[13px] mt-2 flex items-center gap-2 flex-wrap" style={{ color: 'var(--c-muted)' }}>
          <span className="flex-1 min-w-0">{resume()}{dzs.length > 1 ? ` · ${dzNom}` : ''} · jusqu’à {fin.replace(':', ' h ')}</span>
          <button onClick={() => setOuvert(true)} className="font-semibold px-2 rounded-lg"
            style={{ color: 'var(--accent-texte)', minHeight: 36 }}>
            Changer
          </button>
        </p>
        {error && <p className="text-xs mt-1" style={{ color: 'var(--sev-critique)' }}><AlertTriangle className="w-3.5 h-3.5 inline-block mr-1 align-[-2px]" aria-hidden /> {error}</p>}
      </div>
    );
  }

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)}
        className="w-full rounded-2xl px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)', minHeight: 48 }}>
        <MapPin className="w-4 h-4" style={{ color: '#60A5FA' }} /> Je suis présent aujourd'hui
      </button>
    );
  }

  // ── Formulaire court ──
  return (
    <div className="rounded-2xl p-4 mb-3 space-y-3" style={{ background: 'var(--c-card)', border: '1px solid rgba(37,99,235,0.4)' }}>
      <h3 className="text-sm font-bold  flex items-center gap-2" style={{ color: 'var(--c-text)' }}>
        <MapPin className="w-4 h-4" style={{ color: '#60A5FA' }} /> Ma présence aujourd'hui
      </h3>

      {dzs.length > 1 && (
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--c-muted)' }}>DZ</label>
          <select value={dzId ?? ''} onChange={e => setDzId(e.target.value)} style={inputStyle}>
            {dzs.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--c-muted)' }}>De</label>
          <input type="time" value={debut} onChange={e => setDebut(e.target.value)} style={timeInputStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--c-muted)' }}>À</label>
          <input type="time" value={fin} onChange={e => setFin(e.target.value)} style={timeInputStyle} />
        </div>
      </div>

      {/* La masse sert au chargement de l'avion : le chef d'avionnage remplit
          par les kilos avant de remplir par les sièges. Facultative — une
          présence ne se refuse pas parce qu'on n'a pas dit son poids. */}
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--c-muted)' }}>
          Masse équipée (kg) <span style={{ fontWeight: 400, opacity: 0.6 }}>— facultatif</span>
        </label>
        <input type="number" inputMode="decimal" min={20} max={250} step={0.5}
          value={masse} onChange={e => setMasse(e.target.value)}
          placeholder="ex : 82"
          style={timeInputStyle} />
        <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>
          Sert au chargement de l’avion. Retenue pour les prochaines fois.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--c-muted)' }}>Matériel</label>
        <div className="flex rounded-lg overflow-hidden mb-2" style={{ border: '1px solid var(--c-border)' }}>
          {([['perso', 'Voile perso'], ['location', 'Location DZ']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setMaterielType(k)}
              className="flex-1 py-2.5 text-xs font-semibold"
              style={{ background: materielType === k ? 'var(--action-fond)' : 'transparent', color: materielType === k ? 'white' : 'var(--c-muted)' }}>
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

      {/* AVEC MOI — un toucher par objet, repris la fois suivante. Il part
          tout seul sur la planche : la DZ n'a plus à le demander. */}
      <div>
        <span className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--c-muted)' }}>Avec moi</span>
        <div role="group" aria-label="Équipement emporté" className="flex flex-wrap gap-2">
          {EQUIPEMENTS.map(([k, lib]) => {
            const actif = equipements.includes(k);
            return (
              <button key={k} type="button" aria-pressed={actif}
                onClick={() => setEquipements(e => actif ? e.filter(x => x !== k) : [...e, k])}
                className="px-3 rounded-full text-[13px] font-semibold"
                style={{ minHeight: 36, background: actif ? 'var(--action-fond)' : 'var(--c-hover)', color: actif ? '#fff' : 'var(--c-text2, var(--c-text))' }}>
                {actif ? '✓ ' : ''}{lib}
              </button>
            );
          })}
        </div>
      </div>

      {/* Briefing du jour — intégré, jamais bloquant : l'appli informe */}
      {briefing && (
        ackAt ? (
          <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--sev-conforme)' }}>
            <CheckCircle className="w-3.5 h-3.5" /> Briefing acquitté — circuit {sensLabel}
          </p>
        ) : (
          <div className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap"
            style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.35)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--accent-texte)' }}>Briefing du jour non acquitté</span>
            <button
              onClick={() => document.querySelector('[id^="briefing-card-"]')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-xs font-bold px-3 rounded-lg text-white" style={{ background: 'var(--accent-fond)', minHeight: 36 }}>
              Lire le briefing
            </button>
          </div>
        )
      )}

      {erreurPlage && <p className="text-xs" style={{ color: 'var(--sev-critique)' }}><AlertTriangle className="w-3.5 h-3.5 inline-block mr-1 align-[-2px]" aria-hidden /> {erreurPlage}</p>}
      {error && <p className="text-xs" style={{ color: 'var(--sev-critique)' }}><AlertTriangle className="w-3.5 h-3.5 inline-block mr-1 align-[-2px]" aria-hidden /> {error}</p>}

      <div className="flex gap-2">
        <button onClick={valider} disabled={saving}
          className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
          style={{ background: '#2563EB', minHeight: 48 }}>
          {saving ? 'Enregistrement…' : 'Valider ma présence'}
        </button>
        <button onClick={() => setOuvert(false)} className="px-4 rounded-xl text-sm" style={{ color: 'var(--c-muted)', minHeight: 48 }}>
          Annuler
        </button>
      </div>
    </div>
  );
}
