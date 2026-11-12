
## Sensor and home policy

Each `isyen_id` may own exactly one row in `homes`. The database unique index `homes_one_per_isyen_id_idx` enforces this rule independently of the UI. Sensors are shared `device_types` reference rows; each installation is a tenant-owned `devices` row, and readings are written to partitioned `sensor_data`.

The catalog currently covers DHT11/DHT22 temperature-humidity, MQ-2 gas/smoke, PIR motion, LDR light, soil moisture, smoke, flame, BMP280 pressure-temperature, ultrasonic distance, relay and smart-light types. New hardware can be added as another shared catalog entry without adding a tenant table.

The `/sensors` dashboard exposes a safe WHEN → IF → THEN builder. Its payload uses the existing `automations.trigger_config`, `condition_config` and `action_config` JSONB fields:

```json
{
  "home_id": "<home-uuid>",
  "name": "Cool the room",
  "is_enabled": true,
  "trigger_config": {
    "type": "sensor",
    "device_id": "<sensor-uuid>",
    "metric": "temperature",
    "operator": "greater_than",
    "value": 30
  },
  "condition_config": {},
  "action_config": {
    "device_id": "<actuator-uuid>",
    "command": { "power": true }
  }
}
```

The sensor workspace uses the authenticated Supabase session when available and posts through the existing authenticated API. It remains a safe preview when the user has no session or the API base URL is not configured. ESP32 S3 N16R8 firmware is intentionally outside this update.
