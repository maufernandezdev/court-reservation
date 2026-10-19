"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, X } from "lucide-react";
import type { Reservation } from "@/lib/reservations";
import { useCourts } from "@/hooks/use-courts";
import { useMembership } from "@/hooks/use-membership";
import { useReservations } from "@/hooks/use-reservations";
import { useReservationDetail } from "@/hooks/use-reservation-detail";
import { ReservationDialog } from "@/components/reservations/reservation-dialog";
import { CancelConfirmDialog } from "@/components/reservations/reservation-detail-panel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Diálogo de edición: carga canchas y turnos de la fecha recién al abrirse, no por cada tarjeta. */
function EditTurnDialog({ turn, onClose }: { turn: Reservation; onClose: () => void }) {
  const router = useRouter();
  const { courts, isLoading: isLoadingCourts } = useCourts();
  const { membership } = useMembership();
  const { reservations, isLoading: isLoadingReservations } = useReservations(turn.date);
  const activeReservations = useMemo(() => reservations.filter((r) => r.status === "active"), [reservations]);

  if (isLoadingCourts || isLoadingReservations) return null;

  return (
    <ReservationDialog
      open
      onOpenChange={(open) => !open && onClose()}
      mode="edit"
      reservation={turn}
      initialCourtId={turn.court_id}
      initialTime={turn.time}
      initialDate={turn.date}
      courts={courts}
      activeReservations={activeReservations}
      membership={membership}
      // Mis turnos es un Server Component: se vuelve a pedir para ver el cambio.
      onSaved={() => {
        router.refresh();
        onClose();
      }}
      onCancelled={() => router.refresh()}
      showDetail={false}
    />
  );
}

/** Confirmación de cancelación (con la política y la penalidad del club) abierta desde la tarjeta. */
function CancelTurnDialog({ turn, onClose }: { turn: Reservation; onClose: () => void }) {
  const router = useRouter();
  const { courts } = useCourts();
  const { membership } = useMembership();
  const detail = useReservationDetail({
    open: true,
    reservation: turn,
    courts,
    membership,
    onSaved: () => router.refresh(),
    onCancelled: () => router.refresh(),
    onClosed: onClose,
  });

  // Se abre cuando ya cargaron los cobros y la política, para que el monto de la penalidad sea el real.
  const { isLoadingExtras, cancelConfirmOpen, setCancelConfirmOpen } = detail;
  useEffect(() => {
    if (!isLoadingExtras) setCancelConfirmOpen(true);
  }, [isLoadingExtras, setCancelConfirmOpen]);

  // Si se cierra sin confirmar, se desmonta.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (cancelConfirmOpen) wasOpen.current = true;
    else if (wasOpen.current) onClose();
  }, [cancelConfirmOpen, onClose]);

  return <CancelConfirmDialog reservation={turn} detail={detail} />;
}

/** Tres puntos de una tarjeta de Mis turnos: editar (mismo formulario que la planilla) o cancelar. */
export function TurnActionsMenu({ turn }: { turn: Reservation }) {
  const [action, setAction] = useState<"edit" | "cancel" | null>(null);
  const close = () => setAction(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Opciones del turno">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setAction("edit")}>
            <Pencil />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setAction("cancel")}>
            <X />
            Cancelar turno
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {action === "edit" && <EditTurnDialog turn={turn} onClose={close} />}
      {action === "cancel" && <CancelTurnDialog turn={turn} onClose={close} />}
    </>
  );
}
