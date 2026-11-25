---
name: "add-special-pricing"
description: "El admin puede fijar un precio especial (sin cargo, por persona o monto fijo) en turnos y fijos, y cobrar los turnos por persona como una cuenta que se cierra."
task: "sin ID (pedido de Mauricio, 2026-11-24)"
created_at: "2026-11-24T20:17:00-03:00"
created_by:
  person: "Mauricio Fernández"
  tool: "Claude Code"
  model:
    name: "Claude Opus"
    version: "5.5"
    reasoning_effort: "desconocido"
updated_at: "2026-11-24T20:30:00-03:00"
updated_by:
  person: "Mauricio Fernández"
  tool: "Claude Code"
  model:
    name: "Claude Opus"
    version: "5.5"
    reasoning_effort: "desconocido"
---

# Precio especial en turnos y fijos

## 1. Tarea

Sin ID. Pedido de Mauricio a partir de casos reales de The Garden Tenis (planilla en papel de un martes):

- **Clases del dueño (Diego):** ocupan cancha, no pagan.
- **Dobles de jubilados:** fijo semanal, $10.000 por persona. Suelen ser 4, pero puede variar, y el precio por persona no baja si son más.
- **Entrenamiento:** fijo semanal, $25.000 por persona, con asistencia variable.

**Objetivo:** que el admin pueda poner un precio distinto al de lista en un turno o en un fijo. Los fijos guardan ese precio y no hay que cargarlo cada semana. Los turnos por persona se cobran como una cuenta abierta: cobrando a cada persona, o con un cobro único repartido en varios medios de pago, y después se cierran.

## 2. Objetivos

| ID | Objetivo | Severidad | Estado |
| --- | --- | --- | --- |
| O1 | El admin carga un turno o fijo **sin cargo**: ocupa la cancha, vale $0, no figura como deuda ni suma ingresos. | crítica | pendiente |
| O2 | El admin carga un fijo **por persona** (precio por persona y cantidad habitual) y cada turno que se genera hereda ese precio, sin volver a cargarlo. | crítica | pendiente |
| O3 | En un turno por persona, el admin **cobra a una persona** (nombre opcional, monto sugerido = precio por persona, medio) y ve la lista de quién pagó; cada cobro entra en la caja del día. | crítica | pendiente |
| O4 | En un turno por persona, el admin hace un **cobro único** con varias líneas de medio de pago (por ejemplo $100.000 MP + $25.000 efectivo), con un total sugerido según la cantidad de personas, y **cierra** la cuenta. | crítica | pendiente |
| O5 | Solo el admin puede poner o cambiar un precio especial; un operador o profe no puede hacerlo ni desde la app ni directo contra la base. | crítica | pendiente |
| O6 | El admin carga un turno o fijo con **monto fijo** a mano, que después se cobra igual que un turno normal. | media | pendiente |
| O7 | La planilla (escritorio y celular) muestra el precio especial: "Sin cargo", "$10.000 c/u · 3 pagaron · $30.000" o "Cerrado · 6 · $150.000", nunca "Pendiente" para sin cargo o por persona. | media | pendiente |
| O8 | El cierre del día no cuenta sin cargo ni por persona como "falta cobrar" y avisa cuántos turnos por persona quedaron sin cerrar. | media | pendiente |
| O9 | El admin cambia el precio especial de un fijo y el cambio se aplica a los turnos futuros que todavía no tienen cobros. | media | pendiente |
| O10 | El reporte mensual suma lo cobrado en turnos por persona y monto fijo según su tipo de turno, y los sin cargo no suman. | baja | pendiente |

## 3. Decisiones

