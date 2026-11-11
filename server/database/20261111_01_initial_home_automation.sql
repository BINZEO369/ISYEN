-- ISYEN Home Automation initial schema
-- Account/auth tables are intentionally excluded. Tenant identity is carried by isyen_id.
-- Future auth should place isyen_id in auth.jwt() app_metadata.

create extension if not exists pgcrypto;

create or replace function public.current_isyen_id()
returns text
language sql
stable
as $$
  select coalesce(
    (select auth.jwt() -> 'app_metadata' ->> 'isyen_id'),
    (select auth.jwt() ->> 'isyen_id')
  );
$$;

create table public.homes (
  id uuid primary key default gen_random_uuid(),
  isyen_id text not null check (length(trim(isyen_id)) > 0),
  name text not null check (length(trim(name)) > 0),
  description text,
  address jsonb not null default '{}'::jsonb,
  timezone text not null default 'UTC',
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (isyen_id, id)
);

create table public.home_settings (
  id uuid primary key default gen_random_uuid(),
  isyen_id text not null,
  home_id uuid not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (isyen_id, home_id),
  foreign key (isyen_id, home_id) references public.homes (isyen_id, id) on delete cascade
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  isyen_id text not null,
  home_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  room_type text,
  floor integer,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (isyen_id, id),
  unique (isyen_id, home_id, name),
  foreign key (isyen_id, home_id) references public.homes (isyen_id, id) on delete cascade
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  isyen_id text not null,
  home_id uuid not null,
  room_id uuid,
  name text not null check (length(trim(name)) > 0),
  zone_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (isyen_id, id),
  unique (isyen_id, home_id, name),
  foreign key (isyen_id, home_id) references public.homes (isyen_id, id) on delete cascade,
  foreign key (isyen_id, room_id) references public.rooms (isyen_id, id) on delete set null
);

create table public.device_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  category text not null,
  manufacturer text,
  capabilities jsonb not null default '{}'::jsonb,
  default_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gateways (
  id uuid primary key default gen_random_uuid(),
  isyen_id text not null,
  home_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  gateway_type text not null,
  serial_number text,
  status text not null default 'offline' check (status in ('online', 'offline', 'degraded', 'provisioning')),
  connection_config jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (isyen_id, id),
  unique (isyen_id, serial_number),
  foreign key (isyen_id, home_id) references public.homes (isyen_id, id) on delete cascade
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  isyen_id text not null,
  home_id uuid not null,
  room_id uuid,
  zone_id uuid,
  gateway_id uuid,
  device_type_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  external_id text,
  status text not null default 'offline' check (status in ('online', 'offline', 'unavailable', 'provisioning')),
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (isyen_id, id),
  unique (isyen_id, gateway_id, external_id),
  foreign key (isyen_id, home_id) references public.homes (isyen_id, id) on delete cascade,
  foreign key (isyen_id, room_id) references public.rooms (isyen_id, id) on delete set null,
  foreign key (isyen_id, zone_id) references public.zones (isyen_id, id) on delete set null,
  foreign key (isyen_id, gateway_id) references public.gateways (isyen_id, id) on delete set null,
  foreign key (device_type_id) references public.device_types (id) on delete restrict
);

create table public.device_states (
  id uuid primary key default gen_random_uuid(),
  isyen_id text not null,
  device_id uuid not null,
  state jsonb not null default '{}'::jsonb,
  reported_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  source text not null default 'device',
  unique (isyen_id, device_id),
  foreign key (isyen_id, device_id) references public.devices (isyen_id, id) on delete cascade
);

create table public.device_logs (
  id uuid not null default gen_random_uuid(),
  isyen_id text not null,
  device_id uuid not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (id, occurred_at),
  foreign key (isyen_id, device_id) references public.devices (isyen_id, id) on delete cascade
) partition by range (occurred_at);

create table public.device_logs_default partition of public.device_logs default;

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  isyen_id text not null,
  home_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  description text,
  is_enabled boolean not null default true,
  trigger_config jsonb not null default '{}'::jsonb,
  condition_config jsonb not null default '{}'::jsonb,
  action_config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (isyen_id, id),
  foreign key (isyen_id, home_id) references public.homes (isyen_id, id) on delete cascade
);

create table public.automation_logs (
  id uuid not null default gen_random_uuid(),
  isyen_id text not null,
  automation_id uuid not null,
  status text not null check (status in ('started', 'completed', 'failed', 'skipped')),
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  primary key (id, occurred_at),
  foreign key (isyen_id, automation_id) references public.automations (isyen_id, id) on delete cascade
) partition by range (occurred_at);

create table public.automation_logs_default partition of public.automation_logs default;

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  isyen_id text not null,
  home_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  description text,
  icon text,
  is_enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (isyen_id, id),
  unique (isyen_id, home_id, name),
  foreign key (isyen_id, home_id) references public.homes (isyen_id, id) on delete cascade
);

create table public.scene_devices (
  id uuid primary key default gen_random_uuid(),
  isyen_id text not null,
  scene_id uuid not null,
  device_id uuid not null,
  command jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (isyen_id, scene_id, device_id),
  foreign key (isyen_id, scene_id) references public.scenes (isyen_id, id) on delete cascade,
  foreign key (isyen_id, device_id) references public.devices (isyen_id, id) on delete cascade
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  isyen_id text not null,
  home_id uuid not null,
  automation_id uuid,
  scene_id uuid,
  name text not null check (length(trim(name)) > 0),
  cron_expression text,
  timezone text not null default 'UTC',
  starts_at timestamptz,
  ends_at timestamptz,
  is_enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (isyen_id, id),
  check (automation_id is not null or scene_id is not null),
  foreign key (isyen_id, home_id) references public.homes (isyen_id, id) on delete cascade,
  foreign key (isyen_id, automation_id) references public.automations (isyen_id, id) on delete cascade,
  foreign key (isyen_id, scene_id) references public.scenes (isyen_id, id) on delete cascade
);

