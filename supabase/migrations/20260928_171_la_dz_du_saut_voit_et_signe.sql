-- Appliquée en base : la_dz_du_saut_voit_et_signe_meme_un_visiteur
--
-- UN VISITEUR ÉTAIT INVISIBLE DE LA DZ QUI L'AVAIT VU SAUTER.
--
-- La file de validation a cessé de se construire sur l'APPARTENANCE pour se
-- construire sur la DZ DU SAUT — c'était juste. Mais les deux conditions sont
-- restées CUMULÉES : licencié DU centre ET saut fait AU centre. Un parachutiste
-- de passage ne remplit jamais la première.
--
-- Résultat : un saut fait à Royan et soumis à Royan par un licencié de BigAir
-- n'apparaissait chez PERSONNE. Ni chez BigAir — il n'y a pas eu lieu — ni chez
-- Royan — il n'y est pas licencié. L'angle mort exactement inverse du précédent.
--
-- LA RÈGLE JUSTE : la DZ qui a vu le saut le voit et le signe. L'appartenance
-- ne joue aucun rôle dans la validation — elle n'a jamais été le sujet. C'est
-- même le cas le plus courant du parachutisme : on voyage, on saute ailleurs,
-- la DZ d'accueil atteste.
--
-- CE QUE CELA N'OUVRE PAS : la portée est `centre_id = mon centre`. Le centre
-- voit LE SAUT QU'IL A ACCUEILLI, pas le carnet du visiteur.
drop policy if exists sauts_lecture_centre_du_saut on sauts;
create policy sauts_lecture_centre_du_saut on sauts for select to authenticated
  using (centre_id is not null
         and exists (select 1 from admin_centres a
                     where a.profile_id = auth.uid() and a.centre_id = sauts.centre_id));

drop policy if exists "Moniteurs and admins can update sauts for validation" on sauts;
create policy "Moniteurs and admins can update sauts for validation" on sauts
  for update using (
    moniteur_id = auth.uid()
    or get_my_role() = any (array['moniteur','admin'])
    or (centre_id is not null
        and exists (select 1 from admin_centres a
                    where a.profile_id = auth.uid() and a.centre_id = sauts.centre_id))
  ) with check (
    moniteur_id = auth.uid()
    or get_my_role() = any (array['moniteur','admin'])
    or (centre_id is not null
        and exists (select 1 from admin_centres a
                    where a.profile_id = auth.uid() and a.centre_id = sauts.centre_id))
  );

-- POUR QUE CELA NE SE REPRODUISE PAS. La file était définie dans l'écran, en
-- trois filtres qu'on pouvait recombiner de travers — et on l'a fait deux fois,
-- dans les deux sens. Elle est désormais définie UNE FOIS, ici, et l'écran ne
-- compose plus rien. Corps complet en base : `sauts_du_centre`.
comment on function sauts_du_centre(uuid, text, int, int) is
  'LA definition de la file de validation d''un centre : les sauts FAITS CHEZ LUI, licencie ou visiteur. Ne jamais y rajouter de condition d''appartenance — c''est le bogue qui est revenu deux fois, dans les deux sens.';
