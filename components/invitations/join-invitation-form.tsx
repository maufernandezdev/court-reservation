"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CircleAlert } from "lucide-react";
import {
  joinExistingAccountSchema,
  joinNewAccountSchema,
  type JoinExistingAccountInput,
  type JoinNewAccountInput,
} from "@/lib/invitations";
import {
  joinWithExistingAccountAction,
  joinWithNewAccountAction,
  joinWithSessionAction,
} from "@/app/invitacion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordInput } from "@/components/auth/password-input";

type Mode = "new" | "existing";

const EXISTING_FIELDS = joinExistingAccountSchema.omit({ token: true });
const NEW_FIELDS = joinNewAccountSchema.omit({ token: true });

type ExistingValues = Omit<JoinExistingAccountInput, "token">;
type NewValues = Omit<JoinNewAccountInput, "token">;

/**
 * Ingreso por invitación sin sesión: o se crea una cuenta (nombre, correo y contraseña) o se
 * ingresa con una que ya existe (correo y contraseña). Si sale bien, la acción redirige al panel.
 */
export function JoinInvitationForm({ token }: { token: string }) {
  const [mode, setMode] = useState<Mode>("new");

  return (
    <div className="flex flex-col gap-5">
      <ToggleGroup
        type="single"
        variant="segmented"
        spacing={1}
        value={mode}
        onValueChange={(value) => value && setMode(value as Mode)}
        aria-label="Cuenta"
        className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
      >
        <ToggleGroupItem value="new" className="h-10 w-full">
          Soy nuevo
        </ToggleGroupItem>
        <ToggleGroupItem value="existing" className="h-10 w-full">
          Ya tengo cuenta
        </ToggleGroupItem>
      </ToggleGroup>

      {mode === "new" ? <NewAccountForm token={token} /> : <ExistingAccountForm token={token} />}
    </div>
  );
}

function NewAccountForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewValues>({
    resolver: zodResolver(NEW_FIELDS),
    defaultValues: { full_name: "", email: "", password: "" },
  });

  const onSubmit = (values: NewValues) => {
    setError("");
    startTransition(async () => {
      const result = await joinWithNewAccountAction({ token, ...values });
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
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre y apellido</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="Juli Pérez" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="juli@mail.com" {...field} />
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
              <FormLabel>Elegí una contraseña</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Creando tu cuenta…" : "Crear cuenta y entrar"}
          {!isPending && <ArrowRight className="text-ball" />}
        </Button>
        <p className="text-sm text-pretty text-muted-foreground">
          Con ese correo y contraseña vas a ingresar las próximas veces. Tu nombre y tu foto los podés cambiar
          después desde Mi perfil.
        </p>
      </form>
    </Form>
  );
}

function ExistingAccountForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const form = useForm<ExistingValues>({
    resolver: zodResolver(EXISTING_FIELDS),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: ExistingValues) => {
    setError("");
    startTransition(async () => {
      const result = await joinWithExistingAccountAction({ token, ...values });
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
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="juli@mail.com" {...field} />
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
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Entrando…" : "Ingresar y unirme al club"}
          {!isPending && <ArrowRight className="text-ball" />}
        </Button>
      </form>
    </Form>
  );
}

/** "Unirme al club" cuando ya hay una sesión iniciada. */
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
