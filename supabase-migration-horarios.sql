-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- Corrige tabelas já existentes sem apagar usuários, quadras ou reservas.

alter table public.availability
  drop constraint if exists availability_start_time_check,
  drop constraint if exists availability_end_time_check;

alter table public.availability
  add constraint availability_start_time_check
    check (start_time in ('06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00')),
  add constraint availability_end_time_check
    check (end_time = start_time + interval '2 hours');

alter table public.bookings
  drop constraint if exists bookings_start_time_check,
  drop constraint if exists bookings_end_time_check;

alter table public.bookings
  add constraint bookings_start_time_check
    check (start_time in ('06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00')),
  add constraint bookings_end_time_check
    check (end_time = start_time + interval '2 hours');

insert into public.availability (court_id, day_of_week, start_time, end_time)
select courts.id, days.day_of_week, slots.start_time, slots.start_time + interval '2 hours'
from public.courts
cross join generate_series(0, 6) as days(day_of_week)
cross join (values
  (time '06:00'), (time '08:00'), (time '10:00'), (time '12:00'),
  (time '14:00'), (time '16:00'), (time '18:00'), (time '20:00')
) as slots(start_time)
where courts.active = true
on conflict (court_id, day_of_week, start_time) do nothing;
