-- ISYEN sensor catalog and one-home-per-account hardening.
-- Sensors remain shared device_types plus tenant-owned devices.

create unique index if not exists homes_one_per_isyen_id_idx
  on public.homes (isyen_id);

comment on index public.homes_one_per_isyen_id_idx is
  'Guarantees one home per ISYEN tenant/account.';

create index if not exists device_types_category_active_idx
  on public.device_types (category, is_active, key);

insert into public.device_types
  (key, name, category, manufacturer, capabilities, default_config, is_active)
values
  (
    'sensor_dht11', 'DHT11 Temperature & Humidity', 'sensor', 'Generic',
    '{"sensor_metrics":[{"key":"temperature","label":"Temperature","unit":"°C","value_type":"number"},{"key":"humidity","label":"Humidity","unit":"%","value_type":"number"}],"connection":["gpio"],"automation_roles":["threshold","rate_of_change"]}'::jsonb,
    '{"sampling_interval_seconds":30,"temperature_unit":"celsius","humidity_min":0,"humidity_max":100}'::jsonb, true
  ),
  (
    'sensor_dht22', 'DHT22 Temperature & Humidity', 'sensor', 'Generic',
    '{"sensor_metrics":[{"key":"temperature","label":"Temperature","unit":"°C","value_type":"number"},{"key":"humidity","label":"Humidity","unit":"%","value_type":"number"}],"connection":["gpio"],"automation_roles":["threshold","rate_of_change"]}'::jsonb,
    '{"sampling_interval_seconds":30,"temperature_unit":"celsius","humidity_min":0,"humidity_max":100}'::jsonb, true
  ),
  (
    'sensor_mq2_gas', 'MQ-2 Gas / Smoke Sensor', 'sensor', 'Generic',
    '{"sensor_metrics":[{"key":"gas","label":"Gas level","unit":"ppm","value_type":"number"},{"key":"smoke","label":"Smoke level","unit":"ppm","value_type":"number"}],"connection":["analog","digital"],"automation_roles":["threshold","safety_alert"]}'::jsonb,
    '{"sampling_interval_seconds":10,"alert_threshold":300}'::jsonb, true
  ),
  (
    'sensor_pir_motion', 'PIR Motion Sensor', 'sensor', 'Generic',
    '{"sensor_metrics":[{"key":"motion","label":"Motion","unit":"boolean","value_type":"boolean"}],"connection":["digital"],"automation_roles":["state_change","occupancy"]}'::jsonb,
    '{"cooldown_seconds":30,"active_high":true}'::jsonb, true
  ),
  (
    'sensor_ldr_light', 'LDR Light Sensor', 'sensor', 'Generic',
    '{"sensor_metrics":[{"key":"illuminance","label":"Light level","unit":"lux","value_type":"number"}],"connection":["analog"],"automation_roles":["threshold"]}'::jsonb,
    '{"sampling_interval_seconds":30,"dark_threshold":80}'::jsonb, true
  ),
  (
    'sensor_soil_moisture', 'Soil Moisture Sensor', 'sensor', 'Generic',
    '{"sensor_metrics":[{"key":"soil_moisture","label":"Soil moisture","unit":"%","value_type":"number"}],"connection":["analog"],"automation_roles":["threshold"]}'::jsonb,
    '{"sampling_interval_seconds":300,"dry_threshold":30}'::jsonb, true
  ),
  (
    'sensor_smoke', 'Smoke Detector', 'sensor', 'Generic',
    '{"sensor_metrics":[{"key":"smoke","label":"Smoke detected","unit":"boolean","value_type":"boolean"}],"connection":["digital"],"automation_roles":["state_change","safety_alert"]}'::jsonb,
    '{"active_high":true,"critical":true}'::jsonb, true
  ),
  (
    'sensor_flame', 'Flame Sensor', 'sensor', 'Generic',
    '{"sensor_metrics":[{"key":"flame","label":"Flame detected","unit":"boolean","value_type":"boolean"}],"connection":["digital","analog"],"automation_roles":["state_change","safety_alert"]}'::jsonb,
    '{"active_high":true,"critical":true}'::jsonb, true
  ),
  (
    'sensor_bmp280', 'BMP280 Pressure & Temperature', 'sensor', 'Generic',
    '{"sensor_metrics":[{"key":"temperature","label":"Temperature","unit":"°C","value_type":"number"},{"key":"pressure","label":"Pressure","unit":"hPa","value_type":"number"}],"connection":["i2c"],"automation_roles":["threshold","rate_of_change"]}'::jsonb,
    '{"sampling_interval_seconds":60,"temperature_unit":"celsius"}'::jsonb, true
  ),
  (
    'sensor_ultrasonic', 'Ultrasonic Distance Sensor', 'sensor', 'Generic',
    '{"sensor_metrics":[{"key":"distance","label":"Distance","unit":"cm","value_type":"number"}],"connection":["gpio"],"automation_roles":["threshold"]}'::jsonb,
    '{"sampling_interval_seconds":30,"max_distance_cm":400}'::jsonb, true
  ),
  (
    'actuator_relay', 'Relay / Switch Output', 'actuator', 'Generic',
    '{"controls":[{"key":"power","label":"Power","value_type":"boolean"}],"connection":["gpio"],"automation_roles":["action"]}'::jsonb,
    '{"active_high":true,"safe_start":false}'::jsonb, true
  ),
  (
    'actuator_smart_light', 'Smart Light', 'actuator', 'Generic',
    '{"controls":[{"key":"power","label":"Power","value_type":"boolean"},{"key":"brightness","label":"Brightness","unit":"%","value_type":"number"}],"connection":["gpio","wifi"],"automation_roles":["action"]}'::jsonb,
    '{"power":false,"brightness":100}'::jsonb, true
  )
on conflict (key) do update set
  name = excluded.name,
  category = excluded.category,
  manufacturer = excluded.manufacturer,
  capabilities = excluded.capabilities,
  default_config = excluded.default_config,
  is_active = excluded.is_active,
  updated_at = now();

comment on table public.device_types is
  'Shared reference catalog for sensors, actuators, capabilities and safe defaults. Tenant devices reference this table by device_type_id.';
