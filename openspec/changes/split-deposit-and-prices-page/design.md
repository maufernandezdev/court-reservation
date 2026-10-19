## Context

`sport_prices` tiene una fila por club y tipo de cancha con `deposit_enabled`, `deposit_type` y `deposit_value` (una sola seña para todos los turnos). La sección de precios (`components/courts/sport-prices-section.tsx`) y el horario de la noche se muestran arriba de las tarjetas en Canchas. La base de producción está vacía.

## Goals / Non-Goals

**Goals:**
- Seña distinta para público y profes, con el público apagado por defecto.
- Canchas liviana; ajustes en un modal que se abre desde Canchas, sin secciones nuevas.

**Non-Goals:**
- Cambiar cómo se registra el cobro de la seña (`payments`) ni los estados de pago.
- Editar la duración y el horario de cada cancha en la nueva pantalla: son datos de cada cancha y siguen en el menú ⋮ de su tarjeta.

## Decisions

- **Columnas separadas, no una tabla nueva.** `deposit_enabled/type/value` se renombran a `public_deposit_*` (seña del público) y se agregan `profe_deposit_*`, siguiendo el estilo de `public_price_per_hour` / `profe_price_per_hour`. La migración copia la configuración vigente a `profe_deposit_*` y apaga la del público. Rollback: vuelve a `deposit_*` con la configuración de profes.
- **`depositFor(prices, kind, price)`** elige la seña por tipo de turno (`profe` → profes; `standard` y `torneo` → público). Es el único punto de cálculo: lo usan el formulario, el detalle, el cobro de seña, Políticas (ejemplo) y las tarjetas de Canchas.
- **Modal en Canchas, sin ruta nueva.** Un botón "Precios" en el encabezado de Canchas abre `PricesDialog`; no hay entrada de menú ni ruta propia (decisión del usuario: no sumar secciones). El acceso es el de Canchas (solo admin).
- **Se reutiliza la sección existente**: `SportPricesSection` y `NightStartCard` se mueven a `components/prices/` y se muestran dentro del modal, con la seña partida en dos bloques ("Seña del público" y "Seña de profes"), sin reescribir el formulario ni las acciones (`updateSportPricesAction`, `updateNightStartAction`) más que para los campos nuevos. Las acciones revalidan `/dashboard/canchas`, así que al cerrar el modal las tarjetas muestran los valores nuevos.
- **Auditoría**: `prices.updated` agrega los campos de seña por audiencia; los registros viejos con `deposit_*` siguen leyéndose con su texto.
- **Bienvenida del alta**: el alta redirige a `/dashboard/canchas?alta=1`; con ese parámetro el modal se abre solo en un paso de bienvenida y, con "Siguiente", pasa a los precios iniciales. Al cerrar se limpia el parámetro (`router.replace`), así no reaparece al recargar. Reemplaza al aviso "PASO 3 DE 3".

## Risks / Trade-offs

- [Código viejo que lea `deposit_*`] → se desplegó junto con la migración; `grep deposit_` en `app lib components hooks` tiene que dar solo los nombres nuevos.
- [El público no puede dejar seña mientras esté apagada] → es lo pedido; se enciende desde Precios y señas cuando el club lo decida.
- [Turnos con seña ya cobrada y la configuración cambia] → los cobros ya registrados no se tocan; solo cambia la seña que se ofrece de ahí en más.

## Migration Plan

1. Escribir `0015_deposit_by_audience.sql` y `supabase/rollback/0015_down.sql`; probar subir → bajar → subir en el Supabase local.
2. Implementar código y pantallas; verificar a 1440 y 390 px.
3. Aplicar en la base real (vacía) y desplegar junto con el código.
