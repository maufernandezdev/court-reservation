"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Club, Eye, EyeOff, MailCheck } from "lucide-react";

type PasswordInputProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
};

function PasswordInput({ value, onChange, id }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        placeholder="•••"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShow((prev) => !prev)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

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
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {step === "signup" ? (
              <Club className="h-6 w-6" />
            ) : (
              <MailCheck className="h-6 w-6" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {step === "signup" ? "Crear cuenta" : "Revisá tu email"}
          </CardTitle>
          <CardDescription>
            {step === "signup"
              ? "Registrate para acceder al panel del club"
              : `Te enviamos un correo a ${email}. Hacé clic en el link que te enviamos para validar tu cuenta.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "signup" ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSignup)}
                className="space-y-4"
              >
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="usuario@club.com"
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
                        <PasswordInput
                          value={field.value}
                          onChange={field.onChange}
                        />
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
                      <FormLabel>Confirmar contraseña</FormLabel>
                      <FormControl>
                        <PasswordInput
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Registrando..." : "Registrarse"}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {notice && (
                <Alert>
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              )}
              <Alert>
                <AlertDescription>
                  Si no lo ves, revisá la carpeta de spam. El link puede tardar
                  unos minutos en llegar.
                </AlertDescription>
              </Alert>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  Reenviar correo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("signup");
                    setError("");
                    setNotice("");
                  }}
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  Cambiar email
                </button>
              </div>
            </div>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Iniciá sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
