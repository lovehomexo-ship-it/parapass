-- Appliquée en base : sauts_centre_ou_le_saut_a_eu_lieu + valider_un_saut_seulement_chez_soi
--
-- UN SAUT NE SAVAIT PAS OÙ IL AVAIT EU LIEU. La table ne portait que `lieu`,
-- du texte libre ; le formulaire résolvait le centre choisi, en recopiait le
-- nom et JETAIT l'identifiant. La file de validation se construisait donc sur
-- la seule appartenance : un saut réel à Royan attendait la signature de
-- BigAir, qui ne l'avait pas vu. Or valider, ici, c'est signer.
alter table sauts add column if not exists centre_id uuid references centres(id) on delete set null;

comment on column sauts.centre_id is
  'La DZ ParaPass ou le saut a eu lieu, quand c''en est une. NULL = DZ hors ParaPass (le texte libre `lieu` fait foi) : aucun centre ne peut alors l''attester dans l''application.';

create index if not exists sauts_centre_statut_idx on sauts (centre_id, statut, date_saut desc);

-- Reprise : la rotation d'origine quand le saut vient d'une planche, sinon
-- l'égalité STRICTE du nom. Deviner « Royan (Médis) » = « Royan Océan
-- Parachutisme » reviendrait à attribuer une signature sur une ressemblance.
update sauts s set centre_id = r.centre_id
from places_rotation pr join rotations r on r.id = pr.rotation_id
where pr.id = s.place_rotation_id and s.centre_id is null;

update sauts s set centre_id = c.id
from centres c where c.nom = s.lieu and s.centre_id is null;

-- LA GARANTIE EST EN BASE, PAS DANS L'ÉCRAN : un appel direct à l'API
-- contournait le filtre.
drop policy if exists "Moniteurs and admins can update sauts for validation" on sauts;
create policy "Moniteurs and admins can update sauts for validation" on sauts
  for update using (
    moniteur_id = auth.uid()
    or get_my_role() = any (array['moniteur','admin'])
    or (get_my_role() = 'admin_centre'
        and is_my_licencie(parachutiste_id)
        and centre_id in (select centre_id from admin_centres where profile_id = auth.uid()))
  ) with check (
    moniteur_id = auth.uid()
    or get_my_role() = any (array['moniteur','admin'])
    or (get_my_role() = 'admin_centre'
        and is_my_licencie(parachutiste_id)
        and centre_id in (select centre_id from admin_centres where profile_id = auth.uid()))
  );

-- `cloturer_rotation` connaissait le centre et n'en recopiait que le nom :
-- son insert porte désormais `centre_id` (corps complet en base, migration
-- `valider_un_saut_seulement_chez_soi`).
