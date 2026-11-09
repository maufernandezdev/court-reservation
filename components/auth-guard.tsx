"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

/**
 * El layout del panel ya valida la sesión en el servidor (y redirige a /login si no
 * hay), así que acá no se bloquea el render: los hijos se pintan de entrada (y llegan
 * en el HTML del servidor). Solo se reacciona si la sesión se cierra o vence estando
 * en la página (por ejemplo, al tocar "Cerrar sesión").
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  return <>{children}</>;
}
