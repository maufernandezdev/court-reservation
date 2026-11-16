> **Origen:** etapa 1 aprobada por Mau (2026-11-15). La página pública del club queda para la etapa 2; por ahora las redes se usan en los mensajes que ya comparte la app.

## Why

Los mensajes que copia el club para WhatsApp (turnos libres de Hoy y del buscador "¿Hay cancha?") no dicen cómo contactarlo, y el aviso de un horario por confirmar no tenía a qué número ir.

## What Changes

- **Redes del club en Políticas:** `settings.whatsapp` (solo números, 8 a 15 dígitos; acepta espacios, guiones y "+", que se limpian) y `settings.instagram` (usuario; acepta "@usuario" o el link del perfil y guarda solo el usuario), validados con Zod y con checks en la base.
- **Mensajes:** los turnos libres que se copian para WhatsApp terminan con una línea de contacto (link de WhatsApp e Instagram del club). "Avisar al admin por WhatsApp" de los horarios por confirmar va al número del club (sin número, WhatsApp pide elegir el chat).

## Capabilities

### Modified Capabilities
- `club-settings`: redes del club.

## Impact

- **Base de datos:** `0029_club_social.sql` y `supabase/rollback/0029_down.sql`.
- **Código:** `lib/clubs.ts` (`clubSocialSchema`, `normalizeInstagram`, `clubContactLine`), `lib/club-data.ts`, `lib/availability.ts` (`buildAvailabilityMessage` con `contact`), Políticas (`ClubSocialForm`, `updateClubSocialAction`), Hoy, buscador y aviso de confirmación.
- **Fuera de alcance:** página pública del club (etapa 2).
