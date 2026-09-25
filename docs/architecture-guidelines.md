# ARCHITECTURE & OPENCODE / CLAUDE CODING GUIDELINES
> **Next.js (App Router) + Server-First Pattern + BFF / Convex Integration**

Este documento define la arquitectura, las convenciones de código y las reglas que todos los desarrolladores y la IA (**OpenCode / Claude Code**) deben seguir estrictamente al generar, modificar o refactorizar código en este proyecto.

---

## 🛠️ 1. Principios Generales de Arquitectura

1. **Server-First Pattern:** Todo componente es por defecto un **Server Component (RSC)** a menos que requiera interactividad explícita del lado del cliente.
2. **Data Fetching via BFF + Convex:** Queda **estrictamente prohibido** escribir llamadas `fetch` REST directas e incondicionales dentro de componentes visuales de cliente. La comunicación con el backend debe realizarse a través de la arquitectura existente del proyecto: **BFF (Backend For Frontend / API Routes), Server Actions o el cliente oficial de Convex (`ConvexHttpClient`)**.
3. **UI Basada en shadcn/ui:** Se **debe utilizar siempre `shadcn/ui`** como sistema principal de componentes visuales. Si un componente necesario no existe en los componentes de UI compartidos (`src/components/ui/`), la IA debe utilizar los primitivos de `shadcn/ui` o sugerir/agregar la instalación del componente correspondiente antes de crear UI personalizada desde cero.
4. **Buenas Prácticas Nativas de Next.js:** Es obligatorio utilizar los componentes y optimizaciones nativas del framework (ej. `next/image` para imágenes, `next/link` para navegación, `next/font` para tipografías).
5. **Tipado Estricto con Zod:** La validación de datos, inputs y respuestas debe realizarse mediante esquemas de Zod.

---

## 🎨 2. Reglas de UI y Componentes (`shadcn/ui` + Nativos de Next.js)

### A. Uso Estricto de `shadcn/ui`
- **Regla:** Antes de crear una etiqueta HTML nativa (`<button>`, `<input>`, `<dialog>`, etc.), verifica si existe el componente correspondiente en los componentes de UI del proyecto.
- **Si no existe:** La IA debe utilizar la CLI de `shadcn/ui` (o estructurar el componente siguiendo el patrón `Radix UI + Tailwind CSS` de `shadcn`).
- **Estilos:** Usa `cn()` desde las utilidades del proyecto para combinar clases de Tailwind.

### B. Buenas Prácticas Nativas de Next.js
1. **Imágenes:** Queda **estrictamente prohibido** usar la etiqueta `<img>` nativa de HTML. Usa siempre `<Image />` importado de `next/image` especificando `width`, `height`, `alt` y optimización de carga (`priority` para LCP).
2. **Navegación:** Usa siempre `<Link />` de `next/link` en lugar de etiquetas `<a>` para aprovechar el prefetching automático.
3. **Fuentes:** Usa `next/font/google` o `next/font/local` en el `layout.tsx` para evitar CLS (Cumulative Layout Shift).

```tsx
// Ejemplo correcto de componente con Next.js + shadcn/ui
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function UserProfileCard({ name, avatarUrl }: { name: string; avatarUrl: string }) {
  return (
    <Card className="max-w-sm">
      <CardHeader className="flex flex-row items-center gap-4">
        <Image
          src={avatarUrl}
          alt={`Avatar de ${name}`}
          width={48}
          height={48}
          className="rounded-full object-cover"
        />
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link href="/settings/profile">Editar Perfil</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## ⚡ 3. Servidor vs. Cliente (Server Components vs. Client Components)

- **Server Component (Por Defecto):** Usa `async/await` para cargar datos en el servidor (usando ConvexHttpClient o BFF). Rendimiento máximo sin enviar JavaScript innecesario al cliente.
- **Client Component (`'use client'`):** Úsalo **únicamente** cuando se requiera interactividad (`onClick`, `onChange`), Hooks de React (`useState`, `useEffect`) o APIs del navegador.

---

## 📝 4. Directivas de Prompt para OpenCode / Claude Code (`CLAUDE.md` / `AGENTS.md`)

Guarda este bloque en tu archivo `CLAUDE.md` o `AGENTS.md`:

```text
[REGLAS DE GENERACIÓN DE CÓDIGO - OPENCODE / CLAUDE CODE - NEXT.JS]

1. SERVER FIRST: Todos los componentes son Server Components por defecto. Agrega 'use client' ÚNICAMENTE si se requiere interactividad explícita (eventos de React, useState, useEffect).
2. DATA FETCHING: NUNCA hagas llamadas `fetch` REST directas ni inventes clientes HTTP genéricos. Usa la arquitectura real del proyecto: BFF (API Routes), Server Actions o `ConvexHttpClient`.
3. SHADCN/UI: SIEMPRE utiliza componentes de `shadcn/ui`. Si no existe el componente necesario en la UI del proyecto, indícalo o créalo siguiendo la convención de `shadcn/ui` en lugar de escribir HTML/Tailwind nativo desordenado.
4. BUENAS PRÁCTICAS NEXT.JS:
   - PROHIBIDO el uso de `<img>`. Usa SIEMPRE `<Image />` de `next/image` con dimensiones (width/height) y alt explícitos.
   - PROHIBIDO el uso de `<a href="...">`. Usa SIEMPRE `<Link />` de `next/link`.
5. VALIDACIÓN: Valida todas las entradas de usuario y respuestas usando esquemas de Zod.
6. PROPS: Asegúrate de que todas las props pasadas de Server Components a Client Components sean objetos JSON planos serializables.
```
