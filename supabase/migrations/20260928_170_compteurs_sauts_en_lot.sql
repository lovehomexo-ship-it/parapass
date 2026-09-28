-- Appliquée en base : compteurs_sauts_en_lot
--
-- LE NOMBRE DE SAUTS SE COMPTAIT DANS LE NAVIGATEUR, LIGNE À LIGNE.
--
-- L'écran « Mes licenciés » téléchargeait UNE LIGNE PAR SAUT de tous ses
-- licenciés, puis les comptait en JavaScript. PostgREST plafonne une réponse à
-- 1000 lignes : passé ce seuil, les sauts suivants ne sont jamais reçus. À
-- Royan — plus de 5900 sauts — la plupart des compteurs étaient tronqués, et
-- Sophie MARTIN affichait « 0 saut » alors qu'elle en a 57.
--
-- Le défaut était invisible tant qu'un centre restait petit : le pire genre de
-- bogue, il attend la croissance pour se manifester.
--
-- Même définition que `get_jump_counts`, celle du carnet du parachutiste : hors
-- soufflerie, tous statuts pour le total. Deux définitions auraient fini par
-- diverger, et un carnet qui affiche 57 en face d'une liste qui affiche 0 ruine
-- la confiance dans les deux.
create or replace function compteurs_sauts(p_ids uuid[])
returns table(parachutiste_id uuid, total integer, valide integer)
language sql stable security definer set search_path to 'public','pg_temp' as $$
  select i.id,
         count(s.id) filter (where s.is_tunnel = false)::int,
         count(s.id) filter (where s.is_tunnel = false
                               and s.statut in ('valide','historique'))::int
  from unnest(coalesce(p_ids, '{}'::uuid[])) as i(id)
  left join sauts s on s.parachutiste_id = i.id
  where i.id = auth.uid() or is_my_licencie(i.id)
  group by i.id;
$$;

revoke all on function compteurs_sauts(uuid[]) from public;
grant execute on function compteurs_sauts(uuid[]) to authenticated;

comment on function compteurs_sauts(uuid[]) is
  'Compteurs de sauts pour une liste de licencies, comptes EN BASE. Meme definition que get_jump_counts : sans cela, deux ecrans affichent deux chiffres pour la meme personne.';
