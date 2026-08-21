# Club Deportivo Central

MVP de sistema de gestión para clubes deportivos. Construido con Next.js (App Router), TypeScript, Tailwind CSS y shadcn/ui.

## Requisitos

- Node.js 18 o superior
- npm (incluido con Node.js)

## Instalación

1. Cloná o abrí el proyecto y navegá a la carpeta:

```bash
cd court-reservation
```

2. Instalá las dependencias:

```bash
npm install
```

3. Si los componentes de shadcn/ui no están presentes, instalalos con:

```bash
npx shadcn@latest add button card input label form dialog table alert badge select dropdown-menu sheet separator avatar tabs sonner textarea
```

4. Verificá que `lucide-react` esté instalado:

```bash
npm ls lucide-react
```

Si no aparece, instalalo manualmente:

```bash
npm install lucide-react
```

## Ejecutar el proyecto

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) en el navegador.

## Credenciales de prueba

- **Usuario:** `test`
- **Contraseña:** `123`

Al iniciar sesión, el sistema redirige al dashboard.

## Estructura del proyecto

- `app/login/page.tsx` — Pantalla de login.
- `app/dashboard/layout.tsx` — Layout con navegación y logout.
- `app/dashboard/reservas/page.tsx` — Grilla de canchas y reservas (MVP principal).
- `app/dashboard/socios/page.tsx` — Lista de socios.
- `app/dashboard/productos/page.tsx` — Stock del kiosco.
- `app/dashboard/caja/page.tsx` — Resumen de ingresos.
- `app/dashboard/reportes/page.tsx` — Widgets de reportes.
- `app/dashboard/notificaciones/page.tsx` — Avisos a socios.
- `app/dashboard/suscripcion/page.tsx` — Planes del SaaS.
- `lib/mocks/data.ts` — Datos mock y configuración inicial.
- `hooks/use-auth.ts` — Manejo simulado de sesión con localStorage.
- `components/auth-guard.tsx` — Protección de rutas del dashboard.

## Notas

- No hay backend real: la sesión y las reservas se persisten en `localStorage`.
- Las credenciales `test` / `123` son solo para demostración.
- El tema respeta el modo claro/oscuro del navegador usando tokens neutros de shadcn/ui.

## Scripts útiles

```bash
npm run dev    # Inicia el servidor de desarrollo
npm run build  # Genera la build de producción
npm run start  # Inicia la app en producción
```
# court-reservation
# court-reservation
# court-reservation
# court-reservation
