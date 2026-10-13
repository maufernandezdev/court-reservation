Cada fase termina con `pnpm exec tsc --noEmit`, `pnpm build`, la recorrida de las pantallas tocadas contra el Supabase local (Playwright a 1440 y 390 px) y un commit propio.

## 1. Preparación

- [x] 1.1 Pedir al usuario el token de API de R2 (Object Read & Write solo sobre `court-reservation`) y que cargue `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_BUCKET` en `.env.local`; verificar sin mostrar valores que están y que `wrangler whoami` apunta a la cuenta del bucket
  - El usuario cargó `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y **`R2_BUCKET_NAME`** (no `R2_BUCKET`; el código acepta ambos) y `R2_ALLOWED_ORIGINS` (no se usa: la subida es desde el servidor, el bucket no necesita CORS). Verificado sin mostrar valores: largos correctos, sin comillas ni espacios, y el Account ID coincide con la cuenta de `wrangler whoami`.
- [x] 1.2 Agregar `aws4fetch` con pnpm y crear `lib/r2.ts` (`server-only`: put, get, delete de objetos); verificar con un objeto de prueba subido, leído y borrado del bucket
  - `aws4fetch` agregado con pnpm; `lib/r2.ts` (`server-only`: `putObject`, `getObject`, `deleteObject`, `isR2Configured`). Verificado contra el bucket real: PUT 200, lectura del mismo objeto con `wrangler r2 object get --remote`, GET 200, DELETE 204 y GET 404 después; el bucket quedó en 0 objetos.

## 2. Base de datos

- [x] 2.1 Migración `0011_profiles.sql`: `profiles` con RLS (propia + miembros de un club en común), backfill desde `memberships`, `update_my_name`, `set_my_profe_color` y trigger que copia el correo confirmado a `memberships.email`; verificar en local con usuarios de dos clubes (lectura cruzada solo con club en común, nombre propio en todas las membresías, color solo si es profe y de la paleta)
  - Verificado en local: backfill de 21 perfiles (uno por usuario, nombre más reciente de sus membresías); el operador lee los perfiles de su club (5), alguien sin club solo el propio y nadie el de otro club; `update` directo bloqueado (0 filas); `update_my_name` recorta, actualiza perfil y todas las membresías y rechaza vacío; `set_my_avatar` solo acepta la ruta propia; `set_my_profe_color` funciona para el profe, rechaza al operador y colores fuera de la paleta; cambiar `auth.users.email` copia el correo a las membresías. Se agregó `shares_club_with` (no estaba en design) para la policy y la ruta de fotos.
- [x] 2.2 `supabase/rollback/0011_down.sql` y prueba subir → bajar → subir en local
  - `supabase/rollback/0011_down.sql`. Verificado: subir → bajar → subir sin cambios en membresías, turnos ni nombres.

## 3. Mi perfil

- [x] 3.1 `/dashboard/perfil` con datos, clubes y rol; `UserBlock` del menú (escritorio y celular) enlaza a Mi perfil y muestra la foto o iniciales; verificar para admin, operador y profesor a 1440 y 390 px
  - `/dashboard/perfil` (Server Component: resumen con foto o iniciales, correo y chips de club · rol) y `UserBlock` del menú como enlace "Mi perfil" con `UserAvatar` (escritorio y "Más" del celular); el layout pasa la foto al shell. Verificado para operador (1440) y profesor (390).
- [x] 3.2 Formulario de nombre (RHF + Zod) con `update_my_name`; verificar que el nombre nuevo aparece en el menú, en Equipo y en Actividad, y el error con nombre vacío
  - `NameForm` + `updateMyNameAction` (`update_my_name`, revalida el layout). Verificado: error con nombre vacío; "Oscar Operador" aparece en el menú, en todas sus membresías, en Equipo y en Actividad del admin.
- [x] 3.3 Formulario de contraseña (actual, nueva, repetir; toggle de visibilidad); verificar el cambio correcto (ingreso con la nueva) y el rechazo con la actual incorrecta
  - `PasswordForm` (actual, nueva, repetir con `PasswordInput`) + `changePasswordAction` (verifica la actual con `signInWithPassword`). Verificado: "La contraseña actual no es correcta." con una incorrecta; cambio correcto e ingreso posterior con la nueva.
- [x] 3.4 Formulario de correo con aviso de confirmación pendiente y mensaje al volver del link; verificar en local (Mailpit) el pedido, la confirmación, el correo nuevo en Equipo y el rechazo de un correo ya usado
  - `EmailForm` + `changeEmailAction` (`updateUser({ email })` con regreso a `/dashboard/perfil?correo=confirmado`). Verificado en local con Mailpit: correo de otra cuenta rechazado; aviso de confirmación pendiente y el correo anterior sigue vigente; llegaron 2 links (cambio de correo seguro: al nuevo y al actual) y al abrirlos el correo cambia en la cuenta y en las membresías (trigger); mensaje "Tu correo quedó actualizado.".
- [x] 3.5 Color del profe en su perfil (uno por club donde es profe); verificar que el profe lo cambia, que el turno toma el color en la planilla y que un operador no ve la opción
  - `ProfeColorSection` + `setMyProfeColorAction` (`set_my_profe_color`), un selector por club donde es profe. Verificado: el profe elige Verde (#1F7A4D guardado) a 390 px; el operador no ve la sección. (El color en la planilla ya se verificó en `add-reservation-types-and-socios`.)

## 4. Foto

- [x] 4.1 Subida con recorte y reducción en el navegador, `uploadAvatarAction` y `removeAvatarAction`; mensajes para formato y tamaño no permitidos y para R2 sin configurar; verificar subir, cambiar y quitar
  - `AvatarUploader` (valida con Zod JPG/PNG/WebP ≤ 5 MB, recorta al centro y reduce a 512×512 WebP con canvas) + `uploadAvatarAction` (acepta solo WebP ≤ 1 MB, sube a `avatars/<userId>.webp`, `set_my_avatar`) y `removeAvatarAction` (borra en R2 y limpia la ruta); sin credenciales responde "Las fotos todavía no están configuradas". Verificado contra el bucket real: PDF rechazado; JPG de 1600×1000 queda como WebP 512×512 recortado al centro; cambiar a un PNG cambia la versión de la URL; quitar vuelve a las iniciales y el bucket queda en 0 objetos.
- [x] 4.2 Ruta `GET /api/avatars/[userId]` con control de club en común y caché privada; fotos en menú, Mi perfil y Equipo con `next/image`; verificar que alguien de otro club recibe 404 y que al cambiar la foto se ve la nueva
  - `app/api/avatars/[userId]/route.ts` (sesión + RLS de `profiles` = club en común; `Cache-Control: private, max-age=86400`); `UserAvatar` con `next/image` (`unoptimized`, para que el navegador mande sus cookies) en menú, Mi perfil y Equipo. Verificado: `image/webp` con caché privada; el admin del club la ve en Equipo y recibe 200; alguien de otro club y sin sesión reciben 404.

## 5. Cierre

- [ ] 5.1 Aplicar `0011` en producción con confirmación del usuario y borrar los objetos de prueba del bucket
- [x] 5.2 Actualizar README (variables de R2, Mi perfil), `docs/PROJECT_DOCUMENTATION.md` y marcar "Editar perfil" en `docs/next-steps.md`
  - README (variables de R2 con `R2_BUCKET_NAME`, Mi perfil en la tabla, `components/profile/`), `docs/PROJECT_DOCUMENTATION.md` (sección de 0011 y R2; pendientes de producción 0009 y 0011) y "Editar perfil" marcado ✅ en `docs/next-steps.md`.
