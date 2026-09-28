-- Appliquée en base : chaque_regle_dit_comment_la_resoudre
--                   + regles_en_vigueur_suit_vraiment_la_table
--
-- UNE ANOMALIE QU'ON NE SAIT PAS RÉSOUDRE N'EST QU'UN REPROCHE.
--
-- Feu Vert disait ce qui n'allait pas, citait le texte qui le fonde, et
-- s'arrêtait là. Devant « MAT-001 — pliage de secours valable jusqu'au
-- 14/05/2026 », on sait qu'il y a un problème ; on ne sait pas quoi FAIRE, ni
-- qui doit le faire. L'écran devient un juge au lieu d'un outil.
--
-- Chaque règle porte donc son REMÈDE : quoi faire, par qui, où dans
-- l'application. Colonne distincte de `source_texte` — on ne confond jamais la
-- référence fédérale avec la marche à suivre ParaPass.
alter table regles_securite add column if not exists remede text;

comment on column regles_securite.remede is
  'Marche a suivre pour lever l''anomalie : quoi faire, par qui, ou. Guidance ParaPass — a ne pas confondre avec `source_texte`, qui porte la reference federale.';

-- JE N'AVAIS PAS SUPPRIMÉ LE PIÈGE, JE L'AVAIS REPORTÉ. `regles_en_vigueur`
-- promet `setof regles_securite` et recopiait ses colonnes à la main : ajouter
-- `moment` l'a cassée une fois, ajouter `remede` l'a cassée une seconde, de la
-- même façon — et avec elle tout Feu Vert, puisque chaque verdict passe par là.
-- La liste ne doit plus exister : on sélectionne les LIGNES par leur
-- identifiant et `r.*` suit la table quoi qu'on lui ajoute. Plus rien à
-- maintenir, donc plus rien à oublier.
create or replace function regles_en_vigueur(p_centre_id uuid)
returns setof regles_securite language sql stable as $function$
  select r.*
  from regles_securite r
  where r.id in (
    select c.id from (
      select rs.id, rs.actif,
             row_number() over (partition by rs.code
                                order by (rs.centre_id is not null) desc, rs.version desc) as rang
      from regles_securite rs
      where rs.centre_id is null or rs.centre_id = p_centre_id
    ) c
    where c.rang = 1 and c.actif
  )
  order by r.gravite desc, r.code
$function$;

-- Remèdes des 14 règles et fonction `dossier_detail` : corps complets en base.
