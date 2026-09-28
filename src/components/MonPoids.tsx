import { useEffect, useState } from 'react';
import { Scale, Check, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════
// MON POIDS — une seule saisie, et tout en découle.
//
// Il se saisissait jusqu'ici dans la carte « charge alaire », elle-même enfouie
// dans la fiche de CHAQUE matériel : introuvable. Et deux autres endroits
// écrivaient un poids sans le savoir — le check-in de présence et la planche
// d'avionnage. Trois nombres pour une personne, dont rien ne garantissait
// qu'ils parlaient du même sauteur.
//
// Ici, deux champs et un seul sens de lecture :
//   poids nu  +  équipement  =  masse embarquée
//   └─ la DT 48 lit celui-ci   └─ l'avion pèse celui-là
//
// La propagation est tenue par un déclencheur en base, pas par cet écran :
// quel que soit l'endroit d'où le poids est écrit, l'avion voit le même nombre.
// ═══════════════════════════════════════════════════════════════════════════

export function MonPoids({ userId }: { userId: string | undefined }) {
  const [nu, setNu] = useState<string>('');
  const [equipement, setEquipement] = useState<string>('');
  const [total, setTotal] = useState<number | null>(null);
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'ok' | 'erreur'>('repos');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from('profils_prives')
      .select('poids_nu_kg, poids_equipement_kg, poids_tout_equipe_kg')
      .eq('profile_id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error('Lecture du poids échouée :', error); return; }
        setNu(data?.poids_nu_kg != null ? String(Math.round(Number(data.poids_nu_kg))) : '');
        setEquipement(data?.poids_equipement_kg != null ? String(Math.round(Number(data.poids_equipement_kg))) : '');
        setTotal(data?.poids_tout_equipe_kg != null ? Math.round(Number(data.poids_tout_equipe_kg)) : null);
      });
  }, [userId]);

  const nombre = (s: string): number | null => {
    const v = s.trim().replace(',', '.');
    if (v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const enregistrer = async () => {
    if (!userId) return;
    const n = nombre(nu);
    const e = nombre(equipement);
    if (n === null) { setEtat('erreur'); setMessage('Indiquez au moins votre poids sans équipement.'); return; }
    if (n < 30 || n > 200) { setEtat('erreur'); setMessage('Poids attendu entre 30 et 200 kg.'); return; }
    if (e !== null && (e < 0 || e > 60)) { setEtat('erreur'); setMessage('Poids d’équipement attendu entre 0 et 60 kg.'); return; }

    setEtat('envoi'); setMessage(null);
    const { error } = await supabase.from('profils_prives').upsert({
      profile_id: userId, poids_nu_kg: n, poids_equipement_kg: e,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error('Enregistrement du poids échoué :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint });
      setEtat('erreur'); setMessage('Enregistrement refusé. Réessayez.');
      return;
    }
    setTotal(Math.round(n + (e ?? 0)));
    setEtat('ok'); setMessage('Poids enregistré.');
    setTimeout(() => setEtat('repos'), 2500);
  };

  const champ: React.CSSProperties = {
    width: '100%', minHeight: 44, borderRadius: 10, padding: '10px 12px', fontSize: 15,
    background: 'var(--c-input, var(--c-bg))', color: 'var(--c-text)',
    border: '1px solid var(--c-border-f)', outline: 'none',
  };

  return (
    <div className="rounded-2xl p-5"
      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
      <p className="flex items-center gap-2 mb-1" style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)' }}>
        <Scale className="w-4 h-4" aria-hidden /> Mon poids
      </p>
      <p className="mb-4" style={{ fontSize: 13, color: 'var(--c-muted)', lineHeight: 1.5 }}>
        Saisi une fois ici, il sert partout : la <strong>DT 48</strong> en déduit votre
        surface de voilure minimale, et votre DZ connaît votre masse à l’embarquement
        sans avoir à vous la redemander à chaque saut.
      </p>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <label style={{ fontSize: 12.5, color: 'var(--c-text2)' }}>
          Poids sans équipement (kg)
          <input type="number" inputMode="decimal" min={30} max={200} step={1}
            value={nu} onChange={e => setNu(e.target.value)}
            placeholder="ex : 75" className="mt-1" style={champ} />
          <span className="block mt-1" style={{ fontSize: 11.5, color: 'var(--c-muted)' }}>
            C’est ce poids-là que lit la DT 48 : le tableau fédéral ajoute
            l’équipement lui-même.
          </span>
        </label>

        <label style={{ fontSize: 12.5, color: 'var(--c-text2)' }}>
          Poids de l’équipement (kg)
          <input type="number" inputMode="decimal" min={0} max={60} step={1}
            value={equipement} onChange={e => setEquipement(e.target.value)}
            placeholder="ex : 11" className="mt-1" style={champ} />
          <span className="block mt-1" style={{ fontSize: 11.5, color: 'var(--c-muted)' }}>
            Sac complet, casque, combinaison. Laissez vide si vous ne le
            connaissez pas encore.
          </span>
        </label>
      </div>

      {/* LE TOTAL NE SE SAISIT PAS : il se déduit. Un troisième champ modifiable
          serait un troisième nombre à maintenir, et c'est précisément ce qu'on
          vient de supprimer. */}
      <div className="mt-4 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
        <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>
          Masse embarquée — celle que voit votre DZ
        </span>
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text)' }}>
          {total !== null ? `${total} kg` : '—'}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button type="button" onClick={enregistrer} disabled={etat === 'envoi'}
          className="px-4 rounded-xl font-bold text-white disabled:opacity-60"
          style={{ minHeight: 44, background: '#F97316', fontSize: 14 }}>
          {etat === 'envoi' ? 'Enregistrement…' : 'Enregistrer mon poids'}
        </button>
        {message && (
          <span role="status" className="flex items-center gap-1.5"
            style={{ fontSize: 13, color: etat === 'erreur' ? 'var(--sev-critique)' : 'var(--sev-conforme)' }}>
            {etat === 'ok' && <Check className="w-4 h-4" aria-hidden />}
            {message}
          </span>
        )}
      </div>

      {/* P5 : on dit ce qui sort d'ici et ce qui n'en sort pas. Un poids est une
          donnée personnelle ; la masse embarquée est une donnée de sécurité. */}
      <p className="mt-3 flex items-start gap-1.5" style={{ fontSize: 11.5, color: 'var(--c-muted)' }}>
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden />
        <span>
          Votre DZ voit la <strong>masse embarquée</strong>, dont elle a besoin pour
          le centrage de l’avion. Votre poids sans équipement ne lui est pas montré :
          il ne sert qu’au calcul de la voilure minimale.
        </span>
      </p>
    </div>
  );
}
