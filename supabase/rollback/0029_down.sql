-- Vuelta atrás de 0029_club_social.sql (se pierden el WhatsApp y el Instagram cargados).
alter table public.settings
  drop column if exists whatsapp,
  drop column if exists instagram;
