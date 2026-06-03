ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS triagem_id uuid REFERENCES public.triagens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_triagem
  ON public.documents(company_id, triagem_id)
  WHERE triagem_id IS NOT NULL;
