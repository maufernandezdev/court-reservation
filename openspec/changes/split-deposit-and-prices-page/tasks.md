## 1. Base de datos

- [x] 1.1 Migración `0015_deposit_by_audience.sql`: `deposit_*` → `public_deposit_*` (apagada) y `profe_deposit_*` con la configuración anterior, con las mismas restricciones; `supabase/rollback/0015_down.sql`; probar subir → bajar → subir en local y que los precios existentes conserven su seña como seña de profes

## 2. Lógica y acciones

- [x] 2.1 `lib/pricing.ts`: tipo `SportPrices`, esquema Zod con las dos señas (validaciones de porcentaje y valor por separado) y `depositFor(prices, kind, price)`; verificar con pruebas de la función (público apagado, profe fijo y %, torneo usa público, noche)
- [x] 2.2 Usar `depositFor` con el tipo de turno en `app/dashboard/reservas/actions.ts` (cobro de seña), `hooks/use-reservation-detail.ts`, `components/reservations/reservation-form.tsx` y el ejemplo de `app/dashboard/configuracion/page.tsx`; ajustar los textos ("no tiene seña configurada")
- [x] 2.3 `lib/audit.ts` y `app/dashboard/canchas/actions.ts` (`updateSportPricesAction`): campos nuevos, texto de Actividad y `revalidatePath` de Canchas; los registros viejos con `deposit_*` siguen leyéndose

## 3. Pantallas

- [x] 3.1 Modal `components/prices/prices-dialog.tsx` con el horario de la noche y una tarjeta de precios por tipo de cancha del club, con "Seña del público" y "Seña de profes"; mover `sport-prices-section` a `components/prices/`. Sin ruta ni entrada de menú propias (se había hecho como pantalla y se cambió a modal el 2026-10-18)
- [x] 3.2 `app/dashboard/canchas/page.tsx`: quitar los precios y el horario de la noche, dejar tarjetas con su resumen, "Nueva cancha" y el botón "Precios" que abre el modal; las tarjetas muestran la seña por audiencia
- [x] 3.3 Bienvenida del alta: `/dashboard/canchas?alta=1` abre el modal en un paso de bienvenida y "Siguiente" muestra los precios iniciales; al cerrar se limpia el parámetro
- [x] 3.4 Verificar en el navegador a 1440 y 390 px: Canchas sin formularios, modal de Precios con guardado de cada seña, turno estándar sin seña, turno de profe con seña, bienvenida → Siguiente → Listo sin reaparecer al recargar, y que `/dashboard/precios` no existe

## 4. Cierre

- [x] 4.1 `grep -rn "deposit_" app lib components hooks` solo con los nombres nuevos; `pnpm exec tsc --noEmit` y `pnpm build` pasan
- [x] 4.2 Actualizar README y `docs/PROJECT_DOCUMENTATION.md`, y agregar a `docs/next-steps.md` la prueba manual
- [x] 4.3 Aplicar `0015` en la base real y verificar las columnas — aplicada el 2026-10-18
