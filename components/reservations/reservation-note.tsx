"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { StickyNote } from "lucide-react";
import { NOTE_MAX_LENGTH, reservationNoteSchema } from "@/lib/reservations";
import { setReservationNoteAction } from "@/app/dashboard/reservas/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const noteFormSchema = z.object({ note: reservationNoteSchema });
type NoteFormValues = z.infer<typeof noteFormSchema>;

/** Papel del post-it: amarillo en los dos modos, con texto oscuro y la esquina doblada. */
const PAPER =
  "bg-[#fff1a8] text-[#3d3200] shadow-[0_2px_6px_rgb(16_20_24/0.18)] [background-image:linear-gradient(225deg,#e8d46a_0_10px,transparent_10px)]";

/**
 * Esquina doblada tipo post-it en el ángulo inferior derecho de la tarjeta del turno. Ocupa solo el
 * margen interno de la tarjeta, así no tapa su texto ni el de las tarjetas vecinas.
 * La tarjeta tiene que ser `relative`.
 */
export function NoteCorner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute right-0 bottom-0 size-3 bg-[#ffe45c] shadow-[-1px_-1px_1px_rgb(16_20_24/0.18)] [clip-path:polygon(100%_0,100%_100%,0_100%)]",
        className
      )}
    />
  );
}

/** Contenido del globo con la nota (al pasar el mouse por la tarjeta). */
function NoteBubble({ note }: { note: string }) {
  return (
    <TooltipContent
      side="top"
      className={cn("max-w-56 -rotate-1 rounded-sm px-3 py-2 text-[13px] leading-snug font-medium", PAPER)}
    >
      {note}
    </TooltipContent>
  );
}

/** Envuelve una tarjeta (botón) para mostrar la nota del admin al pasar el mouse. */
export function WithNoteTooltip({ note, children }: { note?: string | null; children: React.ReactElement }) {
  if (!note) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <NoteBubble note={note} />
    </Tooltip>
  );
}

/** Ícono de nota con su globo, para listas donde no hay tarjeta (Hoy). */
export function NoteIcon({ note }: { note?: string | null }) {
  if (!note) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm bg-[#fff1a8] text-[#3d3200]"
          aria-label={`Nota: ${note}`}
        >
          <StickyNote className="size-3.5" />
        </button>
      </TooltipTrigger>
      <NoteBubble note={note} />
    </Tooltip>
  );
}

/**
 * Nota del turno en el detalle: post-it con el texto (admin y operador). El admin la agrega,
 * la cambia o la quita.
 */
export function ReservationNoteSection({
  reservationId,
  note,
  canEdit,
  onSaved,
}: {
  reservationId: string;
  note: string | null | undefined;
  canEdit: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    values: { note: note ?? "" },
  });
  const length = form.watch("note")?.length ?? 0;

  const save = async (value: string) => {
    setIsSaving(true);
    const { success, error } = await setReservationNoteAction(reservationId, value);
    setIsSaving(false);
    if (!success) {
      toast.error(error ?? "No se pudo guardar la nota");
      return;
    }
    toast.success(value.trim() ? "Nota guardada" : "Nota quitada");
    setEditing(false);
    await onSaved();
  };

  if (editing) {
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => save(v.note))} className={cn("flex flex-col gap-2 rounded-sm p-3", PAPER)}>
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    {...field}
                    autoFocus
                    rows={3}
                    maxLength={NOTE_MAX_LENGTH}
                    aria-label="Nota del turno"
                    placeholder="Ej.: trae su propia red, avisar a Diego si llega tarde"
                    className="resize-none border-[#d9c24f] bg-white/60 text-[#3d3200] placeholder:text-[#3d3200]/50"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs opacity-75">
              {length}/{NOTE_MAX_LENGTH}
            </span>
            <span className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? "Guardando…" : "Guardar"}
              </Button>
            </span>
          </div>
        </form>
      </Form>
    );
  }

  if (!note) {
    return canEdit ? (
      <Button variant="outline" size="sm" className="self-start" onClick={() => setEditing(true)}>
        <StickyNote />
        Agregar nota
      </Button>
    ) : null;
  }

  return (
    <div className={cn("flex flex-col gap-2 rounded-sm p-3 pr-5", PAPER)}>
      <p className="flex items-start gap-2 text-sm leading-snug font-medium text-pretty break-words">
        <StickyNote aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="sr-only">Nota: </span>
          {note}
        </span>
      </p>
      {canEdit && (
        <span className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[#3d3200] hover:bg-black/5"
            onClick={() => setEditing(true)}
          >
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[#3d3200] hover:bg-black/5"
            onClick={() => save("")}
            disabled={isSaving}
          >
            Quitar
          </Button>
        </span>
      )}
    </div>
  );
}
