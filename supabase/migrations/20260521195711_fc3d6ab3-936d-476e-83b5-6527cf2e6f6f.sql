-- Remove duplicate indexes to reduce write cost.
-- Each table below already has another index covering the same column(s).
DROP INDEX IF EXISTS public.idx_pc_assignee;          -- duplicate of idx_production_cards_assignee
DROP INDEX IF EXISTS public.idx_pc_case;              -- duplicate of idx_production_cards_case
DROP INDEX IF EXISTS public.idx_pc_client;            -- duplicate of idx_production_cards_client
DROP INDEX IF EXISTS public.idx_pc_company;           -- duplicate of idx_production_cards_company

DROP INDEX IF EXISTS public.cases_assigned_idx;       -- duplicate of idx_cases_assigned
DROP INDEX IF EXISTS public.cases_client_idx;         -- duplicate of idx_cases_client
DROP INDEX IF EXISTS public.cases_company_idx;        -- duplicate of idx_cases_company
DROP INDEX IF EXISTS public.idx_cases_company_id;     -- duplicate of idx_cases_company

DROP INDEX IF EXISTS public.clients_company_idx;      -- duplicate of idx_clients_company
DROP INDEX IF EXISTS public.idx_clients_company_id;   -- duplicate of idx_clients_company

DROP INDEX IF EXISTS public.idx_documents_card_id;    -- duplicate of idx_documents_card
DROP INDEX IF EXISTS public.idx_contracts_case_id;    -- duplicate of idx_contracts_case

DROP INDEX IF EXISTS public.tasks_assigned_idx;       -- duplicate of idx_tasks_assigned
DROP INDEX IF EXISTS public.tasks_case_idx;           -- duplicate of idx_tasks_case
DROP INDEX IF EXISTS public.tasks_company_idx;        -- duplicate of idx_tasks_company
DROP INDEX IF EXISTS public.tasks_due_idx;            -- duplicate of idx_tasks_due
DROP INDEX IF EXISTS public.idx_tasks_assigned_to;    -- duplicate of idx_tasks_assigned
DROP INDEX IF EXISTS public.idx_tasks_due_date;       -- duplicate of idx_tasks_due

DROP INDEX IF EXISTS public.events_case_idx;          -- duplicate of idx_events_case
DROP INDEX IF EXISTS public.events_company_idx;       -- duplicate of idx_events_company
DROP INDEX IF EXISTS public.events_starts_idx;        -- duplicate of idx_events_starts

DROP INDEX IF EXISTS public.publications_assigned_to_idx; -- duplicate of idx_publications_assigned
DROP INDEX IF EXISTS public.publications_company_idx;     -- duplicate of idx_publications_company
DROP INDEX IF EXISTS public.publications_status_idx;      -- duplicate of idx_publications_status

DROP INDEX IF EXISTS public.deadlines_company_idx;        -- duplicate of idx_deadlines_company
DROP INDEX IF EXISTS public.deadlines_due_idx;            -- duplicate of idx_deadlines_due