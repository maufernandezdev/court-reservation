"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { Button } from "@/components/ui/button";

/** Resumen del período listo para pegar en WhatsApp, con botón para copiarlo. */
export function CopySummary({ text }: { text: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado", { description: "Pegalo en WhatsApp para compartir el resumen." });
    } catch {
      toast.error("No se pudo copiar. Probá de nuevo.");
    }
  };

  return (
    <section aria-labelledby="resumen-whatsapp" className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="resumen-whatsapp" className="flex items-center gap-2 text-base font-bold">
          <WhatsAppIcon className="size-5 text-green-600" />
          Resumen para WhatsApp
        </h2>
        <Button variant="outline" size="sm" onClick={copy}>
          <Copy className="mr-2 size-4" />
          Copiar
        </Button>
      </div>
      <pre className="rounded-xl bg-muted p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">{text}</pre>
    </section>
  );
}