create table public.sensor_data (
  id uuid not null default gen_random_uuid(),
  isyen_id text not null,
  home_id uuid not null,
  device_id uuid,
  metric text not null,
  value_numeric double precision,
  value_text text,
  unit text,
  data jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  primary key (id, recorded_at),
  check (value_numeric is not null or value_text is not null),
  foreign key (isyen_id, home_id) references public.homes (isyen_id, id) on delete cascade,
  foreign key (isyen_id, device_id) references public.devices (isyen_id, id) on delete set null
) partition by range (recorded_at);

create table public.sensor_data_default partition of public.sensor_data default;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  isyen_id text not null,
  home_id uuid,
  device_id uuid,
  notification_type text not null,
  title text not null,
  body text,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'error', 'critical')),
  channel text not null default 'in_app',
  is_read boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (isyen_id, id),
  foreign key (isyen_id, home_id) references public.homes (isyen_id, id) on delete cascade,
  foreign key (isyen_id, device_id) references public.devices (isyen_id, id) on delete cascade
);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  isyen_id text not null,
  home_id uuid,
  provider text not null,
  external_account_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'error', 'revoked')),
  config jsonb not null default '{}'::jsonb,
  credentials_ref text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (isyen_id, id),
  unique (isyen_id, provider, external_account_id),
  foreign key (isyen_id, home_id) references public.homes (isyen_id, id) on delete cascade
);

create table public.firmware_updates (
  id uuid primary key default gen_random_uuid(),
  isyen_id text not null,
  device_id uuid not null,
  version text not null,
  firmware_url text,
  checksum text,
  status text not null default 'pending' check (status in ('pending', 'downloading', 'installing', 'completed', 'failed', 'cancelled')),
  progress smallint not null default 0 check (progress between 0 and 100),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (isyen_id, id),
  foreign key (isyen_id, device_id) references public.devices (isyen_id, id) on delete cascade
);

create table public.security_events (
  id uuid not null default gen_random_uuid(),
  isyen_id text not null,
  home_id uuid,
  device_id uuid,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'high', 'critical')),
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  primary key (id, occurred_at),
  foreign key (isyen_id, home_id) references public.homes (isyen_id, id) on delete cascade,
  foreign key (isyen_id, device_id) references public.devices (isyen_id, id) on delete cascade
) partition by range (occurred_at);

create table public.security_events_default partition of public.security_events default;

-- Tenant and lookup indexes.
create index homes_isyen_id_idx on public.homes (isyen_id);
create index home_settings_isyen_id_idx on public.home_settings (isyen_id);
create index rooms_home_idx on public.rooms (isyen_id, home_id);
create index zones_home_idx on public.zones (isyen_id, home_id);
create index gateways_home_idx on public.gateways (isyen_id, home_id);
create index devices_home_idx on public.devices (isyen_id, home_id);
create index devices_room_idx on public.devices (isyen_id, room_id);
create index devices_zone_idx on public.devices (isyen_id, zone_id);
create index devices_type_idx on public.devices (device_type_id);
create index device_states_device_idx on public.device_states (isyen_id, device_id);
create index device_logs_device_time_idx on public.device_logs (isyen_id, device_id, occurred_at desc);
create index automations_home_idx on public.automations (isyen_id, home_id);
create index automation_logs_automation_time_idx on public.automation_logs (isyen_id, automation_id, occurred_at desc);
create index scenes_home_idx on public.scenes (isyen_id, home_id);
create index scene_devices_scene_idx on public.scene_devices (isyen_id, scene_id);
create index schedules_home_idx on public.schedules (isyen_id, home_id);
create index sensor_data_device_time_idx on public.sensor_data (isyen_id, device_id, recorded_at desc);
create index sensor_data_home_metric_time_idx on public.sensor_data (isyen_id, home_id, metric, recorded_at desc);
create index notifications_user_unread_idx on public.notifications (isyen_id, is_read, created_at desc);
create index integrations_user_idx on public.integrations (isyen_id);
create index firmware_updates_device_idx on public.firmware_updates (isyen_id, device_id, created_at desc);
create index security_events_home_time_idx on public.security_events (isyen_id, home_id, occurred_at desc);

-- Generic updated_at trigger for mutable management tables.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['homes','home_settings','rooms','zones','device_types','gateways','devices','automations','scenes','schedules','integrations'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
  end loop;
end $$;

-- RLS: all tenant data is isolated by isyen_id from trusted JWT app_metadata.
do $$
declare
  t text;
begin
  foreach t in array array['homes','home_settings','rooms','zones','gateways','devices','device_states','device_logs','automations','automation_logs','scenes','scene_devices','schedules','sensor_data','notifications','integrations','firmware_updates','security_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.current_isyen_id()) = isyen_id) with check ((select public.current_isyen_id()) = isyen_id)', t || '_tenant_access', t);
  end loop;
end $$;

alter table public.device_types enable row level security;
create policy device_types_read_authenticated on public.device_types for select to authenticated using (is_active = true);

-- API permissions: anonymous clients cannot access tenant data. Service role remains available for backend jobs.
grant select on public.device_types to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.device_types from authenticated;

comment on function public.current_isyen_id() is 'Reads the trusted tenant identifier from auth JWT app_metadata; account/auth provisioning will populate this later.';
comment on table public.device_types is 'Shared reference data; not tenant-owned and does not contain isyen_id.';
