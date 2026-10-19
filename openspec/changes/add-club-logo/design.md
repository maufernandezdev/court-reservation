## Context

Las fotos de perfil se recortan en el navegador, se suben a un bucket privado de R2 desde una Server Action y se sirven por una ruta de la app que exige sesión (`/api/avatars/[userId]`). El bloque del club del menú muestra las iniciales (`clubInitials`). `clubs` ya tiene RLS: lo leen los miembros y lo actualiza solo el admin.

## Decisions

- **Dos columnas en `clubs`** (`logo_path`, `logo_updated_at`) con un check que fuerza la ruta `logos/<id del club>.webp`: el admin no puede apuntar a otro objeto. Sin RPC: la actualización pasa por la política `clubs_update_admin`.
- **Mismo mecanismo que el avatar:** `lib/image.ts` (nuevo) concentra el procesado en el navegador; la foto de perfil usa `toSquareWebp` (recorte al centro) y el logo usa `toLogoWebp`: quita los márgenes vacíos y conserva la forma (lado mayor de hasta 640 px) sobre fondo blanco. El menú lo muestra con 44 px de alto y hasta 88 de ancho.
- **Ruta `/api/clubs/[clubId]/logo`:** lee `clubs.logo_path` con la sesión de quien pide (si no es miembro, el RLS no devuelve la fila y responde 404), trae el objeto de R2 y lo devuelve con caché privada. La URL lleva `?v=<logo_updated_at>` para renovarse al cambiar.
- **Membresía con el logo:** la consulta de membresías trae `logo_path` y `logo_updated_at` del club; el layout arma la URL y el menú (escritorio, celular y selector de club) la muestra en lugar de las iniciales.
- **Subida desde Políticas** como una tarjeta propia junto a los datos del club, solo para el admin; las acciones validan el rol y el archivo (WebP de hasta 1 MB ya procesado, como la foto de perfil) y revalidan el panel.

## Risks / Trade-offs

- [R2 sin configurar en un entorno] → la acción responde que las fotos no están configuradas y el menú sigue con las iniciales.
- [Objeto huérfano si falla el guardado en la base] → se sobrescribe en la próxima subida (la ruta es fija por club).

## Migration Plan

Migración aditiva `0018` (dos columnas nulas): se aplica sin riesgo y los clubes siguen con las iniciales hasta que el admin suba el logo. Rollback: borra las columnas.
