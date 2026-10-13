Cada fase termina con `pnpm exec tsc --noEmit`, `pnpm build`, la recorrida de las pantallas tocadas contra el Supabase local (Playwright a 1440 y 390 px) y un commit propio.

## 1. Preparación

- [ ] 1.1 Pedir al usuario el token de API de R2 (Object Read & Write solo sobre `court-reservation`) y que cargue `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_BUCKET` en `.env.local`; verificar sin mostrar valores que están y que `wrangler whoami` apunta a la cuenta del bucket
- [ ] 1.2 Agregar `aws4fetch` con pnpm y crear `lib/r2.ts` (`server-only`: put, get, delete de objetos); verificar con un objeto de prueba subido, leído y borrado del bucket

## 2. Base de datos

- [x] 2.1 Migración `0011_profiles.sql`: `profiles` con RLS (propia + miembros de un club en común), backfill desde `memberships`, `update_my_name`, `set_my_profe_color` y trigger que copia el correo confirmado a `memberships.email`; verificar en local con usuarios de dos clubes (lectura cruzada solo con club en común, nombre propio en todas las membresías, color solo si es profe y de la paleta)
  - Verificado en local: backfill de 21 perfiles (uno por usuario, nombre más reciente de sus membresías); el operador lee los perfiles de su club (5), alguien sin club solo el propio y nadie el de otro club; `update` directo bloqueado (0 filas); `update_my_name` recorta, actualiza perfil y todas las membresías y rechaza vacío; `set_my_avatar` solo acepta la ruta propia; `set_my_profe_color` funciona para el profe, rechaza al operador y colores fuera de la paleta; cambiar `auth.users.email` copia el correo a las membresías. Se agregó `shares_club_with` (no estaba en design) para la policy y la ruta de fotos.
- [x] 2.2 `supabase/rollback/0011_down.sql` y prueba subir → bajar → subir en local
  - `supabase/rollback/0011_down.sql`. Verificado: subir → bajar → subir sin cambios en membresías, turnos ni nombres.

## 3. Mi perfil

- [ ] 3.1 `/dashboard/perfil` con datos, clubes y rol; `UserBlock` del menú (escritorio y celular) enlaza a Mi perfil y muestra la foto o iniciales; verificar para admin, operador y profesor a 1440 y 390 px
- [ ] 3.2 Formulario de nombre (RHF + Zod) con `update_my_name`; verificar que el nombre nuevo aparece en el menú, en Equipo y en Actividad, y el error con nombre vacío
- [ ] 3.3 Formulario de contraseña (actual, nueva, repetir; toggle de visibilidad); verificar el cambio correcto (ingreso con la nueva) y el rechazo con la actual incorrecta
- [ ] 3.4 Formulario de correo con aviso de confirmación pendiente y mensaje al volver del link; verificar en local (Mailpit) el pedido, la confirmación, el correo nuevo en Equipo y el rechazo de un correo ya usado
- [ ] 3.5 Color del profe en su perfil (uno por club donde es profe); verificar que el profe lo cambia, que el turno toma el color en la planilla y que un operador no ve la opción

## 4. Foto

- [ ] 4.1 Subida con recorte y reducción en el navegador, `uploadAvatarAction` y `removeAvatarAction`; mensajes para formato y tamaño no permitidos y para R2 sin configurar; verificar subir, cambiar y quitar
- [ ] 4.2 Ruta `GET /api/avatars/[userId]` con control de club en común y caché privada; fotos en menú, Mi perfil y Equipo con `next/image`; verificar que alguien de otro club recibe 404 y que al cambiar la foto se ve la nueva

## 5. Cierre

- [ ] 5.1 Aplicar `0011` en producción con confirmación del usuario y borrar los objetos de prueba del bucket
- [ ] 5.2 Actualizar README (variables de R2, Mi perfil), `docs/PROJECT_DOCUMENTATION.md` y marcar "Editar perfil" en `docs/next-steps.md`
