-- Home Preferences are intentionally excluded from the single user_profiles table.
alter table public.user_profiles drop constraint if exists user_profiles_isyen_id_default_home_id_fkey;
alter table public.user_profiles drop constraint if exists user_profiles_isyen_id_default_room_id_fkey;
drop index if exists public.user_profiles_default_home_idx;
drop index if exists public.user_profiles_default_room_idx;
alter table public.user_profiles drop column if exists default_home_id;
alter table public.user_profiles drop column if exists default_room_id;
alter table public.user_profiles drop column if exists preferred_device_view;
comment on table public.user_profiles is 'Single-table user profile containing personal, address, preference, notification and metadata fields. Home preference fields are intentionally excluded.';
