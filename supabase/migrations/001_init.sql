-- AyosPH schema, triggers, RLS and storage. Run once in the Supabase SQL Editor.
create extension if not exists pgcrypto;

create type public.user_role as enum ('resident','staff','admin');
create type public.report_status as enum ('pending','verified','in_progress','resolved','rejected');
create type public.report_category as enum ('pothole','garbage','streetlight','drainage','public_facility','other');

create table public.barangays (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  city text not null check (char_length(city) between 2 and 100),
  province text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, city)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role public.user_role not null default 'resident',
  barangay_id uuid references public.barangays(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_needs_barangay check (role <> 'staff' or barangay_id is not null)
);
create index on public.profiles (role);
create index on public.profiles (barangay_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  barangay_id uuid not null references public.barangays(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  category public.report_category not null,
  status public.report_status not null default 'pending',
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  address_text text,
  photo_path text,
  before_photo_path text,
  after_photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.reports (reporter_id, created_at desc);
create index on public.reports (barangay_id, status, created_at desc);
create index on public.reports (status);

create table public.report_updates (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  old_status public.report_status,
  new_status public.report_status,
  note text,
  created_at timestamptz not null default now()
);
create index on public.report_updates (report_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid references public.reports(id) on delete cascade,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, is_read, created_at desc);

-- ---------- helpers ----------
create or replace function public.auth_role() returns public.user_role
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.auth_barangay() returns uuid
language sql stable security definer set search_path = public as
$$ select barangay_id from public.profiles where id = auth.uid() $$;

-- New auth user -> profile. Role is ALWAYS resident; only a Super Admin can promote.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  begin b := nullif(new.raw_user_meta_data->>'barangay_id','')::uuid;
  exception when others then b := null; end;
  if b is not null and not exists (select 1 from public.barangays where id = b and is_active) then b := null; end if;
  insert into public.profiles (id, full_name, phone, role, barangay_id)
  values (new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''), split_part(new.email,'@',1)),
    nullif(trim(new.raw_user_meta_data->>'phone'),''), 'resident', b);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Block self-promotion through direct client access (service role has auth.uid() = null).
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and public.auth_role() is distinct from 'admin' then
    if new.role is distinct from old.role or new.barangay_id is distinct from old.barangay_id then
      raise exception 'Not allowed to change role or barangay';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile();

create or replace function public.touch_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;
create trigger reports_touch before update on public.reports
  for each row execute function public.touch_updated_at();

-- Notifications on status change (to reporter) and new report (to barangay staff)
create or replace function public.notify_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (user_id, report_id, title, body)
    values (new.reporter_id, new.id,
      'Report ' || initcap(replace(new.status::text,'_',' ')),
      'Your report "' || new.title || '" is now ' || initcap(replace(new.status::text,'_',' ')) || '.');
  end if;
  return new;
end $$;
create trigger reports_notify_status after update of status on public.reports
  for each row execute function public.notify_status_change();

create or replace function public.notify_new_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, report_id, title, body)
  select p.id, new.id, 'New report', 'New ' || replace(new.category::text,'_',' ') || ' report: "' || new.title || '"'
  from public.profiles p where p.role = 'staff' and p.barangay_id = new.barangay_id;
  return new;
end $$;
create trigger reports_notify_new after insert on public.reports
  for each row execute function public.notify_new_report();

-- ---------- stats functions (security invoker => RLS applies) ----------
create or replace function public.report_counts(p_barangay uuid default null, p_reporter uuid default null)
returns table (status public.report_status, total bigint)
language sql stable security invoker as $$
  select r.status, count(*) from public.reports r
  where (p_barangay is null or r.barangay_id = p_barangay)
    and (p_reporter is null or r.reporter_id = p_reporter)
  group by r.status $$;

create or replace function public.barangay_activity()
returns table (id uuid, name text, city text, province text, is_active boolean,
               total bigint, pending bigint, in_progress bigint, resolved bigint)
language sql stable security invoker as $$
  select b.id, b.name, b.city, b.province, b.is_active,
    count(r.id),
    count(*) filter (where r.status = 'pending'),
    count(*) filter (where r.status = 'in_progress'),
    count(*) filter (where r.status = 'resolved')
  from public.barangays b left join public.reports r on r.barangay_id = b.id
  group by b.id order by count(r.id) desc, b.name $$;

-- ---------- Row Level Security ----------
alter table public.barangays enable row level security;
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.report_updates enable row level security;
alter table public.notifications enable row level security;

create policy barangays_read on public.barangays for select to anon, authenticated using (true);
create policy barangays_admin_write on public.barangays for all to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');

create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or public.auth_role() = 'admin'
  or (public.auth_role() = 'staff' and id in (select reporter_id from public.reports where barangay_id = public.auth_barangay())));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');

create policy reports_select on public.reports for select to authenticated using (
  reporter_id = auth.uid() or public.auth_role() = 'admin'
  or (public.auth_role() = 'staff' and barangay_id = public.auth_barangay()));
create policy reports_insert on public.reports for insert to authenticated with check (
  reporter_id = auth.uid() and public.auth_role() = 'resident'
  and barangay_id = public.auth_barangay() and status = 'pending');
create policy reports_update on public.reports for update to authenticated
  using (public.auth_role() = 'admin' or (public.auth_role() = 'staff' and barangay_id = public.auth_barangay()))
  with check (public.auth_role() = 'admin' or (public.auth_role() = 'staff' and barangay_id = public.auth_barangay()));

create policy updates_select on public.report_updates for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_id));
create policy updates_insert on public.report_updates for insert to authenticated with check (
  author_id = auth.uid() and public.auth_role() in ('staff','admin')
  and exists (select 1 from public.reports r where r.id = report_id));

create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;

-- Realtime for in-app notifications
alter publication supabase_realtime add table public.notifications;

-- ---------- Storage: private bucket; all access goes through the API (signed URLs) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
