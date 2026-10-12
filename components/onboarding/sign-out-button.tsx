"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/** Cerrar sesión desde pantallas fuera del panel (bienvenida, invitación). */
export function SignOutButton({
  label = "Cerrar sesión",
  redirectTo = "/login",
  variant = "ghost",
}: {
  label?: string;
  redirectTo?: string;
  variant?: "ghost" | "outline" | "default";
}) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = async () => {
    setIsSigningOut(true);
    await createClient().auth.signOut();
    router.replace(redirectTo);
    router.refresh();
  };

  return (
    <Button type="button" variant={variant} onClick={signOut} disabled={isSigningOut}>
      <LogOut />
      {isSigningOut ? "Cerrando sesión…" : label}
    </Button>
  );
}
