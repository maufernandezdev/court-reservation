> **Origen:** pedido del usuario (2026-10-18). Depende de `add-night-pricing` (precio de noche, aplicado) y de `add-reservation-types-and-socios` (precios y seña por tipo de cancha).

## Why

Hoy la seña es una sola por tipo de cancha y se aplica a todos los turnos. En el club inicial el público no deja seña: solo los profesores. Además, la pantalla de Canchas mezcla las tarjetas de las canchas con todo el ajuste de precios, horario de la noche y seña, y se vuelve larga: el club quiere entrar a Canchas, ver rápido sus canchas, y hacer los ajustes en otro lugar.

## What Changes

- **Seña separada por audiencia:** cada tipo de cancha tiene una seña para el **público** (turnos estándar y de torneo) y otra para **profes** (turnos de profe), cada una con su interruptor, tipo (fijo o %) y valor. La del público arranca apagada; la de profes toma lo que el club ya tenía configurado.
- **Modal Precios** (solo admin, desde el botón "Precios" de Canchas; sin ruta ni entrada de menú nuevas): ahí viven el horario de inicio de la noche y, por tipo de cancha, los precios de día y de noche (público y profe) y las dos señas, con el resumen de un turno de ejemplo.
- **Canchas queda solo con las tarjetas** de las canchas y sus acciones (nueva cancha, editar, dar de baja), más el botón "Precios". Cada tarjeta sigue mostrando el resumen de precios y seña.
- **Bienvenida al crear el club:** Canchas abre sola un modal de bienvenida y, con "Siguiente", la configuración inicial de precios en el mismo modal.

## Capabilities

### New Capabilities
- `deposit-by-audience`: seña del público y seña de profes, y a qué turnos se aplica cada una.
- `prices-dialog`: modal de Precios en Canchas y bienvenida inicial del club.

### Modified Capabilities
<!-- Los specs de `sport-pricing` y `night-pricing` viven en cambios todavía sin archivar: no hay spec en openspec/specs/ para escribir un delta MODIFIED. -->

## Impact

- **Base de datos:** migración `0015_deposit_by_audience.sql` (en `sport_prices`, `deposit_*` pasa a `public_deposit_*`, apagada, y se agregan `profe_deposit_*` con la configuración anterior) y su rollback.
- **Código:** `lib/pricing.ts` (`depositFor` recibe el tipo de turno, esquema del formulario), sección de precios, modal `components/prices/prices-dialog.tsx`, `app/dashboard/canchas/page.tsx`, cobro de seña y panel del turno, formulario del turno, auditoría, documentación.
- **Fuera de alcance:** seña distinta por cancha, seña por día de la semana, cobro online de la seña.
