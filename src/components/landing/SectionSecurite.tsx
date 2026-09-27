import { ShieldCheck, Lock, FileLock2, GitBranch, AlertTriangle, Check, Info } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// SÉCURITÉ ET CONFORMITÉ — la section qu'un directeur technique, un président
// de club ou un ASSUREUR vient chercher.
//
// ELLE NE PROMET RIEN QUE LE PRODUIT NE TIENNE. Chaque ligne correspond à une
// règle réellement chargée en base (`regles_securite`), avec la référence
// fédérale qui la fonde. Les chiffres cités sont comptés, pas estimés :
// 14 règles actives, 10 bloquantes, 7 non levables, 459 valeurs de la DT 48.
//
// ET ELLE DIT CE QUE PARAPASS NE FAIT PAS. Un assureur accorde plus de crédit
// à un périmètre déclaré qu'à une promesse sans limite — et c'est la seule
// façon honnête de présenter un outil qui informe une décision humaine sans
// jamais la remplacer.
// ═══════════════════════════════════════════════════════════════════════════

/** Les règles réellement chargées, avec le texte qui les fonde. */
const REGLES = [
  { code: 'VOI-001', titre: 'Surface de voilure minimale',
    detail: 'La DT 48 croisée poids nu × nombre de sauts : 459 valeurs, 9 tranches d’expérience. '
          + 'Une voile sous le minimum refuse l’embarquement. L’aménagement de −11 % s’accorde nominativement.',
    ref: 'FFP — DT n° 48, applicable au 09/02/2024', dur: true },
  { code: 'LIC-001', titre: 'Licence FFP valide',
    detail: 'Contrôlée à la date du saut, pas à l’inscription. Expirée ou absente : refus.',
    ref: 'Règlement fédéral des licences, 18/11/2023', dur: true },
  { code: 'MED-001', titre: 'Certificat médical de non contre-indication',
    detail: 'Échéance vérifiée le jour même. ParaPass stocke la DATE, jamais le contenu médical.',
    ref: 'Règlement médical fédéral · CACI FFP', dur: true },
  { code: 'MAT-001', titre: 'Pliage du secours dans sa périodicité',
    detail: 'Lu sur la dernière maintenance tracée du matériel, pas sur une déclaration.',
    ref: 'DT n° 50 — maintenance et pliage', dur: true },
  { code: 'MIN-001', titre: 'Mineur : âge et autorisation',
    detail: 'Sans date de naissance, ParaPass refuse de deviner la majorité.',
    ref: 'DT n° 49 — encadrement et progression', dur: true },
  { code: 'QUA-001', titre: 'Qualification wingsuit',
    detail: 'Exigée dès que le saut est déclaré wingsuit.',
    ref: 'DT n° 59 — wingsuit', dur: true },
  { code: 'QUA-002', titre: 'Qualification d’emport de caméra',
    detail: 'Exigée pour tout saut avec appareil de prise de vue.',
    ref: 'DT n° 52 — vidéo et prise de vue', dur: true },
  { code: 'BRV-001', titre: 'Météo confrontée au niveau du pratiquant',
    detail: 'Le vent signé au briefing est comparé au plafond du public concerné — élève, breveté A/B, '
          + 'confirmé, tandem, wingsuit. Une même journée laisse sauter les confirmés et suspend la PAC.',
    ref: 'Seuils du centre, paramétrés par le directeur technique', dur: false },
  { code: 'BRF-001', titre: 'Briefing du jour acquitté',
    detail: 'Nominatif et horodaté. Sans briefing publié, la règle est sans objet — elle n’invente rien.',
    ref: 'Règle du centre', dur: false },
  { code: 'ENC-001', titre: 'Encadrement de la séance couvert',
    detail: 'Vérifié au niveau de la rotation, pas seulement de la personne.',
    ref: 'DT n° 49 — encadrement et progression', dur: false },
];

const VIGILANCES = [
  { code: 'MAT-002', t: 'Pliage du principal tracé',        ref: 'DT n° 53' },
  { code: 'MAT-003', t: 'Vérification du principal du jour', ref: 'DT n° 54' },
  { code: 'REP-001', t: 'Reprise après interruption',        ref: 'DT n° 49' },
  { code: 'EQP-001', t: 'Casque des non-brevetés',           ref: 'DT n° 51' },
];

const ARCHITECTURE = [
  { icon: Lock, titre: 'Le contrôle est en base, pas dans l’écran',
    texte: 'Les règles s’appliquent au niveau de la base de données. Un appel direct à l’API est refusé '
         + 'exactement comme un clic dans l’application. Contourner l’interface ne contourne rien.' },
  { icon: ShieldCheck, titre: 'Donnée absente = refus, jamais feu vert',
    texte: 'Un document manquant ne passe pas pour conforme : il ressort en gris ou en rouge. '
         + 'Le silence n’a jamais valeur d’autorisation.' },
  { icon: GitBranch, titre: 'Référentiel versionné et immuable',
    texte: 'Une règle ne se modifie pas : elle se republie en nouvelle version, l’ancienne est désactivée. '
         + 'On peut donc rejouer une journée passée avec les règles qui s’appliquaient CE JOUR-LÀ.' },
  { icon: FileLock2, titre: 'Journal chaîné',
    texte: 'Chaque décision est horodatée côté serveur et hachée sur la précédente. Retirer ou modifier '
         + 'une ligne casse la chaîne, et cela se voit.' },
];

