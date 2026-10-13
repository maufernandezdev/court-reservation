"use client";

import { useEffect, useId, useRef, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMembership } from "@/hooks/use-membership";
import type { ReservationPerson } from "@/lib/reservations";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type SocioHit = { id: string; full_name: string; dni: string; phone: string };

/** Quita los caracteres que rompen un filtro `or` de PostgREST. */
function sanitize(query: string): string {
  return query.replace(/[,()*%\\]/g, " ").trim();
}

/**
 * Personas del turno: escribir sugiere socios del club (nombre o DNI); clic o
 * Enter fija la persona; Enter sobre un texto sin sugerencias la fija como no socia.
 * La primera persona es quien reserva.
 */
export function PeopleCombobox({
  id,
  value,
  onChange,
  max,
  disabled = false,
  invalid = false,
  firstLabel = "Reserva",
  placeholder = "Escribí un nombre o DNI",
}: {
  id?: string;
  value: ReservationPerson[];
  onChange: (people: ReservationPerson[]) => void;
  max: number;
  disabled?: boolean;
  invalid?: boolean;
  firstLabel?: string;
  placeholder?: string;
}) {
  const clubId = useMembership().membership.club_id;
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SocioHit[]>([]);
  const [focused, setFocused] = useState(false);
  const listId = useId();
  const requestRef = useRef(0);

  const term = sanitize(query);
  const full = value.length >= max;

  useEffect(() => {
    if (!term) {
      setHits([]);
      return;
    }
    const request = ++requestRef.current;
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("socios")
        .select("id, full_name, dni, phone")
        .eq("club_id", clubId)
        .is("deleted_at", null)
        .or(`full_name.ilike.%${term}%,dni.ilike.%${term.replace(/[.\s]/g, "")}%`)
        .order("full_name")
        .limit(8);
      if (request === requestRef.current) setHits((data ?? []) as SocioHit[]);
    }, 200);
    return () => clearTimeout(timer);
  }, [term, clubId, supabase]);

  const selectedIds = new Set(value.map((p) => p.socio_id).filter(Boolean));
  const suggestions = hits.filter((hit) => !selectedIds.has(hit.id));
  const alreadyNamed = value.some((p) => p.name.toLowerCase() === term.toLowerCase());

  // Opción resaltada: el primer socio sugerido; si no hay, "agregar sin ser socio".
  // Se recalcula cuando llegan las sugerencias (llegan después de lo escrito).
  const firstOption = suggestions[0]?.id ?? (alreadyNamed ? "" : `libre:${term}`);
  const [highlighted, setHighlighted] = useState("");
  useEffect(() => {
    setHighlighted(firstOption);
  }, [firstOption]);

  const add = (person: ReservationPerson) => {
    if (full) return;
    onChange([...value, person]);
    setQuery("");
    setHits([]);
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const showList = focused && term.length > 0 && !full;

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Personas del turno">
          {value.map((person, index) => (
            <li
              key={`${person.socio_id ?? "libre"}-${person.name}-${index}`}
              className="flex items-center gap-1.5 rounded-full border bg-card py-1 pr-1 pl-3 text-sm"
            >
              {index === 0 && (
                <span className="font-mono text-[11px] text-muted-foreground uppercase">
                  {firstLabel}
                </span>
              )}
              <span className="font-medium">{person.name}</span>
              {!person.socio_id && (
                <span className="text-xs text-muted-foreground">(no socio)</span>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Quitar a ${person.name}`}
                  className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-line"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <Command
          shouldFilter={false}
          value={highlighted}
          onValueChange={setHighlighted}
          className={cn(
            "relative overflow-visible rounded-lg border bg-card",
            invalid && "border-destructive",
            full && "opacity-60"
          )}
        >
          <CommandInput
            id={id}
            value={query}
            onValueChange={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={full}
            aria-invalid={invalid || undefined}
            aria-controls={listId}
            placeholder={full ? `Hasta ${max} personas` : placeholder}
          />
          {showList && (
            <CommandList
              id={listId}
              className="absolute top-full right-0 left-0 z-50 mt-1 max-h-64 rounded-lg border bg-popover shadow-md"
            >
              {suggestions.length > 0 && (
                <CommandGroup heading="Socios">
                  {suggestions.map((hit) => (
                    <CommandItem
                      key={hit.id}
                      value={hit.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onSelect={() => add({ name: hit.full_name, socio_id: hit.id, phone: hit.phone })}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{hit.full_name}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {[hit.dni && `DNI ${hit.dni}`, hit.phone].filter(Boolean).join(" · ") || "Socio"}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {!alreadyNamed && (
                <CommandGroup heading={suggestions.length > 0 ? "No es socio" : undefined}>
                  <CommandItem
                    value={`libre:${term}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onSelect={() => add({ name: term, socio_id: null })}
                  >
                    <UserPlus />
                    Agregar «{term}» sin ser socio
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          )}
        </Command>
      )}
    </div>
  );
}
