# Plan: pruebas pendientes de "sin superposición de turnos"

Estado: **pendiente de revisión por Mauricio**. Contexto: commit `f1369a6` (migración `0034_no_court_overlap`).

## Qué ya está probado (2026-11-24)

- **Base**, en transacciones revertidas y sin residuos. Se probó con el acceso total a la base y con los roles admin, profe, operador y organizador (rol de Juanjo cambiado solo dentro de la transacción).
  - Rechaza turnos superpuestos de tipo estándar, profe, torneo, cortesía y por confirmar.
  - Rechaza mover un turno, cambiarle la cancha, estirarlo o reactivar uno cancelado si queda encima de otro.
  - Permite los turnos pegados sin pisar y los cancelados en el mismo horario.
- **Interfaz, solo como admin:**
  - En el alta, el formulario ofrece solo las canchas libres y acorta la duración.
  - Editar a Leo del jueves a un horario sin cancha libre no se guardó.
- **Datos:** no había superposiciones previas en ningún club.

## Pruebas que faltan

Hacerlas en el "Club de Pruebas Altenor" o con datos marcados "PRUEBA" y borrarlos al final. Si alguna logra superponer un turno, se borra el turno superpuesto y se corrige el hueco.

### 1. Interfaz con otros roles (necesita que Mauricio entre con cada usuario)

| # | Usuario | Prueba | Esperado |
|---|---|---|---|
| 1.1 | Profe | Crear un turno propio encima de otro profe | La cancha ocupada no aparece o sale "Esa cancha ya está reservada en ese horario" |
| 1.2 | Profe | Editar su turno: moverlo o estirarlo encima de otro | No se guarda |
| 1.3 | Operador (crear cuenta de prueba) | Alta estándar encima de un fijo | No se guarda |
| 1.4 | Operador | Mover o estirar un turno ajeno encima de otro | No se guarda |
| 1.5 | Organizador (crear cuenta de prueba) | Crear un torneo encima de un turno | No se guarda |
| 1.6 | Organizador | Mover un torneo existente encima de un turno | No se guarda; queda pendiente, porque en la base el insert directo lo frenó RLS |

### 2. Flujos de la app que no se recorrieron

| # | Flujo | Prueba | Esperado |
|---|---|---|---|
| 2.1 | Fijo nuevo | Crear un fijo cuya fecha 3 o 4 choque con un turno suelto | Esa fecha se saltea y se avisa; no hay superposición |
| 2.2 | Convertir en fijo | Pasar a fijo un turno suelto con choques en semanas siguientes | Igual que 2.1 |
| 2.3 | Generar fechas | Abrir la planilla cuando `ensure_series_until` genera fechas nuevas y alguna choca | Se saltea y no falla la carga |
| 2.4 | Aprobar | Aprobar un turno "por confirmar" | Sigue ocupando el mismo hueco; no puede haber otro encima |
| 2.5 | Precio especial | Turno sin cargo, por persona o monto fijo encima de otro, como admin | Rechazado |
| 2.6 | Concurrencia | Dos usuarios guardan el mismo hueco a la vez (dos pestañas) | Uno se guarda y el otro ve "cancha ocupada" |
| 2.7 | Mensaje | Forzar el rechazo de la base (por ejemplo con 2.6) | Se ve "Esa cancha ya está reservada en ese horario" y no "No se pudo guardar" |

### 3. Base

| # | Prueba | Esperado |
|---|---|---|
| 3.1 | Turno que cruza la medianoche (si se permitiera, por ejemplo 22:30 + 60 min) | Definir la regla; hoy el rango termina en el minuto 1410 + 60 y no se compara con el día siguiente |
| 3.2 | Consulta periódica de superposiciones (la de esta sesión) en todos los clubes | 0 filas |

## Cierre

- [ ] Ejecutar 1.x con Mauricio.
- [ ] Ejecutar 2.x y 3.x.
- [ ] Borrar cuentas y turnos de prueba.
- [ ] Anotar resultados en este archivo.
