-- Store each DHT/BMP metric independently and return the latest value per device+metric.
-- The firmware remains the hardware source; this RPC is the authenticated ingestion target.
CREATE OR REPLACE FUNCTION public.latest_sensor_readings(p_home_id uuid, p_limit integer DEFAULT 500)
RETURNS TABLE(id uuid, home_id uuid, device_id uuid, metric text, value_numeric double precision, value_text text, unit text, recorded_at timestamptz)
LANGUAGE sql STABLE SET search_path = pg_catalog, public
AS $function$
  SELECT DISTINCT ON (sd.device_id, sd.metric)
    sd.id, sd.home_id, sd.device_id, sd.metric,
    sd.value_numeric, sd.value_text, sd.unit, sd.recorded_at
  FROM public.sensor_data AS sd
  JOIN public.devices AS d
    ON d.isyen_id = sd.isyen_id AND d.id = sd.device_id AND d.home_id = sd.home_id
  WHERE sd.isyen_id = public.current_isyen_id()
    AND sd.home_id = p_home_id
    AND (
      (d.config ->> 'hardware' = 'esp32_s3_gpio_sensor' AND d.config ->> 'metric' = sd.metric)
      OR
      (d.config ->> 'hardware' = 'isyen_protocol_sensor' AND (
        (d.config ->> 'sensor_key' IN ('dht11_temperature_humidity','dht22_temperature_humidity') AND sd.metric IN ('temperature','humidity'))
        OR (d.config ->> 'sensor_key' IN ('sensor_bmp180','sensor_bmp280','sensor_bmp388','sensor_bmp390') AND sd.metric IN ('temperature','pressure'))
      ))
    )
  ORDER BY sd.device_id, sd.metric, sd.recorded_at DESC, sd.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 500);
$function$;

CREATE OR REPLACE FUNCTION public.record_protocol_sensor_readings(
  p_device_id uuid,
  p_values jsonb,
  p_reported_at timestamptz DEFAULT NULL
)
RETURNS TABLE(id uuid, home_id uuid, device_id uuid, metric text, value_numeric double precision, value_text text, unit text, recorded_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_isyen_id text;
  v_device public.devices%ROWTYPE;
  v_sensor_key text;
  v_entry record;
  v_metric text;
  v_value double precision;
  v_unit text;
  v_allowed text[];
  v_min double precision;
  v_max double precision;
BEGIN
  v_isyen_id := public.current_isyen_id();
  IF v_isyen_id IS NULL OR length(trim(v_isyen_id)) = 0 THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'sensor_account_not_authenticated';
  END IF;
  IF p_values IS NULL OR jsonb_typeof(p_values) <> 'object' OR jsonb_object_length(p_values) < 1 OR jsonb_object_length(p_values) > 2 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'sensor_values_invalid';
  END IF;

  SELECT d.* INTO v_device
  FROM public.devices AS d
  WHERE d.id = p_device_id
    AND d.isyen_id = v_isyen_id
    AND d.config ->> 'hardware' = 'isyen_protocol_sensor'
    AND d.config ->> 'enabled' = 'true'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'sensor_device_not_available';
  END IF;

  v_sensor_key := v_device.config ->> 'sensor_key';
  IF v_sensor_key IN ('dht11_temperature_humidity','dht22_temperature_humidity') THEN
    v_allowed := ARRAY['temperature','humidity'];
  ELSIF v_sensor_key IN ('sensor_bmp180','sensor_bmp280','sensor_bmp388','sensor_bmp390') THEN
    v_allowed := ARRAY['temperature','pressure'];
  ELSE
    RAISE EXCEPTION USING errcode = '22023', message = 'sensor_model_invalid';
  END IF;

  FOR v_entry IN SELECT key, value FROM jsonb_each(p_values)
  LOOP
    v_metric := v_entry.key;
    IF NOT (v_metric = ANY(v_allowed)) OR jsonb_typeof(v_entry.value) <> 'number' THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'sensor_metric_invalid';
    END IF;
    v_value := (v_entry.value #>> '{}')::double precision;
    IF v_value::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'sensor_value_invalid';
    END IF;

    IF v_metric = 'temperature' THEN
      IF v_device.config ->> 'temperature_unit' = 'fahrenheit' THEN
        IF v_sensor_key = 'dht11_temperature_humidity' THEN v_min := 32; v_max := 122;
        ELSIF v_sensor_key = 'dht22_temperature_humidity' THEN v_min := -40; v_max := 176;
        ELSE v_min := -40; v_max := 185; END IF;
        IF v_value < v_min OR v_value > v_max THEN RAISE EXCEPTION USING errcode = '22023', message = 'sensor_temperature_out_of_range'; END IF;
        v_value := (v_value - 32) * 5 / 9;
      ELSE
        IF v_sensor_key = 'dht11_temperature_humidity' THEN v_min := 0; v_max := 50;
        ELSIF v_sensor_key = 'dht22_temperature_humidity' THEN v_min := -40; v_max := 80;
        ELSE v_min := -40; v_max := 85; END IF;
        IF v_value < v_min OR v_value > v_max THEN RAISE EXCEPTION USING errcode = '22023', message = 'sensor_temperature_out_of_range'; END IF;
      END IF;
      v_unit := '°C';
    ELSIF v_metric = 'humidity' THEN
      IF v_sensor_key = 'dht11_temperature_humidity' THEN v_min := 20; v_max := 90; ELSE v_min := 0; v_max := 100; END IF;
      IF v_value < v_min OR v_value > v_max THEN RAISE EXCEPTION USING errcode = '22023', message = 'sensor_humidity_out_of_range'; END IF;
      v_unit := '%';
    ELSE
      IF v_value < 300 OR v_value > 1100 THEN RAISE EXCEPTION USING errcode = '22023', message = 'sensor_pressure_out_of_range'; END IF;
      v_unit := 'hPa';
    END IF;

    RETURN QUERY INSERT INTO public.sensor_data AS inserted (
      isyen_id, home_id, device_id, metric, value_numeric, value_text, unit, data, recorded_at
    ) VALUES (
      v_isyen_id, v_device.home_id, v_device.id, v_metric, v_value, NULL, v_unit,
      jsonb_build_object('sensor_key', v_sensor_key, 'reported_at', p_reported_at), now()
    )
    RETURNING inserted.id, inserted.home_id, inserted.device_id, inserted.metric,
      inserted.value_numeric, inserted.value_text, inserted.unit, inserted.recorded_at;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_protocol_sensor_readings(uuid, jsonb, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_protocol_sensor_readings(uuid, jsonb, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_protocol_sensor_readings(uuid, jsonb, timestamptz) TO authenticated;
