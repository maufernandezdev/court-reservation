import { PageSkeleton } from "@/components/shell/page-skeleton";

/** Carga de Planilla: se ve al instante al tocar el menú mientras llegan los datos. */
export default function Loading() {
  return <PageSkeleton variant="schedule" />;
}
