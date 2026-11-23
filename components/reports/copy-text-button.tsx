"use client";

import { toast } from "sonner";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { Button } from "@/components/ui/button";

/** Copia un texto listo para pegar en WhatsApp. */
export function CopyTextButton({ text, label = "Copiar para WhatsApp" }: { text: string; label?: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado", { description: "Pegalo en WhatsApp para mandarlo." });
    } catch {
      toast.error("No se pudo copiar. Probá de nuevo.");
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={copy}>
      <WhatsAppIcon className="size-4 text-green-600" />
      {label}
    </Button>
  );
}
