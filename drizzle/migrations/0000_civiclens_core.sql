-- ROLES
create type public.app_role as enum ('citizen','officer','admin');
create type public.issue_category as enum ('pothole','drainage','streetlight','garbage','water_supply','road_damage','other');
create type public.report_status as enum ('submitted','verified','assigned','in_progress','resolved','rejected','escalated');
create type public.area_type as enum ('urban','rural');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text,
  ward text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'citizen',
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- auto profile + role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name, ward)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'ward', 'Ward 07')
  ) on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'citizen') on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- OFFICERS (in-charge directory)
create table public.officers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  designation text not null,
  department text not null,
  ward text not null,
  area public.area_type not null default 'urban',
  category public.issue_category not null,
  contact text,
  escalation_authority text not null default 'Municipal Corporation Commissioner',
  created_at timestamptz not null default now()
);
grant select on public.officers to authenticated, anon;
grant all on public.officers to service_role;
alter table public.officers enable row level security;
create policy "officers public read" on public.officers for select to authenticated, anon using (true);

-- REPORTS
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category public.issue_category not null,
  description text not null default '',
  photo_url text not null,
  resolved_photo_url text,
  latitude double precision not null,
  longitude double precision not null,
  address text not null default '',
  area public.area_type not null default 'urban',
  status public.report_status not null default 'submitted',
  ai_verified boolean not null default false,
  ai_confidence integer not null default 0,
  ai_authenticity integer not null default 0,
  ai_duplicate_risk integer not null default 0,
  ai_notes text not null default '',
  severity text not null default 'medium',
  officer_id uuid references public.officers(id) on delete set null,
  escalated boolean not null default false,
  escalated_at timestamptz,
  escalation_note text,
  sla_hours integer not null default 48,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "reports readable by authenticated" on public.reports for select to authenticated using (true);
create policy "insert own report" on public.reports for insert to authenticated with check (auth.uid() = user_id);
create policy "update own report or officer" on public.reports for update to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'officer') or public.has_role(auth.uid(),'admin'));
create policy "delete own report" on public.reports for delete to authenticated using (auth.uid() = user_id);
create index reports_geo_idx on public.reports (latitude, longitude);

-- TIMELINE
create table public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  label text not null,
  detail text not null default '',
  kind text not null default 'info',
  created_at timestamptz not null default now()
);
grant select, insert on public.report_events to authenticated;
grant all on public.report_events to service_role;
alter table public.report_events enable row level security;
create policy "events readable by authenticated" on public.report_events for select to authenticated using (true);
create policy "insert events" on public.report_events for insert to authenticated with check (true);

insert into public.officers (name, designation, department, ward, area, category, contact) values
 ('N. Rao','Assistant Engineer','Roads & Highways','Ward 07','urban','pothole','roads.ward07@corp.gov.in'),
 ('S. Krishnan','Junior Engineer','Storm Water Drains','Ward 07','urban','drainage','drains.ward07@corp.gov.in'),
 ('A. Verma','Section Officer','Street Lighting','Ward 07','urban','streetlight','lights.ward07@corp.gov.in'),
 ('M. Iqbal','Sanitary Inspector','Solid Waste Management','Ward 07','urban','garbage','swm.ward07@corp.gov.in'),
 ('P. Devi','Assistant Engineer','Water Supply','Ward 07','urban','water_supply','water.ward07@corp.gov.in'),
 ('R. Sundaram','Block Development Officer','Panchayat Works','Rural Block 3','rural','road_damage','bdo.block3@panchayat.gov.in'),
 ('K. Latha','Village Administrative Officer','Panchayat Works','Rural Block 3','rural','other','vao.block3@panchayat.gov.in');