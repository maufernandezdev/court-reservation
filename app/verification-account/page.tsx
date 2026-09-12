"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type Status = "loading" | "success" | "error";

const REDIRECT_PATH = "/";
const COUNTDOWN_SECONDS = 10;

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

  const icon =
    status === "loading" ? (
      <Loader2 className="h-6 w-6 animate-spin" />
    ) : status === "success" ? (
      <CheckCircle2 className="h-6 w-6" />
    ) : (
      <XCircle className="h-6 w-6" />
    );

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {icon}
          </div>
          <CardTitle className="text-2xl">
            {status === "loading" && "Verificando tu cuenta..."}
            {status === "success" && "¡Cuenta verificada!"}
            {status === "error" && "No pudimos verificar tu cuenta"}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Estamos validando tu correo. No cierres esta pestaña."}
            {status === "success" &&
              `Tu correo fue validado correctamente. Serás redirigido al inicio en ${countdown} segundos.`}
            {status === "error" &&
              "El link es inválido o expiró. Pedí un nuevo correo de verificación intentando iniciar sesión."}
          </CardDescription>
        </CardHeader>
        {status !== "loading" && (
          <CardContent>
            <Button
              className="w-full"
              variant={status === "success" ? "default" : "outline"}
              onClick={() => router.push(REDIRECT_PATH)}
            >
              Ir al inicio
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default function VerificationAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <CardTitle className="text-2xl">Verificando tu cuenta...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <VerificationAccountContent />
    </Suspense>
  );
}
