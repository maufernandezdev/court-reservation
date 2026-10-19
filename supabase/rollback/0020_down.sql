-- Vuelta atrás de 0020_profe_cancellation.sql: los profesores vuelven a no poder cancelar dentro de la ventana de penalidad.
drop function if exists public.cancel_own_profe_reservation(uuid, text, boolean);

create or replace function public.protect_reservation_money()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_hours int;
begin
  if new.payment_status is distinct from old.payment_status
     and not public.is_staff(old.club_id) then
    raise exception 'Solo el personal del club puede cambiar el cobro de una reserva'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and new.status = 'cancelled'
     and not public.is_staff(old.club_id) then
    select cancel_window_hours into v_window_hours
    from public.settings where club_id = old.club_id;
    v_window_hours := coalesce(v_window_hours, 24);

    if old.date + old.time::time < now() + make_interval(hours => v_window_hours) then
      raise exception 'No podés cancelar un turno dentro de la ventana de penalidad. Consultá con un administrador.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
