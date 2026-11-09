import { PageSkeleton } from "@/components/shell/page-skeleton";

/**
 * Carga de Hoy. Va en el route group `(hoy)` y no en `app/dashboard/loading.tsx` a
 * propósito: Next precarga cada ruta hasta su primer `loading.tsx`, y uno a nivel del
 * panel taparía el de cada sección (al tocar el menú se esperaba al servidor sin
 * mostrar nada).
 */
export default function Loading() {
  return <PageSkeleton variant="kpis" />;
}
