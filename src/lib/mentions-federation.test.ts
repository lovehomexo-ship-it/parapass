import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// AUCUNE CAUTION QUE NOUS N'AVONS PAS. La fédération n'a pas validé
// l'application : logo, « en partenariat », « licence numérique FFP »,
// « conforme FFP » se lisaient comme un agrément. Ce test empêche ces mentions
// de revenir à l'écran. Les noms de code (colonnes `*_ffp`, `licenceFFP`) et
// les commentaires ne sont pas concernés.

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return fichiers(p);
    return /\.(tsx?|html)$/.test(n) && !n.includes('.test.') ? [p] : [];
  });
}

const INTERDIT = [/logo-ffp/i, /partenariat avec la (FFP|F[ée]d[ée]ration)/i, /F[ée]d[ée]ration Fran[çc]aise de Parachutisme/i,
  /Licence numérique FFP/i, /Conforme FFP/i, /num[ée]rique FFP/i, /clubs FFP/i];

describe('mentions de la fédération', () => {
  it('aucune mention de caution fédérale à l’écran', () => {
    const fautes: string[] = [];
    for (const f of [...fichiers('src'), 'index.html']) {
      // Les commentaires ne s'affichent pas : on les retire avant de chercher.
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const re of INTERDIT) if (re.test(src)) fautes.push(`${f} : ${re}`);
    }
    expect(fautes).toEqual([]);
  });
});
