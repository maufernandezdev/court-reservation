# Tasks — add-court-management

## 1. Base de datos (Supabase)

- [x] 1.1 Crear `supabase/migrations/0001_courts.sql` con el DDL de la tabla `courts`, índice en `user_id` y políticas RLS de select/insert por `auth.uid()` según design.md, y verificar que el archivo existe y el SQL es válido
- [x] 1.2 Aplicar el SQL en el SQL Editor del dashboard de Supabase y verificar que la tabla `public.courts` aparece en Table Editor con RLS habilitado

## 2. Hook de datos

- [x] 2.1 Crear `hooks/use-courts.ts` exponiendo `{ courts, isLoading, createCourt }` usando el browser client de `lib/supabase/client.ts` (select filtrado por usuario vía RLS, insert con `user_id` del session user), y verificar que `pnpm exec tsc --noEmit` pasa
- [x] 2.2 Tipar la cancha (p. ej. `types/court.ts` o en el mismo hook) con `id`, `user_id`, `name`, `type` (`'futbol' | 'tenis' | 'padel'`) y `created_at`, y verificar que el tipo se importa sin errores

## 3. UI del dashboard

- [x] 3.1 Crear `app/dashboard/canchas/page.tsx` con AuthGuard, estado vacío (mensaje + CTA "Crear tu primera cancha") y lista de canchas mostrando nombre y label de tipo ("Fútbol", "Tenis", "Pádel"), y verificar que la ruta `/dashboard/canchas` renderiza con el usuario de prueba
- [x] 3.2 Agregar el formulario de alta en un Dialog de shadcn/ui con react-hook-form + zodResolver, schema `courtSchema` (name requerido no vacío, type requerido con `z.enum(['futbol','tenis','padel'])`), mensajes de error en español, y verificar que enviar el formulario vacío muestra los errores y no llama a Supabase
- [x] 3.3 Conectar el submit con `createCourt`, cerrar el dialog y refrescar la lista tras el alta, y verificar que la cancha nueva aparece sin recargar la página
- [x] 3.4 Agregar el item "Canchas" (icono `LandPlot` de lucide) en la sidebar de `app/dashboard/layout.tsx`, y verificar que navega a `/dashboard/canchas` y queda marcado como activo

## 4. Verificación integral

- [x] 4.1 Con `test@user.com`, crear al menos dos canchas de distinto tipo y verificar que ambas se listan y persisten tras recargar la página
- [x] 4.2 Crear un segundo usuario, crear una cancha con él y verificar que `test@user.com` no la ve (aislamiento RLS), y viceversa
- [x] 4.3 Verificar que un visitante sin sesión es redirigido a `/login` al intentar abrir `/dashboard/canchas`
- [x] 4.4 Correr `pnpm build` y verificar que compila sin errores
- [x] 4.5 Documentar en `docs/PROJECT_DOCUMENTATION.md` que la tabla `courts` se aplica manualmente desde `supabase/migrations/` hasta adoptar la CLI

## 5. Grilla de reservas: canchas reales + filtro por tipo

- [ ] 5.1 Refactor de `app/dashboard/reservas/page.tsx` para que las columnas de la grilla vengan de `useCourts()` (reemplazando las canchas mock), con estado de carga (spinner), y verificar que la grilla renderiza las canchas reales del usuario de prueba
- [ ] 5.2 Agregar estado vacío en `/dashboard/reservas` cuando el usuario no tiene canchas (mensaje + botón que navega a `/dashboard/canchas`), y verificar que se muestra con un usuario sin canchas
- [ ] 5.3 Agregar el filtro por tipo (Select con Todas/Fútbol/Tenis/Pádel) que filtra las columnas de la grilla, y verificar que al elegir "Pádel" solo quedan columnas de canchas de pádel y con "Todas" vuelven todas
- [ ] 5.4 Correr `pnpm build` y verificar que compila sin errores
