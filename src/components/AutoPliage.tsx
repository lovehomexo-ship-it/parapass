import { useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { fetchDernierPliageMateriel, declarerAutoPliage, type DernierPliage } from '../lib/pliage';
import { useComplianceRules, daysUntil } from '../lib/compliance';

/** État de pliage d'une voile perso + déclaration d'auto-pliage par le para.
 *  L'appli informe (pliage ancien signalé selon la règle paramétrée), ne bloque pas. */
export function AutoPliageBlock({ materielId, userId, centreId }: {
  materielId: string; userId: string | undefined; centreId: string | undefined;
}) {
  const [dernier, setDernier] = useState<DernierPliage | null>(null);
  const [charge, setCharge] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { rules } = useComplianceRules();

  useEffect(() => {
    fetchDernierPliageMateriel(materielId).then(d => { setDernier(d); setCharge(true); });
  }, [materielId]);

  const declarer = async () => {
    if (!userId) return;
    if (!centreId) { setError('Rejoignez une DZ pour déclarer un pliage.'); return; }
    setSaving(true);
    setError(null);
    const err = await declarerAutoPliage({ materielId, userId, centreId });
    setSaving(false);
    if (err) { setError(err); return; }
    setDernier(await fetchDernierPliageMateriel(materielId));
  };

  if (!charge) return null;

  const joursDepuis = dernier ? -(daysUntil(dernier.date_pliage) ?? 0) : null;
  const seuilAncien = rules.pliage_voile_ancien_jours ?? 30;
  const ancien = joursDepuis !== null && joursDepuis > seuilAncien;

  return (
    <div className="mt-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${ancien ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}` }}>
      <div className="flex items-center gap-2 flex-wrap">
        <PackageCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ancien ? '#FBBF24' : '#34D399' }} />
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {dernier
            ? <>Dernier pliage : <strong className="text-white">{new Date(dernier.date_pliage).toLocaleDateString('fr-FR')}</strong>
                {' — '}{dernier.type_pliage === 'auto' ? 'auto-déclaré' : `par ${dernier.plieur_nom ?? 'plieur habilité'}`}
                {ancien && <span style={{ color: '#FBBF24' }}> · plus de {seuilAncien} j (repère paramétré)</span>}</>
            : 'Aucun pliage enregistré pour cette voile.'}
        </span>
        <button onClick={declarer} disabled={saving}
          className="ml-auto text-xs font-semibold px-2.5 rounded-lg disabled:opacity-50"
          style={{ background: 'rgba(37,99,235,0.15)', color: '#60A5FA', border: '1px solid rgba(37,99,235,0.3)', minHeight: 32 }}>
          {saving ? '…' : 'Déclarer un auto-pliage'}
        </button>
      </div>
      {error && <p className="text-xs mt-1" style={{ color: '#FCA5A5' }}>⚠️ {error}</p>}
    </div>
  );
}
