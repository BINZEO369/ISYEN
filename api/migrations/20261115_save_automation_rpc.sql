CREATE OR REPLACE FUNCTION public.save_automation(
  p_automation_id integer,
  p_gateway_id integer,
  p_automation_name text,
  p_logic_type text,
  p_cooldown_seconds integer,
  p_conditions jsonb,
  p_actions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, auth, public
AS $function$
DECLARE
  v_automation_id integer;
  v_condition_count integer;
  v_action_count integer;
  v_valid_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_gateway_id IS NULL OR p_gateway_id < 1 THEN
    RAISE EXCEPTION 'A valid gateway is required' USING ERRCODE = '22023';
  END IF;
  IF p_automation_name IS NULL OR length(btrim(p_automation_name)) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Automation name must contain 1 to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF p_logic_type IS NULL OR p_logic_type NOT IN ('AND', 'OR') THEN
    RAISE EXCEPTION 'Logic type must be AND or OR' USING ERRCODE = '22023';
  END IF;
  IF p_cooldown_seconds IS NULL OR p_cooldown_seconds NOT BETWEEN 0 AND 3600 THEN
    RAISE EXCEPTION 'Cooldown must be between 0 and 3600 seconds' USING ERRCODE = '22023';
  END IF;

  IF p_conditions IS NULL OR jsonb_typeof(p_conditions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Conditions must be a JSON array' USING ERRCODE = '22023';
  END IF;
  v_condition_count := jsonb_array_length(p_conditions);
  IF v_condition_count NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'Add between 1 and 3 conditions' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_conditions) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
       OR coalesce(item.value->>'sensor_id', '') !~ '^[1-9][0-9]{0,9}$'
       OR coalesce(item.value->>'operator', '') NOT IN ('eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'changed')
       OR (
         item.value->>'operator' <> 'changed'
         AND jsonb_typeof(item.value->'value') IS DISTINCT FROM 'number'
       )
       OR (
         item.value->>'operator' = 'changed'
         AND item.value ? 'value'
         AND jsonb_typeof(item.value->'value') NOT IN ('number', 'null')
       )
  ) THEN
    RAISE EXCEPTION 'One or more automation conditions are invalid' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_conditions) AS item(value)
    WHERE (item.value->>'sensor_id')::numeric > 2147483647
  ) THEN
    RAISE EXCEPTION 'Sensor ID is outside the supported range' USING ERRCODE = '22023';
  END IF;

  IF p_actions IS NULL OR jsonb_typeof(p_actions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Actions must be a JSON array' USING ERRCODE = '22023';
  END IF;
  v_action_count := jsonb_array_length(p_actions);
  IF v_action_count NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'Add between 1 and 3 actions' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_actions) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
       OR coalesce(item.value->>'device_id', '') !~ '^[1-9][0-9]{0,9}$'
       OR coalesce(item.value->>'action_type', '') NOT IN ('on', 'off', 'toggle')
       OR coalesce(item.value->>'delay_seconds', '0') !~ '^(0|[1-9][0-9]*)$'
  ) THEN
    RAISE EXCEPTION 'One or more automation actions are invalid' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_actions) AS item(value)
    WHERE length(coalesce(item.value->>'delay_seconds', '0')) > 2
  ) THEN
    RAISE EXCEPTION 'Action delay is outside the supported range' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_actions) AS item(value)
    WHERE (coalesce(item.value->>'delay_seconds', '0'))::integer > 60
       OR (item.value->>'device_id')::numeric > 2147483647
  ) THEN
    RAISE EXCEPTION 'Action device ID or delay is outside the supported range' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_valid_count
  FROM jsonb_array_elements(p_conditions) AS item(value)
  JOIN public.sensors AS sensor
    ON sensor.id = (item.value->>'sensor_id')::integer
   AND sensor.gateway_id = p_gateway_id;
  IF v_valid_count <> v_condition_count THEN
    RAISE EXCEPTION 'Select sensors belonging to the selected gateway' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_valid_count
  FROM jsonb_array_elements(p_actions) AS item(value)
  JOIN public.devices AS device
    ON device.id = (item.value->>'device_id')::integer
   AND device.gateway_id = p_gateway_id;
  IF v_valid_count <> v_action_count THEN
    RAISE EXCEPTION 'Select devices belonging to the selected gateway' USING ERRCODE = '22023';
  END IF;

  IF p_automation_id IS NULL THEN
    INSERT INTO public.automations (
      gateway_id, automation_name, enabled, logic_type, cooldown_seconds
    ) VALUES (
      p_gateway_id, btrim(p_automation_name), true, p_logic_type, p_cooldown_seconds
    )
    RETURNING id INTO v_automation_id;
  ELSE
    UPDATE public.automations
    SET automation_name = btrim(p_automation_name),
        logic_type = p_logic_type,
        cooldown_seconds = p_cooldown_seconds
    WHERE id = p_automation_id
      AND gateway_id = p_gateway_id
    RETURNING id INTO v_automation_id;

    IF v_automation_id IS NULL THEN
      RAISE EXCEPTION 'Automation not found' USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM public.automation_conditions
    WHERE automation_id = v_automation_id;
    DELETE FROM public.automation_actions
    WHERE automation_id = v_automation_id;
  END IF;

  INSERT INTO public.automation_conditions (
    automation_id, sensor_id, operator, value, order_index
  )
  SELECT
    v_automation_id,
    (item.value->>'sensor_id')::integer,
    item.value->>'operator',
    CASE
      WHEN jsonb_typeof(item.value->'value') = 'number'
      THEN (item.value->>'value')::double precision
      ELSE NULL
    END,
    item.ordinality - 1
  FROM jsonb_array_elements(p_conditions) WITH ORDINALITY AS item(value, ordinality);

  INSERT INTO public.automation_actions (
    automation_id, device_id, action_type, delay_seconds, order_index
  )
  SELECT
    v_automation_id,
    (item.value->>'device_id')::integer,
    item.value->>'action_type',
    coalesce((item.value->>'delay_seconds')::integer, 0),
    item.ordinality - 1
  FROM jsonb_array_elements(p_actions) WITH ORDINALITY AS item(value, ordinality);

  RETURN jsonb_build_object('id', v_automation_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.save_automation(integer, integer, text, text, integer, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_automation(integer, integer, text, text, integer, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_automation(integer, integer, text, text, integer, jsonb, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
