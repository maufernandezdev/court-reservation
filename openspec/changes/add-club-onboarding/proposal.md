> **Estado:** registrado (2026-10-06) como pendiente del rediseño `apply-saque-visual-design`. Ampliado (2026-10-12) con el flujo de invitaciones por link y la elección "crear mi club / me van a invitar".

## Why

Hoy el club no existe como entidad: es el id del usuario que se registró (`owner_id` en `memberships`, `user_id` en `courts` y `reservations`), y el nombre sale de una constante fija (`CLUB_NAME`). Además, cada persona que se registra queda automáticamente como admin de un club propio vacío, incluso si solo viene a trabajar como operador en el club de otro. Si el admin la saca del equipo, vuelve a entrar como admin de ese club vacío; si la invitan a dos clubes, la app elige sola el más reciente. Para instalar el producto en más de un club hace falta que el club sea una entidad propia, que quien se registra elija qué hacer y que el dueño pueda sumar a su equipo con un link.

## What Changes

- **Entidad club**: tabla `clubs` con nombre y ciudad. Canchas, reservas, cobros, saldos, políticas, auditoría y membresías pasan a colgar de `club_id` en lugar del id del dueño. **BREAKING** (esquema): se renombran `owner_id` / `user_id` (dueño) a `club_id` en todas las tablas del club.
- **Registro sin club automático**: se elimina el trigger que crea un club por cada usuario nuevo. **BREAKING** (comportamiento): después de registrarse y verificar el correo, la persona elige entre **"Crear mi club"** o **"Me van a invitar"**.
- **Alta del club** (canvas `AltaClub`, "Paso 2 de 3 — Tu club"): nombre, ciudad, deportes que se juegan y cuántas canchas de cada uno; crea el club, deja a la persona como admin, crea las canchas con valores por defecto y la lleva a Canchas para definir precio, duración y seña (paso 3).
- **Invitaciones por link**: en Equipo, el admin carga nombre, correo y rol; la app genera un link de invitación personal que se comparte con **"Enviar por WhatsApp"** (mensaje armado) o **"Copiar link"**. Las invitaciones pendientes se ven en Equipo y se pueden cancelar o regenerar. **BREAKING** (comportamiento): ya no se agrega a alguien buscando su correo entre los usuarios registrados.
- **Pantalla de ingreso por invitación** (`/invitacion/<token>`): muestra el club y el rol, con el correo invitado fijo. Si la persona ya tiene cuenta, ingresa su contraseña; si no, elige una contraseña ahí mismo y entra sin pasar por el registro ni confirmar el correo aparte. Al entrar queda como miembro del club.
- **Club activo y selector**: el menú muestra el nombre real del club. Si la persona es miembro de varios clubes, puede cambiar de club desde el bloque del club; todos los datos que ve son solo del club activo.
- **Migración de datos**: el club actual conserva todos sus datos y pasa a llamarse "Club Deportivo Central" (editable). Se eliminan los clubes vacíos que el trigger creó al registrarse (las personas que no pertenecen a otro club pasan por la bienvenida).
- **Nombre y ciudad editables** por el admin en Políticas ("Datos del club").
- **Fuera de alcance**: envío de la invitación por correo desde la app (queda para cuando haya un proveedor de correo propio; el link ya funciona igual si el admin lo pega en un correo), deportes nuevos más allá de fútbol, tenis y pádel, y la superficie de cancha (`add-court-surface`, postergado).

## Capabilities

### New Capabilities
- `club-onboarding`: elección posterior al registro ("Crear mi club" / "Me van a invitar"), alta del club con canchas iniciales y datos del club editables.
- `club-invitations`: invitaciones del admin por link (WhatsApp o copiar), estado y gestión de invitaciones pendientes, e ingreso al club desde el link con el correo invitado.
- `club-switcher`: club activo, nombre real en el menú, cambio de club para miembros de varios clubes y aislamiento de los datos al club activo.

### Modified Capabilities
<!-- `club-roles` (de `add-club-operations-foundation`) todavía no está archivada en `openspec/specs/`, así que no se puede escribir un delta MODIFIED. Su requisito "Invitación de miembros por el admin" queda reemplazado por `club-invitations`, y el escenario "Dueño existente migrado" por la migración de este cambio. Ver la última fase de tasks.md. -->

## Impact

- **Base de datos**: migración `0007` (tabla `clubs`, `club_invitations`, renombre a `club_id`, nuevas funciones `create_club`, `get_invitation`, `accept_invitation`, `my_pending_invitations`, RLS actualizado, se eliminan `handle_new_user` y `find_user_id_by_email`).
- **Servidor**: nueva variable `SUPABASE_SECRET_KEY` (solo servidor) para crear la cuenta del invitado ya confirmada; `getSessionContext` y `requireRole` resuelven el club activo.
- **Código**: todas las consultas y Server Actions filtran por `club_id` del club activo (`hooks/use-*.ts`, `app/dashboard/**/actions.ts`, `lib/*.ts`); `useMembership`; shell del panel; `app/register`, `app/verification-account`; nuevas rutas `/bienvenida`, `/bienvenida/club`, `/invitacion/[token]`; Equipo (`app/dashboard/miembros`) y Políticas (`app/dashboard/configuracion`).
- **Pruebas**: los usuarios de prueba (`TEST_ADMIN_*`, `TEST_OPERADOR_*`) se mantienen; cambia cómo se invita al operador.
