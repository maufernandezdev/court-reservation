-- Redes del club: WhatsApp (solo números, con o sin código de país) e Instagram (usuario sin @).
-- Se editan en Políticas y se usan en los mensajes de WhatsApp que arma la app.
alter table public.settings
  add column if not exists whatsapp text not null default '' check (whatsapp ~ '^[0-9]{0,15}$'),
  add column if not exists instagram text not null default '' check (instagram ~ '^[A-Za-z0-9._]{0,30}$');
