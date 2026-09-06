-- ════════════════════════════════════════════════════════════════════════════
-- AVIONNAGE — Clôturer la JOURNÉE, pas seulement une planche.
--
-- Aujourd'hui on clôture avion par avion. À la fin de la journée il reste des
-- planches ouvertes qui n'ont jamais décollé, une file avec des gens qui sont
-- rentrés chez eux, et rien ne dit que la journée est finie. Le lendemain
-- matin, le chef d'avionnage hérite d'un écran ambigu.
--
-- CE QUE LA CLÔTURE FAIT, ET CE QU'ELLE NE FAIT PAS
--   • Les planches qui ont largué et ne sont pas clôturées le sont, par
--     cloturer_rotation — donc les sauts sont créés, une seule fois
--     (l'index unique sur sauts.place_rotation_id le garantit déjà).
--   • Les planches SANS largage sont ANNULÉES, pas clôturées : elles n'ont
--     pas volé, elles ne doivent produire aucun saut.
--   • La file est vidée des demandes restées en attente, marquées 'retiree' —
--     jamais supprimées : la DZ doit pouvoir constater qui a attendu en vain.
--   • Les inscriptions se ferment (centres.avionnage_actif = false).
--   • Tout est journalisé.
--   Elle NE touche à aucun saut déjà créé, et ne modifie aucune planche déjà
--   clôturée : elle est idempotente, on peut la rejouer sans dégât.
-- ════════════════════════════════════════════════════════════════════════════

begin;

create or replace function cloturer_journee_avionnage(p_centre_id uuid, p_date date default current_date)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_r record;
  v_cloturees int := 0; v_annulees int := 0; v_sauts int := 0; v_file int := 0;
  v_res jsonb;
begin
  if not exists (select 1 from admin_centres a
                 where a.profile_id = auth.uid() and a.centre_id = p_centre_id) then
    raise exception 'Réservé au centre concerné' using errcode = '42501';
  end if;

  for v_r in
    select id, numero, heure_largage, statut, cloturee_le
    from rotations
    where centre_id = p_centre_id and date_jour = p_date
      and statut not in ('terminee', 'annulee') and cloturee_le is null
    order by numero
  loop
    if v_r.heure_largage is not null then
      -- A largué : on clôture par le chemin normal, qui crée les sauts.
      v_res := cloturer_rotation(v_r.id);
      v_sauts := v_sauts + coalesce((v_res->>'sauts_crees')::int, 0);
      v_cloturees := v_cloturees + 1;
    else
      -- N'a pas volé : annulée. Aucun saut ne doit en naître.
      update rotations set statut = 'annulee' where id = v_r.id;
      v_annulees := v_annulees + 1;
    end if;
  end loop;

  -- La file : marquée retirée, jamais supprimée.
  update file_avionnage
     set statut = 'retiree', retiree_le = now()
   where centre_id = p_centre_id and date_jour = p_date and statut = 'attente';
  get diagnostics v_file = row_count;

  update centres set avionnage_actif = false where id = p_centre_id;

  perform journaliser(p_centre_id, 'embarquement_consigne', jsonb_build_object(
    'evenement', 'cloture_journee_avionnage', 'date', p_date,
    'planches_cloturees', v_cloturees, 'planches_annulees', v_annulees,
    'sauts_crees', v_sauts, 'file_retiree', v_file));

  return jsonb_build_object('planches_cloturees', v_cloturees, 'planches_annulees', v_annulees,
                            'sauts_crees', v_sauts, 'file_retiree', v_file);
end $$;

comment on function cloturer_journee_avionnage(uuid, date) is
  'Avionnage — clôt la journée : planches ayant largué clôturées (sauts créés), planches n''ayant pas volé ANNULÉES, file retirée sans suppression, inscriptions fermées. Idempotente.';

commit;

-- APPLIQUÉE LE 06/09/2026 après validation.
