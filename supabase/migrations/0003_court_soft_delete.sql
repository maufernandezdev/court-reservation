-- Soft delete de canchas: baja lógica con columna `active`.
-- Las canchas "eliminadas" quedan en la base (con sus reservas) pero no se muestran.

alter table public.courts add column active boolean not null default true;

-- Policy de UPDATE que faltaba (la usan tanto la edición como la baja lógica).
create policy "courts_update_own" on public.courts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
