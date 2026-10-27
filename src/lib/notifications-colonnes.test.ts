import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// LES NOTIFICATIONS QUI NE PARTAIENT PAS. Neuf écritures visaient `profile_id`
// et trois `lu` : la table n'a ni l'une ni l'autre colonne. Supabase répondait
// 400, le code n'en regardait pas l'erreur — « saut validé », « demande
// acceptée », « délégation accordée » n'arrivaient jamais au parachutiste, et la
// cloche du tableau de bord DZ comptait en échec (1 275 requêtes en 400 par jour).
//
// Ce test relit le code : toute clé posée sur `notifications` doit être une
// colonne de la table.

const COLONNES = new Set(['id', 'user_id', 'type', 'titre', 'message', 'data', 'lue', 'created_at']);

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return fichiers(p);
    return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe('table notifications', () => {
  it('n’écrit et ne filtre que des colonnes qui existent', () => {
    const fautes: string[] = [];
    for (const f of fichiers('src')) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/from\('notifications'\)/g)) {
        // L'appel jusqu'au point-virgule qui le termine.
        const appel = src.slice(m.index, src.indexOf(';', m.index));
        const objets = [...appel.matchAll(/\.(?:insert|update)\(\s*(?:\w+\.map\([^=]*=>\s*\(\s*)?\[?\s*\{([\s\S]*?)\}/g)].map(x => x[1]);
        for (const corps of objets) {
          // Seules les clés de premier niveau (pas celles imbriquées dans `data`).
          const plat = corps.replace(/\{[\s\S]*?\}/g, '');
          for (const k of plat.matchAll(/(?:^|[,{\s])([a-z_]+)\s*:/g)) {
            if (!COLONNES.has(k[1])) fautes.push(`${f} : clé « ${k[1]} »`);
          }
        }
        for (const k of appel.matchAll(/\.(?:eq|neq|in|is)\('([a-z_]+)'/g)) {
          if (!COLONNES.has(k[1])) fautes.push(`${f} : filtre « ${k[1]} »`);
        }
      }
    }
    expect(fautes).toEqual([]);
  });
});
