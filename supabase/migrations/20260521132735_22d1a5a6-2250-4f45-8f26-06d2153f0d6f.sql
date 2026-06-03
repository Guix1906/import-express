-- Auto-fill completed_at when card is marked finalizado
CREATE OR REPLACE FUNCTION public.production_cards_autocomplete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.operational_status = 'finalizado' AND OLD.operational_status IS DISTINCT FROM 'finalizado' AND NEW.completed_at IS NULL THEN
    NEW.completed_at = now();
  END IF;
  IF NEW.operational_status <> 'finalizado' AND OLD.operational_status = 'finalizado' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_production_cards_autocomplete ON public.production_cards;
CREATE TRIGGER trg_production_cards_autocomplete
BEFORE UPDATE ON public.production_cards
FOR EACH ROW EXECUTE FUNCTION public.production_cards_autocomplete();

-- Department column for sector filtering
ALTER TABLE public.production_cards
  ADD COLUMN IF NOT EXISTS department text;