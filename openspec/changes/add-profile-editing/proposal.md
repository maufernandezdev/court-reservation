> **Origen:** `docs/next-steps.md` → "Editar perfil" (2026-10-12). El bucket de Cloudflare R2 `court-reservation` ya existe (vacío, sin acceso público).

## Why

Hoy nadie puede cambiar sus propios datos: el nombre lo carga el admin al invitar, el correo y la contraseña quedan como se crearon, y el color de un profe solo lo cambia el admin. Cada persona (admin, operador o profesor) tiene que poder mantener su perfil, y el club quiere ver la foto de cada uno.

## What Changes

- **Pantalla "Mi perfil"** en `/dashboard/perfil`, para todos los roles. Se abre tocando tu nombre abajo en el menú lateral (en el celular, desde "Más").
- **Nombre:** se cambia en un solo lugar y se ve en el menú, en Equipo y en Actividad de todos los clubes de la persona.
- **Contraseña:** se cambia pidiendo la contraseña actual, con la misma regla y el mismo toggle de visibilidad que el registro.
- **Correo:** se pide el correo nuevo y se confirma desde un link que Supabase manda al correo nuevo. Hasta confirmarlo, sigue valiendo el anterior.
- **Foto:** se sube una imagen que la app recorta en cuadrado y achica antes de guardarla en el bucket privado de Cloudflare R2. Se puede cambiar o quitar, y se ve en el menú, en Equipo y en Mi perfil. Sin foto se siguen viendo las iniciales.
- **Color de la planilla (profes):** el profe elige su color desde su perfil (antes solo podía el admin, que sigue pudiendo desde Equipo).

## Capabilities

### New Capabilities
- `user-profile`: datos propios de cada persona (nombre, correo, contraseña, foto y color de profe) y dónde se muestran.

### Modified Capabilities
<!-- El color de profe de `reservation-types` (cambio `add-reservation-types-and-socios`, sin archivar) pasa a poder elegirlo también el profe; se documenta en `user-profile`. -->

## Impact

- **Base de datos:** migración `0011_profiles.sql` (tabla `profiles` con nombre y foto por usuario; funciones para actualizar el nombre propio en todas sus membresías y para que el profe cambie su color; trigger que copia a `memberships.email` el correo nuevo cuando se confirma).
- **Cloudflare R2:** un token de API de R2 con permiso de lectura y escritura solo sobre `court-reservation` (lo crea el usuario en el panel de Cloudflare) y variables de servidor `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. El bucket queda privado.
- **Código:** `/dashboard/perfil` (formularios con RHF + Zod), ruta `/api/avatars/[userId]` que sirve la foto desde R2 solo a miembros de un club en común, acciones de servidor, bloque de usuario del menú, Equipo (fotos).
- **Dependencias:** `aws4fetch` (firma de pedidos a la API S3 de R2, liviana) en lugar del SDK de AWS.
- **Fuera de alcance:** borrar la cuenta, autenticación en dos pasos, envío de correos propios (el cambio de correo usa el SMTP de Supabase: con el de prueba solo llega a correos del equipo).
