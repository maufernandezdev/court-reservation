-- Vuelta atrás de 0018_club_logo.sql. Los objetos subidos a R2 (`logos/<id>.webp`) no se borran.
alter table public.clubs
  drop constraint clubs_logo_path_check,
  drop column logo_path,
  drop column logo_updated_at;
