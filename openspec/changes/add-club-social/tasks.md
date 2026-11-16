## 1. Base de datos

- [x] 1.1 `0029_club_social.sql` (columnas con check) y rollback; aplicada el 2026-11-15 en `ddzxywqtnmibrctevmew`

## 2. Aplicación

- [x] 2.1 `clubSocialSchema` (WhatsApp solo números; Instagram usuario, "@usuario" o link) y `updateClubSocialAction` (admin, auditada)
- [x] 2.2 Tarjeta "Redes del club" en Políticas
- [x] 2.3 Línea de contacto al pie de los turnos libres (Hoy y buscador) y número del club en "Avisar al admin por WhatsApp"

## 3. Verificación

- [x] 3.1 En localhost: WhatsApp con letras y link de Instagram con espacio se rechazan con mensaje claro (sin guardar nada en el club real)
- [ ] 3.2 Guardar el WhatsApp y el Instagram reales del club y copiar los turnos libres — lo hace Mau con los datos del club
- [x] 3.3 `pnpm exec tsc --noEmit` y `pnpm build`
