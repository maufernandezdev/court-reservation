## 1. Cálculos

- [x] 1.1 `lib/reports.ts`: períodos (`hoy`, `ayer`, `7d`, `mes`) en horario de Buenos Aires y `buildReport` (indicadores, ocupación, por cancha, horarios, tipos, alertas, texto de WhatsApp); verificar con pruebas de las funciones (ocupación del 50 %, saldo a favor fuera de los ingresos, cancha sin turnos, mes hasta hoy)

## 2. Pantalla

- [x] 2.1 `app/dashboard/reportes/page.tsx` como Server Component (solo admin): consultas paginadas de turnos y cobros, selector de período (`components/reports/period-tabs.tsx`), indicadores, tabla por cancha, horarios más pedidos, tipos de turno, "Para revisar" y resumen con botón de copiar (`components/reports/copy-summary.tsx`); sin mocks ni stock
- [x] 2.2 Verificar en el navegador a 1440 y 390 px con datos de prueba: cada período, un operador sin acceso, deporte sin precio, deuda de un turno pasado y copiado del resumen

## 3. Cierre

- [x] 3.1 `pnpm exec tsc --noEmit` y `pnpm build` pasan; actualizar README y `docs/PROJECT_DOCUMENTATION.md`; agregar la prueba manual a `docs/next-steps.md`
