DO $$
DECLARE
    v_updated integer;
    r record;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'social_calendars' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.social_calendars ADD COLUMN status text DEFAULT 'draft';
    END IF;

    UPDATE public.social_calendars SET status = 'draft' WHERE status IS NULL;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'social_calendars null->draft: %', v_updated;

    UPDATE public.social_calendars
    SET status = CASE lower(status)
        WHEN 'rascunho' THEN 'draft'
        WHEN 'draft' THEN 'draft'
        WHEN 'em_producao' THEN 'in_production'
        WHEN 'em_produção' THEN 'in_production'
        WHEN 'producao' THEN 'in_production'
        WHEN 'produção' THEN 'in_production'
        WHEN 'aguardando_aprovacao' THEN 'awaiting_approval'
        WHEN 'aguardando_aprovação' THEN 'awaiting_approval'
        WHEN 'pendente_aprovacao' THEN 'awaiting_approval'
        WHEN 'pendente_aprovação' THEN 'awaiting_approval'
        WHEN 'awaiting_approval' THEN 'awaiting_approval'
        WHEN 'aprovado' THEN 'approved'
        WHEN 'approved' THEN 'approved'
        WHEN 'publicado' THEN 'published'
        WHEN 'published' THEN 'published'
        WHEN 'concluido' THEN 'archived'
        WHEN 'concluído' THEN 'archived'
        WHEN 'archived' THEN 'archived'
        ELSE status
    END
    WHERE status IS NOT NULL;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'social_calendars normalized: %', v_updated;

    UPDATE public.social_calendars
    SET status = 'draft'
    WHERE status IS NOT NULL
      AND status NOT IN ('draft','in_production','awaiting_approval','approved','published','archived');
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'social_calendars forced->draft: %', v_updated;

    FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.social_calendars'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.social_calendars DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'social_posts' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.social_posts ADD COLUMN status text DEFAULT 'draft';
    END IF;

    UPDATE public.social_posts SET status = 'draft' WHERE status IS NULL;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'social_posts null->draft: %', v_updated;

    UPDATE public.social_posts
    SET status = CASE lower(status)
        WHEN 'rascunho' THEN 'draft'
        WHEN 'draft' THEN 'draft'
        WHEN 'pendente' THEN 'briefing_sent'
        WHEN 'briefing_sent' THEN 'briefing_sent'
        WHEN 'ajuste_em_andamento' THEN 'design_in_progress'
        WHEN 'design_in_progress' THEN 'design_in_progress'
        WHEN 'aguardando_aprovacao' THEN 'ready_for_approval'
        WHEN 'aguardando_aprovação' THEN 'ready_for_approval'
        WHEN 'pendente_aprovacao' THEN 'ready_for_approval'
        WHEN 'pendente_aprovação' THEN 'ready_for_approval'
        WHEN 'ready_for_approval' THEN 'ready_for_approval'
        WHEN 'aprovado' THEN 'approved'
        WHEN 'approved' THEN 'approved'
        WHEN 'ajuste_solicitado' THEN 'rejected'
        WHEN 'rejected' THEN 'rejected'
        WHEN 'agendado' THEN 'scheduled'
        WHEN 'scheduled' THEN 'scheduled'
        WHEN 'publicado' THEN 'published'
        WHEN 'published' THEN 'published'
        WHEN 'concluido' THEN 'published'
        WHEN 'concluído' THEN 'published'
        ELSE status
    END
    WHERE status IS NOT NULL;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'social_posts normalized: %', v_updated;

    UPDATE public.social_posts
    SET status = 'draft'
    WHERE status IS NOT NULL
      AND status NOT IN ('draft','briefing_sent','design_in_progress','ready_for_approval','approved','rejected','scheduled','published');
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'social_posts forced->draft: %', v_updated;

    FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.social_posts'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE public.social_calendars DROP CONSTRAINT IF EXISTS social_calendars_status_check;
ALTER TABLE public.social_calendars
ADD CONSTRAINT social_calendars_status_check
CHECK (status IN ('draft','in_production','awaiting_approval','approved','published','archived'));

ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;
ALTER TABLE public.social_posts
ADD CONSTRAINT social_posts_status_check
CHECK (status IN ('draft','briefing_sent','design_in_progress','ready_for_approval','approved','rejected','scheduled','published'));
