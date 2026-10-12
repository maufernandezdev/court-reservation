> **Estado:** registrado (2026-10-06) como pendiente del rediseño `apply-saque-visual-design`. Sin specs, diseño ni tareas todavía.
>
> **Postergado (2026-10-12):** por ahora no se implementa. Se retoma solo si el producto crece y se instala en otros clubes (ver `add-club-onboarding`).

## Why

Los clubes de tenis distinguen canchas por superficie (polvo de ladrillo, cemento, césped) y los de pádel por cerramiento (vidrio, muro). El canvas muestra la superficie en la planilla, Hoy, Canchas y el buscador, y sirve para responder consultas ("¿tenés polvo a las 19?").

## What Changes

- Campo opcional de superficie por cancha (lista según el deporte) en el formulario de Canchas.
- Mostrarla en encabezados de la planilla, tarjetas de Canchas, Hoy y resultados del buscador / texto de WhatsApp.

## Capabilities

### Modified Capabilities
- Gestión de canchas: nuevo atributo `surface`.

## Impact

Migración menor en `courts`, schema Zod de cancha, componentes de canchas y planilla.
