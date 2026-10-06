"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AuthHeading, AuthLayout } from "@/components/auth/auth-layout";

type Status = "loading" | "success" | "error";

const REDIRECT_PATH = "/dashboard";
const COUNTDOWN_SECONDS = 10;

const TITLES: Record<Status, string> = {
  loading: "Verificando tu cuenta…",
  success: "¡Cuenta verificada!",
  error: "No pudimos verificar tu cuenta",
};

function StatusIcon({ status }: { status: Status }) {
  const Icon =
    status === "loading" ? Loader2 : status === "success" ? CheckCircle2 : XCircle;
  return (
    <span
      className={cn(
        "flex size-12 items-center justify-center rounded-xl",
        status === "success" && "bg-ball text-ball-foreground",
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
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  // Intercambia el ?code= de la URL por una sesión (valida el email)
  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setStatus("error");
      return;
    }

    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      setStatus(error ? "error" : "success");
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
              : "El link es inválido o expiró. Pedí un nuevo correo de verificación intentando iniciar sesión."
        }
      />
      {status !== "loading" && (
        <Button
          size="lg"
          variant={status === "success" ? "default" : "outline"}
          onClick={() => router.push(REDIRECT_PATH)}
        >
          Ir al inicio
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
