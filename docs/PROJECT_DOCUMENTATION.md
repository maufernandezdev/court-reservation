# Project Documentation

Lugar de notas del proyecto: decisiones, pendientes y configuraciones que no se desprenden del código.

## Decisiones

### Verificación de email en el registro: por link, no por código

- El registro (`app/register/page.tsx`) muestra una pantalla de "Revisá tu email" después del signup, indicando que se envió un correo con un **link de confirmación** (no un código).
- El link redirige a **`/verification-account`**, que toma el parámetro `?code=` de la URL, lo canjea con `supabase.auth.exchangeCodeForSession(code)` (esto es lo que valida el email), y muestra un resultado: éxito (con cuenta regresiva de 10 s y botón para ir al inicio) o error (link inválido/expirado).
- **Decisión (2026-09):** se descartó la verificación por código OTP. Supabase por defecto manda un link (`{{ .ConfirmationURL }}`), y hacer que mande un código requería editar el template "Confirm signup" para incluir `{{ .Token }}`. Como el envío de emails igual queda pendiente de configurar un **SMTP propio** (el SMTP por defecto de Supabase tiene límites muy bajos y no sirve para producción), se optó por el flujo de link que funciona con el template por defecto.
- La pantalla tiene "Reenviar correo" (`supabase.auth.resend({ type: "signup" })`) y "Cambiar email" (vuelve al formulario y registra un usuario nuevo; el anterior queda unconfirmed huérfano).
- Si la confirmación de email está deshabilitada en el proyecto, `signUp` devuelve sesión y el usuario entra directo al dashboard (ya manejado en el código).
- Cuando se configure el SMTP propio: Authentication → Emails → conectar SMTP, y probar el flujo completo.

### Límite de emails del SMTP por defecto

- El SMTP por defecto de Supabase permite solo **2 emails por hora por proyecto**, compartidos entre todos los endpoints (signup, reenvío, magic link, recuperación de contraseña). Además hay un cooldown de 60 s entre reenvíos al mismo email.
- **No se puede subir** ese límite; el servicio por defecto es solo para pruebas.
- Workarounds para desarrollo: esperar la hora, desactivar "Confirm email" en Authentication → Sign In / Providers → Email, usar Supabase CLI local (Inbucket captura los mails sin límite), o configurar SMTP propio (con SMTP custom el límite pasa a 30/hora y es configurable en Authentication → Rate Limits).

## Decisiones y semántica

- **Soft delete de canchas (migración `0003_court_soft_delete.sql`, aplicada 2026-09-24):** la baja de una cancha es lógica: se marca `active = false` y la fila (con sus reservas) queda en la base. Todas las queries del cliente filtran `.eq("active", true)`, así que la cancha desaparece de la UI. La migración también agregó la policy RLS `courts_update_own` (update sobre filas propias), que usan tanto la edición como la baja lógica. No hay policy de DELETE a propósito: la baja física no es un flujo soportado.
- `/dashboard/canchas` es Server Component: lee con el client de servidor y muta vía Server Actions (`app/dashboard/canchas/actions.ts`), que validan con Zod, chequean sesión y hacen `revalidatePath`. Las páginas de reservas y home siguen en el cliente con `useCourts()`/`useReservations()`.

## Pendientes

- Nada del trabajo de auth/registro está commiteado todavía (register, supabase lib, proxy, cambios en login/dashboard/AGENTS.md).
- **Migraciones de Supabase sin CLI:** la tabla `courts` (y las que se agreguen) vive como SQL versionado en `supabase/migrations/`, pero se aplica a mano copiándola en el SQL Editor del dashboard. Cuando haya varias migraciones, evaluar adoptar Supabase CLI (`supabase db push`).
- Usuarios unconfirmed huérfanos (emails con typo): no se limpian automáticamente. Se puede borrar a mano desde Authentication → Users en el dashboard, o armar una Edge Function con `service_role` que los purgue.

## Semántica de reservas y ocupación

- **`reservations.time`:** franja de **inicio** en formato `"HH:00"`, en bloques fijos de 1 hora alineados a la grilla (`TIME_SLOTS` en `lib/mocks/data.ts`: 09:00 a 22:00). No hay duración variable: una reserva siempre ocupa exactamente el bloque `[time, time + 1h)`. El constraint único `(court_id, date, time)` garantiza un solo titular por cancha/fecha/franja a nivel base de datos (doble reserva imposible aunque la UI falle).
- **"En curso" (home `/dashboard`):** el bloque de 1h que contiene la hora local del navegador para la fecha de hoy, calculado como `hora actual` truncada a hora completa. Si son las 18:35, la franja en curso es "18:00" (reserva 18:00–19:00). Fuera de la grilla (antes de las 09:00 o después de las 22:59) no hay franja en curso y toda cancha se muestra como disponible.
- **Fechas:** se manejan como strings `YYYY-MM-DD` (hora local del navegador), no timestamps. Aceptable para un club en un único país; si se opera en varias zonas horarias habría que revisarlo.
- **RLS:** cada usuario solo ve/toca sus propias reservas (`user_id = auth.uid()`). Además, el trigger `reservations_check_court_owner` rechaza insert/update que apunte a una cancha que no sea del mismo usuario (la policy de RLS sola no lo impedía, solo validaba `user_id`).