- Solo el admin usa precio especial por ahora (decidido por Mauricio). No se abre al operador.
- El precio especial vive en el **turno y en el fijo**, no en la configuración del club ni en "tarifas guardadas". Las tarifas guardadas se descartan por ahora: el fijo ya evita recargar el precio cada semana.
- Modos: `lista` (como hoy), `sin_cargo`, `por_persona` y `monto_fijo`. "También da clases" queda descartado: sin cargo cubre las clases del dueño.
- En un turno **por persona**, `price` es lo cobrado: arranca en $0, sube con cada cobro y queda fijo al cerrar. El precio por persona y la cantidad habitual van en columnas propias. Se descarta usar precio × cantidad como deuda, porque la asistencia varía.
- Un turno por persona abierto **no es deuda**. Queda "abierto" hasta que el admin lo cierra; no se cierra solo al terminar el día (decidido por Mauricio, 2026-11-24). El cierre del día muestra un aviso.
- Un turno **sin cargo** nace pagado (`payment_status = 'pagada'`, sin registro de cobro), igual que hoy un turno de $0 al cobrarlo.
- Los cobros por persona se guardan en `payments` con un tipo nuevo `persona` y el nombre de quien pagó (opcional). Se descarta crear una tabla aparte para no duplicar la lógica de caja y reportes.
- El cobro único se registra como varias filas de `payments` (una por medio de pago) y cierra la cuenta en la misma transacción.
- Cerrar una cuenta se puede deshacer: el admin la reabre (decidido por Mauricio, 2026-11-24).
- El nombre de quien paga se elige de los jugadores cargados o se escribe a mano (supuesto del asistente, sin objeción).
- Las pruebas se hacen en un club de prueba propio creado desde localhost (decidido por Mauricio, 2026-11-24), no en The Garden Tenis.
- El cambio de precio de un fijo afecta solo turnos futuros (desde hoy) sin cobros. Los ya cobrados no se tocan.
- La regla "solo admin" se controla en la base con un trigger, además de la UI. Los turnos que genera `ensure_series_until` heredan el modo del fijo y quedan permitidos aunque los genere un no admin al abrir la planilla.
- Dobles en varias canchas a la vez: un fijo por cancha, cada uno con su cuenta. Se descarta agrupar canchas.

Fuera de alcance: tarifas guardadas reutilizables, precio especial en el portal público y en el buscador de disponibilidad, cobro por persona para operador o profe, agrupar varias canchas en una sola cuenta, y cierre automático de cuentas abiertas.

## 4. Fases

### Fase 1 — Base de datos: modos de precio, cobros por persona y permisos

**Entrega:** esquema, generación de fijos y reglas en la base listas, sin cambios visibles en la app (todo turno existente queda en `lista`). Cubre la parte de datos de O1, O2, O5, O6 y O9.

**Contratos (migración `0033_special_pricing.sql` + `supabase/rollback/0033_special_pricing.sql`):**
- `reservations`: `pricing_mode text not null default 'lista' check (pricing_mode in ('lista','sin_cargo','por_persona','monto_fijo'))`, `unit_price numeric null`, `expected_people smallint null`, `closed_at timestamptz null`, `closed_by uuid null references auth.users(id)`. Checks: `por_persona` ⇒ `unit_price > 0`; `sin_cargo` ⇒ `price = 0`.
- `reservation_series`: `pricing_mode` (mismo check), `custom_price numeric null` (monto fijo), `unit_price numeric null`, `expected_people smallint null`.
- `payments.kind`: se agrega `'persona'`. Nueva columna `payer_name text null`.
- `ensure_series_until` (última versión en `0028_approval_rules.sql`): según el modo del fijo, `lista` = cálculo actual; `sin_cargo` = price 0 y `payment_status 'pagada'`; `monto_fijo` = `custom_price`; `por_persona` = price 0 y copia `unit_price` y `expected_people`.
- Trigger `enforce_special_pricing_admin` en `reservations` y `reservation_series` (insert/update): si el modo no es `lista` o cambian `unit_price`/`custom_price`, exige `is_admin(club_id)`, salvo inserts de turnos con `series_id` cuyo modo coincide con el del fijo.
- RPC `register_person_payments(p_reservation_id uuid, p_lines jsonb, p_close boolean, p_people int)`: solo admin; turno activo, `por_persona` y abierto; inserta una fila `persona` por línea (`amount > 0`, `method` en efectivo/mercado_pago, `payer_name` opcional), recalcula `price` como la suma de cobros no liberados y, si `p_close`, fija `closed_at`/`closed_by`, `payment_status = 'pagada'` y guarda `expected_people = p_people` como asistencia real.
- RPC `reopen_person_reservation(p_reservation_id uuid)`: solo admin; limpia `closed_at` y vuelve a `pendiente`.
- RPC `update_series_pricing(p_series_id uuid, p_mode text, p_custom_price numeric, p_unit_price numeric, p_expected_people int)`: solo admin; actualiza el fijo y los turnos con `date >= hoy del club`, activos y sin cobros.

