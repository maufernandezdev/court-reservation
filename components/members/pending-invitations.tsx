"use client";

import { Link2, X } from "lucide-react";
import { isExpired, shortDate, type ClubInvitation } from "@/lib/invitations";
import { CLUB_ROLE_LABELS } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Invitaciones abiertas del club (pendientes o vencidas sin usar). */
export function PendingInvitations({
  invitations,
  busyId,
  onRegenerate,
  onRevoke,
}: {
  invitations: ClubInvitation[];
  busyId: string | null;
  onRegenerate: (invitation: ClubInvitation) => void;
  onRevoke: (invitation: ClubInvitation) => void;
}) {
  if (invitations.length === 0) return null;

  return (
    <section
      aria-labelledby="invitaciones"
      className="overflow-hidden rounded-2xl border bg-card"
    >
      <h2 id="invitaciones" className="border-b px-5 py-3.5 text-base font-bold">
        Invitaciones pendientes
      </h2>
      <ul className="divide-y">
        {invitations.map((invitation) => {
          const name = invitation.full_name || invitation.email;
          const expired = isExpired(invitation.expires_at);
          return (
            <li
              key={invitation.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5"
            >
              <span className="flex min-w-0 flex-[1_1_220px] flex-col">
                <strong className="truncate text-[15px]">{name}</strong>
                <span className="truncate text-[13px] text-muted-foreground">
                  {invitation.email} · {CLUB_ROLE_LABELS[invitation.role]}
                </span>
              </span>
              {expired ? (
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  Vencida
                </Badge>
              ) : (
                <span className="font-mono text-[13px] text-muted-foreground">
                  Vence el {shortDate(invitation.expires_at)}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === invitation.id}
                  onClick={() => onRegenerate(invitation)}
                >
                  <Link2 />
                  Generar link nuevo
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Cancelar la invitación de ${name}`}
                  disabled={busyId === invitation.id}
                  onClick={() => onRevoke(invitation)}
                >
                  <X />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
