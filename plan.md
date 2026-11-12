# ISYEN Sensor Automation Update Plan

## Requirements

- A single account identified by `isyen_id` may own only one home.
- The database must support DHT temperature/humidity, gas, PIR, and additional sensors without creating a new table for each sensor model.
- Sensors are represented as shared `device_types` plus tenant-owned `devices`; readings remain in partitioned `sensor_data`.
- Each sensor can be selected as an automation trigger, with conditions and actions stored in the existing JSONB automation fields.
- The user dashboard must show sensor/device health, readings, home status, and forms for adding a device and creating an automation.
- ESP32 firmware is explicitly out of scope for this update.

## Architecture decisions

- Keep the existing 21-table structure. No separate sensor-model table is required because `device_types.capabilities` and `default_config` already provide a versioned shared catalog.
- Enforce one home per tenant with a unique index on `homes.isyen_id`.
- Seed an idempotent catalog for DHT11, DHT22, MQ-2 gas, PIR motion, LDR, soil moisture, smoke, flame, BMP280, ultrasonic, relay, and smart light devices.
- Keep RLS tenant isolation through `isyen_id`; shared device types remain read-only reference data.
- Add a dashboard UI that is usable with mock state today and is wired to the existing API contract when authentication/API credentials are configured.

## Project structure

- `server/database/20261112_08_sensor_catalog_single_home.sql`: live/applied schema update and sensor reference seed.
- `app/app/page.tsx`: user home dashboard, sensor list, readings and automation builder.
- `app/app/globals.css`: responsive visual system for the dashboard.
- `management/app/page.tsx`: operations view for catalog coverage and automation/device health.
- `server/API.md`: endpoint usage and sensor/automation payload examples.

## Design

- **Style options:** quiet industrial control room (0.07), warm Bengali home concierge (0.05), botanical hardware lab (0.08).
- **Chosen movement:** quiet industrial control room with a warm home accent.
- **Core principles:** glanceable status, clear sensor semantics, safe control boundaries, progressive detail.
- **Color philosophy:** ink and deep moss communicate reliability; lime marks live/healthy state; amber and coral are reserved for attention and safety.
- **Layout paradigm:** a left rail for home context and a wide operational canvas with a compact status strip, not a centered marketing card.
- **Signature elements:** sensor tiles with metric chips, a “signal pulse” status rail, and an automation flow row labelled WHEN / IF / THEN.
- **Interaction:** forms expose the smallest useful configuration first; advanced JSON remains an implementation detail.
- **Typography/voice:** clean system sans with concise Bengali labels and English device keys where hardware compatibility matters.

## Scope boundary

- No account registration/login tables or ESP32 firmware are added here.
- Dashboard writes require a valid authenticated Supabase session; without one, the UI remains a safe preview and explains the missing connection.


## Board health and account Settings continuation (2026-11-12)

- Add an account Settings panel for authenticated ESP32-S3 N16R8 board totals, online/offline state, request rate, cumulative API requests, RSSI, firmware version and last heartbeat.
- Reuse the current `gateways` table and its tenant-scoped RLS; do not add migrations or write production data.
- Add a bearer-authenticated runtime heartbeat that derives `isyen_id` from the verified session, registers by the board MAC, and stores counter/timing data in existing gateway metadata.
- Keep the Settings summary/counts paginated and scoped to the signed-in account; a board is online only when its heartbeat is no older than 45 seconds.
- Update ESP32 firmware only for board heartbeat/request-sequence telemetry in this phase. Sensor support remains at the existing GPIO analog/digital contract; DHT/BMP physical drivers and per-board device assignment are not introduced here.