**Tests (antes del código):** el proyecto no tiene corredor de tests; se usa SQL en transacción revertida, como se verificaron 0026–0028. Archivo `supabase/tests/0033_special_pricing.sql` (`begin … rollback`) con un caso por regla:
- Un fijo `sin_cargo` genera turnos con precio 0 y pagados.
- Un fijo `por_persona` genera turnos con `unit_price` y precio 0; uno `monto_fijo` usa `custom_price`.
- Un operador no puede insertar ni actualizar un turno o fijo con modo distinto de `lista` (falla con 42501), pero sí puede disparar la generación de un fijo especial.
- `register_person_payments` con dos líneas (MP + efectivo) suma el precio; con `p_close` lo cierra; sobre un turno cerrado o de otro modo falla.
- `update_series_pricing` no toca turnos pasados ni turnos con cobros.

**Tareas:**
- [x] Escribir `supabase/tests/0033_special_pricing.sql` con los casos de arriba (patrón: verificación transaccional usada para 0026–0028).
- [x] Migración `0033_special_pricing.sql` y su rollback (patrón: `0032_blocked_hours_and_profe_settlement.sql` y `supabase/rollback/`).
- [x] Reescribir `ensure_series_until` partiendo de la versión de `0028_approval_rules.sql`.
- [x] RPCs con el patrón de `settle_profe_reservations` (0032): `is_admin`, validaciones con errcode y `for update`.
- [x] Tipos en `lib/reservations.ts` (`PricingMode`, campos nuevos en `Reservation`, `ReservationSeries` y `Payment`).
- [x] Aplicar la migración en `ddzxywqtnmibrctevmew` solo con OK de Mauricio y correr el SQL de tests. (Aplicada el 2026-11-24 con permiso de Mauricio; tests ok; los 136 turnos de fijos existentes coinciden con `list_price_for`.)
- [x] Verificar tipos, lint y tests del proyecto. (tsc verde; el proyecto no tiene ESLint configurado.)

### Fase 2 — Cargar turnos y fijos con precio especial

**Entrega:** el admin elige el modo de precio al crear o editar un turno o fijo, y puede cambiar el precio de un fijo. Cubre O1, O2, O5, O6 y O9.

**Contratos:**
- Formulario del turno (`reservation-form.tsx`), sección **Precio**, visible solo para el admin: "De lista ($X)" · "Sin cargo" · "Por persona" (precio por persona + cantidad habitual) · "Monto fijo" ($). Validado con Zod y con mensajes en español.
- `createReservationAction` / `updateReservationAction` / `createSeries` (`app/dashboard/reservas/actions.ts`): reciben `pricing_mode`, `unit_price`, `expected_people` y `custom_price`; `prepareReservation` usa `quotePrice` solo en modo `lista`.
- Detalle del turno de un fijo: acción "Cambiar precio del fijo" (admin) que llama a `update_series_pricing`.

**Tests (TDD):** sin corredor de tests en el proyecto. La regla de cálculo se centraliza en una función pura `priceForMode` en `lib/pricing.ts` y se verifica con un script `scripts/verify-special-pricing.mjs` (patrón: `scripts/verify-reservations.mjs`), solo con lectura contra el club real:
- `priceForMode`: lista = `quotePrice`, sin cargo = 0, monto fijo = el monto, por persona = 0.

**Tareas:**
- [x] Reglas de precio en `lib/special-pricing.ts` (`resolvePricing`, sin dependencias) y su verificación `node scripts/verify-special-pricing.ts` (13 casos, todo OK).
- [x] Sección Precio en `reservation-form.tsx` (componentes de `components/ui/`, toggle como el de cancha en `mobile-schedule.tsx`), schema Zod y textos en voseo.
- [x] Server actions: aceptar y validar los campos nuevos, y rechazar modo especial si quien carga no es admin (además del trigger).
- [x] "Cambiar precio del fijo" en `reservation-detail-panel.tsx`.
- [x] Verificar tipos, lint y tests del proyecto. Probado en el club de pruebas: fijo por persona ($10.000 × 4, 8 fechas), cambio de precio del fijo a $12.000 y turno sin cargo (pagado, sin cobros).

### Fase 3 — Cobrar por persona, cobro único y cerrar

**Entrega:** en el detalle de un turno por persona, el admin cobra de a uno o en un cobro único con varios medios, ve quién pagó y cierra o reabre la cuenta. Cubre O3 y O4.

