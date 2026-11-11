-- user_profiles.isyen_id is the tenant root for all user-owned and management data.
alter table public.homes add constraint homes_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.home_settings add constraint home_settings_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.rooms add constraint rooms_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.zones add constraint zones_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.gateways add constraint gateways_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.devices add constraint devices_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.device_states add constraint device_states_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.device_logs add constraint device_logs_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.automations add constraint automations_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.automation_logs add constraint automation_logs_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.scenes add constraint scenes_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.scene_devices add constraint scene_devices_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.schedules add constraint schedules_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.sensor_data add constraint sensor_data_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.notifications add constraint notifications_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.integrations add constraint integrations_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.firmware_updates add constraint firmware_updates_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.security_events add constraint security_events_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;
alter table public.admin_users add constraint admin_users_isyen_id_user_profiles_fkey foreign key (isyen_id) references public.user_profiles (isyen_id) on delete cascade;

create policy user_profiles_isyen_id_read on public.user_profiles
for select to authenticated
using ((select public.current_isyen_id()) = isyen_id and profile_status <> 'deleted');

create policy user_profiles_isyen_id_update on public.user_profiles
for update to authenticated
using ((select public.current_isyen_id()) = isyen_id and profile_status <> 'deleted')
with check ((select public.current_isyen_id()) = isyen_id and profile_status <> 'deleted');

comment on table public.user_profiles is 'Tenant root for profile and all user-owned management data. Tenant tables reference user_profiles.isyen_id and use JWT isyen_id RLS isolation.';
