# saque — reservas de canchas para clubes

Plataforma para que un club (tenis, pádel, fútbol y más) gestione su planilla de turnos, cobros, cancelaciones con penalidad y equipo. "saque" es el nombre de trabajo del producto (se cambia en `lib/brand.ts`); el primer club que la usa es un club de tenis.

- **Diseño de referencia:** canvas https://claude.ai/artifact/HzX1cWWmfHrkUH27QnMidF
- **Notas, decisiones y pendientes:** [`docs/PROJECT_DOCUMENTATION.md`](docs/PROJECT_DOCUMENTATION.md)
- **Requerimientos del cliente:** [`docs/requerimientos_software_canchas.md`](docs/requerimientos_software_canchas.md)
- **Reglas para agentes de IA:** [`AGENTS.md`](AGENTS.md) y [`docs/architecture-guidelines.md`](docs/architecture-guidelines.md)

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui (`components/ui/`), íconos lucide
- Supabase: Auth (email + contraseña con confirmación por link), Postgres con RLS, migraciones en `supabase/migrations/`
- Formularios con `react-hook-form` + Zod; Server Actions para mutaciones
- **pnpm** como gestor de paquetes (no usar npm ni yarn)

## Puesta en marcha

1. Instalar dependencias:

   ```bash
   pnpm install
   ```

2. Crear `.env.local` con las variables del proyecto de Supabase:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
   # Solo servidor (nunca con prefijo NEXT_PUBLIC_): crea la cuenta del invitado al aceptar
   # una invitación. Supabase → Project Settings → API Keys → Secret keys.
   SUPABASE_SECRET_KEY=sb_secret_...
   # Solo servidor: fotos de perfil en Cloudflare R2 (token de API de R2 con
   # Object Read & Write solo sobre el bucket). Sin estas, el resto funciona.
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET_NAME=court-reservation
   # Solo para la CLI de Supabase (db push):
   SUPABASE_DB_PASSWORD=<password de la base>
   # Solo para pruebas automáticas (ver "Pruebas"):
   TEST_ADMIN_EMAIL=...
   TEST_ADMIN_PASSWORD=...
   TEST_OPERADOR_EMAIL=...
   TEST_OPERADOR_PASSWORD=...
   ```

3. Aplicar las migraciones (una vez por cambio de esquema) con la CLI de Supabase ya linkeada al proyecto:

   ```bash
   SUPABASE_DB_PASSWORD=... supabase db push
   ```

4. Levantar la app:

   ```bash
   pnpm dev
   ```

   Abrir http://localhost:3000. La raíz redirige al panel; el panel manda al login si no hay sesión y a la bienvenida si la persona todavía no pertenece a ningún club.

## Scripts

```bash
pnpm dev              # servidor de desarrollo (Turbopack)
pnpm build            # build de producción (también corre TypeScript)
pnpm start            # sirve la build
pnpm exec tsc --noEmit  # chequeo de tipos rápido

