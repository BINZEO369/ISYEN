-- Canonical model catalog for protocol-specific DHT and BMP sensors.
-- Firmware drivers are intentionally unchanged; these rows describe saved configuration only.
UPDATE public.device_types
SET is_active = false, updated_at = now()
WHERE key IN ('sensor_dht11', 'sensor_dht22')
  AND NOT EXISTS (SELECT 1 FROM public.devices d WHERE d.device_type_id = public.device_types.id);

INSERT INTO public.device_types (key, name, category, manufacturer, capabilities, default_config, is_active)
VALUES
  ('dht11_temperature_humidity', 'DHT11 Temperature & Humidity', 'sensor', 'Generic',
   '{"sensor":true,"connection":["gpio"],"sensor_metrics":[{"key":"temperature","label":"Temperature","unit":"°C","value_type":"number","min":0,"max":50},{"key":"humidity","label":"Humidity","unit":"%","value_type":"number","min":20,"max":90}],"automation_roles":["threshold","rate_of_change"]}'::jsonb,
   '{"hardware":"isyen_protocol_sensor","sensor_key":"dht11_temperature_humidity","connection":"gpio","sampling_interval_seconds":2,"temperature_unit":"celsius","enabled":true}'::jsonb, true),
  ('dht22_temperature_humidity', 'DHT22 Temperature & Humidity', 'sensor', 'Generic',
   '{"sensor":true,"connection":["gpio"],"sensor_metrics":[{"key":"temperature","label":"Temperature","unit":"°C","value_type":"number","min":-40,"max":80},{"key":"humidity","label":"Humidity","unit":"%","value_type":"number","min":0,"max":100}],"automation_roles":["threshold","rate_of_change"]}'::jsonb,
   '{"hardware":"isyen_protocol_sensor","sensor_key":"dht22_temperature_humidity","connection":"gpio","sampling_interval_seconds":2,"temperature_unit":"celsius","enabled":true}'::jsonb, true),
  ('sensor_bmp180', 'BMP180 Temperature & Pressure', 'sensor', 'Bosch',
   '{"sensor":true,"connection":["i2c"],"sensor_metrics":[{"key":"temperature","label":"Temperature","unit":"°C","value_type":"number"},{"key":"pressure","label":"Pressure","unit":"hPa","value_type":"number"}],"automation_roles":["threshold","rate_of_change"]}'::jsonb,
   '{"hardware":"isyen_protocol_sensor","sensor_key":"sensor_bmp180","connection":"i2c","sampling_interval_seconds":10,"temperature_unit":"celsius","i2c_address":"0x77","enabled":true}'::jsonb, true),
  ('sensor_bmp280', 'BMP280 Temperature & Pressure', 'sensor', 'Bosch',
   '{"sensor":true,"connection":["i2c"],"sensor_metrics":[{"key":"temperature","label":"Temperature","unit":"°C","value_type":"number"},{"key":"pressure","label":"Pressure","unit":"hPa","value_type":"number"}],"automation_roles":["threshold","rate_of_change"]}'::jsonb,
   '{"hardware":"isyen_protocol_sensor","sensor_key":"sensor_bmp280","connection":"i2c","sampling_interval_seconds":10,"temperature_unit":"celsius","i2c_address":"0x76","enabled":true}'::jsonb, true),
  ('sensor_bmp388', 'BMP388 Temperature & Pressure', 'sensor', 'Bosch',
   '{"sensor":true,"connection":["i2c","spi"],"sensor_metrics":[{"key":"temperature","label":"Temperature","unit":"°C","value_type":"number"},{"key":"pressure","label":"Pressure","unit":"hPa","value_type":"number"}],"automation_roles":["threshold","rate_of_change"]}'::jsonb,
   '{"hardware":"isyen_protocol_sensor","sensor_key":"sensor_bmp388","connection":"i2c","sampling_interval_seconds":10,"temperature_unit":"celsius","i2c_address":"0x76","enabled":true}'::jsonb, true),
  ('sensor_bmp390', 'BMP390 Temperature & Pressure', 'sensor', 'Bosch',
   '{"sensor":true,"connection":["i2c","spi"],"sensor_metrics":[{"key":"temperature","label":"Temperature","unit":"°C","value_type":"number"},{"key":"pressure","label":"Pressure","unit":"hPa","value_type":"number"}],"automation_roles":["threshold","rate_of_change"]}'::jsonb,
   '{"hardware":"isyen_protocol_sensor","sensor_key":"sensor_bmp390","connection":"i2c","sampling_interval_seconds":10,"temperature_unit":"celsius","i2c_address":"0x76","enabled":true}'::jsonb, true)
ON CONFLICT (key) DO UPDATE SET
  name = excluded.name,
  category = excluded.category,
  manufacturer = excluded.manufacturer,
  capabilities = excluded.capabilities,
  default_config = excluded.default_config,
  is_active = excluded.is_active,
  updated_at = now();
