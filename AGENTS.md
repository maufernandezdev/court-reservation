# AGENTS.md — Club Deportivo Central

Instrucciones para agentes de IA que trabajen en este repositorio.

## Stack

- **Framework:** Next.js (App Router) + React + TypeScript
- **Estilos:** Tailwind CSS v4 + shadcn/ui (componentes en `components/ui/`)
- **Auth y backend:** Supabase (`@supabase/ssr`, `@supabase/supabase-js`) — clientes en `lib/supabase/`
- **Manejo de paquetes:** pnpm (no usar npm ni yarn)
- **Idioma de la UI:** Español (es-AR, voseo)

## Reglas obligatorias

### Validación de formularios con Zod

- **Todo formulario debe validar sus inputs con Zod.** No hay excepciones.
- Los schemas Zod se definen junto al formulario (mismo archivo, arriba del componente) y se tipan con `z.infer`.
- La integración con React se hace con `react-hook-form` + `@hookform/resolvers/zod` (`zodResolver`).
- Los mensajes de error de los schemas van en español y deben ser claros para el usuario final.
- Campos de contraseña usan el componente con toggle de visibilidad (ojo) como referencia: `app/register/page.tsx` y `app/login/page.tsx`.

### Estilo y convenciones

- Componentes nuevos de UI: usar primero los de `components/ui/` (shadcn/ui); si no existe, agregarlo con el CLI de shadcn.
- Client components: agregar `"use client"` solo donde sea necesario.
- Textos de la UI siempre en español (voseo: "Ingresá", "Registrate", etc.).

### Reglas de Generación de Código (`/app`)

Cuando trabajes dentro de la carpeta `/app`, sigue estrictamente las reglas definidas en `/docs/architecture-guidelines.md`:

1. **SERVER FIRST:** Todos los componentes son Server Components por defecto. Agrega `'use client'` ÚNICAMENTE si se requiere interactividad explícita (eventos de React, `useState`, `useEffect`).
2. **DATA FETCHING:** NUNCA hagas llamadas `fetch` REST directas ni inventes clientes HTTP genéricos. Usa la arquitectura real del proyecto: BFF (API Routes), Server Actions o `ConvexHttpClient`.
3. **SHADCN/UI:** SIEMPRE utiliza componentes de `shadcn/ui`. Si no existe el componente necesario en la UI del proyecto, indícalo o créalo siguiendo la convención de `shadcn/ui` en lugar de escribir HTML/Tailwind nativo desordenado.
4. **BUENAS PRÁCTICAS NEXT.JS:**
   - PROHIBIDO el uso de `<img>`. Usa SIEMPRE `<Image />` de `next/image` con dimensiones (width/height) y `alt` explícitos.
   - PROHIBIDO el uso de `<a href="...">`. Usa SIEMPRE `<Link />` de `next/link`.
5. **VALIDACIÓN:** Valida todas las entradas de usuario y respuestas usando esquemas de Zod.
6. **PROPS:** Asegúrate de que todas las props pasadas de Server Components a Client Components sean objetos JSON planos serializables.
