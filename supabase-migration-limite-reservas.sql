-- Execute uma vez no SQL Editor do Supabase.
-- Limita cada membro a 30 reservas futuras na mesma quadra e horário
-- e bloqueia a mesma combinação no mês seguinte para garantir rotatividade.

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
  future_booking_count integer;
  previous_month_booking_count integer;
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
    when p_recurrence_type = 'monthly' then least(30, (date_trunc('month', p_booking_date) + interval '1 month - 1 day')::date - p_booking_date + 1)
    else p_recurrence_count
  end;

  -- Serializa pedidos iguais para que duas reservas simultâneas não ultrapassem o limite.
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || p_court_id::text || ':' || p_start_time::text));
  select count(*) into future_booking_count
  from public.bookings
  where user_id = auth.uid()
    and court_id = p_court_id
    and start_time = p_start_time
    and status = 'confirmed'
    and booking_date >= current_date;

  if future_booking_count + occurrence_total > 30 then
    raise exception 'Você já possui % reserva(s) futura(s) nesta quadra e horário. O limite é de 30.', future_booking_count;
  end if;

  select count(*) into previous_month_booking_count
  from public.bookings
  where user_id = auth.uid()
    and court_id = p_court_id
    and start_time = p_start_time
    and status = 'confirmed'
    and booking_date >= (date_trunc('month', p_booking_date) - interval '1 month')::date
    and booking_date < date_trunc('month', p_booking_date)::date;

  if previous_month_booking_count >= 30 then
    raise exception 'Você utilizou este horário nesta quadra por 30 dias no mês anterior. Escolha outra quadra ou horário neste mês.';
  end if;

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
