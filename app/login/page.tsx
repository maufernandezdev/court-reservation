"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, CircleAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AuthHeading, AuthLayout } from "@/components/auth/auth-layout";
import { PasswordInput } from "@/components/auth/password-input";

const loginSchema = z.object({
  email: z.string().trim().email("Ingresá un email válido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

type LoginValues = z.infer<typeof loginSchema>;

/** Traduce los errores de Supabase Auth más comunes. */
function loginErrorMessage(message?: string): string {
  if (!message) return "No se pudo iniciar sesión.";
  if (/invalid login credentials/i.test(message)) {
    return "El email o la contraseña no coinciden. Revisalos e intentá de nuevo.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Todavía no confirmaste tu email. Revisá tu bandeja de entrada.";
  }
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState("");

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const isSubmitting = form.formState.isSubmitting;

  const handleSubmit = async (values: LoginValues) => {
    setError("");
    const { success, error } = await login(values.email, values.password);
    if (success) {
      router.push("/dashboard");
    } else {
      setError(loginErrorMessage(error));
    }
  };

  return (
    <AuthLayout>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-6"
          noValidate
        >
          <AuthHeading
            title="Ingresá a tu club"
            description="Usá el email con el que te registraste."
          />

          {error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="vos@tuclub.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? "Ingresando…" : "Ingresar"}
            {!isSubmitting && <ArrowRight className="text-ball" />}
          </Button>

          <div className="flex flex-col gap-1.5 border-t pt-5 text-[15px] text-muted-foreground">
            <span>
              ¿Todavía no tenés cuenta?{" "}
              <Link
                href="/register"
                className="font-semibold text-foreground underline-offset-4 hover:underline"
              >
                Registrate
              </Link>
            </span>
            <span>¿Te invitaron a un club? Ingresá con el email de la invitación.</span>
          </div>
        </form>
      </Form>
    </AuthLayout>
  );
}
