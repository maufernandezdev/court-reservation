"use client";

import type { Court } from "@/lib/courts";
import type { Reservation } from "@/lib/reservations";
import type { Membership } from "@/lib/roles";
import { useReservationDetail } from "@/hooks/use-reservation-detail";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { ReservationDetailPanel } from "@/components/reservations/reservation-detail-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ReservationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  reservation: Reservation | null;
  initialCourtId: string;
  initialTime: string;
  initialDate: string;
  courts: Court[];
  activeReservations: Reservation[];
  membership: Membership;
  onSaved: (reservation: Reservation) => void;
  onCancelled: (reservation: Reservation) => void;
};

/**
 * Alta/edición de un turno en un diálogo. En edición suma el detalle
 * (cobros, cancelación, historial) con la lógica de `useReservationDetail`.
 */
export function ReservationDialog({
  open,
  onOpenChange,
  mode,
  reservation,
  initialCourtId,
  initialTime,
  initialDate,
  courts,
  activeReservations,
  membership,
  onSaved,
  onCancelled,
}: ReservationDialogProps) {
  const detail = useReservationDetail({
    open: open && mode === "edit",
    reservation: mode === "edit" ? reservation : null,
    courts,
    membership,
    onSaved,
    onCancelled,
    onClosed: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Editar reserva" : "Nueva reserva"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Modificá los datos, registrá cobros o cancelá la reserva."
              : "Completá los datos del turno."}
          </DialogDescription>
        </DialogHeader>

        <ReservationForm
          open={open}
          mode={mode}
          reservation={reservation}
          initialCourtId={initialCourtId}
          initialTime={initialTime}
          initialDate={initialDate}
          courts={courts}
          activeReservations={activeReservations}
          onSaved={onSaved}
          onClose={() => onOpenChange(false)}
        />

        {mode === "edit" && reservation && (
          <div className="border-t pt-4">
            <ReservationDetailPanel
              reservation={reservation}
              membership={membership}
              detail={detail}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
