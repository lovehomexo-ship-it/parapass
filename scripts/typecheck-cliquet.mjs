#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// CLIQUET DE TYPAGE
//
// Le projet porte des erreurs de type héritées. Les corriger toutes d'un coup
// serait long et risqué — mais laisser le typage débranché a déjà coûté cher :
// le crash de la page d'accueil en juillet venait de là, et l'onglet Licence du
// passeport est resté cassé plus d'un mois sans que le build bronche.
//
// Ce cliquet tranche : le stock d'erreurs ne peut que DIMINUER. Toute erreur
// NOUVELLE fait échouer le build ; chaque correction abaisse le seuil
// automatiquement.
//
// On mémorise la SIGNATURE de chaque erreur (fichier + code + message), sans
// numéro de ligne : ajouter dix lignes en haut d'un fichier ne doit pas faire
// passer ses erreurs existantes pour des nouveautés.
// ═══════════════════════════════════════════════════════════════════════════
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FICHIER = fileURLToPath(new URL('../typecheck-baseline.json', import.meta.url));

let sortie = '';
try {
  execSync('npx tsc --noEmit -p tsconfig.app.json', { encoding: 'utf8', stdio: 'pipe' });
} catch (e) {
  sortie = (e.stdout ?? '') + (e.stderr ?? '');
}

const lignes = sortie.split('\n').filter((l) => / error TS\d+:/.test(l));

/** fichier(ligne,col): error TSxxxx: message → "fichier|TSxxxx|message" */
const signature = (l) => {
  const m = l.match(/^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/);
  return m ? `${m[1]}|${m[2]}|${m[3]}` : l.trim();
};

const actuelles = lignes.map(signature);
const compte = (arr) => arr.reduce((m, s) => m.set(s, (m.get(s) ?? 0) + 1), new Map());

// Sans fichier de référence, on l'ÉCRIT immédiatement : sinon l'exécution
// suivante prendrait l'état dégradé pour la norme, et le cliquet ne servirait
// plus à rien.
if (!existsSync(FICHIER)) {
  writeFileSync(FICHIER,
    JSON.stringify({ maximum: actuelles.length, signatures: actuelles }, null, 2) + '\n');
  console.log(`ℹ️  TYPAGE — référence créée : ${actuelles.length} erreurs héritées.`);
  process.exit(0);
}
const base = JSON.parse(readFileSync(FICHIER, 'utf8'));

const attendues = compte(base.signatures ?? []);
const obtenues = compte(actuelles);

// Une erreur est NOUVELLE si sa signature apparaît plus souvent qu'au départ.
const nouvelles = [];
for (const [sig, n] of obtenues) {
  const avant = attendues.get(sig) ?? 0;
  for (let k = 0; k < n - avant; k++) nouvelles.push(sig);
}

if (nouvelles.length > 0) {
  console.error(`\n❌ TYPAGE — ${nouvelles.length} erreur(s) NOUVELLE(S) :\n`);
  for (const s of nouvelles.slice(0, 15)) {
    const [f, code, msg] = s.split('|');
    console.error(`   ${f}\n      ${code} : ${msg}\n`);
  }
  console.error('   Corrigez-les avant de pousser.');
  console.error('   (Le stock hérité est toléré ; il ne doit pas grandir.)\n');
  process.exit(1);
}

if (actuelles.length < (base.maximum ?? actuelles.length)) {
  writeFileSync(FICHIER,
    JSON.stringify({ maximum: actuelles.length, signatures: actuelles }, null, 2) + '\n');
  console.log(`✅ TYPAGE — ${actuelles.length} erreurs `
    + `(seuil abaissé de ${base.maximum} à ${actuelles.length}). Merci.`);
} else {
  console.log(`✅ TYPAGE — ${actuelles.length} erreurs héritées, aucune nouvelle.`);
}
