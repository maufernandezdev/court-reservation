-- Logo del club: el admin lo sube (la app lo guarda en R2) y todo el equipo lo ve en el menú.
-- Aquí solo se guarda la ruta del objeto y su versión; la ruta es fija por club.
-- `supabase db push` corre cada migración dentro de una transacción.

alter table public.clubs
  add column logo_path text,
  add column logo_updated_at timestamptz,
  add constraint clubs_logo_path_check check (logo_path is null or logo_path = 'logos/' || id::text || '.webp');
