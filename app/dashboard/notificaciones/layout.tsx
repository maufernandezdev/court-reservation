import { redirect } from "next/navigation";
import { FEATURES } from "@/lib/features";

/** Módulo oculto por ahora (ver `lib/features.ts`): la ruta vuelve a Hoy. */
export default function Layout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.notifications) {
    redirect("/dashboard");
  }
  return children;
}
