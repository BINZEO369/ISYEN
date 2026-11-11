-- Child partitions do not inherit RLS policies automatically.
alter table public.device_logs_default enable row level security;
create policy device_logs_default_tenant_access on public.device_logs_default for all to authenticated using ((select public.current_isyen_id()) = isyen_id) with check ((select public.current_isyen_id()) = isyen_id);

alter table public.automation_logs_default enable row level security;
create policy automation_logs_default_tenant_access on public.automation_logs_default for all to authenticated using ((select public.current_isyen_id()) = isyen_id) with check ((select public.current_isyen_id()) = isyen_id);

alter table public.sensor_data_default enable row level security;
create policy sensor_data_default_tenant_access on public.sensor_data_default for all to authenticated using ((select public.current_isyen_id()) = isyen_id) with check ((select public.current_isyen_id()) = isyen_id);

alter table public.security_events_default enable row level security;
create policy security_events_default_tenant_access on public.security_events_default for all to authenticated using ((select public.current_isyen_id()) = isyen_id) with check ((select public.current_isyen_id()) = isyen_id);
