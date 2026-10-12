"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, CircleAlert, Lock } from "lucide-react";
import { joinInvitationSchema } from "@/lib/invitations";
import { joinWithInvitationAction, joinWithSessionAction } from "@/app/invitacion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordInput } from "@/components/auth/password-input";

// Solo la contraseña se carga a mano: el token viene del link y el correo es el invitado.
const passwordSchema = joinInvitationSchema.pick({ password: true });
type PasswordValues = z.infer<typeof passwordSchema>;

/** Ingreso por invitación sin sesión: con cuenta pide la contraseña; sin cuenta, elegir una. */
export function JoinInvitationForm({
  token,
  email,
  hasAccount,
}: {
  token: string;
  email: string;
  hasAccount: boolean;
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "" },
  });

  const onSubmit = (values: PasswordValues) => {
    setError("");
    startTransition(async () => {
      // Si sale bien, la acción redirige al panel del club.
      const result = await joinWithInvitationAction({ token, password: values.password });
      if (result && !result.success) setError(result.error);
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        {error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="invitation-email">Correo</Label>
          <div className="relative">
            <Input
              id="invitation-email"
              type="email"
              value={email}
              readOnly
              aria-readonly="true"
              className="bg-muted pr-10 text-muted-foreground"
            />
            <Lock
              aria-hidden="true"
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{hasAccount ? "Contraseña" : "Elegí una contraseña"}</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete={hasAccount ? "current-password" : "new-password"}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Entrando…" : "Entrar al club"}
          {!isPending && <ArrowRight className="text-ball" />}
        </Button>
      </form>
    </Form>
  );
}

/** "Unirme al club" cuando ya hay sesión con el correo invitado. */
export function JoinWithSessionButton({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const join = () => {
    setError("");
    startTransition(async () => {
      const result = await joinWithSessionAction(token);
      if (result && !result.success) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button size="lg" onClick={join} disabled={isPending}>
        {isPending ? "Uniéndote…" : "Unirme al club"}
        {!isPending && <ArrowRight className="text-ball" />}
      </Button>
    </div>
  );
}
