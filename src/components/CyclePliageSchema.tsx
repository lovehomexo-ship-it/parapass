import { useState } from 'react';
import { X, Printer, HelpCircle } from 'lucide-react';

// ─── SVG du cycle (horizontal desktop / empilé mobile) ───────────────────────

function CycleSVG({ printMode = false }: { printMode?: boolean }) {
  const bg = printMode ? '#ffffff' : '#0B1F3A';
  const track = printMode ? '#C0CDD9' : '#7C93AB';
  const textColor = printMode ? '#0F172A' : '#E2E8F0';
  const mutedColor = printMode ? '#475569' : '#94A3B8';
  const actorColor = printMode ? '#334155' : '#BAC8D9';

  // State nodes
  const libre = { x: 120, y: 180, label: 'LIBRE', color: '#10B981', bg: printMode ? '#D1FAE5' : 'rgba(16,185,129,0.18)' };
  const pris = { x: 430, y: 180, label: 'PRIS', color: '#60A5FA', bg: printMode ? '#DBEAFE' : 'rgba(96,165,250,0.18)' };
  const aplier = { x: 720, y: 180, label: 'À PLIER', color: '#F97316', bg: printMode ? '#FFEDD5' : 'rgba(249,115,22,0.18)' };

  const r = 48; // node radius

  return (
    <svg
      viewBox="0 0 840 360"
      className="w-full"
      style={{ maxHeight: 360, display: 'block' }}
      aria-label="Cycle de vie d'un sac parachute"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Defs */}
      <defs>
        <marker id="arrow-libre" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={libre.color} />
        </marker>
        <marker id="arrow-pris" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={pris.color} />
        </marker>
        <marker id="arrow-aplier" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={aplier.color} />
        </marker>
        <marker id="arrow-track" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={track} />
        </marker>
      </defs>

      {/* Background */}
      <rect width="840" height="360" rx="16" fill={bg} />

      {/* ─── Flèches ─────────────────────────────────────────────────────── */}

      {/* LIBRE → PRIS (haut) */}
      <line x1={libre.x + r} y1={libre.y - 18} x2={pris.x - r - 8} y2={pris.y - 18}
        stroke={libre.color} strokeWidth="2" markerEnd="url(#arrow-libre)" />
      <text x={(libre.x + pris.x) / 2} y={libre.y - 32} textAnchor="middle" fontSize="11" fill={textColor} fontWeight="600">
        Prendre ce sac
      </text>
      <text x={(libre.x + pris.x) / 2} y={libre.y - 48} textAnchor="middle" fontSize="13">
        👤
      </text>
      <text x={(libre.x + pris.x) / 2} y={libre.y - 19} textAnchor="middle" fontSize="9" fill={actorColor}>
        parachutiste
      </text>

      {/* PRIS → LIBRE (bas) */}
      <line x1={pris.x - r} y1={pris.y + 18} x2={libre.x + r + 8} y2={libre.y + 18}
        stroke={track} strokeWidth="2" markerEnd="url(#arrow-track)" />
      <text x={(libre.x + pris.x) / 2} y={pris.y + 38} textAnchor="middle" fontSize="10.5" fill={mutedColor}>
        Rendre le sac / ⏰ Auto 21h
      </text>
      <text x={(libre.x + pris.x) / 2} y={pris.y + 52} textAnchor="middle" fontSize="9" fill={actorColor}>
        👤 porteur · 🏢 staff · ⏰ auto
      </text>

      {/* PRIS → À PLIER (haut) */}
      <line x1={pris.x + r} y1={pris.y - 18} x2={aplier.x - r - 8} y2={aplier.y - 18}
        stroke={aplier.color} strokeWidth="2" markerEnd="url(#arrow-aplier)" />
      <text x={(pris.x + aplier.x) / 2} y={pris.y - 32} textAnchor="middle" fontSize="11" fill={textColor} fontWeight="600">
        Marquer "À plier"
      </text>
      <text x={(pris.x + aplier.x) / 2} y={pris.y - 48} textAnchor="middle" fontSize="13">
        👤
      </text>
      <text x={(pris.x + aplier.x) / 2} y={pris.y - 19} textAnchor="middle" fontSize="9" fill={actorColor}>
        porteur (après le saut)
      </text>

      {/* À PLIER → PRIS (bas) */}
      <line x1={aplier.x - r} y1={aplier.y + 18} x2={pris.x + r + 8} y2={pris.y + 18}
        stroke={pris.color} strokeWidth="2" markerEnd="url(#arrow-pris)" />
      <text x={(pris.x + aplier.x) / 2} y={aplier.y + 38} textAnchor="middle" fontSize="11" fill={textColor} fontWeight="600">
        ✓ Pliage effectué
      </text>
      <text x={(pris.x + aplier.x) / 2} y={aplier.y + 52} textAnchor="middle" fontSize="9" fill={actorColor}>
        🪂 plieur (attribué au porteur, payable)
      </text>

      {/* PRIS self-loop → Auto-plié (boucle au sommet) */}
      <path
        d={`M ${pris.x - 22} ${pris.y - r}
            C ${pris.x - 22} ${pris.y - r - 48}, ${pris.x + 22} ${pris.y - r - 48}, ${pris.x + 22} ${pris.y - r}`}
        stroke={track} strokeWidth="2" fill="none" markerEnd="url(#arrow-track)" />
      <text x={pris.x} y={pris.y - r - 56} textAnchor="middle" fontSize="10.5" fill={mutedColor}>
        Auto-plié (Brevet C/D)
      </text>
      <text x={pris.x} y={pris.y - r - 70} textAnchor="middle" fontSize="13">
        🎓
      </text>

      {/* ─── Nœuds ─────────────────────────────────────────────────────── */}

      {[libre, pris, aplier].map((n) => (
        <g key={n.label}>
          <circle cx={n.x} cy={n.y} r={r} fill={n.bg} stroke={n.color} strokeWidth="2.5" />
          <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill={n.color} letterSpacing="0.5">
            {n.label}
          </text>
        </g>
      ))}

      {/* ─── Légende états additionnels ───────────────────────────────── */}
      <g transform="translate(24, 296)">
        <text fontSize="9" fill={mutedColor} fontWeight="600">ÉTATS ADDITIONNELS :</text>
        {/* REPLIAGE SECOURS */}
        <circle cx="168" cy="-3" r="5" fill="none" stroke="#8B5CF6" strokeWidth="1.5" />
        <text x="176" y="0" fontSize="9" fill={mutedColor}>Repliage secours</text>
        {/* RETIRÉ */}
        <circle cx="288" cy="-3" r="5" fill="none" stroke="#64748B" strokeWidth="1.5" />
        <text x="296" y="0" fontSize="9" fill={mutedColor}>Retiré du service</text>
        <text x="390" y="0" fontSize="9" fill={mutedColor}>— gérés par le staff depuis le Parc de sacs</text>
      </g>

      {/* ─── Légende flèches ──────────────────────────────────────────── */}
      <g transform="translate(24, 318)">
        <line x1="0" y1="-3" x2="18" y2="-3" stroke={libre.color} strokeWidth="2" markerEnd="url(#arrow-libre)" />
        <text x="22" y="0" fontSize="9" fill={mutedColor}>Action parachutiste/plieur</text>
        <line x1="180" y1="-3" x2="198" y2="-3" stroke={track} strokeWidth="2" markerEnd="url(#arrow-track)" />
        <text x="202" y="0" fontSize="9" fill={mutedColor}>Action staff ou automatique</text>
      </g>
    </svg>
  );
}

