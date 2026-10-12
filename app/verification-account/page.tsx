"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AuthHeading, AuthLayout } from "@/components/auth/auth-layout";

// "verified": el correo quedó validado pero sin sesión en este navegador
// (link abierto en otro navegador o dispositivo): hay que ingresar a mano.
type Status = "loading" | "success" | "verified" | "error";

const REDIRECT_PATH = "/dashboard";
const COUNTDOWN_SECONDS = 10;

const TITLES: Record<Status, string> = {
  loading: "Verificando tu cuenta…",
  success: "¡Cuenta verificada!",
  verified: "¡Cuenta verificada!",
  error: "No pudimos verificar tu cuenta",
};

function StatusIcon({ status }: { status: Status }) {
  const Icon =
    status === "loading" ? Loader2 : status === "error" ? XCircle : CheckCircle2;
  return (
    <span
      className={cn(
        "flex size-12 items-center justify-center rounded-xl",
        (status === "success" || status === "verified") && "bg-ball text-ball-foreground",
        status === "loading" && "bg-muted text-foreground",
        status === "error" && "bg-danger-soft text-danger-soft-foreground"
      )}
    >
      <Icon className={cn("size-6", status === "loading" && "animate-spin")} />
    </span>
  );
}

function VerificationAccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  // Supabase ya validó el correo al abrir el link y redirige acá con ?code=.
  // El cliente del navegador canjea ese code por una sesión solo, al iniciarse
  // (detectSessionInUrl): no hay que volver a llamar a exchangeCodeForSession,
  // porque el segundo canje falla ("PKCE code verifier not found") aunque todo salió bien.
  useEffect(() => {
    const linkError = searchParams.get("error_description") ?? searchParams.get("error");
    if (linkError) {
      setStatus("error");
      setErrorDetail(linkError);
      return;
    }

    if (!searchParams.get("code")) {
      setStatus("error");
      setErrorDetail("La URL no contiene el código de verificación.");
      return;
    }

    // getSession espera a que termine el canje automático.
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        // Sin sesión: el link se abrió en otro navegador (el canje necesita el
        // verificador guardado al registrarse), pero el correo igual quedó validado.
        setStatus(session ? "success" : "verified");
      });
  }, [searchParams]);

  // Cuenta regresiva para redirigir automáticamente
  useEffect(() => {
    if (status !== "success") return;
    if (countdown === 0) {
      router.push(REDIRECT_PATH);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown, router]);

  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      <StatusIcon status={status} />
      <AuthHeading
        title={TITLES[status]}
        description={
          status === "loading"
            ? "Estamos validando tu correo. No cierres esta pestaña."
            : status === "success"
              ? `Tu correo fue validado correctamente. Te llevamos al inicio en ${countdown} segundos.`
              : status === "verified"
                ? "Tu correo fue validado correctamente. Ingresá con tu email y contraseña para seguir."
                : "El link es inválido o expiró. Pedí un nuevo correo de verificación intentando iniciar sesión."
        }
      />
      {status === "error" && errorDetail && (
        <p className="rounded-lg bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
          Detalle: {errorDetail}
        </p>
      )}
      {status !== "loading" && (
        <Button
          size="lg"
          variant={status === "error" ? "outline" : "default"}
          onClick={() => router.push(status === "verified" ? "/login" : REDIRECT_PATH)}
        >
          {status === "verified" ? "Ingresar" : "Ir al inicio"}
        </Button>
      )}
    </div>
  );
}

export default function VerificationAccountPage() {
  return (
    <AuthLayout>
      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <StatusIcon status="loading" />
            <AuthHeading title={TITLES.loading} />
          </div>
        }
      >
        <VerificationAccountContent />
      </Suspense>
    </AuthLayout>
  );
}
