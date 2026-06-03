ALTER TABLE public.production_cards
  ADD COLUMN IF NOT EXISTS legal_phase text NOT NULL DEFAULT 'triagem',
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'aguardando_documentos',
  ADD COLUMN IF NOT EXISTS legal_phase_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS operational_status_changed_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_pc_company_legal_phase ON public.production_cards (company_id, legal_phase);
CREATE INDEX IF NOT EXISTS idx_pc_company_op_status ON public.production_cards (company_id, operational_status);

UPDATE public.production_cards SET legal_phase = CASE column_key
  WHEN 'pre_atendimento' THEN 'triagem'
  WHEN 'contrato_fechado' THEN 'contrato_fechado'
  WHEN 'peticao_inicial' THEN 'peticao_inicial'
  WHEN 'citacao' THEN 'citacao'
  WHEN 'contestacao' THEN 'contestacao'
  WHEN 'instrucao' THEN 'instrucao'
  WHEN 'sentenca' THEN 'sentenca'
  WHEN 'recurso' THEN 'recurso'
  WHEN 'execucao' THEN 'execucao'
  WHEN 'arquivado' THEN 'arquivado'
  ELSE 'triagem'
END
WHERE legal_phase = 'triagem';

UPDATE public.production_cards SET operational_status = CASE column_key
  WHEN 'para_producao' THEN 'em_analise'
  WHEN 'em_producao' THEN 'em_producao'
  WHEN 'em_revisao' THEN 'em_revisao'
  WHEN 'protocolado' THEN 'protocolado'
  WHEN 'acompanhamento' THEN 'acompanhamento'
  WHEN 'pendencias' THEN 'pendencias'
  WHEN 'finalizado' THEN 'finalizado'
  ELSE 'aguardando_documentos'
END
WHERE operational_status = 'aguardando_documentos';

CREATE TABLE IF NOT EXISTS public.card_phase_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  track text NOT NULL CHECK (track IN ('legal','operational')),
  from_value text,
  to_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cph_card ON public.card_phase_history (card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cph_company ON public.card_phase_history (company_id, created_at DESC);

ALTER TABLE public.card_phase_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members view card_phase_history" ON public.card_phase_history;
CREATE POLICY "members view card_phase_history"
  ON public.card_phase_history FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "members insert card_phase_history" ON public.card_phase_history;
CREATE POLICY "members insert card_phase_history"
  ON public.card_phase_history FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND actor_id = auth.uid());