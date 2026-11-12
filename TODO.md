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
- [x] Add an authenticated dashboard link to the dedicated `/sensors` workspace while preserving the landing, sign-in, registration, profile and GPIO work from the other agent.

## Delivery

- [x] Apply and verify the Supabase migration.
- [x] Run app, management, and server typecheck/lint/build/test checks after merging the remote agent commits.
- [x] Push the completed update to GitHub `main` with a focused merge commit.
- [x] Do not modify ESP32 firmware in this update.

## DHT/BMP model configuration (this continuation)

- [x] Add canonical DHT11/DHT22 and BMP180/BMP280/BMP388/BMP390 entries and model defaults to the shared sensor catalog.
- [x] Add model-specific dashboard configuration for DHT GPIO, BMP I²C pins/address, sampling interval, and temperature unit.
- [x] Validate protocol model, connection, sampling limits, pin safety, and I²C address in the server before saving.
- [x] Add tenant-scoped multi-metric telemetry ingestion and model/range validation for DHT temperature+humidity and BMP temperature+pressure.
- [x] Extend latest-reading queries and dashboard rendering to show the latest value per metric, timestamps, and stale/live status with Supabase Realtime refresh.
- [x] Clearly mark missing/partial/stale readings; never synthesize data or claim hardware is live without fresh samples.
- [ ] Update ESP32 firmware drivers to read physical DHT/BMP modules and POST the documented protocol payload (explicitly deferred per user request).
- [x] Deploy API and dashboard through their existing Vercel projects from GitHub commit `175706d`; production aliases are `isyen-api.vercel.app` and `isyen-app.vercel.app`.
- [x] Verify dashboard HTTP 200, API `/health` and `/ready` HTTP 200, and protocol ingestion route returns the expected HTTP 401 without a Bearer token (route is live and remains authenticated).
- [ ] Configure a real DHT/BMP device and add firmware polling/upload; Supabase currently has zero configured DHT/BMP device rows, so no physical readings are being collected yet.


## ESP32 board status and Settings (2026-11-12)

- [x] Add authenticated tenant-scoped gateway heartbeat and account status/count endpoints using existing `gateways` fields and metadata; no DDL.
- [x] Add same-origin app proxies and a paginated Settings panel with total/online/offline counts, last heartbeat, firmware, RSSI, request rate and total requests.
- [x] Add tests for tenant-derived board registration, monotonic request-sequence totals, invalid board identifiers and unauthenticated access.
- [x] Prepare ESP32-S3 N16R8 firmware v4.1 to heartbeat every 15 seconds and report an API request sequence.
- [x] Run frozen install, lint, typecheck, tests and builds; all passed.
- [ ] Deploy/push only after explicit user request; production data and schema remain unchanged.
