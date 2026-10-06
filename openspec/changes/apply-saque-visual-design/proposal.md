## Why

La app funciona (reservas reales, roles, cobros, cancelaciones con penalidad, auditoría) pero usa el tema neutro por defecto de shadcn, sin identidad propia. El objetivo es comercializarla para clubes de tenis, pádel y clubes en general, así que necesita una identidad visual con personalidad y una experiencia de operación más clara. El diseño ya está hecho en el canvas "Plataforma de reservas de canchas" (https://claude.ai/artifact/HzX1cWWmfHrkUH27QnMidF). Este cambio lo pasa a la app por fases, sobre la funcionalidad core existente y sin romperla.

## What Changes

- **Identidad visual base**: paleta "saque" (tinta `#101418`, pelota `#D7F04A`, línea `#2C55D1`, piso `#F6F7F3`, error `#C2361F`, a favor `#1F7A4D`) cargada como tokens de shadcn en `app/globals.css`; tipografías Archivo (expandida, títulos y números), Geist (interfaz) y Geist Mono (horarios y montos) vía `next/font/google`; estilos únicos por estado de turno (pagada, señada, pendiente, cancelada y, a futuro, fijo) reutilizados en toda la app; nombre de producto de trabajo "saque" centralizado en una constante.
- **Shell del panel**: menú lateral oscuro con grupos (Operación, Club, Administración), ítem activo en amarillo pelota, bloque de club con rol, usuario y cierre de sesión. En celular se usa una barra inferior de navegación en lugar del menú lateral. Las rutas actuales no cambian. Cambian los rótulos: "Reservas" pasa a "Planilla", "Miembros" a "Equipo" y "Configuración" a "Políticas", y el inicio pasa a llamarse "Hoy".
- **Pantallas de acceso**: login y registro con el panel de marca (dibujo de la cancha) y el formulario rediseñado; misma lógica de Supabase, validación Zod y toggle de contraseña. Se rediseña también la pantalla de verificación de cuenta.
- **Hoy (inicio)**: reemplaza "Ocupación actual" por resumen del día (turnos, ocupación, cobrado, por cobrar), "Ahora en cancha", próximos turnos con acceso al cobro, y huecos libres con "Copiar para WhatsApp", todo calculado con datos reales.
- **Planilla**: grilla canchas × horarios con bloques por duración real y estilo por estado de pago, línea de "ahora", filtro por deporte y panel lateral de detalle en escritorio. Las acciones existentes del diálogo de reserva (cobrar, cambiar estado, cancelar, historial) siguen funcionando. En celular, lista por cancha con selector de día y botón flotante "Nuevo turno". El buscador de disponibilidad se rediseña como "¿Hay cancha?" y suma la opción de copiar el texto para WhatsApp.
- **Administración**: rediseño de Canchas (tarjetas + formulario con resumen de precio/seña), Equipo (tabla de personas + matriz de permisos por rol) y Políticas (línea de tiempo de la ventana de cancelación + ejemplo calculado con los valores del club).
- **Actividad (nueva página)**: `/dashboard/actividad` lista el `audit_log` del club agrupado por día, con filtros por persona y tipo de acción. Solo la ve el admin.
- **Fuera de alcance (quedan como cambios posteriores)**: alta del club en 3 pasos (requiere entidad "club"), turnos fijos/clases recurrentes, superficie de cancha, "cancela el club sin penalidad", devolución de seña en lugar de saldo a favor, alerta por liberación de turnos fijos, selector multi-club funcional, portal público de reservas, modo oscuro. Ninguna pantalla muestra controles para funciones que no existen.

## Capabilities

### New Capabilities
- `visual-identity`: tokens de color, tipografías, estilos de estado de turno y marca de producto compartidos por toda la app.
- `app-shell`: navegación del panel (menú lateral agrupado en escritorio, barra inferior en celular), identidad del club, usuario y cierre de sesión, con visibilidad por rol.
- `auth-screens`: presentación de login, registro y verificación de cuenta.
- `daily-overview`: pantalla "Hoy" con resumen operativo del día calculado a partir de canchas, reservas y cobros reales.
- `reservation-sheet`: presentación de la planilla (escritorio y celular), panel de detalle del turno y buscador rápido de disponibilidad con texto para WhatsApp.
- `club-admin-screens`: presentación de Canchas, Equipo, Políticas y la nueva página de Actividad (lectura del `audit_log`).

### Modified Capabilities
<!-- openspec/specs/ todavía está vacío (los cambios anteriores no se archivaron); los comportamientos existentes se preservan y se referencian desde las specs nuevas. -->

## Impact

- **Código**: `app/globals.css`, `app/layout.tsx`, `app/dashboard/layout.tsx`, `app/login`, `app/register`, `app/verification-account`, `app/dashboard/page.tsx`, `app/dashboard/reservas`, `app/dashboard/canchas`, `app/dashboard/miembros`, `app/dashboard/configuracion`, nueva `app/dashboard/actividad`, `components/reservations/*`, `components/courts/*`, nuevos componentes en `components/brand/` y `components/shell/`.
- **shadcn/ui**: se actualizan variantes de `button`, `badge`, `card` e `input` con los tokens nuevos; puede requerir agregar `toggle-group`, `scroll-area` o `tooltip` con el CLI.
- **Dependencias**: ninguna nueva (fuentes vía `next/font/google`).
- **Base de datos**: sin migraciones. Actividad lee `audit_log` con las policies RLS existentes (`is_member`).
- **Riesgo**: regresiones visuales en páginas mock no rediseñadas (Socios, Productos, Caja, Reportes, Notificaciones, Suscripción): heredan los tokens y se revisan en una pasada final.
