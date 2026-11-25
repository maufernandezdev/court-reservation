# Plan abierto — Liquidación de profes por período

Estado: **abierto, en debate** (2026-11-24). Falta que Mauricio responda las preguntas de abajo antes de armar fases y tests.

## Pedido

- Cada profe paga lo que va usando, con la frecuencia que prefiera: por día, por semana o como le quede cómodo.
- The Garden empieza a liquidar desde el **1/12**. Lo anterior lo arregla el club por su cuenta.
- El admin entra a liquidar un período y ve lo mismo que hoy por profe: turnos, horas, total, lo ya pagado y lo que falta.
- La vista semanal se mantiene como vista para mirar. Las dos tienen que convivir.
- No se debe poder liquidar lo que todavía no pasó.
- Deshacer una liquidación (solo admin), por si hubo un error. Es deseable pero se puede postergar si complica.

## Cómo funciona hoy

- `app/dashboard/liquidaciones/page.tsx` muestra siempre una semana, de lunes a domingo (`?semana=`).
- La RPC `settle_profe_reservations` (migración 0032):
  - toma los turnos de profe activos y no pagados entre `p_from` y `p_to`;
  - inserta un cobro `total` por el saldo de cada uno, con un solo medio;
  - deja cada turno en `pagada`.
- No hay control de fechas futuras.
- La liquidación no queda guardada como algo propio, solo como cobros sueltos y una línea `profe.settled` en Actividad. Por eso hoy no se puede deshacer de forma limpia.

## Propuesta

1. **Fecha de inicio por club ("Liquidar desde").** Se guarda en `settings`; para The Garden, el 1/12. Lo anterior no cuenta como deuda del profe en esta pantalla.
2. **Dos vistas que conviven:**
   - **Semana:** la vista actual, para mirar.
   - **Liquidar:** período con atajos (hoy, ayer, esta semana, este mes) o un rango libre. Por profe muestra lo mismo que hoy y permite liquidar.
   - Alternativa preferida: **"todo lo pendiente hasta tal fecha"**, desde la fecha de inicio. Así da igual si el profe paga cada día o cada semana: siempre se ve lo acumulado y no queda nada en el medio sin cobrar.
3. **No liquidar el futuro.** El "hasta" llega como máximo a hoy, y de hoy solo cuentan los turnos ya terminados. La UI lo limita y la RPC también lo valida.
4. **Historial de liquidaciones.** Nueva tabla `profe_settlements`, más la columna `payments.settlement_id` para saber qué cobros generó cada liquidación. Guarda:
   - profe;
   - período desde y hasta;
   - medio de pago;
   - monto y cantidad de turnos;
   - quién la hizo y cuándo;
   - `voided_at` y `voided_by`, que se completan si se deshace.
5. **Deshacer (solo admin).** Barato si sale junto con el historial:
   - borra los cobros de esa liquidación;
   - devuelve los turnos a pendiente, o a señado si ya tenían otra seña;
   - marca la liquidación como deshecha y deja registro en Actividad.

   Aviso: si se deshace una liquidación de un día cuya caja ya se cerró, el cierre de ese día cambia. Hay que avisarlo en la confirmación.
   Las liquidaciones hechas antes de este cambio no tienen registro y no se podrán deshacer.

## Preguntas abiertas

1. ¿Sirve "todo lo pendiente hasta tal fecha", o es mejor elegir "desde" y "hasta"?
2. ¿Hay profes que paguen por adelantado, por ejemplo su fijo del mes? Si los hay, cambia la regla de bloquear el futuro.
3. ¿Se puede repartir una liquidación en efectivo y MP, como el cobro único por persona?
4. ¿Deshacer entra en esta tanda?

## Próximo paso

Con las respuestas: definir objetivos con severidad, fases (migración, RPC, pantalla Liquidar, historial y deshacer), tests SQL y de lógica, y pruebas en el Club de Pruebas Altenor.
