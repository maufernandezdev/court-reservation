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
```

## Funcionalidad

| Sección (menú) | Ruta | Quién la ve | Qué hace |
| --- | --- | --- | --- |
| Bienvenida | `/bienvenida` | sin club (o "Crear otro club") | Elegir "Crear mi club" o "Me van a invitar" (con las invitaciones pendientes para su correo) |
| Alta del club | `/bienvenida/club` | cualquier cuenta | Nombre, ciudad y canchas por deporte; crea el club y lleva a Canchas (paso 3) |
| Invitación | `/invitacion/<token>` | pública | Entrar al club desde el link: con cuenta pide la contraseña, sin cuenta elige una |
| Hoy | `/dashboard` | todos | Resumen del día (turnos, ocupación, cobrado, por cobrar), ahora en cancha, próximos turnos con cobro, huecos libres para WhatsApp |
| Planilla | `/dashboard/reservas` | todos | Grilla canchas × horarios (escritorio) o lista por cancha (celular); alta, edición, cobros, cancelación; buscador "¿Hay cancha?" |
| Canchas | `/dashboard/canchas` | admin | Precio por hora, duración del turno (30/60/90), horario y seña (fija o %) |
| Equipo | `/dashboard/miembros` | admin | Personas del club, roles, invitaciones por link (WhatsApp o copiar) y matriz de permisos |
| Políticas | `/dashboard/configuracion` | admin | Ventana de cancelación y penalidad, con ejemplo calculado; nombre y ciudad del club |
| Actividad | `/dashboard/actividad` | admin | Auditoría: quién creó, modificó, cobró o canceló, con filtros |
| Caja, Socios, Productos, Reportes, Notificaciones, Suscripción | `/dashboard/...` | admin | Pantallas de ejemplo (datos mock), todavía sin backend |

**Clubes:** cada club es una fila de `clubs`, y todo lo demás (canchas, reservas, cobros, saldos, políticas, auditoría, equipo, invitaciones) cuelga de `club_id`. Registrarse no crea un club: quien se registra elige crear el suyo (queda como admin) o esperar una invitación. Una persona puede pertenecer a varios clubes y cambia de club desde el bloque del club en el menú (cookie `club_activo`); todas las pantallas leen solo el club activo.

**Invitaciones:** el admin carga nombre, correo y rol en Equipo y comparte el link (vence a los 7 días, sirve una vez). La persona entra con ese correo: si ya tiene cuenta pone su contraseña; si no, elige una ahí mismo (la cuenta se crea ya confirmada). Desde Equipo se puede generar un link nuevo (invalida el anterior) o cancelar la invitación. La app todavía no manda correos: el link se comparte por WhatsApp o se pega en un mail.

**Roles** (`lib/roles.ts`): `admin` (todo), `operador` (planilla y cobros), `profesor` (planilla; no cobra ni cancela fuera de término ni turnos con cobros). Las reglas se aplican en las Server Actions (`requireRole`), en RLS y en triggers de la base.

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
    reservas/  canchas/  miembros/  configuracion/  actividad/   (+ actions.ts por sección)
components/
  ui/            componentes shadcn (con el tema del producto)
  brand/         logo y dibujo de cancha
  shell/         navegación (nav-config, sidebar con selector de club, tab bar, page header, contexto del club activo)
  auth/          layout y password input de las pantallas de acceso
  onboarding/    bienvenida, pasos y formulario del alta del club
  members/       compartir invitación e invitaciones pendientes (Equipo)
  invitations/   formulario de ingreso por invitación
  club/          datos del club (Políticas)
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
