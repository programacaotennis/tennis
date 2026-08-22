-- Execute uma vez no SQL Editor do Supabase.
-- Cria reservas recorrentes como ocorrencias individuais e aplica o limite mensal.

update public.profiles
set role = 'admin'
where id in (select id from auth.users where lower(email) = 'programacaotennis@gmail.com');

alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

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
  previous_date date;
  next_month_start date;
  recurrence_key uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'É necessário estar autenticado.'; end if;
  if p_booking_date < current_date then raise exception 'Não é possível agendar uma data passada.'; end if;
  if p_recurrence_type not in ('once', 'daily', 'weekly', 'monthly') then raise exception 'Periodicidade inválida.'; end if;
  if p_recurrence_count < 1 or p_recurrence_count > 31 then raise exception 'A quantidade deve estar entre 1 e 31.'; end if;
  if p_start_time not in ('06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00') then raise exception 'Horário inválido.'; end if;
  if not exists (select 1 from public.courts where id = p_court_id and active) then raise exception 'Quadra indisponível.'; end if;

  if not exists (select 1 from public.availability where court_id = p_court_id and day_of_week = extract(dow from p_booking_date) and start_time = p_start_time) then raise exception 'Este horário não está disponível para esta quadra.'; end if;

  for occurrence_index in 0..p_recurrence_count - 1 loop
    occurrence_date := case p_recurrence_type
      when 'daily' then p_booking_date + occurrence_index
      when 'weekly' then p_booking_date + (occurrence_index * 7)
      when 'monthly' then (p_booking_date + (occurrence_index || ' month')::interval)::date
      else p_booking_date
    end;

    if not exists (select 1 from public.availability where court_id = p_court_id and day_of_week = extract(dow from occurrence_date) and start_time = p_start_time) then
      raise exception 'Este horário não está disponível em %.', occurrence_date;
    end if;

    if exists (select 1 from public.bookings where court_id = p_court_id and booking_date = occurrence_date and start_time = p_start_time and status = 'confirmed') then
      raise exception 'O horário já está reservado em %.', occurrence_date;
    end if;

    next_month_start := date_trunc('month', occurrence_date)::date;
    if extract(month from occurrence_date) <> extract(month from (occurrence_date - interval '1 month')) then
      if (select count(*) from public.bookings where user_id = auth.uid() and court_id = p_court_id and start_time = p_start_time and status = 'confirmed' and booking_date between next_month_start - 30 and next_month_start - 1) = 30 then
        raise exception 'Este horário e esta quadra ficam indisponíveis para você neste mês após 30 dias consecutivos de uso.';
      end if;
    end if;
  end loop;

  for occurrence_index in 0..p_recurrence_count - 1 loop
    occurrence_date := case p_recurrence_type
      when 'daily' then p_booking_date + occurrence_index
      when 'weekly' then p_booking_date + (occurrence_index * 7)
      when 'monthly' then (p_booking_date + (occurrence_index || ' month')::interval)::date
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

grant execute on function public.get_booked_slots(date) to authenticated;
