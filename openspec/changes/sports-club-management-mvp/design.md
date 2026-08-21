## Context

El proyecto es una aplicación Next.js existente con App Router. Se reestructurará bajo `app/` para soportar las nuevas páginas de login, dashboard y submódulos. La motivación y alcance están en `proposal.md`. No hay backend ni base de datos real en este MVP; toda la persistencia y los datos iniciales residen en el cliente.

## Goals / Non-Goals

**Goals:**
- Entregar una navegación completa y un login funcional con sesión simulada.
- Implementar la grilla de reservas como módulo principal con estado local interactivo.
- Preparar vistas secundarias con datos mock y componentes de shadcn/ui.
- Mantener compatibilidad con modo claro/oscuro usando únicamente tokens neutros de shadcn/ui.
- Proveer instrucciones claras de instalación de dependencias.

**Non-Goals:**
- Integración con backend, base de datos, autenticación real o pasarelas de pago.
- Lógica compleja de negocio en socios, caja o reportes (solo vistas iniciales).
- Paletas de color personalizadas o animaciones elaboradas.
- Tests automatizados, CI/CD o despliegue.

## Decisions

### 1. State and persistence: React state + localStorage
**Rationale:** El MVP no requiere backend. `useState` + `useEffect` para hidratar/guardar en `localStorage` es suficiente para la sesión y las reservas.
**Alternative considered:** Context API o Zustand. Rejected to keep the prototype minimal; prop drilling is acceptable for this scale.

### 2. Auth guard: client-side redirect
**Rationale:** Sin backend, la protección de rutas se implementa en un componente de layout/página que lee el flag de sesión y redirige a `/login` si no existe.
**Alternative considered:** Middleware de Next.js. Rejected because localStorage is not accessible in middleware; a client-only guard avoids hydration mismatches and keeps the mock auth simple.

### 3. Routing structure under `app/`
**Rationale:** Seguir la convención de Next.js App Router:
- `/login` → `app/login/page.tsx`
- `/dashboard` → `app/dashboard/page.tsx` (puede redirigir a `/dashboard/reservas`)
- `/dashboard/reservas` → `app/dashboard/reservas/page.tsx`
- Módulos secundarios → `app/dashboard/<module>/page.tsx`
- Layout compartido del dashboard → `app/dashboard/layout.tsx`

### 4. shadcn/ui components
**Rationale:** El usuario especificó shadcn/ui. Se usarán componentes neutros (`Card`, `Button`, `Input`, `Label`, `Form`, `Dialog`, `Table`, `Alert`, `Toast`, `Badge`, `Select`, `DropdownMenu`, `Sheet`, `Separator`, `Avatar`, `Tabs`) más `lucide-react` para iconografía.

### 5. Booking grid data model
**Rationale:** Representar canchas y horarios como configuración estática, y las reservas como un array de objetos `{ id, courtId, time, customerName, phone }`. La grilla se deriva cruzando configuración con reservas.

### 6. Mock data location
**Rationale:** Centralizar datos mock en `lib/data.ts` o `lib/mocks/` para facilitar la transición futura a una API real.

## Risks / Trade-offs

- **[Risk]** localStorage solo funciona en el cliente; podría causar hidratación inconsistente si se lee durante el renderizado inicial.
  → **Mitigation:** Usar `useEffect` para leer/escribir localStorage y mostrar estados de carga o skeletons mientras tanto.
- **[Risk]** Las credenciales hardcodeadas (`test` / `123`) son inseguras y solo válidas para prototipo.
  → **Mitigation:** Documentar explícitamente que es un placeholder; no usar en producción.
- **[Risk]** Sin backend, múltiples pestañas no sincronizan estado entre sí.
  → **Mitigation:** Aceptado para el MVP; en futura iteración reemplazar por API.
- **[Risk]** Las vistas secundarias son placeholders que pueden parecer "vacías".
  → **Mitigation:** Incluir datos mock representativos y widgets visuales para simular valor.

## Migration Plan

1. Instalar componentes de shadcn/ui y `lucide-react` según las instrucciones del README.
2. Limpiar/renombrar archivos existentes en `app/` según la nueva estructura de rutas.
3. Implementar auth local y layout del dashboard.
4. Implementar módulo de reservas con estado local.
5. Implementar vistas secundarias con datos mock.
6. Verificar navegación, modo oscuro y persistencia de sesión.

## Open Questions

- ¿El nombre del club debe ser configurable en un archivo o hardcodeado por ahora? (asumido hardcodeado como "Club Deportivo Central").
- ¿Se desea que `/dashboard` redirija automáticamente a `/dashboard/reservas`? (asumido sí, para mejor UX).
