> **Estado:** registrado (2026-10-06) como pendiente del rediseño `apply-saque-visual-design`. Sin specs, diseño ni tareas todavía.

## Why

Para vender el producto a más de un club, quien se registra tiene que poder dar de alta **su** club (nombre, ciudad, deportes, canchas) en lugar de heredar el nombre fijo `CLUB_NAME`. Hoy el club es implícito (el `owner_id` de la membresía) y no tiene nombre propio. El canvas incluye la pantalla "Alta del club" (paso 2 de 3).

## What Changes

- Entidad "club" con nombre, ciudad y deportes (o columnas equivalentes asociadas al owner).
- Alta del club después del registro: datos del club y canchas iniciales por deporte (crea las canchas con valores por defecto).
- El menú muestra el nombre real del club y, si la persona pertenece a más de un club, un selector para cambiar de club.

## Capabilities

### New Capabilities
- `club-onboarding`: alta del club y canchas iniciales.
- `club-switcher`: elegir el club activo cuando la persona es miembro de varios.

## Impact

Migración nueva, `useMembership`/`getSessionContext` (club activo), `app/register`, shell del panel.
