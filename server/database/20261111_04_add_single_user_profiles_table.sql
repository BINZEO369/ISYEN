-- All user profile information intentionally lives in one table.
create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  isyen_id text not null unique check (length(trim(isyen_id)) > 0),

  first_name text,
  last_name text,
  full_name text,
  profile_photo text,
  date_of_birth date,
  gender text,
  phone_number text,
  email text not null check (length(trim(email)) > 3),
  bio text,

  country text,
  state text,
  city text,
  postal_code text,
  address_line_1 text,
  address_line_2 text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),

  language text not null default 'en',
  currency text not null default 'USD',
  timezone text not null default 'UTC',
  date_format text not null default 'YYYY-MM-DD',
  time_format text not null default '24h' check (time_format in ('12h', '24h')),
  temperature_unit text not null default 'celsius' check (temperature_unit in ('celsius', 'fahrenheit')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),

  default_home_id uuid,
  default_room_id uuid,
  preferred_device_view text not null default 'grid' check (preferred_device_view in ('grid', 'list', 'compact')),

  push_notifications boolean not null default true,
  email_notifications boolean not null default true,
  sms_notifications boolean not null default false,
  security_alerts boolean not null default true,
  device_alerts boolean not null default true,
  automation_alerts boolean not null default true,

  profile_status text not null default 'active' check (profile_status in ('active', 'incomplete', 'suspended', 'deleted')),
  profile_completion smallint not null default 0 check (profile_completion between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (isyen_id, default_home_id) references public.homes (isyen_id, id) on delete set null,
  foreign key (isyen_id, default_room_id) references public.rooms (isyen_id, id) on delete set null
);

create unique index user_profiles_email_ci_uidx on public.user_profiles (lower(email));
create index user_profiles_isyen_id_idx on public.user_profiles (isyen_id);
create index user_profiles_default_home_idx on public.user_profiles (isyen_id, default_home_id);
create index user_profiles_default_room_idx on public.user_profiles (isyen_id, default_room_id);
create index user_profiles_status_idx on public.user_profiles (profile_status);

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

-- A signed-in user can read and update only their own profile.
-- Profile creation, deletion and privileged status changes remain backend/service-role operations.
create policy user_profiles_self_read on public.user_profiles
for select to authenticated
using ((select auth.uid()) = auth_user_id and profile_status <> 'deleted');

create policy user_profiles_self_update on public.user_profiles
for update to authenticated
using ((select auth.uid()) = auth_user_id and profile_status <> 'deleted')
with check ((select auth.uid()) = auth_user_id and profile_status <> 'deleted');

revoke all on public.user_profiles from anon, authenticated;
grant select, update on public.user_profiles to authenticated;
grant all on public.user_profiles to service_role;

comment on table public.user_profiles is 'Single-table user profile containing personal, address, preference, home, notification and metadata fields.';
comment on column public.user_profiles.isyen_id is 'Unique ISYEN tenant/user identifier; account integration can map this to auth_user_id later.';
