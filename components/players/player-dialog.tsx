"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { digitsOnly, playerSchema, type Player, type PlayerInput } from "@/lib/players";
import { createPlayerAction, updatePlayerAction } from "@/app/dashboard/jugadores/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const EMPTY: PlayerInput = { full_name: "", dni: "", phone: "", email: "" };

/** Alta (sin `player`) o edición de un jugador. */
export function PlayerDialog({
  open,
  onOpenChange,
  player,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: Player | null;
  onSaved: (name: string) => void;
}) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<PlayerInput>({
    resolver: zodResolver(playerSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    setError("");
    form.reset(
      player
        ? { full_name: player.full_name, dni: player.dni, phone: digitsOnly(player.phone), email: player.email }
        : EMPTY
    );
  }, [open, player, form]);

  const onSubmit = async (values: PlayerInput) => {
    setError("");
    setIsSubmitting(true);
    const result = player
      ? await updatePlayerAction(player.id, values)
      : await createPlayerAction(values);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "No se pudo guardar el jugador.");
      return;
    }
    onSaved(values.full_name.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{player ? "Editar jugador" : "Agregar jugador"}</DialogTitle>
          <DialogDescription>
            Solo el nombre es obligatorio. Con DNI o teléfono es más fácil encontrarlo al reservar.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            {error && (
              <Alert variant="destructive">
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
                    <Input placeholder="Mauricio Fernández" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dni"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNI</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="30111222" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="1155551111"
                        className="font-mono"
                        {...field}
                        onChange={(event) => field.onChange(digitsOnly(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo (opcional)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="mauricio@mail.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando…" : player ? "Guardar cambios" : "Agregar jugador"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
