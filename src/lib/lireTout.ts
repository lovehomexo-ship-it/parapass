/**
 * Lire TOUTES les lignes d'une requête, par pages de 1 000.
 *
 * L'API coupe chaque lecture à 1 000 lignes, sans erreur ni avertissement. Un
 * moniteur à 3 000 sauts voyait donc 1 000 sauts au total, et la page
 * Progression, plafonnée à 200, en annonçait 200. On relit page après page
 * jusqu'à la dernière, incomplète.
 *
 * `construire(debut, fin)` refait la requête complète pour une tranche : un
 * constructeur Supabase ne se réutilise pas après exécution.
 */
export async function lireTout<T>(
  construire: (debut: number, fin: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  taillePage = 1000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const tout: T[] = [];
  for (let debut = 0; ; debut += taillePage) {
    const { data, error } = await construire(debut, debut + taillePage - 1);
    if (error) return { data: tout, error };
    const lot = data ?? [];
    tout.push(...lot);
    if (lot.length < taillePage) return { data: tout, error: null };
  }
}