// ─── Légende 3 lignes ─────────────────────────────────────────────────────────

function LegendeLignes({ printMode = false }: { printMode?: boolean }) {
  const color = printMode ? '#475569' : 'rgba(255,255,255,0.5)';
  const items = [
    'Le sac se prend et se rend en scannant son QR.',
    'Un pliage n\'est payable que s\'il est attribué à un parachutiste.',
    'Le staff peut corriger n\'importe quel état depuis le Parc de sacs.',
  ];
  return (
    <ul className="mt-4 space-y-1 list-none p-0 m-0">
      {items.map(line => (
        <li key={line} className="flex items-start gap-2 text-xs" style={{ color }}>
          <span className="mt-0.5 flex-shrink-0 text-[10px]">•</span>
          {line}
        </li>
      ))}
    </ul>
  );
}

// ─── Bouton imprimer ─────────────────────────────────────────────────────────

function imprimerSchema() {
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Cycle pliage — ParaPass</title>
<style>
  @page { size: A4 landscape; margin: 1.5cm; }
  body { margin: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; }
  h1 { font-size: 15px; color: #0F172A; margin: 0 0 12px; font-weight: 800; letter-spacing: -0.5px; }
  .sub { font-size: 11px; color: #64748B; margin-bottom: 20px; }
  .svg-wrap { width: 100%; }
  ul { margin: 16px 0 0; padding: 0; list-style: none; }
  li { font-size: 10px; color: #475569; margin-bottom: 4px; padding-left: 12px; position: relative; }
  li::before { content: "•"; position: absolute; left: 0; }
  .footer { margin-top: 24px; font-size: 9px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 8px; }
</style></head>
<body onload="window.print()">
<h1>ParaPass · Cycle de vie d'un sac — Module Pliage</h1>
<p class="sub">À afficher au local de pliage · parapass.fr</p>
<div class="svg-wrap">
  <svg viewBox="0 0 840 360" width="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="840" height="360" rx="12" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1"/>

    <!-- markers -->
    <defs>
      <marker id="ag" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#10B981"/></marker>
      <marker id="ab" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#60A5FA"/></marker>
      <marker id="ao" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#F97316"/></marker>
      <marker id="at" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#94A3B8"/></marker>
    </defs>

    <!-- LIBRE → PRIS -->
    <line x1="168" y1="162" x2="382" y2="162" stroke="#10B981" stroke-width="2" marker-end="url(#ag)"/>
    <text x="275" y="148" text-anchor="middle" font-size="11" fill="#0F172A" font-weight="700">Prendre ce sac</text>
    <text x="275" y="134" text-anchor="middle" font-size="13">👤</text>
    <text x="275" y="161" text-anchor="middle" font-size="8.5" fill="#64748B">parachutiste</text>

    <!-- PRIS → LIBRE -->
    <line x1="382" y1="198" x2="168" y2="198" stroke="#94A3B8" stroke-width="2" marker-end="url(#at)"/>
    <text x="275" y="218" text-anchor="middle" font-size="10.5" fill="#64748B">Rendre / ⏰ Auto 21h</text>
    <text x="275" y="231" text-anchor="middle" font-size="8.5" fill="#94A3B8">👤 porteur · 🏢 staff · ⏰ auto</text>

    <!-- PRIS → À PLIER -->
    <line x1="478" y1="162" x2="672" y2="162" stroke="#F97316" stroke-width="2" marker-end="url(#ao)"/>
    <text x="575" y="148" text-anchor="middle" font-size="11" fill="#0F172A" font-weight="700">Marquer "À plier"</text>
    <text x="575" y="134" text-anchor="middle" font-size="13">👤</text>
    <text x="575" y="161" text-anchor="middle" font-size="8.5" fill="#64748B">porteur, après le saut</text>

    <!-- À PLIER → PRIS -->
    <line x1="672" y1="198" x2="478" y2="198" stroke="#60A5FA" stroke-width="2" marker-end="url(#ab)"/>
    <text x="575" y="218" text-anchor="middle" font-size="11" fill="#0F172A" font-weight="700">✓ Pliage effectué</text>
    <text x="575" y="231" text-anchor="middle" font-size="8.5" fill="#64748B">🪂 plieur — attribué au porteur, payable</text>

    <!-- Self-loop Auto-plié -->
    <path d="M 408 132 C 408 84, 452 84, 452 132" stroke="#94A3B8" stroke-width="2" fill="none" marker-end="url(#at)"/>
    <text x="430" y="76" text-anchor="middle" font-size="10" fill="#64748B">Auto-plié (Brevet C/D)</text>
    <text x="430" y="62" text-anchor="middle" font-size="13">🎓</text>

    <!-- Nodes -->
    <circle cx="120" cy="180" r="48" fill="#D1FAE5" stroke="#10B981" stroke-width="2.5"/>
    <text x="120" y="185" text-anchor="middle" font-size="13" font-weight="800" fill="#065F46">LIBRE</text>

    <circle cx="430" cy="180" r="48" fill="#DBEAFE" stroke="#60A5FA" stroke-width="2.5"/>
    <text x="430" y="185" text-anchor="middle" font-size="13" font-weight="800" fill="#1E40AF">PRIS</text>

    <circle cx="720" cy="180" r="48" fill="#FFEDD5" stroke="#F97316" stroke-width="2.5"/>
    <text x="720" y="185" text-anchor="middle" font-size="11" font-weight="800" fill="#9A3412">À PLIER</text>

    <!-- Légende additionnelle -->
    <text x="24" y="304" font-size="9" fill="#94A3B8" font-weight="600">ÉTATS ADDITIONNELS :</text>
    <circle cx="192" cy="300" r="5" fill="none" stroke="#8B5CF6" stroke-width="1.5"/>
    <text x="200" y="304" font-size="9" fill="#94A3B8">Repliage secours</text>
    <circle cx="304" cy="300" r="5" fill="none" stroke="#64748B" stroke-width="1.5"/>
    <text x="312" y="304" font-size="9" fill="#94A3B8">Retiré</text>
    <text x="360" y="304" font-size="9" fill="#94A3B8">— gérés par le staff depuis le Parc de sacs</text>

    <!-- Légende flèches -->
    <line x1="24" y1="320" x2="42" y2="320" stroke="#10B981" stroke-width="2" marker-end="url(#ag)"/>
    <text x="46" y="324" font-size="9" fill="#94A3B8">Action parachutiste / plieur</text>
    <line x1="210" y1="320" x2="228" y2="320" stroke="#94A3B8" stroke-width="2" marker-end="url(#at)"/>
    <text x="232" y="324" font-size="9" fill="#94A3B8">Staff ou automatique</text>
  </svg>
</div>
<ul>
  <li>Le sac se prend et se rend en scannant son QR.</li>
  <li>Un pliage n'est payable que s'il est attribué à un parachutiste.</li>
  <li>Le staff peut corriger n'importe quel état depuis le Parc de sacs.</li>
</ul>
<p class="footer">Généré via ParaPass · parapass.fr</p>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

// ─── Modale "?" ───────────────────────────────────────────────────────────────

export function CycleHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0B1F3A', border: '1px solid rgba(124,147,171,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(124,147,171,0.15)' }}>
          <p className="font-bold text-white text-sm">Cycle de vie d'un sac</p>
          <div className="flex items-center gap-2">
            <button
              onClick={imprimerSchema}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer A4
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="px-4 py-5 overflow-x-auto">
          <CycleSVG />
          <LegendeLignes />
        </div>
      </div>
    </div>
  );
}

// ─── Bouton "?" compact ───────────────────────────────────────────────────────

export function CycleHelpButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Comment fonctionne le cycle de pliage ?"
        className={`inline-flex items-center justify-center rounded-full transition-all ${className ?? ''}`}
        style={{ width: 28, height: 28, background: 'rgba(124,147,171,0.12)', border: '1px solid rgba(124,147,171,0.25)', color: '#7C93AB' }}
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {open && <CycleHelpModal onClose={() => setOpen(false)} />}
    </>
  );
}

// ─── Panneau repliable centre ─────────────────────────────────────────────────

export function CycleHelpPanel({ pliageCount }: { pliageCount: number }) {
  const STORAGE_KEY = 'parapass_cycle_help_collapsed';
  const [collapsed, setCollapsed] = useState(() => {
    if (pliageCount >= 10) return true;
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* noop */ }
  }

  return (
    <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid rgba(124,147,171,0.2)', background: 'rgba(11,31,58,0.6)' }}>
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-all"
        style={{ background: 'rgba(124,147,171,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#7C93AB' }} />
          <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
            ℹ️ Comment fonctionne le cycle de pliage
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); imprimerSchema(); }}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-semibold"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Printer className="w-3 h-3" /> Imprimer
          </button>
          <span className="text-sm" style={{ color: '#7C93AB' }}>{collapsed ? '▸' : '▾'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-5 overflow-x-auto">
          <div className="pt-3">
            <CycleSVG />
            <LegendeLignes />
          </div>
        </div>
      )}
    </div>
  );
}