# Suscripciones (dueño del producto; usa SUPABASE_SECRET_KEY de .env.local)
node scripts/subscription-admin.mjs status <club>
node scripts/subscription-admin.mjs pay <club> --amount 15000 --cycle monthly [--mp-payment-id ID]
node scripts/subscription-admin.mjs plan <club> <inicial|club|gran_club>
```

**Suscripción de los clubes:** cada club tiene 30 días de prueba gratis y después paga por mes o por año según sus canchas (Inicial hasta 3, Club hasta 6, Gran Club sin tope; cuentan canchas de cualquier tipo). Vencido el período hay 5 días de gracia; pasados, el club queda en solo lectura (ve todo, no crea ni modifica nada) hasta que se registre el pago. Hoy los pagos los carga el dueño del producto con el script; el modelo ya está listo para el webhook de Mercado Pago.

## Funcionalidad

| Sección (menú) | Ruta | Quién la ve | Qué hace |
| --- | --- | --- | --- |
| Bienvenida | `/bienvenida` | sin club | Elegir "Crear mi club" o "Me van a invitar" (explica que hay que pedir el link al administrador) |
| Alta del club | `/bienvenida/club` | sin club | Nombre, ciudad y canchas por deporte; crea el club y lleva a Canchas, donde un modal de bienvenida guía la carga de los precios iniciales |
| Invitación | `/invitacion/<token>` | pública | Entrar al club desde el link: cuenta nueva (nombre, correo y contraseña), "Ya tengo cuenta" (correo y contraseña) o, con sesión iniciada, "Unirme al club" |
| Hoy | `/dashboard` | todos | Resumen del día (turnos, ocupación, cobrado, por cobrar), ahora en cancha, próximos turnos con cobro, huecos libres para WhatsApp |
| Planilla | `/dashboard/reservas` | todos | Grilla canchas × horarios (escritorio) o lista por cancha (celular); turnos estándar, de profe, de torneo y fijos; alta, edición, cobros, cancelación; buscador "¿Hay cancha?" |
| Caja | `/dashboard/caja` | admin | Lo cobrado en el día elegido, por método, con los movimientos |
| Canchas | `/dashboard/canchas` | admin | Las tarjetas de las canchas con su resumen de precios y seña, "Nueva cancha", por cancha editar (nombre y deporte) y dar de baja, y el botón "Precios" que abre el modal con el horario de inicio de la noche y, por tipo de cancha, precios público y profe de día y de noche, seña del público y seña de profes |
| Jugadores | `/dashboard/jugadores` | todos (el profe carga a sus alumnos y modifica solo los suyos) | Alta, edición, baja y búsqueda de jugadores (nombre, DNI, teléfono, correo); `/dashboard/socios` redirige |
| Mis turnos | `/dashboard/mis-turnos` | solo profesores | Sus turnos de profe en tres vistas: Hoy, Semana (lunes a domingo, con los fijos) e Historial por mes (con totales de turnos, horas y cancelados) |
| Equipo | `/dashboard/equipo` | admin | Personas del club, roles, color de cada profe, invitaciones por link (WhatsApp o copiar) y matriz de permisos |
| Políticas | `/dashboard/configuracion` | admin | Ventana de cancelación y penalidad, con ejemplo calculado; duración estándar de torneo; horario de apertura y cierre del club; logo del club (lo ve todo el equipo en el menú); nombre y ciudad del club |
| Mi perfil | `/dashboard/perfil` | todos (desde el nombre, abajo en el menú) | Nombre, foto, correo (con confirmación), contraseña y, para profes, su color en la planilla |
| Actividad | `/dashboard/actividad` | admin | Auditoría: quién creó, modificó, cobró o canceló, con filtros |
| Suscripción | `/dashboard/suscripcion` | admin | Plan del club, estado (prueba gratis, al día, en gracia, vencida), vencimiento, canchas usadas contra el límite del plan, planes e historial de pagos. El botón de pago dice "Próximamente" hasta integrar Mercado Pago. Un aviso en el panel (todos los roles) se muestra a 7 días o menos del vencimiento, en gracia y vencida |
| Reportes | `/dashboard/reportes` | admin | Cómo rindieron las canchas en Hoy, Ayer, Últimos 7 días o Este mes: ingresos cobrados (mismo criterio que Caja), turnos, ocupación, lo que falta cobrar, rendimiento por cancha, horarios más pedidos, tipos de turno, "Para revisar" (saldos sin cobrar, cancelaciones tardías, deportes sin precio, canchas sin turnos) y un resumen para WhatsApp con botón de copiar |
| Productos, Notificaciones | `/dashboard/...` | nadie por ahora | Ocultas con `lib/features.ts` (el código queda); su ruta redirige a Hoy |

**Clubes:** cada club es una fila de `clubs`, y todo lo demás (canchas, reservas, cobros, saldos, políticas, auditoría, equipo, invitaciones) cuelga de `club_id`. Registrarse no crea un club: quien se registra elige crear el suyo (queda como admin) o esperar una invitación. Una persona puede pertenecer a varios clubes y cambia de club desde el bloque del club en el menú (cookie `club_activo`); todas las pantallas leen solo el club activo.

**Invitaciones:** el admin elige solo el rol (operador o profesor) y, si quiere, una nota para reconocer el link, y lo comparte por WhatsApp o lo copia (vence a los 7 días, sirve una sola vez). Quien lo abre carga su nombre, su correo y una contraseña (la cuenta se crea ya confirmada) o ingresa con su cuenta, y entra con el rol invitado; nombre, correo y foto se cambian después en Mi perfil. Desde Equipo se puede generar un link nuevo (invalida el anterior) o cancelar la invitación. Un administrador nuevo se suma como operador y se asciende con el selector de rol. La app no manda correos.

**Roles** (`lib/roles.ts`): `admin` (todo), `operador` (planilla y cobros), `profesor` (ve la planilla, pero solo edita y cancela los turnos que creó él o que están a su nombre; no cobra ni cancela fuera de término ni turnos con cobros). Las reglas se aplican en las Server Actions (`requireRole`), en RLS y en triggers de la base.

**Duración y horario:** el club tiene un único horario de apertura y cierre (por defecto 09:00–22:00, en Políticas y en la bienvenida del alta). Los turnos empiezan cada 30 minutos. En Nueva reserva se elige **Desde** y **Hasta**: el fin se completa solo con 1 hora (en un torneo, con la duración de Políticas) y se puede cambiar de a 30 min hasta el cierre (máximo 6 h, sin pisar otro turno); el valor es el precio por hora × la duración. Las canchas no tienen duración ni horario propios.

**Tipos de turno:** estándar (público), profe (lo carga el profe con su cuenta o el staff eligiendo el profe; se ve con el color del profe) y torneo (2 a 4 jugadores; arranca en la duración estándar de Políticas y se puede cambiar). Las personas del turno se eligen con un buscador de jugadores (o se escriben si no están registrados); la primera es quien reserva. Un turno estándar o de profe puede ser **fijo**: se repite todas las semanas, cada fecha es un turno común (se cobra y se cancela aparte) y se da de baja desde una fecha.

**Precios:** por tipo de cancha (tenis, pádel, fútbol), con precio público y precio profe de día y de noche, y dos señas: la **del público** (turnos estándar y de torneo, apagada por defecto) y la **de profes** (turnos de profe), cada una fija o en %. Todo se ajusta en el modal Precios de Canchas. El club tiene un único horario de inicio de la noche (por defecto 18:00) y el precio se elige por la **hora de inicio** del turno: si empieza antes, todo a precio de día; si empieza a esa hora o después, todo a precio de noche (también en cada fecha de un turno fijo). El precio de noche es opcional: si se deja vacío (0), se cobra el de día. El valor queda **fijado en cada turno** al reservarlo (`reservations.price`), así un cambio de precios no altera turnos ya reservados; en una edición se recalcula si cambia la cancha, el tipo, la duración o la hora de inicio.

**Cobros y cancelaciones:** un turno pasa por `pendiente → señada → pagada` según los cobros registrados; "Cobrar total" cobra solo el saldo. Cancelar en término libera lo cobrado como saldo a favor; fuera de término se aplica la penalidad (% del turno): se retiene de lo cobrado y lo que falta queda como deuda (`lib/cancellation.ts` replica el cálculo del servidor).

## Estructura

```
app/
  login/ register/ verification-account/   acceso (con panel de marca)
  bienvenida/                               elección después del registro y alta del club
  invitacion/[token]/                       ingreso al club desde el link de invitación
  dashboard/
    layout.tsx                              resuelve el club activo (servidor) + shell: menú lateral y barra inferior móvil
    page.tsx                                Hoy
    reservas/  canchas/  equipo/  configuracion/  actividad/   (+ actions.ts por sección)
