-- Appliquée en base : photo_satellite_du_briefing_lecture_et_remplacement
--
-- LA PHOTO SATELLITE DU BRIEFING NE POUVAIT PAS S'ENVOYER.
-- « Upload échoué : new row violates row-level security policy ».
--
-- 1. LE BUCKET `dz-maps` N'AVAIT NI LECTURE NI SUPPRESSION. Une politique
--    d'écriture, une de mise à jour, rien d'autre. Or l'envoi se fait en
--    `upsert` : l'API de stockage doit d'abord VOIR si le fond existe pour
--    décider entre insérer et remplacer. Sans droit de lecture elle ne voit
--    rien, tente une insertion, et bute sur l'objet qu'elle vient d'écrire.
--    Le premier envoi passe parfois ; le remplacement, jamais.
--
-- 2. UN CHEMIN INATTENDU FAISAIT ÉCHOUER LA POLITIQUE ELLE-MÊME. Elle écrivait
--    `split_part(name,'/',1)::uuid` : si le premier segment n'est pas un
--    identifiant, le transtypage LÈVE UNE ERREUR au lieu de répondre « non ».
--    Une règle de sécurité doit REFUSER, pas planter.
create or replace function dz_du_chemin(p_name text)
returns uuid language plpgsql immutable set search_path = pg_catalog as $$
declare v uuid;
begin
  begin
    v := split_part(p_name, '/', 1)::uuid;
  exception when others then
    return null;      -- un chemin qui ne nomme pas un centre ne donne aucun droit
  end;
  return v;
end $$;

grant execute on function dz_du_chemin(text) to authenticated, anon, service_role;

drop policy if exists dz_admin_write_dz_maps  on storage.objects;
drop policy if exists dz_admin_update_dz_maps on storage.objects;
drop policy if exists dz_admin_read_dz_maps   on storage.objects;
drop policy if exists dz_admin_delete_dz_maps on storage.objects;

create policy dz_admin_write_dz_maps on storage.objects for insert to authenticated
  with check (bucket_id = 'dz-maps' and is_dz_admin(dz_du_chemin(name)));

create policy dz_admin_update_dz_maps on storage.objects for update to authenticated
  using (bucket_id = 'dz-maps' and is_dz_admin(dz_du_chemin(name)))
  with check (bucket_id = 'dz-maps' and is_dz_admin(dz_du_chemin(name)));

create policy dz_admin_read_dz_maps on storage.objects for select to authenticated
  using (bucket_id = 'dz-maps' and is_dz_admin(dz_du_chemin(name)));

create policy dz_admin_delete_dz_maps on storage.objects for delete to authenticated
  using (bucket_id = 'dz-maps' and is_dz_admin(dz_du_chemin(name)));

update storage.buckets
   set file_size_limit = 8388608,
       allowed_mime_types = array['image/webp','image/jpeg','image/png']
 where id = 'dz-maps';
