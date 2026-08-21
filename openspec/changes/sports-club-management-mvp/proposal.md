## Why

El club deportivo necesita una herramienta digital centralizada para gestionar reservas de canchas, socios, productos del kiosco, caja y comunicaciones. Hoy la operatoria se realiza de forma manual o dispersa, lo que genera sobresolicitud de turnos, errores en el control de pagos y falta de visibilidad de la ocupación. Este MVP entrega una base funcional y navegable que permite validar el modelo de negocio antes de incorporar backend real o pasarelas de pago.

## What Changes

- **Módulo de autenticación local**: página `/login` con credenciales hardcodeadas (`test` / `123`), guardado de sesión simulada en `localStorage`/cookie client-side y redirección protegida hacia `/dashboard`.
- **Layout del dashboard**: shell profesional con sidebar/header, nombre del club y botón de cierre de sesión.
- **Módulo principal de reservas**: grilla interactiva `/dashboard/reservas` con canchas como columnas, horarios como filas, celdas libres/ocupadas y modal para crear nuevas reservas.
- **Vistas secundarias preparatorias**: `/dashboard/socios`, `/dashboard/productos`, `/dashboard/caja`, `/dashboard/reportes`, `/dashboard/notificaciones` y `/dashboard/suscripcion`, con datos mock y componentes de shadcn/ui.
- **Estado y persistencia local**: mock data y `localStorage`; sin backend ni base de datos real en este MVP.
- **Instalación de dependencias de UI**: instrucciones para agregar los componentes de shadcn/ui necesarios.

## Capabilities

### New Capabilities

- `auth/login`: autenticación sencilla con credenciales hardcodeadas y gestión de sesión client-side.
- `dashboard/layout`: shell de navegación del club con sidebar, identificación del club y cierre de sesión.
- `reservations/booking-grid`: grilla de canchas y horarios con visualización de ocupación y creación de reservas mediante diálogo.
- `members/management`: lista simple de socios con nombre, DNI, teléfono y estado de cuota.
- `products/kiosk-stock`: tabla de stock de productos del kiosco con placeholder para lectura de código de barras.
- `cash/daily-summary`: resumen básico de ingresos diarios del club.
- `reports/widgets`: widgets de reportes para exportar resúmenes y alertas de stock.
- `notifications/announcements`: panel para enviar avisos a socios (ej. cancelación por lluvia).
- `subscription/plans`: vista de planes de cobro del SaaS para el club (prueba gratis, básico, pro).

### Modified Capabilities

- Ninguna. No existen capabilities previos en el proyecto.

## Impact

- **Código**: se reestructura la app Next.js existente bajo `app/` agregando páginas de login, dashboard y submódulos.
- **Dependencias**: se instalan componentes de shadcn/ui (`button`, `card`, `input`, `label`, `form`, `dialog`, `table`, `alert`, `toast`, `badge`, `select`, `dropdown-menu`, `sheet`, `separator`, `avatar`, `tabs`) y `lucide-react`.
- **Estilos**: se usan exclusivamente los tokens neutros de shadcn/ui, manteniendo compatibilidad con modo claro/oscuro y sin paletas personalizadas.
- **Persistencia**: sesión y datos mock en `localStorage`; no hay cambios en APIs, base de datos ni infraestructura.
