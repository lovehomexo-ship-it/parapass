-- « Erreur lors de l'upload : new row violates row-level security policy » sur
-- le logo de Royan.
--
-- Le seau `centre-logos` n'avait que deux règles, INSERT et UPDATE, et AUCUNE
-- règle de lecture ni de suppression. Or l'écran téléverse en `upsert` : le
-- moteur doit d'abord LIRE l'objet existant pour décider s'il insère ou met à
-- jour. Sans règle SELECT, cette lecture ne voit rien — c'est exactement le
-- défaut déjà rencontré sur `dz-maps`, sur un autre seau.
--
-- Et les deux règles présentes disaient seulement « bucket_id = centre-logos » :
-- n'IMPORTE QUEL compte connecté pouvait donc écraser le logo de n'importe
-- quelle DZ. Le logo sert de cachet officiel au verso des carnets. On ferme le
-- trou en même temps qu'on répare : seul l'administrateur du centre écrit le
-- sien. Mesuré : un admin de Royan se voit refuser l'écriture du logo BigAir.

-- Le centre d'un fichier « logo-<uuid>.<ext> ». Ne LÈVE jamais : une règle qui
-- explose sur un nom inattendu bloque tout le seau (leçon de `dz-maps`, où
-- `split_part(...)::uuid` levait au lieu de rendre faux).
create or replace function centre_du_logo(p_nom text)
returns uuid
language plpgsql
immutable
as $$
declare v_id uuid;
begin
  begin
    v_id := (regexp_match(p_nom, '^logo-([0-9a-fA-F-]{36})\.'))[1]::uuid;
  exception when others then
    return null;
  end;
  return v_id;
end
$$;

drop policy if exists "centre-logos auth insert" on storage.objects;
drop policy if exists "centre-logos auth update" on storage.objects;
drop policy if exists "centre-logos lecture" on storage.objects;
drop policy if exists "centre-logos ecriture admin" on storage.objects;
drop policy if exists "centre-logos maj admin" on storage.objects;
drop policy if exists "centre-logos suppression admin" on storage.objects;

-- Lecture : le seau est public (le logo s'affiche sur les cartes de licence).
-- Sans elle, l'upsert ne peut pas savoir si l'objet existe.
create policy "centre-logos lecture" on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'centre-logos');

create policy "centre-logos ecriture admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'centre-logos'
              and centre_du_logo(name) is not null
              and is_dz_admin(centre_du_logo(name)));

create policy "centre-logos maj admin" on storage.objects
  for update to authenticated
  using      (bucket_id = 'centre-logos' and is_dz_admin(centre_du_logo(name)))
  with check (bucket_id = 'centre-logos' and is_dz_admin(centre_du_logo(name)));

create policy "centre-logos suppression admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'centre-logos' and is_dz_admin(centre_du_logo(name)));
