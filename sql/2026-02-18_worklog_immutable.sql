CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.worklogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  module TEXT NOT NULL CHECK (module IN ('social_media','traffic','automations')),
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  priority TEXT NULL,
  requested_by_name TEXT NULL,
  due_date DATE NULL,
  creative_link TEXT NULL,
  description TEXT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ NULL,
  duration_seconds INT NULL
);

CREATE TABLE IF NOT EXISTS public.worklog_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worklog_id UUID NOT NULL REFERENCES public.worklogs(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.enforce_worklogs_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.module IS DISTINCT FROM OLD.module
     OR NEW.action_type IS DISTINCT FROM OLD.action_type
     OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.requested_by_name IS DISTINCT FROM OLD.requested_by_name
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.creative_link IS DISTINCT FROM OLD.creative_link
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'worklogs são imutáveis após criação';
  END IF;

  IF NEW.status = 'done' THEN
    NEW.closed_at := COALESCE(NEW.closed_at, now());
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.closed_at - OLD.created_at))::int;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.block_worklog_actions_changes()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'worklog_actions são imutáveis após criação';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_worklogs_immutability ON public.worklogs;
CREATE TRIGGER trg_worklogs_immutability
BEFORE UPDATE ON public.worklogs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_worklogs_immutability();

DROP TRIGGER IF EXISTS trg_worklog_actions_no_update ON public.worklog_actions;
CREATE TRIGGER trg_worklog_actions_no_update
BEFORE UPDATE ON public.worklog_actions
FOR EACH ROW
EXECUTE FUNCTION public.block_worklog_actions_changes();

DROP TRIGGER IF EXISTS trg_worklog_actions_no_delete ON public.worklog_actions;
CREATE TRIGGER trg_worklog_actions_no_delete
BEFORE DELETE ON public.worklog_actions
FOR EACH ROW
EXECUTE FUNCTION public.block_worklog_actions_changes();
