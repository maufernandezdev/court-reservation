"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  invitationMessage,
  shortDate,
  whatsappUrl,
  type SharedInvitation,
} from "@/lib/invitations";
import { CLUB_ROLE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Link de invitación recién generado, con "Enviar por WhatsApp" y "Copiar link". */
export function InvitationShare({
  invitation,
  clubName,
}: {
  invitation: SharedInvitation;
  clubName: string;
}) {
  const [copied, setCopied] = useState(false);
  const message = invitationMessage({
    fullName: invitation.fullName,
    clubName,
    roleLabel: CLUB_ROLE_LABELS[invitation.role],
    email: invitation.email,
    link: invitation.link,
    expiresAt: invitation.expiresAt,
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitation.link);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Seleccioná el link y copialo a mano.");
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-[15px] text-pretty wrap-anywhere text-muted-foreground">
        Mandale el link a <strong className="text-foreground">{invitation.fullName}</strong>.
        Va a entrar con <strong className="text-foreground">{invitation.email}</strong> como{" "}
        {CLUB_ROLE_LABELS[invitation.role].toLowerCase()}. Sirve una sola vez y vence el{" "}
        {shortDate(invitation.expiresAt)}.
      </p>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="invitation-link">Link de invitación</Label>
        <Input
          id="invitation-link"
          readOnly
          value={invitation.link}
          onFocus={(event) => event.currentTarget.select()}
          className="font-mono text-[13px]"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild size="lg">
          <Link href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="text-ball" />
            Enviar por WhatsApp
          </Link>
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={copyLink}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copiado" : "Copiar link"}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Mensaje</span>
        <p className="rounded-xl bg-muted px-4 py-3 text-sm whitespace-pre-line wrap-anywhere text-muted-foreground">
          {message}
        </p>
      </div>
    </div>
  );
}
