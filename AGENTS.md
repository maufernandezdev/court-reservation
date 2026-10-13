# AGENTS.md — Club Deportivo Central

Instrucciones para agentes de IA que trabajen en este repositorio.

## Stack

- **Framework:** Next.js (App Router) + React + TypeScript
- **Estilos:** Tailwind CSS v4 + shadcn/ui (componentes en `components/ui/`)
- **Auth y backend:** Supabase (`@supabase/ssr`, `@supabase/supabase-js`) — clientes en `lib/supabase/`
- **Manejo de paquetes:** pnpm (no usar npm ni yarn)
- **Idioma de la UI:** Español (es-AR, voseo)

## Reglas obligatorias

### Cloudflare: acceso mediante Wrangler

- Para conectarse a Cloudflare y administrar recursos del proyecto, usar el CLI **Wrangler**. Hay una instalación global disponible como `wrangler` y una sesión OAuth configurada en este equipo.
- Antes de operar, ejecutar `wrangler whoami` para verificar la sesión y la cuenta de destino. Si la sesión expiró, usar `wrangler login`; no solicitar tokens ni credenciales por chat.
- Para operaciones administrativas, usar el CLI global. Si el proyecto tiene una versión local de Wrangler o scripts propios de desarrollo/despliegue, respetar esa versión y ejecutarlos con pnpm.
- Consultar `wrangler --help` y `wrangler <comando> --help` para confirmar la sintaxis vigente, especialmente para R2. Verificar el recurso, la cuenta y el entorno antes de modificar recursos remotos.
- No copiar credenciales de Wrangler al repositorio ni registrar secretos en código, documentación o logs.

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
