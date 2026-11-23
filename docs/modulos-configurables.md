# Módulos a volver configurables por club

> Anotado el 23/11/2026. Hoy estos comportamientos están armados a la medida de The Garden Tenis, el primer
> club en usar Altenor. Quedan fijos así por ahora; cuando se sumen otros clubes conviene que cada uno los
> elija desde Políticas (o un apartado "Cómo trabaja el club").

| Módulo | Cómo funciona hoy (fijo) | Qué haría falta configurar |
| --- | --- | --- |
| **Liquidación de profes** (`/dashboard/liquidaciones`) | El profe le paga al club sus turnos de profe, por semana (lunes a domingo). El cobro entra a la caja del día en que se paga. | Sentido (el profe paga al club / el club le paga al profe / ninguno); período (semanal, quincenal, mensual, día de cierre); si se cobra por turno al momento o solo en la liquidación; precio por hora del profe vs. porcentaje de la clase. |
| **Horarios bloqueados** (Políticas, tabla `approval_rules`) | En una franja bloqueada solo el admin carga turnos; el resto ve un aviso para comunicarse con él por WhatsApp. | Elegir entre bloqueo (hoy) o "pedido por confirmar" (lo que había antes de la migración 0032: el turno ocupa el lugar y el admin lo confirma o rechaza); qué roles quedan exceptuados. |
| **Categorías de salida de Caja** (`lib/cash.ts`) | Empleado, Proveedor, Gasto general, Retiro. "Liquidación de profe" quedó oculta porque en este club paga el profe. | Categorías propias del club; si "A quién" es obligatorio y para cuáles. |
| **Reportes** (`/dashboard/reportes`) | Cierre del día + reporte mensual (ingresos por origen, egresos por destino, balance). | Qué secciones ver (el rendimiento por cancha, horarios y tipos que se quitó puede volver como opción); período del reporte; formato de exportación (PDF hoy; Excel/CSV). |
| **Productos** (`/dashboard/productos`) | Catálogo con nombre y precio, sin stock. | Control de stock y reposiciones; código de barras; quién puede vender. |
| **Equipo con o sin acceso** | Personas sin cuenta (empleados y profes) para pagarles; acceso por link de invitación. | Roles y permisos por club; alta masiva de cuentas. |
| **Medios de pago** | Efectivo y Mercado Pago (transferencia/otro solo para registros viejos). | Medios propios del club. |
