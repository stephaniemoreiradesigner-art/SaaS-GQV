DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'logbook_origin') THEN
    CREATE TYPE public.logbook_origin AS ENUM ('social_media', 'trafego_pago', 'automacoes');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.logbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  origin public.logbook_origin NOT NULL,
  action_type text NOT NULL,
  title text NOT NULL,
  priority text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'open',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  duration_seconds integer NULL
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'logbook_entries'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'logbook_entries_client_id_fkey'
    ) THEN
      ALTER TABLE public.logbook_entries
      ADD CONSTRAINT logbook_entries_client_id_fkey
      FOREIGN KEY (client_id)
      REFERENCES public.clientes(id)
      ON DELETE RESTRICT;
    END IF;
  END IF;
END
$$;

COMMENT ON COLUMN public.logbook_entries.client_id IS 'FK opcional para public.clientes(id) adicionada via bloco condicional acima.';

CREATE TABLE IF NOT EXISTS public.logbook_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.logbook_entries(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.logbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logbook_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS logbook_entries_select_authenticated ON public.logbook_entries;
CREATE POLICY logbook_entries_select_authenticated
  ON public.logbook_entries
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS logbook_entries_insert_authenticated ON public.logbook_entries;
CREATE POLICY logbook_entries_insert_authenticated
  ON public.logbook_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS logbook_actions_select_authenticated ON public.logbook_actions;
CREATE POLICY logbook_actions_select_authenticated
  ON public.logbook_actions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS logbook_actions_insert_authenticated ON public.logbook_actions;
CREATE POLICY logbook_actions_insert_authenticated
  ON public.logbook_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.logbook_add_action(p_entry_id uuid, p_note text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_id uuid;
BEGIN
  IF p_note IS NULL OR length(trim(p_note)) = 0 THEN
    RAISE EXCEPTION 'note_obrigatoria';
  END IF;

  PERFORM 1
  FROM public.logbook_entries
  WHERE id = p_entry_id
    AND status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'entry_invalida_ou_fechada';
  END IF;

  INSERT INTO public.logbook_actions (entry_id, note, created_by)
  VALUES (p_entry_id, p_note, auth.uid())
  RETURNING id INTO v_action_id;

  RETURN v_action_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.logbook_close_entry(p_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.logbook_entries
  SET status = 'done',
      completed_at = now(),
      duration_seconds = extract(epoch from (now() - created_at))::int
  WHERE id = p_entry_id
    AND status = 'open';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'entry_invalida_ou_fechada';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.logbook_add_action(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.logbook_close_entry(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS logbook_entries_client_origin_created_idx
  ON public.logbook_entries (client_id, origin, created_at DESC);

CREATE INDEX IF NOT EXISTS logbook_actions_entry_created_idx
  ON public.logbook_actions (entry_id, created_at ASC);

-- Como rodar no Supabase (SQL Editor):
-- 1) Acesse o projeto no Supabase.
-- 2) Vá em SQL Editor.
-- 3) Clique em New query.
-- 4) Cole todo o conteúdo deste arquivo.
-- 5) Clique em Run.
