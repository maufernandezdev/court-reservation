"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Clock, X } from "lucide-react";
import type { Reservation } from "@/lib/reservations";
import { approvalWhatsappHref } from "@/lib/approval";
import { reservationTitle } from "@/lib/reservation-tone";
import { approveReservationAction, rejectReservationAction } from "@/app/dashboard/reservas/actions";
import { useActiveClub } from "@/components/shell/active-club-provider";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Turno en un horario con confirmación: el admin lo confirma o lo rechaza; quien lo pidió ve el
 * estado y puede avisarle al admin por WhatsApp con el mensaje armado.
 */
export function ApprovalBox({
  reservation,
  courtName,
  isAdmin,
  onSaved,
}: {
  reservation: Reservation;
  courtName: string;
  isAdmin: boolean;
  onSaved: (reservation: Reservation) => void;
}) {
  const { membership } = useActiveClub();
  // El número del club se carga en Políticas (bloque 5); sin número, WhatsApp pide elegir el chat.
  const whatsapp: string | null = null;
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (reservation.status === "rejected") {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          El admin rechazó este horario: el turno no ocupa el lugar.
          {reservation.cancel_reason ? ` Motivo: ${reservation.cancel_reason}` : ""}
        </AlertDescription>
      </Alert>
    );
  }
  if (reservation.status !== "pending_approval") return null;

  const approve = async () => {
    setBusy(true);
    const result = await approveReservationAction(reservation.id);
    setBusy(false);
    if (!result.success || !result.reservation) {
      toast.error(result.error ?? "No se pudo confirmar el turno.");
      return;
    }
    toast.success("Turno confirmado");
    onSaved(result.reservation);
  };

  const reject = async () => {
    setBusy(true);
    const result = await rejectReservationAction(reservation.id, reason);
    setBusy(false);
    setRejectOpen(false);
    if (!result.success || !result.reservation) {
      toast.error(result.error ?? "No se pudo rechazar el turno.");
      return;
    }
    toast.success("Turno rechazado: el lugar quedó libre");
    onSaved(result.reservation);
  };

  const waHref = approvalWhatsappHref(whatsapp, {
    clubName: membership.club.name,
    title: reservationTitle(reservation),
    courtName,
    date: reservation.date,
    time: reservation.time,
  });

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border-[1.5px] border-dashed border-line p-3.5 text-sm">
      <span className="flex items-center gap-2 font-semibold">
        <Clock aria-hidden="true" className="size-4" />
        Por confirmar
      </span>
      <p className="text-pretty text-muted-foreground">
        Este horario necesita la confirmación del admin. Mientras tanto el turno ocupa el lugar.
      </p>
      {isAdmin ? (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={approve} disabled={busy}>
            <Check />
            Confirmar
          </Button>
          <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={busy}>
            <X />
            Rechazar
          </Button>
        </div>
      ) : (
        <Button asChild variant="outline">
          <Link href={waHref} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon className="size-4" />
            Avisar al admin por WhatsApp
          </Link>
        </Button>
      )}

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar el horario?</AlertDialogTitle>
            <AlertDialogDescription>
              El turno queda rechazado y el lugar se libera. Quien lo pidió ve el motivo en el detalle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`reject-reason-${reservation.id}`}>Motivo (opcional)</Label>
            <Textarea
              id={`reject-reason-${reservation.id}`}
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: ese horario es para socios"
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Mejor no</AlertDialogCancel>
            <AlertDialogAction onClick={reject} disabled={busy} variant="destructive">
              Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
