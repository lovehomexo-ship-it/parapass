-- La page publique de réservation tandem affichait « réservations non
-- disponibles » à tout visiteur CONNECTÉ d'un autre centre : la lecture de
-- tandem_config était ouverte aux anonymes (centres actifs) mais, pour un
-- compte connecté, limitée à son propre centre. Un parachutiste connecté ne
-- pouvait donc pas réserver un tandem pour un proche dans une autre DZ.
drop policy if exists tandem_config_lecture_connectes on public.tandem_config;
create policy tandem_config_lecture_connectes on public.tandem_config
  for select to authenticated using (actif = true);
