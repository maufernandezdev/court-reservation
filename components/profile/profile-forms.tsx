"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, MailCheck } from "lucide-react";
import { toast } from "sonner";
import {
  profileEmailSchema,
  profileNameSchema,
  profilePasswordSchema,
  type ProfileEmailInput,
  type ProfileNameInput,
  type ProfilePasswordInput,
} from "@/lib/profile";
import { PROFE_COLORS } from "@/lib/profe-colors";
import {
  changeEmailAction,
  changePasswordAction,
  setMyProfeColorAction,
  updateMyNameAction,
} from "@/app/dashboard/perfil/actions";
import { PasswordInput } from "@/components/auth/password-input";
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

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-lg font-bold">
          {title}
        </h2>
        {description && <p className="text-[15px] text-pretty text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Nombre: se ve en el menú, en Equipo y en Actividad de todos tus clubes. */
export function NameForm({ fullName }: { fullName: string }) {
  const [error, setError] = useState("");
  const form = useForm<ProfileNameInput>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: { full_name: fullName },
  });

  const onSubmit = async (values: ProfileNameInput) => {
    setError("");
    const result = await updateMyNameAction(values);
    if (!result.success) {
      setError(result.error ?? "No se pudo guardar tu nombre.");
      return;
    }
    form.reset({ full_name: values.full_name.trim() });
    toast.success("Nombre guardado");
  };

  return (
    <Section id="perfil-nombre" title="Nombre" description="Se ve en el menú, en Equipo y en Actividad de todos tus clubes.">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre y apellido</FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div>
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting ? "Guardando…" : "Guardar nombre"}
            </Button>
          </div>
        </form>
      </Form>
    </Section>
  );
}

/** Correo: el cambio se confirma desde un link; hasta entonces vale el anterior. */
export function EmailForm({
  email,
  pendingEmail,
  justConfirmed,
}: {
  email: string;
  pendingEmail: string | null;
  justConfirmed: boolean;
}) {
  const [error, setError] = useState("");
  const [requested, setRequested] = useState<string | null>(pendingEmail);
  const form = useForm<ProfileEmailInput>({
    resolver: zodResolver(profileEmailSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ProfileEmailInput) => {
    setError("");
    const result = await changeEmailAction(values);
    if (!result.success) {
      setError(result.error ?? "No se pudo pedir el cambio de correo.");
      return;
    }
    setRequested(values.email);
    form.reset({ email: "" });
  };

  return (
    <Section
      id="perfil-correo"
      title="Correo"
      description={
        <>
          Ingresás con <strong className="text-foreground">{email}</strong>.
        </>
      }
    >
      {justConfirmed && !requested && (
        <Alert>
          <MailCheck className="size-4" />
          <AlertDescription>Tu correo quedó actualizado.</AlertDescription>
        </Alert>
      )}
      {requested && (
        <Alert>
          <MailCheck className="size-4" />
          <AlertDescription>
            Falta confirmar <strong>{requested}</strong>: te mandamos un link a ese correo (y puede
            llegarte un aviso al actual). Hasta que lo confirmes seguís ingresando con {email}.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo nuevo</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" placeholder="vos@mail.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div>
            <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Enviando…" : "Cambiar correo"}
            </Button>
          </div>
        </form>
      </Form>
    </Section>
  );
}

/** Contraseña: pide la actual y la nueva dos veces. */
export function PasswordForm() {
  const [error, setError] = useState("");
  const form = useForm<ProfilePasswordInput>({
    resolver: zodResolver(profilePasswordSchema),
    defaultValues: { current: "", password: "", confirm: "" },
  });

  const onSubmit = async (values: ProfilePasswordInput) => {
    setError("");
    const result = await changePasswordAction(values);
    if (!result.success) {
      setError(result.error ?? "No se pudo cambiar la contraseña.");
      return;
    }
    form.reset({ current: "", password: "", confirm: "" });
    toast.success("Contraseña cambiada", { description: "La próxima vez ingresá con la nueva." });
  };

  return (
    <Section id="perfil-contrasena" title="Contraseña">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField
            control={form.control}
            name="current"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contraseña actual</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="current-password" {...field} />
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
                  <FormLabel>Contraseña nueva</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repetí la contraseña nueva</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Cambiando…" : "Cambiar contraseña"}
            </Button>
          </div>
        </form>
      </Form>
    </Section>
  );
}

/** Color en la planilla, uno por cada club donde la persona es profe. */
export function ProfeColorSection({
  clubs,
}: {
  clubs: { clubId: string; clubName: string; color: string | null }[];
}) {
  const [colors, setColors] = useState(() => new Map(clubs.map((c) => [c.clubId, c.color])));
  const [saving, setSaving] = useState<string | null>(null);

  const choose = async (clubId: string, color: string) => {
    setSaving(clubId);
    const result = await setMyProfeColorAction(clubId, color);
    setSaving(null);
    if (!result.success) {
      toast.error(result.error ?? "No se pudo cambiar el color");
      return;
    }
    setColors((prev) => new Map(prev).set(clubId, color));
    toast.success("Color actualizado");
  };

  return (
    <Section
      id="perfil-color"
      title="Tu color en la planilla"
      description="Tus turnos de profe se ven con este color."
    >
      <div className="flex flex-col gap-4">
        {clubs.map((club) => (
          <div key={club.clubId} className="flex flex-col gap-2">
            {clubs.length > 1 && <span className="text-sm font-semibold">{club.clubName}</span>}
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Color en ${club.clubName}`}>
              {PROFE_COLORS.map((option) => {
                const selected = (colors.get(club.clubId) ?? "").toUpperCase() === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={option.label}
                    title={option.label}
                    disabled={saving === club.clubId}
                    onClick={() => choose(club.clubId, option.value)}
                    className="flex size-10 items-center justify-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line disabled:opacity-60"
                    style={{ backgroundColor: option.value }}
                  >
                    {selected && <Check className="size-4" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