const ASSUREUR = [
  'Preuve opposable de la conformité AU MOMENT du saut, et non d’un contrôle annuel.',
  'Traçabilité nominative : qui a levé une dérogation, quand, et sur quel motif.',
  'Contrôle systématique des points les plus accidentogènes — charge alaire, reprise après interruption, météo confrontée au niveau.',
  'Aucune donnée de santé conservée : ParaPass retient l’échéance du certificat, pas son contenu.',
  'Historique de sauts vérifiable par QR code, opposable en cas de sinistre.',
  'Périmètre et limites déclarés par écrit, ci-dessous.',
];

const LIMITES = [
  'ParaPass ne remplace pas le directeur technique. L’application informe, l’humain décide et engage sa responsabilité.',
  'ParaPass ne mesure pas la météo : il lit l’observation signée au briefing et les seuils que le centre a fixés.',
  'ParaPass ne contrôle pas physiquement le matériel : il trace que la vérification a été faite, par qui et quand.',
  'Le contrôle automatique de l’assurance responsabilité civile du licencié n’est pas encore actif — la donnée est collectée, la règle reste à écrire avec l’assureur.',
];

export function SectionSecurite() {
  return (
    <section id="securite" className="py-20" style={{ background: '#001A4D' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.35)' }}>
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden /> Sécurité &amp; conformité
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            La sécurité n’est pas un écran.<br className="hidden sm:block" /> C’est une règle en base.
          </h2>
          <p className="max-w-2xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16 }}>
            Quatorze règles opposables s’appliquent avant qu’un parachutiste monte dans l’avion.
            Dix sont bloquantes, sept ne peuvent être levées par personne. Chacune cite le texte
            qui la fonde — ou dit clairement qu’elle relève du centre.
          </p>
        </div>

        {/* Les chiffres, comptés et non arrondis. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-14 max-w-3xl mx-auto">
          {[
            { n: '14', l: 'règles actives' },
            { n: '10', l: 'bloquantes' },
            { n: '7',  l: 'que nul ne peut lever' },
            { n: '459', l: 'valeurs DT 48 chargées' },
          ].map(x => (
            <div key={x.l} className="text-center rounded-xl py-4"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-3xl font-extrabold text-white">{x.n}</p>
              <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>{x.l}</p>
            </div>
          ))}
        </div>

        {/* ── LE PARE-FEU ─────────────────────────────────────────────────── */}
        <h3 className="text-xl font-bold text-white mb-1">Ce qui bloque un embarquement</h3>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Le cadenas marque les règles que personne — pas même le directeur technique — ne peut lever.
        </p>

        <div className="grid md:grid-cols-2 gap-3 mb-12">
          {REGLES.map(r => (
            <div key={r.code} className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-start gap-2.5 mb-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 mt-0.5 tabular-nums"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}>
                  {r.code}
                </span>
                <p className="font-bold text-white text-sm flex-1">{r.titre}</p>
                {r.dur && <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#FCA5A5' }} aria-label="non levable" />}
              </div>
              <p className="text-[13px] leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>{r.detail}</p>
              <p className="text-[11px] italic" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.ref}</p>
            </div>
          ))}
        </div>

        {/* ── VIGILANCES ──────────────────────────────────────────────────── */}
        <h3 className="text-xl font-bold text-white mb-1">Ce qui déclenche une vigilance</h3>
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Signalé au chef d’avionnage, qui tranche et dont la décision est journalisée.
        </p>
        <div className="flex flex-wrap gap-2 mb-14">
          {VIGILANCES.map(v => (
            <span key={v.code} className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.12)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#FBBF24' }} aria-hidden />
              <strong>{v.code}</strong> {v.t}
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>· {v.ref}</span>
            </span>
          ))}
        </div>

        {/* ── ARCHITECTURE ────────────────────────────────────────────────── */}
        <h3 className="text-xl font-bold text-white mb-6">Pourquoi ces règles tiennent</h3>
        <div className="grid md:grid-cols-2 gap-4 mb-14">
          {ARCHITECTURE.map(a => (
            <div key={a.titre} className="rounded-xl p-5 flex gap-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(37,99,235,0.4)' }}>
                <a.icon className="w-5 h-5" style={{ color: '#93C5FD' }} aria-hidden />
              </div>
              <div>
                <p className="font-bold text-white text-sm mb-1.5">{a.titre}</p>
                <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{a.texte}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── POUR UN ASSUREUR ────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-5">
          <div className="rounded-2xl p-6"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" style={{ color: '#6EE7B7' }} aria-hidden />
              Ce que ça change pour un assureur
            </h3>
            <ul className="space-y-2.5">
              {ASSUREUR.map(a => (
                <li key={a} className="flex items-start gap-2.5 text-[13px] leading-relaxed"
                  style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#6EE7B7' }} strokeWidth={2.5} aria-hidden />
                  {a}
                </li>
              ))}
            </ul>
          </div>

          {/* L'HONNÊTETÉ EST UN ARGUMENT. Un périmètre déclaré vaut mieux
              qu'une promesse sans limite — surtout devant quelqu'un dont le
              métier est d'évaluer un risque. */}
          <div className="rounded-2xl p-6"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Info className="w-5 h-5" style={{ color: '#93C5FD' }} aria-hidden />
              Ce que ParaPass ne fait pas
            </h3>
            <ul className="space-y-2.5">
              {LIMITES.map(l => (
                <li key={l} className="flex items-start gap-2.5 text-[13px] leading-relaxed"
                  style={{ color: 'rgba(255,255,255,0.7)' }}>
                  <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.35)' }} aria-hidden />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </section>
  );
}
