"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AUDIT_KINDS, AUDIT_KIND_LABELS, type AuditKind } from "@/lib/audit";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ActivityFiltersProps = {
  people: { user_id: string; name: string }[];
  person: string | null;
  kind: AuditKind | null;
};

/** Filtros de Actividad: escriben en la URL (el Server Component vuelve a leer). */
export function ActivityFilters({ people, person, kind }: ActivityFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const go = (next: { persona?: string | null; tipo?: string | null }) => {
    const params = new URLSearchParams();
    const persona = next.persona !== undefined ? next.persona : person;
    const tipo = next.tipo !== undefined ? next.tipo : kind;
    if (persona) params.set("persona", persona);
    if (tipo) params.set("tipo", tipo);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-person" className="text-[13px]">
          Persona
        </Label>
        <Select
          value={person ?? "all"}
          onValueChange={(v) => go({ persona: v === "all" ? null : v })}
        >
          <SelectTrigger id="activity-person" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo el equipo</SelectItem>
            {people.map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ToggleGroup
        type="single"
        variant="segmented"
        spacing={1}
        value={kind ?? "all"}
        onValueChange={(v) => v && go({ tipo: v === "all" ? null : v })}
        aria-label="Tipo de acción"
        className="flex-wrap rounded-lg bg-muted p-1"
      >
        <ToggleGroupItem value="all" className="h-9 px-3.5">
          Todo
        </ToggleGroupItem>
        {AUDIT_KINDS.map((k) => (
          <ToggleGroupItem key={k} value={k} className="h-9 px-3.5">
            {AUDIT_KIND_LABELS[k]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {isPending && (
        <Loader2 className="mb-3 size-4 animate-spin text-muted-foreground" aria-label="Cargando" />
      )}
    </div>
  );
}
