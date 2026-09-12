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

## Pendientes

- Nada del trabajo de auth/registro está commiteado todavía (register, supabase lib, proxy, cambios en login/dashboard/AGENTS.md).
- **Migraciones de Supabase sin CLI:** la tabla `courts` (y las que se agreguen) vive como SQL versionado en `supabase/migrations/`, pero se aplica a mano copiándola en el SQL Editor del dashboard. Cuando haya varias migraciones, evaluar adoptar Supabase CLI (`supabase db push`).
- Usuarios unconfirmed huérfanos (emails con typo): no se limpian automáticamente. Se puede borrar a mano desde Authentication → Users en el dashboard, o armar una Edge Function con `service_role` que los purgue.
