-- Management access-control registry for admin assignment.
create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  isyen_id text not null check (length(trim(isyen_id)) > 0),
  email text not null check (length(trim(email)) > 3),
  role text not null default 'viewer' check (role in ('super_admin', 'admin', 'operator', 'viewer')),
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  permissions jsonb not null default '{}'::jsonb,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index admin_users_email_ci_uidx on public.admin_users (lower(email));
create index admin_users_isyen_id_idx on public.admin_users (isyen_id);
create index admin_users_role_status_idx on public.admin_users (role, status);
create index admin_users_auth_user_id_idx on public.admin_users (auth_user_id);

create trigger admin_users_set_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;

-- A logged-in admin can read only their own management record.
-- Creation, role changes, suspension and deletion are backend/service-role operations.
create policy admin_users_self_read on public.admin_users
for select to authenticated
using ((select auth.uid()) = auth_user_id and status = 'active');

revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;
grant all on public.admin_users to service_role;

comment on table public.admin_users is 'Management access-control registry. Role assignment is controlled by trusted backend/service-role operations.';
comment on column public.admin_users.isyen_id is 'Tenant identifier associated with the administrator.';
comment on column public.admin_users.role is 'Authorization tier: super_admin, admin, operator or viewer.';
