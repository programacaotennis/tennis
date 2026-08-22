-- Execute uma vez no SQL Editor do Supabase.
-- Cria reservas recorrentes como ocorrencias individuais e aplica o limite mensal.

update public.profiles
set role = 'admin'
where id in (select id from auth.users where lower(email) = 'programacaotennis@gmail.com');

alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- Recupera contas criadas antes do gatilho de perfil estar ativo.
insert into public.profiles (id, full_name, email, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.email),
  u.email,
  case when lower(u.email) = 'programacaotennis@gmail.com' then 'admin'::public.user_role else 'member'::public.user_role end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    case when lower(new.email) = 'programacaotennis@gmail.com' then 'admin'::public.user_role else 'member'::public.user_role end
  );
  return new;
end;
$$;

drop policy if exists "admins manage profile roles" on public.profiles;
create policy "admins manage profile roles" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.bookings
  add column if not exists recurrence_type text not null default 'once'
    check (recurrence_type in ('once', 'daily', 'weekly', 'monthly')),
  add column if not exists recurrence_count integer not null default 1
    check (recurrence_count between 1 and 31),
  add column if not exists recurrence_id uuid;

-- Um horário cancelado volta a ficar disponível para uma nova reserva.
alter table public.bookings
  drop constraint if exists bookings_court_id_booking_date_start_time_key;
create unique index if not exists bookings_unique_confirmed_slot
  on public.bookings (court_id, booking_date, start_time)
  where status = 'confirmed';

create or replace function public.create_recurring_booking(
  p_court_id bigint,
  p_booking_date date,
  p_start_time time,
  p_recurrence_type text,
  p_recurrence_count integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  occurrence_date date := p_booking_date;
  occurrence_index integer;
  occurrence_total integer;
  recurrence_key uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'É necessário estar autenticado.'; end if;
  if p_booking_date < current_date then raise exception 'Não é possível agendar uma data passada.'; end if;
  if p_recurrence_type not in ('once', 'daily', 'weekly', 'monthly') then raise exception 'Periodicidade inválida.'; end if;
  if p_recurrence_count < 1 or p_recurrence_count > 30 then raise exception 'A quantidade deve estar entre 1 e 30.'; end if;
  if p_recurrence_type in ('once', 'monthly') and p_recurrence_count <> 1 then raise exception 'Esta periodicidade permite apenas uma ocorrência.'; end if;
  if p_start_time not in ('06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00') then raise exception 'Horário inválido.'; end if;
  if not exists (select 1 from public.courts where id = p_court_id and active) then raise exception 'Quadra indisponível.'; end if;

  if not exists (select 1 from public.availability where court_id = p_court_id and day_of_week = extract(dow from p_booking_date) and start_time = p_start_time) then raise exception 'Este horário não está disponível para esta quadra.'; end if;

  occurrence_total := case
    when p_recurrence_type = 'monthly' then ((date_trunc('month', p_booking_date) + interval '1 month - 1 day')::date - p_booking_date + 1)
    else p_recurrence_count
  end;

  for occurrence_index in 0..occurrence_total - 1 loop
    occurrence_date := case p_recurrence_type
      when 'daily' then p_booking_date + occurrence_index
      when 'weekly' then p_booking_date + (occurrence_index * 7)
      when 'monthly' then p_booking_date + occurrence_index
      else p_booking_date
    end;

    if date_trunc('month', occurrence_date) <> date_trunc('month', p_booking_date) then
      raise exception 'As ocorrências devem permanecer no mês da data inicial.';
    end if;

    if not exists (select 1 from public.availability where court_id = p_court_id and day_of_week = extract(dow from occurrence_date) and start_time = p_start_time) then
      raise exception 'Este horário não está disponível em %.', occurrence_date;
    end if;

    if exists (select 1 from public.bookings where court_id = p_court_id and booking_date = occurrence_date and start_time = p_start_time and status = 'confirmed') then
      raise exception 'O horário já está reservado em %.', occurrence_date;
    end if;

  end loop;

  for occurrence_index in 0..occurrence_total - 1 loop
    occurrence_date := case p_recurrence_type
      when 'daily' then p_booking_date + occurrence_index
      when 'weekly' then p_booking_date + (occurrence_index * 7)
      when 'monthly' then p_booking_date + occurrence_index
      else p_booking_date
    end;
    insert into public.bookings (court_id, user_id, booking_date, start_time, end_time, recurrence_type, recurrence_count, recurrence_id)
    values (p_court_id, auth.uid(), occurrence_date, p_start_time, p_start_time + interval '2 hours', p_recurrence_type, p_recurrence_count, recurrence_key);
  end loop;
end;
$$;

create table if not exists public.notifications (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  court_id bigint references public.courts(id) on delete cascade,
  booking_date date,
  start_time time,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Compatibilidade com bancos que receberam a primeira versão desta migração.
alter table public.notifications
  add column if not exists court_id bigint references public.courts(id) on delete cascade,
  add column if not exists booking_date date,
  add column if not exists start_time time;

alter table public.notifications enable row level security;
drop policy if exists "users view their notifications" on public.notifications;
create policy "users view their notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "users read their notifications" on public.notifications;
create policy "users read their notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.push_subscriptions (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "users manage their push subscriptions" on public.push_subscriptions;
create policy "users manage their push subscriptions" on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify_booking_cancellation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  court_name text;
begin
  if old.status = 'confirmed' and new.status = 'cancelled' then
    select name into court_name from public.courts where id = new.court_id;
    insert into public.notifications (user_id, court_id, booking_date, start_time, message)
    select id, new.court_id, new.booking_date, new.start_time, format('Horário liberado: %s em %s, das %s às %s.', court_name, new.booking_date, left(new.start_time::text, 5), left(new.end_time::text, 5))
    from public.profiles
    where id <> new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_booking_cancelled on public.bookings;
create trigger on_booking_cancelled
  after update of status on public.bookings
  for each row execute procedure public.notify_booking_cancellation();

drop function if exists public.get_booked_slots(date);
create function public.get_booked_slots(p_booking_date date)
returns table (court_id bigint, start_time time, booked_by text)
language sql
security definer
set search_path = public
as $$
  select b.court_id, b.start_time, coalesce(p.full_name, 'Membro')
  from public.bookings b
  join public.profiles p on p.id = b.user_id
  where b.booking_date = p_booking_date and b.status = 'confirmed';
$$;

/* Legacy declaration retained below for migration compatibility. */
/*
create or replace function public.get_booked_slots(p_booking_date date)
returns table (court_id bigint, start_time time)
language sql
security definer
set search_path = public
as $$
  select b.court_id, b.start_time
  from public.bookings b
  where b.booking_date = p_booking_date and b.status = 'confirmed';
$$;
*/

grant execute on function public.get_booked_slots(date) to authenticated;