components/
  ui/            componentes shadcn (con el tema del producto)
  brand/         logo y dibujo de cancha
  shell/         navegación (nav-config, sidebar con selector de club, tab bar, page header, contexto del club activo)
  auth/          layout y password input de las pantallas de acceso
  onboarding/    bienvenida, pasos y formulario del alta del club
  players/        diálogo de alta y edición de jugadores
  cash/          selector de día de la Caja
  members/       compartir invitación e invitaciones pendientes (Equipo)
  invitations/   formulario de ingreso por invitación
  profile/       Mi perfil (formularios, foto y avatar)
  club/          datos del club (Políticas)
  subscription/  planes de la pantalla de Suscripción
  reservations/  grilla, planilla móvil, detalle del turno, formulario, buscador
  courts/        formulario y acciones de canchas
  activity/      filtros de Actividad
hooks/           datos del cliente (canchas, reservas, membresía, detalle de turno, pagos del día, hora actual)
lib/             dominio: precios, disponibilidad, roles, auditoría, cancelación, tonos de estado, marca
supabase/migrations/   esquema y RLS
supabase/rollback/     vuelta atrás manual de migraciones delicadas (no las aplica db push)
openspec/        propuestas, specs y tareas de cada cambio
scripts/         verificaciones y utilidades de prueba (scripts/dev/)
```

## Sistema visual

- Tokens en `app/globals.css`: piso `#F6F7F3`, tinta `#101418`, pelota `#D7F04A` (`bg-ball`), línea `#2C55D1` (foco, `bg-line`). `--accent` es el gris de hover de shadcn; el amarillo de marca es `ball`.
- Fuentes (`app/layout.tsx`, `next/font`): Archivo expandida para títulos (`font-display font-stretch-[125%]`), Geist para la interfaz, Geist Mono para horarios y montos.
- Estados de turno: `lib/reservation-tone.ts` + variantes del `Badge` (`paid`, `deposit`, `pending`, `cancelled`, `fixed`). Usarlos siempre en lugar de colores sueltos.
- Encabezado de página: `components/shell/page-header.tsx`. Navegación: `components/shell/nav-config.ts`.

