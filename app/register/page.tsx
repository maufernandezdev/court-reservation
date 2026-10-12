"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, CircleAlert, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthHeading, AuthLayout } from "@/components/auth/auth-layout";
import { PasswordInput } from "@/components/auth/password-input";

const signupSchema = z
  .object({
    email: z.string().email("Ingresá un email válido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type SignupValues = z.infer<typeof signupSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<"signup" | "check-email">("signup");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const handleSignup = async (values: SignupValues) => {
    setError("");
    setNotice("");
    setIsSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/verification-account`,
      },
    });

    if (error) {
      setError(error.message);
      setIsSubmitting(false);
      return;
    }

    // identities vacío = el email ya está registrado
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("Ya existe una cuenta con ese email.");
      setIsSubmitting(false);
      return;
    }

    setEmail(values.email);

    if (data.session) {
      // Confirmación de email deshabilitada en el proyecto: sesión directa
      router.push("/dashboard");
      return;
    }

    setNotice("Te enviamos un correo para validar tu cuenta. Revisá tu bandeja de entrada.");
    setIsSubmitting(false);
    setStep("check-email");
  };

  const handleResend = async () => {
    setError("");
    setNotice("");
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      setError(error.message);
    } else {
      setNotice("Te reenviamos el correo de confirmación.");
    }
  };

  return (
    <AuthLayout courtVariant="vertical">
      {step === "signup" ? (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSignup)}
            className="flex flex-col gap-6"
            noValidate
          >
            <AuthHeading
              title="Creá tu cuenta"
              description="Si te invitaron a un club, no hace falta registrarte: entrá desde el link de la invitación."
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
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <PasswordInput autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repetí la contraseña</FormLabel>
                      <FormControl>
                        <PasswordInput autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
              {!isSubmitting && <ArrowRight className="text-ball" />}
            </Button>

            <p className="text-[15px] text-muted-foreground">
              ¿Ya tenés cuenta?{" "}
              <Link
                href="/login"
                className="font-semibold text-foreground underline-offset-4 hover:underline"
              >
                Ingresá
              </Link>
            </p>
          </form>
        </Form>
      ) : (
        <div className="flex flex-col gap-6">
          <span className="flex size-12 items-center justify-center rounded-xl bg-ball text-ball-foreground">
            <MailCheck className="size-6" />
          </span>
          <AuthHeading
            title="Revisá tu email"
            description={
              <>
                Te enviamos un correo a{" "}
                <strong className="text-foreground">{email}</strong>. Hacé clic
                en el link para validar tu cuenta.
              </>
            }
          />

          {error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {notice && (
            <Alert>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            Si no lo ves, revisá la carpeta de spam. El link puede tardar unos
            minutos en llegar.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={handleResend}>
              Reenviar correo
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep("signup");
                setError("");
                setNotice("");
              }}
            >
              Cambiar email
            </Button>
          </div>

          <p className="text-[15px] text-muted-foreground">
            ¿Ya validaste tu cuenta?{" "}
            <Link
              href="/login"
              className="font-semibold text-foreground underline-offset-4 hover:underline"
            >
              Ingresá
            </Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
