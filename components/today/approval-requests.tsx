"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Clock, X } from "lucide-react";
import { approvalWhatsappHref } from "@/lib/approval";
import { approveReservationAction, rejectReservationAction } from "@/app/dashboard/reservas/actions";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Turno pedido en un horario con confirmación (datos planos que manda el servidor). */
export type ApprovalRequest = {
  id: string;
  date: string;
  time: string;
  title: string;
  courtName: string;
  status: "pending_approval" | "rejected";
  requestedBy: string;
  reason: string | null;
};

function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

/**
 * Hoy: el admin ve "Para confirmar" con confirmar y rechazar; el resto ve el estado de sus
 * pedidos y puede avisarle al admin por WhatsApp.
 */
export function ApprovalRequests({
  requests,
  isAdmin,
  clubName,
  clubWhatsapp,
}: {
  requests: ApprovalRequest[];
  isAdmin: boolean;
  clubName: string;
  clubWhatsapp: string | null;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (requests.length === 0) return null;

  const decide = async (id: string, approve: boolean) => {
    setBusyId(id);
    const result = approve ? await approveReservationAction(id) : await rejectReservationAction(id, "");
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error ?? "No se pudo guardar.");
      return;
    }
    toast.success(approve ? "Turno confirmado" : "Turno rechazado: el lugar quedó libre");
    startTransition(() => router.refresh());
  };

  return (
    <section aria-labelledby="para-confirmar" className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-dashed border-line bg-card p-5">
      <h2 id="para-confirmar" className="flex items-center gap-2 text-lg font-bold">
        <Clock aria-hidden="true" className="size-5" />
        {isAdmin ? "Para confirmar" : "Tus pedidos de horario"}
        <Badge variant="outline">{requests.length}</Badge>
      </h2>
      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3">
            <span className="w-24 font-mono text-sm">
              {shortDate(r.date)} {r.time}
            </span>
            <span className="flex min-w-0 flex-[1_1_220px] flex-col">
              <strong className="truncate text-[15px]">{r.title}</strong>
              <span className="truncate text-[13px] text-muted-foreground">
                {r.courtName}
                {isAdmin ? ` · pidió ${r.requestedBy}` : ""}
                {r.status === "rejected" && r.reason ? ` · Motivo: ${r.reason}` : ""}
              </span>
            </span>
            {isAdmin ? (
              <span className="flex gap-2">
                <Button size="sm" onClick={() => decide(r.id, true)} disabled={busyId === r.id}>
                  <Check />
                  Confirmar
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide(r.id, false)} disabled={busyId === r.id}>
                  <X />
                  Rechazar
                </Button>
              </span>
            ) : r.status === "rejected" ? (
              <Badge variant="cancelled">Rechazado</Badge>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Por confirmar</Badge>
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={approvalWhatsappHref(clubWhatsapp, {
                      clubName,
                      title: r.title,
                      courtName: r.courtName,
                      date: r.date,
                      time: r.time,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <WhatsAppIcon className="size-4" />
                    Avisar al admin
                  </Link>
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
