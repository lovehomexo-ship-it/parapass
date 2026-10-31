-- LA TABLE DES PASSAGERS TANDEM N'EXISTAIT PAS.
-- `tandem_reserver`, `tandem_passager_enregistrer`, `tandem_dossier_get` et
-- `tandem_certif_get` y lisent et y écrivent, mais elle n'avait jamais été
-- créée : toute réservation en ligne échouait (« relation tandem_passengers
-- does not exist »), et le dossier passager (poids, contact d'urgence,
-- décharge) ne pouvait pas être rempli.
--
-- Les données d'un passager (date de naissance, poids, contact d'urgence) ne
-- se lisent que par les fonctions à jeton (le passager, avec son lien) ou par
-- un administrateur du centre de la réservation.
create table if not exists public.tandem_passengers (
  id                      uuid primary key default gen_random_uuid(),
  booking_id              uuid not null references public.tandem_bookings(id) on delete cascade,
  prenom                  text not null default '',
  nom                     text not null default '',
  date_naissance          date,
  nationalite             text,
  adresse                 text,
  contact_urgence_nom     text,
  contact_urgence_tel     text,
  poids                   integer check (poids is null or (poids between 20 and 200)),
  decharge_signee         boolean not null default false,
  decharge_signe_at       timestamptz,
  decharge_signature_hash text,
  certif_token            text unique default translate(encode(gen_random_bytes(18), 'base64'), '+/=', '-_'),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists tandem_passengers_booking on public.tandem_passengers(booking_id);

alter table public.tandem_passengers enable row level security;
create policy tandem_passengers_admin on public.tandem_passengers
  for all to authenticated
  using (exists (select 1 from tandem_bookings b where b.id = booking_id and is_dz_admin(b.centre_id)))
  with check (exists (select 1 from tandem_bookings b where b.id = booking_id and is_dz_admin(b.centre_id)));
-- (Pas de politique pour `anon` : sans elle, la RLS refuse tout accès anonyme
-- direct ; le passager passe par les fonctions à jeton.)
-- Les réservations antérieures n'ont pas de fiche : les fonctions les lisent
-- par jointure externe et retombent sur le nom de la réservation.
