-- Execute uma vez no SQL Editor do Supabase.
-- Permite que membros autenticados consultem apenas as reservas confirmadas.

drop policy if exists "members view their bookings" on public.bookings;
drop policy if exists "admins view all bookings" on public.bookings;

create policy "authenticated users view confirmed bookings"
  on public.bookings
  for select
  to authenticated
  using (status = 'confirmed' or user_id = auth.uid() or public.is_admin());
