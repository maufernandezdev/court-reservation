## 1. Base de datos

- [x] 1.1 Migración `0018_club_logo.sql` (`clubs.logo_path`, `logo_updated_at`, check de la ruta) y `supabase/rollback/0018_down.sql`; probar subir → bajar → subir y que otra ruta se rechace

## 2. Servidor

- [x] 2.1 `app/api/clubs/[clubId]/logo/route.ts` (solo miembros) y acciones `uploadClubLogoAction` / `removeClubLogoAction` (solo admin) con validación del archivo

## 3. Pantallas

- [x] 3.1 `lib/image.ts` compartido (recorte y modo "contener"), tarjeta "Logo del club" en Políticas, y el logo en el bloque del club del menú (escritorio, celular y selector de club) para todos los roles
- [x] 3.2 Verificar en el navegador a 1440 y 390 px: subir, cambiar y quitar como admin; el operador ve el logo; archivo no válido; la ruta del logo de otro club responde 404

## 4. Cierre

- [x] 4.1 `pnpm exec tsc --noEmit` y `pnpm build` pasan; actualizar README y `docs/PROJECT_DOCUMENTATION.md`, y agregar la prueba manual a `docs/next-steps.md`
- [x] 4.2 Aplicar `0018` en la base real y verificar las columnas — aplicada el 2026-10-18
