> **Origen:** pedido del usuario (2026-10-18). Reutiliza la infraestructura de las fotos de perfil (R2 privado y recorte en el navegador) de `add-profile-editing`.

## Why

El bloque del club en el menú muestra solo las iniciales del nombre ("TGT"). Una vez que el admin guarda el logo del club, lo tiene que ver todo el equipo ahí.

## What Changes

- **Logo del club:** el admin lo sube, cambia o quita desde Políticas → "Logo del club" (JPG, PNG o WebP de hasta 5 MB). Se quitan sus bordes vacíos y se guarda con su forma (hasta 640 px de lado mayor) en R2, así un logo horizontal se ve grande en el menú.
- **Lo ven todos los miembros** (admin, operadores y profesores) en el bloque del club del menú, en escritorio y en celular y en el selector de club. Sin logo, siguen las iniciales.
- Se sirve desde la app (`/api/clubs/<id>/logo`) solo a quienes pertenecen al club.

## Capabilities

### New Capabilities
- `club-logo`: logo del club cargado por el admin y visible para todo el equipo.

### Modified Capabilities
<!-- Sin cambios en specs publicados. -->

## Impact

- **Base de datos:** migración `0018_club_logo.sql` (`clubs.logo_path`, `clubs.logo_updated_at` y un check de la ruta) y su rollback.
- **Código:** ruta `app/api/clubs/[clubId]/logo/route.ts`, acciones de subir y quitar, componente de subida (Políticas), bloque del club del menú, `lib/image.ts` compartido con la foto de perfil, documentación.
- **Fuera de alcance:** mostrar el logo en la pantalla pública de invitación (no hay sesión para pedirlo), favicon o logo en correos.
