# ISYEN Sensor and Automation Update

## Database ownership and catalog

- [x] Enforce the rule that one `isyen_id` can create only one home; duplicate home inserts fail at the database layer through `homes_one_per_isyen_id_idx`.
- [x] Keep sensor models shared in `device_types`, with no tenant-specific duplicate catalog rows.
- [x] Seed DHT11/DHT22 temperature-humidity, MQ-2 gas/smoke, PIR motion, LDR, soil moisture, smoke, flame, BMP280, ultrasonic, relay, and smart-light reference types with capabilities and defaults.
- [x] Preserve tenant isolation with `isyen_id` foreign keys and RLS for devices, readings, automations, and logs.

## Dashboard behavior

- [x] Show a home overview with one-home state, online/offline device count, sensor count, automation count, and latest signal.
- [x] Allow adding a sensor/device by selecting a shared type, naming it, assigning a room, and saving tenant-owned configuration when an authenticated API token is available.
- [x] Show sensor metrics for temperature, humidity, gas/air quality, motion, light, soil moisture, smoke, flame, pressure, and distance when available.
- [x] Provide an automation builder with explicit WHEN sensor trigger, IF condition, THEN action fields, enabled state, and save/update affordance.
- [x] Explain that authenticated Supabase/API credentials are required for live writes while keeping the preview safe without credentials.

## Delivery

- [x] Apply and verify the Supabase migration.
- [x] Run app, management, and server typecheck/lint/build/test checks.
- [ ] Push the completed update to GitHub `main` with a focused commit.
- [x] Do not modify ESP32 firmware in this update.
