## Context

- El nombre de cada persona vive hoy en `memberships.full_name`, uno por club (lo carga el admin al invitar o sale de `raw_user_meta_data`). Lo leen el menú, Equipo, Actividad, Caja y el detalle del turno. El correo se copia en `memberships.email`.
- Las membresías solo las modifica el admin (RLS `memberships_admin_update`), así que una persona no puede cambiar su propio nombre ni su color con un `update` directo.
- Auth: Supabase con confirmación de correo activada y el SMTP de prueba (solo entrega a correos del equipo). El cliente del navegador canjea solo los `?code=` de los links (`detectSessionInUrl`).
- R2: bucket `court-reservation` (ENAM), vacío, sin acceso público por r2.dev ni CORS. La sesión de Wrangler (OAuth) sirve para administrar, pero la app necesita credenciales S3 propias para leer y escribir objetos.
- Reglas del repo: formularios con RHF + Zod (schema junto al formulario), `next/image` con dimensiones, datos por Server Actions o rutas BFF.

## Goals / Non-Goals

**Goals:**
- Un único lugar para el nombre de la persona, sin cambiar todas las pantallas que hoy leen `memberships.full_name`.
- Fotos privadas (solo para quien comparte club), sin exponer el bucket.
- Cambios de seguridad (contraseña, correo) con verificación.

**Non-Goals:**
- Borrar la cuenta, 2FA, inicio de sesión con proveedores externos.
- Correo transaccional propio (el cambio de correo depende del SMTP de Supabase).

## Decisions

### 1. Tabla `profiles` y nombre sincronizado
`profiles(user_id pk → auth.users, full_name, avatar_path, avatar_updated_at, updated_at)`. RLS: cada uno lee y escribe su fila; los miembros de un club en común leen las de los demás (para foto y nombre en Equipo).
- Función `update_my_name(p_full_name)` (`SECURITY DEFINER`): valida (1–120 caracteres), actualiza `profiles` y **todas** las `memberships.full_name` de `auth.uid()`. Así el menú, Equipo, Actividad y Caja muestran el nombre nuevo sin cambiar sus consultas.
- Alternativa: leer siempre el nombre de `profiles` con un join. Descartada por ahora: obliga a tocar todas las pantallas; se puede migrar después.

### 2. Contraseña: verificar la actual en el servidor
`changePasswordAction`: valida con Zod (actual, nueva ≥ 6, repetición igual), verifica la actual con `signInWithPassword` del correo de la sesión en el cliente de servidor y, si pasa, `auth.updateUser({ password })`. Si la actual falla: "La contraseña actual no es correcta".

### 3. Correo: `updateUser({ email })` con confirmación
`changeEmailAction` llama a `auth.updateUser({ email }, { emailRedirectTo: <origen>/dashboard/perfil?correo=confirmado })`. Supabase manda el link al correo nuevo (y, con "secure email change", también al anterior); hasta confirmarlo `auth.users.email` no cambia. Al volver con `?code=`, el cliente del navegador canjea el código solo y la pantalla muestra "Tu correo quedó actualizado".
- Trigger `after update of email on auth.users` (`SECURITY DEFINER`) que copia el correo nuevo a `memberships.email` e invitaciones no aceptadas no cambian (son de otro correo).
- Correo ya usado por otra cuenta: Supabase devuelve error y se muestra "Ese correo ya lo usa otra cuenta".

### 4. Fotos en R2 privado, servidas por la app
- **Subida:** el navegador recorta al centro y reduce a 512×512 en WebP (`canvas`), y envía el archivo a `uploadAvatarAction` (FormData). El servidor valida tipo (`image/webp|jpeg|png`) y tamaño (≤ 5 MB antes de reducir, ≤ 1 MB lo que llega), lo sube a `avatars/<userId>.webp` con `PUT` firmado por `aws4fetch` contra `https://<account>.r2.cloudflarestorage.com/court-reservation/...`, y guarda `avatar_path` y `avatar_updated_at`.
- **Lectura:** ruta BFF `GET /api/avatars/[userId]`: exige sesión, verifica en la base que quien pide y el dueño comparten un club (o es la misma persona), lee el objeto de R2 con `GET` firmado y lo devuelve con `Cache-Control: private, max-age=86400`. La URL lleva `?v=<avatar_updated_at>` para invalidar la caché al cambiarla. `next/image` la usa como ruta local (sin `remotePatterns`).
- **Quitar:** `removeAvatarAction` borra el objeto y limpia `avatar_path`.
- Credenciales: token de API de R2 con "Object Read & Write" limitado al bucket (se crea en el panel de Cloudflare → R2 → Manage API tokens; Wrangler no puede emitir credenciales S3). Variables de servidor `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` en `lib/r2.ts` con `server-only`.
- Alternativa: bucket público por r2.dev. Descartada: Cloudflare lo limita para producción y haría las fotos públicas. Alternativa: URLs prefirmadas de lectura. Descartada: cambian en cada carga y empeoran la caché; la ruta BFF además controla quién las ve.
- Alternativa: SDK `@aws-sdk/client-s3`. Descartada por tamaño; `aws4fetch` alcanza para PUT/GET/DELETE.

### 5. Color del profe desde el perfil
Función `set_my_profe_color(p_club_id, p_color)` (`SECURITY DEFINER`): exige que `auth.uid()` sea `profesor` en ese club y que el color sea de la paleta (misma lista que `lib/profe-colors.ts` y el trigger de `0009`). En el perfil se muestra un selector por cada club donde la persona es profe.

### 6. Pantalla y navegación
`/dashboard/perfil` (Server Component que carga perfil y membresías; formularios cliente con RHF + Zod, schema arriba de cada formulario). El `UserBlock` del menú pasa a ser un enlace a "Mi perfil" (el botón de cerrar sesión queda aparte) y muestra la foto si existe. Equipo muestra la foto de cada persona.

## Risks / Trade-offs

- [El SMTP de prueba no entrega el link de cambio de correo a correos reales] → Documentado; funciona con correos del equipo de Supabase hasta configurar SMTP propio.
- [La ruta de fotos consulta la base en cada pedido] → Caché privada de un día en el navegador y versión en la URL.
- [Nombre duplicado en `profiles` y `memberships`] → Siempre se escribe con `update_my_name`, que actualiza ambos en la misma transacción; el admin que edita en Equipo sigue tocando solo esa membresía (como hoy).
- [Faltan las credenciales de R2] → La subida muestra "Las fotos todavía no están configuradas" en vez de fallar; el resto del perfil funciona.

## Migration Plan

1. El usuario crea el token de R2 y carga las variables en `.env.local` (y en el despliegue).
2. Probar `0011` en el Supabase local; la subida a R2 se prueba contra el bucket real con un usuario de prueba y se borra el objeto al final.
3. Aplicar `0011` en producción con confirmación del usuario (aditiva). Rollback: `supabase/rollback/0011_down.sql`.

## Open Questions

- Si más adelante se usa un dominio propio en Cloudflare, se puede servir `avatars/` por dominio público con caché de borde; no cambia la API de la pantalla.
