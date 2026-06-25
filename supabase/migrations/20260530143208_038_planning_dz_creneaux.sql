/*
  # Planning DZ & Météo — Tables

  ## New Tables

  ### creneaux_dz
  Créneaux d'ouverture publiés par les centres.
  - `centre_id` — référence au centre
  - `date` — date du créneau
  - `heure_debut` / `heure_fin` — horaires
  - `statut` — ouvert / ferme / sous_reserve / annule
  - `titre` — label optionnel (ex: "Journée VR4")
  - `message` — message personnalisé du centre
  - `offre_promo` — offre tarifaire éventuelle
  - `nb_places_total` / `nb_places_restantes` — capacité
  - `avion` — appareil(s) prévu(s)
  - `altitude_prevue` — en mètres
  - `type_saut` — tableau des types (OA, OC, PAC…)
  - `latitude` / `longitude` — pour la météo
  - `meteo_data` / `meteo_fetched_at` — cache météo 30 min
  - `notifier_licencies` — si vrai, envoie une notif à l'inscription

  ### inscriptions_creneaux
  Réponses des parachutistes aux créneaux.
  - `creneau_id` — référence au créneau
  - `parachutiste_id` — référence au profil
  - `statut` — present / peut_etre / absent
  - `commentaire` — heure d'arrivée estimée, notes
  - Contrainte UNIQUE sur (creneau_id, parachutiste_id)

  ## Security
  - RLS activé sur les deux tables
  - Lecture créneaux : licenciés actifs du centre OU admins du centre
  - Écriture créneaux : admins du centre uniquement
  - Lecture inscriptions : son propre profil OU admins du centre concerné
  - Écriture inscriptions : uniquement son propre profil (INSERT/UPDATE/DELETE)
*/

-- ─── creneaux_dz ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS creneaux_dz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  date date NOT NULL,
  heure_debut time NOT NULL DEFAULT '09:00',
  heure_fin time NOT NULL DEFAULT '18:00',
  statut text NOT NULL DEFAULT 'ouvert'
    CHECK (statut IN ('ouvert', 'ferme', 'sous_reserve', 'annule')),
  titre text,
  message text,
  offre_promo text,
  nb_places_total integer NOT NULL DEFAULT 20,
  nb_places_restantes integer NOT NULL DEFAULT 20,
  avion text,
  altitude_prevue integer DEFAULT 4000,
  type_saut text[] DEFAULT ARRAY['OA','OC'],
  latitude float,
  longitude float,
  meteo_fetched_at timestamptz,
  meteo_data jsonb,
  notifier_licencies boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creneaux_centre_date
  ON creneaux_dz(centre_id, date);

CREATE INDEX IF NOT EXISTS idx_creneaux_date
  ON creneaux_dz(date);

ALTER TABLE creneaux_dz ENABLE ROW LEVEL SECURITY;

-- Lecture : licenciés actifs du centre OU admins du centre
CREATE POLICY "licencies et admins peuvent voir les creneaux de leur centre"
  ON creneaux_dz FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM licencies_centres lc
      WHERE lc.centre_id = creneaux_dz.centre_id
        AND lc.parachutiste_id = auth.uid()
        AND lc.statut = 'actif'
    )
    OR
    EXISTS (
      SELECT 1 FROM admin_centres ac
      WHERE ac.centre_id = creneaux_dz.centre_id
        AND ac.profile_id = auth.uid()
    )
  );

-- Insertion : admins centre uniquement
CREATE POLICY "admins centre peuvent creer des creneaux"
  ON creneaux_dz FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_centres ac
      WHERE ac.centre_id = creneaux_dz.centre_id
        AND ac.profile_id = auth.uid()
    )
  );

-- Mise à jour : admins centre uniquement
CREATE POLICY "admins centre peuvent modifier leurs creneaux"
  ON creneaux_dz FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_centres ac
      WHERE ac.centre_id = creneaux_dz.centre_id
        AND ac.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_centres ac
      WHERE ac.centre_id = creneaux_dz.centre_id
        AND ac.profile_id = auth.uid()
    )
  );

-- Suppression : admins centre uniquement
CREATE POLICY "admins centre peuvent supprimer leurs creneaux"
  ON creneaux_dz FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_centres ac
      WHERE ac.centre_id = creneaux_dz.centre_id
        AND ac.profile_id = auth.uid()
    )
  );

-- ─── inscriptions_creneaux ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inscriptions_creneaux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creneau_id uuid NOT NULL REFERENCES creneaux_dz(id) ON DELETE CASCADE,
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  statut text NOT NULL DEFAULT 'present'
    CHECK (statut IN ('present', 'peut_etre', 'absent')),
  commentaire text,
  notifie boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT inscriptions_creneaux_unique UNIQUE(creneau_id, parachutiste_id)
);

CREATE INDEX IF NOT EXISTS idx_inscriptions_creneau
  ON inscriptions_creneaux(creneau_id);

CREATE INDEX IF NOT EXISTS idx_inscriptions_para
  ON inscriptions_creneaux(parachutiste_id);

ALTER TABLE inscriptions_creneaux ENABLE ROW LEVEL SECURITY;

-- Lecture : soi-même OU admin du centre du créneau
CREATE POLICY "parachutiste voit ses inscriptions ou admin voit toutes"
  ON inscriptions_creneaux FOR SELECT
  TO authenticated
  USING (
    parachutiste_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM creneaux_dz c
      JOIN admin_centres ac ON ac.centre_id = c.centre_id
      WHERE c.id = inscriptions_creneaux.creneau_id
        AND ac.profile_id = auth.uid()
    )
  );

-- Insertion : soi-même uniquement
CREATE POLICY "parachutiste peut s inscrire lui-meme"
  ON inscriptions_creneaux FOR INSERT
  TO authenticated
  WITH CHECK (parachutiste_id = auth.uid());

-- Mise à jour : soi-même uniquement
CREATE POLICY "parachutiste peut modifier sa propre inscription"
  ON inscriptions_creneaux FOR UPDATE
  TO authenticated
  USING (parachutiste_id = auth.uid())
  WITH CHECK (parachutiste_id = auth.uid());

-- Suppression : soi-même uniquement
CREATE POLICY "parachutiste peut supprimer sa propre inscription"
  ON inscriptions_creneaux FOR DELETE
  TO authenticated
  USING (parachutiste_id = auth.uid());
