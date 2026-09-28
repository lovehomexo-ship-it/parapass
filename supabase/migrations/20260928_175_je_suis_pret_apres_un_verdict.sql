-- « Je suis prêt » ne répondait plus dès qu'un moniteur avait touché la ligne.
--
-- La politique d'écriture de l'élève exigeait « valide_par IS NULL ». L'intention
-- était bonne — un élève ne se valide pas lui-même — mais la condition attrape
-- deux cas parfaitement légitimes :
--
--   1. Épreuve à répéter (quantite_requise > 1). Le moniteur signe la première
--      occurrence, valide_par se remplit, statut reste « a_faire » : l'élève ne
--      peut plus JAMAIS se déclarer prêt pour la seconde. C'est le cas signalé —
--      « Bv — 2 sauts dédiés sous voile · 1/2 ».
--   2. Épreuve ratée. Le moniteur pose « echouee » et signe. L'interface propose
--      « Je suis prêt » pour retenter ; la base refuse. Une épreuve ratée était
--      donc définitivement perdue (Claire DUBOIS, « Autonomie : plier »).
--
-- Et le refus était muet : PostgREST renvoyait 0 ligne, l'erreur s'affichait tout
-- en haut de la carte, hors écran. Le bouton paraissait mort.
--
-- Ce que « valide_par IS NULL » protégeait vraiment, c'est l'EFFACEMENT du verdict
-- du moniteur — pas l'existence d'un verdict. WITH CHECK ne voit que NEW, jamais
-- OLD : il ne peut pas exprimer « ne change pas cette colonne ». C'est donc un
-- déclencheur qui le fait, et la politique se contente de ce qu'elle sait dire.
--
-- Au passage, la politique ne gardait pas quantite_faite : un élève pouvait
-- s'attribuer ses 2 sauts sous voile d'un PATCH. Le déclencheur ferme ce trou.

create or replace function progression_epreuve_colonnes_du_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff boolean;
begin
  -- Scripts d'amorçage et de démo (service_role, aucun sub dans le jeton) :
  -- ils écrivent l'état initial, ils ne sont pas un élève qui triche.
  if auth.uid() is null then
    return new;
  end if;

  v_staff := new.centre_id is not null
             and (is_dz_admin(new.centre_id) or is_moniteur_dz(new.centre_id));
  if v_staff then
    return new;
  end if;

  -- À partir d'ici : l'élève. Il déclare, il ne constate pas.
  if tg_op = 'INSERT' then
    new.valide_par     := null;
    new.valide_at      := null;
    new.note           := null;
    new.saut_id        := null;
    new.quantite_faite := 0;
  else
    new.user_id        := old.user_id;
    new.epreuve_id     := old.epreuve_id;
    new.valide_par     := old.valide_par;
    new.valide_at      := old.valide_at;
    new.note           := old.note;
    new.saut_id        := old.saut_id;
    new.quantite_faite := old.quantite_faite;
  end if;

  return new;
end
$$;

comment on function progression_epreuve_colonnes_du_staff() is
  'Un élève déclare son intention (statut), jamais le verdict (valide_par, '
  'valide_at, note, saut_id) ni le compteur (quantite_faite). WITH CHECK ne '
  'voit pas OLD : la garde « ne change pas cette colonne » vit ici.';

drop trigger if exists trg_progression_colonnes_du_staff on progression_epreuves;
create trigger trg_progression_colonnes_du_staff
  before insert or update on progression_epreuves
  for each row execute function progression_epreuve_colonnes_du_staff();

-- La politique ne parle plus que de ce qu'elle peut vraiment garantir.
drop policy if exists eleve_declare_pret_update on progression_epreuves;
create policy eleve_declare_pret_update on progression_epreuves
  for update
  using      (user_id = auth.uid() and statut = any (array['a_faire','pret','echouee']))
  with check (user_id = auth.uid() and statut = any (array['a_faire','pret']));

drop policy if exists eleve_declare_pret_insert on progression_epreuves;
create policy eleve_declare_pret_insert on progression_epreuves
  for insert
  with check (user_id = auth.uid() and statut = any (array['a_faire','pret']));
