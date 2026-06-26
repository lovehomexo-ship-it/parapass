-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 088 : Module de gestion financière (Pro DZ)
--
-- Tables : dz_tarifs, dz_promotions, parachutiste_transactions, paiements
-- Triggers : auto-création de transaction sur saut validé / pliage validé
-- RLS : admin_centre voit tout son DZ; parachutiste voit ses propres données
-- ─────────────────────────────────────────────────────────────────────────────

-- ── dz_tarifs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dz_tarifs (
  id        uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dz_id     uuid        NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  type      text        NOT NULL CHECK (type IN ('saut', 'pliage', 'location_parachute', 'autre')),
  nom       text        NOT NULL,
  prix_cents integer    NOT NULL DEFAULT 0 CHECK (prix_cents >= 0),
  actif     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dz_tarifs_dz_idx ON public.dz_tarifs(dz_id);
ALTER TABLE public.dz_tarifs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tarifs_dz_admin_all"  ON public.dz_tarifs;
DROP POLICY IF EXISTS "tarifs_para_read"     ON public.dz_tarifs;

CREATE POLICY "tarifs_dz_admin_all" ON public.dz_tarifs
  FOR ALL TO authenticated
  USING (
    dz_id IN (
      SELECT lc.centre_id FROM public.licencies_centres lc
      WHERE lc.parachutiste_id = auth.uid() AND lc.statut = 'actif'
    )
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moniteur')
  )
  WITH CHECK (
    dz_id IN (
      SELECT lc.centre_id FROM public.licencies_centres lc
      WHERE lc.parachutiste_id = auth.uid() AND lc.statut = 'actif'
    )
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moniteur')
  );

CREATE POLICY "tarifs_para_read" ON public.dz_tarifs
  FOR SELECT TO authenticated
  USING (
    actif = true
    AND dz_id IN (
      SELECT lc.centre_id FROM public.licencies_centres lc
      WHERE lc.parachutiste_id = auth.uid() AND lc.statut = 'actif'
    )
  );

-- ── dz_promotions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dz_promotions (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dz_id       uuid        NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  nom         text        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('pourcentage', 'fixe')),
  valeur      numeric(10,2) NOT NULL DEFAULT 0 CHECK (valeur >= 0),
  date_debut  date,
  date_fin    date,
  actif       boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dz_promos_dz_idx ON public.dz_promotions(dz_id);
ALTER TABLE public.dz_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promos_dz_admin_all" ON public.dz_promotions;

CREATE POLICY "promos_dz_admin_all" ON public.dz_promotions
  FOR ALL TO authenticated
  USING (
    dz_id IN (
      SELECT lc.centre_id FROM public.licencies_centres lc
      WHERE lc.parachutiste_id = auth.uid() AND lc.statut = 'actif'
    )
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moniteur')
  )
  WITH CHECK (
    dz_id IN (
      SELECT lc.centre_id FROM public.licencies_centres lc
      WHERE lc.parachutiste_id = auth.uid() AND lc.statut = 'actif'
    )
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moniteur')
  );

-- ── parachutiste_transactions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parachutiste_transactions (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parachutiste_id uuid        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  dz_id           uuid        NOT NULL REFERENCES public.centres(id)   ON DELETE CASCADE,
  type            text        NOT NULL CHECK (type IN ('saut', 'pliage', 'location_parachute', 'autre')),
  description     text,
  montant_cents   integer     NOT NULL DEFAULT 0 CHECK (montant_cents >= 0),
  statut          text        NOT NULL DEFAULT 'du' CHECK (statut IN ('du', 'paye', 'annule')),
  jump_id         uuid        REFERENCES public.sauts(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS para_tx_para_idx   ON public.parachutiste_transactions(parachutiste_id);
CREATE INDEX IF NOT EXISTS para_tx_dz_idx     ON public.parachutiste_transactions(dz_id);
CREATE INDEX IF NOT EXISTS para_tx_statut_idx ON public.parachutiste_transactions(statut);
ALTER TABLE public.parachutiste_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tx_para_own"        ON public.parachutiste_transactions;
DROP POLICY IF EXISTS "tx_dz_admin_all"    ON public.parachutiste_transactions;
DROP POLICY IF EXISTS "tx_insert_trigger"  ON public.parachutiste_transactions;

-- Parachutiste voit ses propres transactions
CREATE POLICY "tx_para_own" ON public.parachutiste_transactions
  FOR SELECT TO authenticated
  USING (parachutiste_id = auth.uid());

-- Admin DZ voit et modifie toutes les transactions de son centre
CREATE POLICY "tx_dz_admin_all" ON public.parachutiste_transactions
  FOR ALL TO authenticated
  USING (
    dz_id IN (
      SELECT lc.centre_id FROM public.licencies_centres lc
      WHERE lc.parachutiste_id = auth.uid() AND lc.statut = 'actif'
    )
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moniteur')
  )
  WITH CHECK (
    dz_id IN (
      SELECT lc.centre_id FROM public.licencies_centres lc
      WHERE lc.parachutiste_id = auth.uid() AND lc.statut = 'actif'
    )
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moniteur')
  );

-- Autorise les INSERT depuis les triggers (SECURITY DEFINER)
CREATE POLICY "tx_insert_trigger" ON public.parachutiste_transactions
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── paiements ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paiements (
  id                        uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parachutiste_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dz_id                     uuid        NOT NULL REFERENCES public.centres(id)  ON DELETE CASCADE,
  montant_cents             integer     NOT NULL DEFAULT 0,
  stripe_payment_intent_id  text,
  stripe_checkout_session_id text,
  statut                    text        NOT NULL DEFAULT 'en_attente',
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paiements_para_idx   ON public.paiements(parachutiste_id);
CREATE INDEX IF NOT EXISTS paiements_dz_idx     ON public.paiements(dz_id);
CREATE INDEX IF NOT EXISTS paiements_stripe_idx ON public.paiements(stripe_payment_intent_id);
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paiements_para_own"    ON public.paiements;
DROP POLICY IF EXISTS "paiements_dz_admin"    ON public.paiements;

CREATE POLICY "paiements_para_own" ON public.paiements
  FOR SELECT TO authenticated
  USING (parachutiste_id = auth.uid());

CREATE POLICY "paiements_dz_admin" ON public.paiements
  FOR ALL TO authenticated
  USING (
    dz_id IN (
      SELECT lc.centre_id FROM public.licencies_centres lc
      WHERE lc.parachutiste_id = auth.uid() AND lc.statut = 'actif'
    )
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moniteur')
  )
  WITH CHECK (true);

-- ── Trigger : saut validé → transaction ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_saut_create_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_dz_id     uuid;
  v_prix      integer := 0;
BEGIN
  IF NEW.statut <> 'valide' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.statut = 'valide' THEN RETURN NEW; END IF;

  SELECT lc.centre_id INTO v_dz_id
  FROM public.licencies_centres lc
  WHERE lc.parachutiste_id = NEW.parachutiste_id AND lc.statut = 'actif'
  LIMIT 1;

  IF v_dz_id IS NULL THEN RETURN NEW; END IF;

  SELECT dt.prix_cents INTO v_prix
  FROM public.dz_tarifs dt
  WHERE dt.dz_id = v_dz_id AND dt.type = 'saut' AND dt.actif = true
  ORDER BY dt.created_at DESC LIMIT 1;

  INSERT INTO public.parachutiste_transactions
    (parachutiste_id, dz_id, type, description, montant_cents, statut, jump_id)
  VALUES (
    NEW.parachutiste_id, v_dz_id, 'saut',
    'Saut ' || COALESCE(NEW.hauteur_m::text, '') || 'm — ' || COALESCE(NEW.lieu, ''),
    COALESCE(v_prix, 0), 'du', NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS saut_create_transaction ON public.sauts;
CREATE TRIGGER saut_create_transaction
  AFTER INSERT OR UPDATE OF statut ON public.sauts
  FOR EACH ROW EXECUTE FUNCTION public.fn_saut_create_transaction();

-- ── Trigger : pliage payant → transaction ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_pliage_create_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_dz_id   uuid;
  v_prix    integer := 0;
BEGIN
  IF NEW.type_pliage <> 'plieur_paye' THEN RETURN NEW; END IF;

  SELECT sp.user_id INTO v_user_id
  FROM public.sacs_parachute sp WHERE sp.id = NEW.sac_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT lc.centre_id INTO v_dz_id
  FROM public.licencies_centres lc
  WHERE lc.parachutiste_id = v_user_id AND lc.statut = 'actif'
  LIMIT 1;
  IF v_dz_id IS NULL THEN RETURN NEW; END IF;

  SELECT dt.prix_cents INTO v_prix
  FROM public.dz_tarifs dt
  WHERE dt.dz_id = v_dz_id AND dt.type = 'pliage' AND dt.actif = true
  ORDER BY dt.created_at DESC LIMIT 1;

  INSERT INTO public.parachutiste_transactions
    (parachutiste_id, dz_id, type, description, montant_cents, statut)
  VALUES (
    v_user_id, v_dz_id, 'pliage',
    'Pliage par ' || COALESCE(NEW.plieur_nom_libre, 'plieur'),
    COALESCE(v_prix, 0), 'du'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pliage_create_transaction ON public.validations_pliage;
CREATE TRIGGER pliage_create_transaction
  AFTER INSERT ON public.validations_pliage
  FOR EACH ROW EXECUTE FUNCTION public.fn_pliage_create_transaction();
