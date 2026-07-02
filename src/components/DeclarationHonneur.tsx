import { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

interface Props {
  profile: Profile;
  userId: string;
  onClose: () => void;
  onConfirmed: (nb: number) => void;
}

type Methode = 'honneur' | 'dt' | 'ocr';

const METHODES = [
  {
    value: 'honneur' as Methode,
    titre: '📋 Déclaration sur l\'honneur',
    description: 'Je certifie sur l\'honneur avoir effectué ce nombre de sauts. Cette déclaration est archivée et horodatée.',
    badge: 'Recommandé',
    badgeColor: '#10B981',
  },
  {
    value: 'dt' as Methode,
    titre: '🎓 Validation par le Directeur Technique',
    description: 'Le DT de votre centre confirme votre solde de sauts. Plus robuste réglementairement.',
    badge: 'Renforcé',
    badgeColor: '#3B82F6',
  },
  {
    value: 'ocr' as Methode,
    titre: '📸 Import carnet papier (OCR)',
    description: 'Vous allez photographier votre carnet papier. Claude Vision extraira les données automatiquement.',
    badge: 'Précis',
    badgeColor: '#A78BFA',
  },
];

export function DeclarationHonneur({ profile, userId, onClose, onConfirmed }: Props) {
  const [etape, setEtape] = useState<1 | 2>(1);
  const [nbSauts, setNbSauts] = useState('');
  const [premiereSaison, setPremiereSaison] = useState('');
  const [dernieresDZ, setDernieresDZ] = useState('');
  const [brevet, setBrevet] = useState(profile?.brevet || '');
  const [methode, setMethode] = useState<Methode>('honneur');
  const [nomDT, setNomDT] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nb = parseInt(nbSauts) || 0;
  const canProceed = nbSauts !== '' && nb >= 1;
  const canConfirm = accepted && canProceed && (methode !== 'dt' || nomDT.trim().length > 0);

  const handleConfirmer = async () => {
    if (!canConfirm) return;
    setLoading(true);
    setError(null);

    try {
      const obsLines = [
        `Première saison : ${premiereSaison || 'non renseignée'}`,
        `DZ pratiquées : ${dernieresDZ || 'non renseignées'}`,
        `Méthode : ${methode === 'honneur' ? "Déclaration sur l'honneur" : methode === 'dt' ? `Validé par DT : ${nomDT}` : 'Import OCR carnet papier'}`,
      ];

      const { error: insertErr } = await supabase.from('sauts').insert({
        parachutiste_id: userId,
        date_saut: new Date().toISOString().split('T')[0],
        lieu: dernieresDZ?.split(',')[0]?.trim() || 'Historique',
        nature_saut: 'entrainement',
        categorie: 'OC',
        hauteur_m: 4000,
        fonction: 'parachutiste',
        programme: `Solde antérieur — ${nb} sauts déclarés sur l'honneur`,
        observations: obsLines.join('. '),
        statut: 'declaration_honneur',
        source: 'declaration_honneur',
        nb_sauts_declares: nb,
      });

      if (insertErr) throw insertErr;

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          total_sauts: nb,
          declaration_honneur_faite: true,
          declaration_honneur_nb: nb,
          declaration_honneur_date: new Date().toISOString(),
          declaration_honneur_methode: methode,
          ...(brevet ? { brevet } : {}),
        })
        .eq('id', userId);

      if (updateErr) throw updateErr;

      onConfirmed(nb);
      onClose();
    } catch (err) {
      console.error('Erreur déclaration:', err);
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--c-dropdown)', border: '1px solid var(--c-border)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--c-border)', background: 'rgba(167,139,250,0.08)' }}
        >
          <div>
            <h2 className="font-bold text-base" style={{ color: 'var(--c-text)' }}>
              📋 Déclaration de sauts antérieurs
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
              Conforme à la réglementation FFP — Art. L321-1 Code du sport
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{ color: 'var(--c-muted)', background: 'var(--c-hover)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-5 pt-4 gap-2 flex-shrink-0">
          {[1, 2].map(s => (
            <div
              key={s}
              className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: etape === s ? '#A78BFA' : 'var(--c-dim)' }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{
                  background: etape === s ? '#A78BFA' : etape > s ? '#10B981' : 'var(--c-hover)',
                  color: etape >= s ? '#fff' : 'var(--c-dim)',
                }}
              >
                {etape > s ? '✓' : s}
              </div>
              {s === 1 ? 'Informations' : 'Validation'}
              {s < 2 && <span style={{ color: 'var(--c-border-f)' }}>→</span>}
            </div>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {etape === 1 && (
            <>
              {/* Info réglementaire */}
              <div
                className="rounded-xl p-3 text-xs"
                style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', color: 'var(--c-text2)', lineHeight: 1.6 }}
              >
                <strong style={{ color: '#A78BFA' }}>ℹ️ Procédure FFP</strong> — Cette déclaration est
                identique à celle utilisée pour les carnets perdus ou endommagés. Elle est
                horodatée et archivée.
              </div>

              {/* Nombre de sauts */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
                  Nombre total de sauts à déclarer *
                </label>
                <input
                  type="number"
                  value={nbSauts}
                  onChange={e => setNbSauts(e.target.value)}
                  placeholder="Ex: 247"
                  min="1"
                  max="99999"
                  className="w-full rounded-xl text-center font-bold text-2xl outline-none transition-colors"
                  style={{
                    padding: '14px',
                    border: '1px solid var(--c-border-f)',
                    background: 'var(--c-surface)',
                    color: 'var(--c-text)',
                  }}
                />
                {nb > 0 && (
                  <p className="text-xs text-center mt-1.5" style={{ color: '#A78BFA' }}>
                    Votre prochain saut dans ParaPass sera le n°{nb + 1}
                  </p>
                )}
              </div>

              {/* Brevet */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
                  Brevet obtenu
                </label>
                <div className="flex gap-2">
                  {['BPA', 'A', 'B', 'C', 'D'].map(b => (
                    <button
                      key={b}
                      onClick={() => setBrevet(brevet === b ? '' : b)}
                      className="flex-1 rounded-lg text-xs font-bold transition-all"
                      style={{
                        padding: '8px 4px',
                        border: `1px solid ${brevet === b ? '#F97316' : 'var(--c-border-f)'}`,
                        background: brevet === b ? 'rgba(249,115,22,0.15)' : 'transparent',
                        color: brevet === b ? '#F97316' : 'var(--c-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Première saison */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
                  Année du premier saut (optionnel)
                </label>
                <input
                  type="number"
                  value={premiereSaison}
                  onChange={e => setPremiereSaison(e.target.value)}
                  placeholder="Ex: 2018"
                  min="1960"
                  max="2026"
                  className="w-full rounded-xl outline-none"
                  style={{
                    padding: '10px 14px',
                    border: '1px solid var(--c-border-f)',
                    background: 'var(--c-surface)',
                    color: 'var(--c-text)',
                    fontSize: 13,
                  }}
                />
              </div>

              {/* DZ principales */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
                  DZ principale(s) pratiquées (optionnel)
                </label>
                <textarea
                  value={dernieresDZ}
                  onChange={e => setDernieresDZ(e.target.value)}
                  placeholder="Ex: BigAir Rochefort, Gap-Tallard"
                  rows={2}
                  className="w-full rounded-xl outline-none resize-none"
                  style={{
                    padding: '10px 14px',
                    border: '1px solid var(--c-border-f)',
                    background: 'var(--c-surface)',
                    color: 'var(--c-text)',
                    fontSize: 13,
                  }}
                />
              </div>

              <button
                onClick={() => setEtape(2)}
                disabled={!canProceed}
                className="w-full rounded-xl font-semibold text-sm transition-all"
                style={{
                  padding: '12px',
                  background: canProceed ? '#A78BFA' : 'var(--c-hover)',
                  color: canProceed ? '#fff' : 'var(--c-dim)',
                  border: 'none',
                  cursor: canProceed ? 'pointer' : 'not-allowed',
                }}
              >
                Continuer →
              </button>
            </>
          )}

          {etape === 2 && (
            <>
              {/* Méthode de validation */}
              <div>
                <label className="block text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
                  Méthode de validation
                </label>
                <div className="space-y-2">
                  {METHODES.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setMethode(opt.value)}
                      className="w-full text-left rounded-xl transition-all"
                      style={{
                        padding: '12px 14px',
                        border: `1px solid ${methode === opt.value ? opt.badgeColor : 'var(--c-border-f)'}`,
                        background: methode === opt.value ? `${opt.badgeColor}18` : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>
                          {opt.titre}
                        </span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${opt.badgeColor}20`, color: opt.badgeColor }}
                        >
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--c-muted)', lineHeight: 1.5 }}>
                        {opt.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nom DT si validation DT */}
              {methode === 'dt' && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
                    Nom du Directeur Technique *
                  </label>
                  <input
                    type="text"
                    value={nomDT}
                    onChange={e => setNomDT(e.target.value)}
                    placeholder="Ex: Johnny Guérin"
                    className="w-full rounded-xl outline-none"
                    style={{
                      padding: '10px 14px',
                      border: '1px solid var(--c-border-f)',
                      background: 'var(--c-surface)',
                      color: 'var(--c-text)',
                      fontSize: 13,
                    }}
                  />
                </div>
              )}

              {/* Récapitulatif */}
              <div
                className="rounded-xl p-3 text-xs space-y-1"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--c-border-s)' }}
              >
                <p className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--c-dim)' }}>
                  Récapitulatif
                </p>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--c-muted)' }}>Solde déclaré</span>
                  <span className="font-bold" style={{ color: 'var(--c-text)' }}>{nb} sauts</span>
                </div>
                {brevet && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--c-muted)' }}>Brevet</span>
                    <span className="font-semibold" style={{ color: 'var(--c-text)' }}>Brevet {brevet}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={{ color: 'var(--c-muted)' }}>Méthode</span>
                  <span style={{ color: 'var(--c-text)' }}>
                    {methode === 'honneur' ? "Sur l'honneur" : methode === 'dt' ? 'Validation DT' : 'Import OCR'}
                  </span>
                </div>
                <div className="flex justify-between" style={{ borderTop: '1px solid var(--c-border-s)', paddingTop: 6, marginTop: 4 }}>
                  <span style={{ color: 'var(--c-muted)' }}>Prochain saut ParaPass</span>
                  <span className="font-bold" style={{ color: '#A78BFA' }}>n°{nb + 1}</span>
                </div>
              </div>

              {/* Engagement */}
              <button
                onClick={() => setAccepted(!accepted)}
                className="w-full text-left rounded-xl transition-all"
                style={{
                  padding: '14px',
                  background: accepted ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${accepted ? 'rgba(16,185,129,0.3)' : 'var(--c-border-f)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5"
                  style={{
                    background: accepted ? '#10B981' : 'var(--c-hover)',
                    border: `1px solid ${accepted ? '#10B981' : 'var(--c-border-f)'}`,
                  }}
                >
                  {accepted && <CheckCircle className="w-3 h-3 text-white" />}
                </div>
                <p className="text-xs" style={{ color: 'var(--c-text2)', lineHeight: 1.6 }}>
                  Je soussigné(e) <strong>{profile?.prenom} {profile?.nom}</strong>,
                  certifie sur l'honneur avoir effectué <strong>{nb} sauts</strong> à la date
                  d'aujourd'hui, et m'engage à fournir tout justificatif (carnet papier,
                  attestation DT) sur demande de la FFP ou de la DGAC. Cette déclaration est
                  archivée et horodatée conformément à la réglementation en vigueur.
                </p>
              </button>

              {error && (
                <p className="text-xs text-center" style={{ color: '#F87171' }}>{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setEtape(1)}
                  className="flex-1 rounded-xl text-sm transition"
                  style={{
                    padding: '11px',
                    border: '1px solid var(--c-border-f)',
                    background: 'transparent',
                    color: 'var(--c-muted)',
                    cursor: 'pointer',
                  }}
                >
                  ← Retour
                </button>
                <button
                  onClick={handleConfirmer}
                  disabled={!canConfirm || loading}
                  className="flex-1 rounded-xl text-sm font-semibold transition"
                  style={{
                    padding: '11px',
                    border: 'none',
                    background: canConfirm && !loading ? '#A78BFA' : 'var(--c-hover)',
                    color: canConfirm && !loading ? '#fff' : 'var(--c-dim)',
                    cursor: canConfirm && !loading ? 'pointer' : 'not-allowed',
                  }}
                >
                  {loading ? 'Enregistrement...' : '✓ Confirmer la déclaration'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
