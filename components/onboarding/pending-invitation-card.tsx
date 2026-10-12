"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { acceptPendingInvitationAction } from "@/app/bienvenida/actions";

type PendingInvitationCardProps = {
  id: string;
  clubName: string;
  roleLabel: string;
  expiresLabel: string;
};

/** Invitación pendiente para el correo de la sesión, con "Unirme". */
export function PendingInvitationCard({
  id,
  clubName,
  roleLabel,
  expiresLabel,
}: PendingInvitationCardProps) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const join = () => {
    setError("");
    startTransition(async () => {
      // Si sale bien, la acción redirige al panel del club.
      const result = await acceptPendingInvitationAction(id);
      if (result && !result.success) setError(result.error);
    });
  };

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <strong className="truncate text-base">{clubName}</strong>
          <span className="text-sm text-muted-foreground">
            Como {roleLabel} · vence el {expiresLabel}
          </span>
        </div>
        <Button onClick={join} disabled={isPending}>
          {isPending ? "Uniéndote…" : "Unirme"}
          {!isPending && <ArrowRight className="text-ball" />}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </li>
  );
}
