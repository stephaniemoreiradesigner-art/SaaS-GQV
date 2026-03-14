DO $$
DECLARE
  has_social_calendar_items boolean;
  has_calendar_item_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'social_calendar_items'
  ) INTO has_social_calendar_items;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_posts'
      AND column_name = 'calendar_item_id'
  ) INTO has_calendar_item_id;

  IF NOT has_social_calendar_items THEN
    RAISE NOTICE 'skip: social_calendar_items_missing';
    RETURN;
  END IF;

  IF NOT has_calendar_item_id THEN
    RAISE NOTICE 'skip: social_posts.calendar_item_id_missing';
    RETURN;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_social_calendar_approved_generate_posts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  posts_cols text[];
  select_cols text[];
  has_posts_cliente_id boolean;
  has_posts_tenant_id boolean;
  has_posts_plataforma boolean;
  has_posts_detailed_content boolean;
  has_posts_calendar_item_id boolean;
  has_calendars_tenant_id boolean;
  tenant_id_udt text;
  calendar_tenant text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT (NEW.status IN ('approved', 'aprovado')) THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_posts'
      AND column_name = 'cliente_id'
  ) INTO has_posts_cliente_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_posts'
      AND column_name = 'tenant_id'
  ) INTO has_posts_tenant_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_posts'
      AND column_name = 'plataforma'
  ) INTO has_posts_plataforma;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_posts'
      AND column_name = 'detailed_content'
  ) INTO has_posts_detailed_content;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_posts'
      AND column_name = 'calendar_item_id'
  ) INTO has_posts_calendar_item_id;

  IF NOT has_posts_calendar_item_id THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_calendars'
      AND column_name = 'tenant_id'
  ) INTO has_calendars_tenant_id;

  IF has_posts_tenant_id AND has_calendars_tenant_id THEN
    SELECT udt_name INTO tenant_id_udt
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_posts'
      AND column_name = 'tenant_id';

    EXECUTE 'SELECT tenant_id::text FROM public.social_calendars WHERE id = $1'
    INTO calendar_tenant
    USING NEW.id;
  END IF;

  posts_cols := ARRAY['calendar_id', 'data_agendada', 'tema', 'legenda', 'formato', 'status', 'created_at', 'updated_at'];
  select_cols := ARRAY['$1', 'i.data', 'i.tema', 'COALESCE(i.observacoes, '''')', 'i.tipo_conteudo', '''draft''', 'now()', 'now()'];

  IF has_posts_cliente_id THEN
    posts_cols := posts_cols || 'cliente_id';
    select_cols := select_cols || '$2';
  END IF;

  IF has_posts_tenant_id AND calendar_tenant IS NOT NULL THEN
    posts_cols := posts_cols || 'tenant_id';
    select_cols := select_cols || format('$3::%s', tenant_id_udt);
  END IF;

  IF has_posts_calendar_item_id THEN
    posts_cols := posts_cols || 'calendar_item_id';
    select_cols := select_cols || 'i.id';
  END IF;

  IF has_posts_plataforma THEN
    posts_cols := posts_cols || 'plataforma';
    select_cols := select_cols || 'i.canal';
  END IF;

  IF has_posts_detailed_content THEN
    posts_cols := posts_cols || 'detailed_content';
    select_cols := select_cols || 'COALESCE(i.observacoes, '''')';
  END IF;

  EXECUTE format($sql$
    INSERT INTO public.social_posts (%s)
    SELECT %s
    FROM public.social_calendar_items i
    WHERE i.calendar_id = $1
      AND NOT EXISTS (
        SELECT 1
        FROM public.social_posts sp
        WHERE sp.calendar_item_id = i.id
      )
  $sql$,
    array_to_string(posts_cols, ', '),
    array_to_string(select_cols, ', ')
  )
  USING NEW.id, NEW.cliente_id, calendar_tenant;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handle_social_calendar_approved_generate_posts ON public.social_calendars;
CREATE TRIGGER handle_social_calendar_approved_generate_posts
AFTER UPDATE OF status ON public.social_calendars
FOR EACH ROW
EXECUTE FUNCTION public.handle_social_calendar_approved_generate_posts();

REVOKE ALL ON FUNCTION public.handle_social_calendar_approved_generate_posts() FROM PUBLIC;