## Pruebas

No hay suite automatizada todavía; las verificaciones se hacen con Playwright (global) contra `pnpm dev`:

- **Club de prueba** en Supabase con admin y operador (credenciales `TEST_*` en `.env.local`), 6 canchas y turnos sembrados.
- `scripts/dev/shots.cjs`: inicia sesión y saca capturas de las rutas pedidas en escritorio y celular (`FAKE_NOW` simula la hora).

  ```bash
  NODE_PATH=$(npm root -g) node --env-file=.env.local scripts/dev/shots.cjs admin /tmp/shots demo /dashboard /dashboard/reservas
  ```

- `scripts/dev/inspect-test-reservations.mjs`: lista o limpia (`--clean`) los turnos "Prueba*" que dejan las pruebas en el club del admin de prueba (usa `SUPABASE_SECRET_KEY` de `.env.local`).
- **Supabase local** para probar migraciones sin tocar producción: en una carpeta aparte, `supabase init`, copiar `supabase/migrations/` y `supabase start` (Docker). Para levantar la app contra esa base sin tocar `.env.local`, exportar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` locales antes de `pnpm build && pnpm start -p 3100` (Next no deja correr dos `next dev` en la misma carpeta). La base local no exige confirmar el correo.
- Los `scripts/verify-*.mjs` son de cambios anteriores a las membresías (`0004`) y a los clubes (`0007`): usan columnas que ya no existen.
- Muchos logins seguidos disparan el rate limit de Supabase Auth (HTTP 429).

## Email de registro

El registro exige confirmar el email con un link (las personas invitadas no pasan por el registro: su cuenta se crea confirmada desde el link de invitación). Hoy el proyecto usa el **SMTP por defecto de Supabase**, que solo sirve para pruebas: pocos envíos por hora y, en los proyectos actuales, solo entrega a direcciones del equipo de la organización de Supabase. Para que se registren personas reales hay que configurar un SMTP propio (detalles y pasos en `docs/PROJECT_DOCUMENTATION.md`).

## Flujo de trabajo

Los cambios se planifican con **OpenSpec** (`openspec/changes/<cambio>/`: proposal, specs, design, tasks) y se implementan marcando las tareas en `tasks.md`. Comandos de Claude Code: `/opsx:propose`, `/opsx:apply`, `/opsx:archive`. `openspec list` muestra el estado de cada cambio.