**Contratos:**
- Panel del turno (`reservation-detail-panel.tsx`) en modo `por_persona`:
  - Encabezado "$10.000 por persona · 3 pagaron · $30.000".
  - Lista de cobros: nombre (o "Sin nombre"), monto y medio.
  - **Cobrar a una persona:** nombre opcional (con `people-combobox`), monto (default precio por persona) y medio.
  - **Cobro único y cerrar:** cantidad de personas → total sugerido (precio por persona × cantidad, editable), una o más líneas medio + monto que deben sumar el total, y Confirmar (cobra y cierra).
  - **Cerrar sin cobrar más** (si ya cobró de a uno) y **Reabrir** (si está cerrado).
- Server actions nuevas `registerPersonPaymentsAction` y `reopenPersonReservationAction`, con botón de estado "procesando" y bloqueo contra doble envío (`components/processing-button.tsx`, como en `74c7680`).
- Sin cargo: el panel muestra "Sin cargo" y no ofrece cobrar.

**Tests (TDD):** agregar a `supabase/tests/0033_special_pricing.sql`:
- Las líneas que no suman el total sugerido se aceptan (el total lo define el admin), pero cada línea debe ser mayor a 0.
- Un turno reabierto vuelve a aceptar cobros y no duplica los anteriores.

**Tareas:**
- [x] UI de cuenta por persona en `reservation-detail-panel.tsx` (patrón de los botones de cobro actuales, líneas 295–335).
- [x] Diálogo "Cobro único" con líneas dinámicas (`react-hook-form` `useFieldArray` + Zod).
- [x] Server actions con el patrón de `registerPaymentAction` (validación, permisos y auditoría con `lib/audit.ts`).
- [x] Verificar tipos, lint y tests del proyecto. Probado en el club de pruebas: cobro a Ana $12.000 MP, cobro único de 5 personas repartido $30.000 efectivo + $18.000 MP con cierre (5 personas · $60.000), reabrir sin duplicar cobros; Caja suma $30.000 efectivo y $30.000 MP.

### Fase 4 — Planilla, cierre del día y reportes

**Entrega:** el precio especial se ve bien en la planilla y no distorsiona el cierre del día ni el reporte mensual. Cubre O7, O8 y O10.

**Contratos:**
- `paymentSummary` (`lib/reservation-tone.ts`): "Sin cargo"; abierto: "$10.000 c/u · 3 pagaron · $30.000"; cerrado: "Cerrado · 6 · $150.000"; monto fijo: como hoy.
- `lib/day-close.ts`: `amountDue` devuelve 0 para `sin_cargo` y `por_persona`; nuevo `openPerPersonCount`. El texto de WhatsApp agrega "turnos por persona sin cerrar: N".
- `lib/monthly-report.ts`: los cobros `persona` cuentan como ingreso del tipo de turno (no se saltean como `saldo`).

**Implementado (desvío):** la planilla muestra "$12.000 c/u · cobrado $60.000" (o "Abierta" sin cobros) y, cerrada, "Cerrada · 5 personas · $60.000". No se cuenta "N pagaron" porque un cobro único en varios medios genera varias líneas y no equivale a personas. El reporte mensual ya sumaba los cobros `persona` (solo saltea `saldo`). Las funciones de planilla y cierre importan alias `@/`, así que se verificaron con `tsc` y en el club de pruebas (planilla del 1/12: "Sin cargo" y "$12.000 c/u · cobrado $60.000"), no con el script.

**Tests (TDD):** casos en `scripts/verify-special-pricing.mjs` sobre las funciones puras (`paymentSummary`, `summarizeDayClose` y el agrupado del reporte mensual) con datos armados en memoria:
- Un turno sin cargo y uno por persona abierto no suman a `dueCount`.
- Los cobros `persona` suman a ingresos por origen.

**Tareas:**
- [ ] `paymentSummary` y su uso en `schedule-grid.tsx` y `mobile-schedule.tsx`.
- [ ] `day-close` y Reportes (aviso de cuentas abiertas).
- [ ] `monthly-report` con el tipo `persona`.
- [ ] Verificar tipos, lint y tests del proyecto.

## 5. Pruebas de aceptación

Se corren en http://localhost:3000 con el club de prueba creado para esto (ver `.claude/test-club.md`, sin contraseña). The Garden Tenis tiene datos reales: no se usa para pruebas.

