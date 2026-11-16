## 1. Base de datos

- [x] 1.1 `0028_approval_rules.sql` y rollback: tabla `approval_rules` (lee el equipo, escribe el admin), estados nuevos, columnas de decisión, índice de slot con pendientes, `requires_approval`, trigger `enforce_reservation_approval`, vista actualizada y `ensure_series_until` con pendientes
- [x] 1.2 Aplicar en la base real — aplicada el 2026-11-15 en `ddzxywqtnmibrctevmew`
- [x] 1.3 Verificar en una transacción que se deshace (como admin, operador y organizador simulados): admin en franja queda activo, operador en franja queda por confirmar y fuera queda activo, el pendiente bloquea el lugar, el operador no confirma, el admin sí; además el organizador no lee turnos, cobros, precios ni auditoría y la vista le da el precio en null. Sin filas residuales

## 2. Aplicación

- [x] 2.1 `lib/approval.ts` (franjas, `requiresApproval`, textos, link de WhatsApp) y reglas sembradas para el formulario
- [x] 2.2 Estados en `lib/reservations.ts`; pendientes ocupan el lugar en planilla, Hoy, disponibilidad, buscador y choques
- [x] 2.3 Acciones: confirmar y rechazar (admin, auditadas), sin cobros en pendientes ni rechazados, fijo en franja solo admin, aviso al guardar un turno pendiente
- [x] 2.4 Pantallas: aviso en el formulario, rayado y leyenda en la planilla, `ApprovalBox` en el detalle, "Para confirmar" / "Tus pedidos" en Hoy, contador en el menú, franjas en Políticas

## 3. Verificación

- [x] 3.1 Políticas a 1440 px con la tarjeta de franjas
- [ ] 3.2 Recorrido en el navegador creando una franja y un turno como operador, confirmarlo y rechazar otro — pendiente de definir dónde probar (club real o club de prueba)
- [x] 3.3 `pnpm exec tsc --noEmit` y `pnpm build`
