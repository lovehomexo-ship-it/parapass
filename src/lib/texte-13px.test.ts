import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import reference from './texte-13px-reference.json';

// LE PLANCHER DE 13 PX — un cliquet, comme celui du typage.
//
// Les espaces DZ et parachutiste ont été ramenés à 13 px minimum : à 9-11 px,
// sur un téléphone au soleil d'une zone de saut, on ne lit plus. Ce test
// empêche le petit texte de revenir :
//   • un fichier hors de la référence doit rester à zéro ;
//   • un fichier de la référence (vitrine, démos, carte du passeport…) peut
//     descendre, jamais monter. Quand il descend, abaisser son chiffre dans
//     texte-13px-reference.json (ou le retirer à zéro).
//
// `text-xs` (12 px) n'est pas compté : dans les espaces connectés, la feuille
// de style le remonte à 13 px (index.css, .parapass-centre / .parapass-para).

const PETIT = /text-\[(8|9|10|11|12)(\.5)?px\]|fontSize: ?(8|9|10|11|12)(\.5)?[,} ]|fontSize="(8|9|10|11|12)"/g;
const plafond = reference as Record<string, number>;

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return fichiers(p);
    return n.endsWith('.tsx') && !n.includes('.test.') ? [p] : [];
  });
}

describe('plancher de 13 px', () => {
  it('aucun texte sous 13 px ne s’ajoute', () => {
    const fautes: string[] = [];
    for (const f of fichiers('src')) {
      const n = (readFileSync(f, 'utf8').match(PETIT) ?? []).length;
      const max = plafond[f] ?? 0;
      if (n > max) fautes.push(`${f} : ${n} texte(s) sous 13 px (plafond ${max})`);
    }
    expect(fautes).toEqual([]);
  });
});