#### P1 — Clase del dueño sin cargo
- Objetivo: O1 (crítica)
- Tipo: navegador
- Pasos: 1. Como admin, crear un fijo martes 8–9 h Cancha 4 a nombre "Clase Diego" con Precio "Sin cargo". 2. Abrir la planilla de los próximos dos martes. 3. Ver Caja y Reportes (cierre del día).
- Esperado: el turno aparece todos los martes con "Sin cargo", sin botón de cobrar; no suma a "falta cobrar" ni a ingresos.
- Estado: pendiente

#### P2 — Fijo por persona heredado
- Objetivo: O2 (crítica)
- Tipo: navegador
- Pasos: 1. Crear fijo "Dobles jubilados" martes 10–12 h Cancha 3, por persona $10.000, cantidad habitual 4. 2. Navegar semana a semana tres martes adelante.
- Esperado: cada martes muestra "$10.000 c/u · 0 pagaron · $0" sin haber cargado el precio otra vez.
- Estado: pendiente

#### P3 — Cobro por persona
- Objetivo: O3 (crítica)
- Tipo: navegador
- Pasos: 1. En el turno de P2, "Cobrar a una persona": Ana, $10.000, MP. 2. Otra persona sin nombre, $10.000, efectivo. 3. Ver Caja del día.
- Esperado: el panel lista los dos cobros y el turno muestra "2 pagaron · $20.000"; Caja suma $10.000 MP y $10.000 efectivo.
- Estado: pendiente

#### P4 — Cobro único con varios medios y cierre
- Objetivo: O4 (crítica)
- Tipo: navegador
- Pasos: 1. Fijo "Entrenamiento" por persona $25.000. 2. En un martes, "Cobro único y cerrar": 5 personas (sugiere $125.000), líneas $100.000 MP + $25.000 efectivo. 3. Ver planilla y Caja. 4. Reabrir y volver a cerrar.
- Esperado: el turno queda "Cerrado · 5 · $125.000"; Caja registra $100.000 MP y $25.000 efectivo; reabrir no duplica cobros.
- Estado: pendiente

#### P5 — Solo el admin
- Objetivo: O5 (crítica)
- Tipo: seguridad
- Pasos: 1. Como operador, abrir el formulario de turno. 2. Intentar con el cliente de Supabase del navegador un `update` de `pricing_mode` y una llamada a `register_person_payments`. 3. Como operador, abrir la planilla con un fijo por persona sin generar.
- Esperado: el operador no ve la sección Precio; la base rechaza la escritura y el RPC (42501); la generación del fijo funciona igual.
- Estado: pendiente

#### P6 — Monto fijo
- Objetivo: O6 (media)
- Tipo: navegador
- Pasos: 1. Crear un turno con Monto fijo $15.000. 2. Cobrar total.
- Esperado: valor $15.000, "Pendiente" hasta cobrar y "Pagado" después, igual que un turno normal.
- Estado: pendiente

#### P7 — Planilla en celular y escritorio
- Objetivo: O7 (media)
- Tipo: visual
- Pasos: 1. Con los turnos de P1–P4, ver la planilla en escritorio y en 375 px.
- Esperado: textos "Sin cargo", "c/u · N pagaron" y "Cerrado · N" legibles, sin "Pendiente" en esos turnos.
- Estado: pendiente

#### P8 — Cierre del día
- Objetivo: O8 (media)
- Tipo: funcional
- Pasos: 1. Dejar abierto el turno de P3 y cerrado el de P4. 2. Ver el cierre del día en Reportes y el texto de WhatsApp.
- Esperado: "falta cobrar" no incluye esos turnos; aparece "turnos por persona sin cerrar: 1".
- Estado: pendiente

#### P9 — Cambio de precio del fijo
- Objetivo: O9 (media)
- Tipo: navegador
- Pasos: 1. En el fijo de P2 (con un martes ya cobrado), "Cambiar precio del fijo" a $12.000.
- Esperado: los martes futuros sin cobros muestran $12.000; el martes con cobros y los pasados quedan como estaban.
- Estado: pendiente

#### P10 — Reporte mensual
- Objetivo: O10 (baja)
- Tipo: funcional
- Pasos: 1. Con los cobros de P3, P4 y P6, abrir el reporte mensual.
- Esperado: los ingresos por turnos incluyen esos cobros; P1 no suma nada.
- Estado: pendiente

## Preguntas abiertas

Ninguna. Respondidas por Mauricio el 2026-11-24: el admin cierra y puede reabrir las cuentas; las pruebas van en un club de prueba propio.
