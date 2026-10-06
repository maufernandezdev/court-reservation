import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth";
import {
  AUDIT_ACTIONS_BY_KIND,
  AUDIT_KINDS,
  AUDIT_KIND_LABELS,
  auditKindOf,
  describeAuditEntry,
  type AuditContext,
  type AuditKind,
} from "@/lib/audit";
import type { AuditEntry } from "@/lib/reservations";
import { PageHeader } from "@/components/shell/page-header";
import { ActivityFilters } from "@/components/activity/activity-filters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Actividad" };

const PAGE_SIZE = 50;
const CLUB_TZ = "America/Argentina/Buenos_Aires";

const searchSchema = z.object({
  persona: z.string().uuid().optional().catch(undefined),
  tipo: z.enum(AUDIT_KINDS).optional().catch(undefined),
  antes: z.string().datetime({ offset: true }).optional().catch(undefined),
});

const KIND_STYLES: Record<AuditKind, string> = {
  charged: "bg-ink text-primary-foreground",
  created: "bg-muted text-foreground",
  updated: "bg-line-soft text-line-soft-foreground",
  cancelled: "bg-danger-soft text-danger-soft-foreground",
};

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: CLUB_TZ });
}

function dayLabel(key: string): string {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: CLUB_TZ });
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = y.toLocaleDateString("sv-SE", { timeZone: CLUB_TZ });
  const [yy, mm, dd] = key.split("-").map(Number);
  const full = new Date(yy, mm - 1, dd).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const prefix = key === today ? "Hoy · " : key === yesterday ? "Ayer · " : "";
  return `${prefix}${full}`.toUpperCase();
}

function initials(text: string): string {
  const words = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

export default async function ActividadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, membership } = await getSessionContext();

  if (!membership || membership.role !== "admin") {
    return (
      <Alert>
        <ShieldAlert className="size-4" />
        <AlertDescription>
          Solo los administradores pueden ver la actividad del club.
        </AlertDescription>
      </Alert>
    );
  }

  const raw = await searchParams;
  const filters = searchSchema.parse({
    persona: typeof raw.persona === "string" ? raw.persona : undefined,
    tipo: typeof raw.tipo === "string" ? raw.tipo : undefined,
    antes: typeof raw.antes === "string" ? raw.antes : undefined,
  });

  let query = supabase
    .from("audit_log")
    .select("*")
    .eq("owner_id", membership.owner_id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (filters.persona) query = query.eq("actor_id", filters.persona);
  if (filters.tipo) query = query.in("action", AUDIT_ACTIONS_BY_KIND[filters.tipo]);
  if (filters.antes) query = query.lt("created_at", filters.antes);

  const [{ data: auditData, error }, { data: membersData }, { data: courtsData }] =
    await Promise.all([
      query,
      supabase
        .from("memberships")
        .select("id, user_id, full_name, email, role")
        .eq("owner_id", membership.owner_id),
      supabase.from("courts").select("id, name").eq("user_id", membership.owner_id),
    ]);

  const rows = (auditData ?? []) as AuditEntry[];
  const hasMore = rows.length > PAGE_SIZE;
  const entries = rows.slice(0, PAGE_SIZE);

  const members = (membersData ?? []) as {
    id: string;
    user_id: string;
    full_name: string | null;
    email: string;
    role: string;
  }[];
  const memberByUser = new Map(members.map((m) => [m.user_id, m]));
  const courtName = new Map(
    ((courtsData ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
  );

  // Turnos referenciados por las entradas (para nombre, cancha y horario).
  const reservationIds = [
    ...new Set(
      entries.filter((e) => e.entity === "reservation" && e.entity_id).map((e) => e.entity_id!)
    ),
  ];
  const { data: reservationsData } = reservationIds.length
    ? await supabase
        .from("reservations")
        .select("id, customer_name, date, time, court_id")
        .in("id", reservationIds)
    : { data: [] };
  const reservationById = new Map(
    ((reservationsData ?? []) as {
      id: string;
      customer_name: string;
      date: string;
      time: string;
      court_id: string;
    }[]).map((r) => [r.id, r])
  );

  const contextFor = (entry: AuditEntry): AuditContext => {
    if (entry.entity === "reservation" && entry.entity_id) {
      const r = reservationById.get(entry.entity_id);
      return r
        ? { reservation: { ...r, courtName: courtName.get(r.court_id) } }
        : {};
    }
    if (entry.entity === "court" && entry.entity_id) {
      return { courtName: courtName.get(entry.entity_id) };
    }
    if (entry.entity === "member" && entry.entity_id) {
      // Las entradas de miembros guardan el user_id de la persona.
      const m = memberByUser.get(entry.entity_id);
      return { memberName: m ? m.full_name || m.email : undefined };
    }
    return {};
  };

  const groups = new Map<string, AuditEntry[]>();
  for (const entry of entries) {
    const key = dayKey(entry.created_at);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const nextHref = (() => {
    const last = entries[entries.length - 1];
    if (!hasMore || !last) return null;
    const params = new URLSearchParams();
    if (filters.persona) params.set("persona", filters.persona);
    if (filters.tipo) params.set("tipo", filters.tipo);
    params.set("antes", last.created_at);
    return `/dashboard/actividad?${params.toString()}`;
  })();

  const people = members
    .map((m) => ({ user_id: m.user_id, name: m.full_name || m.email }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Actividad"
        description="Quién creó, movió, cobró o canceló cada turno."
      />

      <ActivityFilters
        people={people}
        person={filters.persona ?? null}
        kind={filters.tipo ?? null}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>No se pudo cargar la actividad.</AlertDescription>
        </Alert>
      )}

      {filters.antes && (
        <Link
          href={(() => {
            const params = new URLSearchParams();
            if (filters.persona) params.set("persona", filters.persona);
            if (filters.tipo) params.set("tipo", filters.tipo);
            const qs = params.toString();
            return qs ? `/dashboard/actividad?${qs}` : "/dashboard/actividad";
          })()}
          className="w-fit text-sm font-semibold underline-offset-4 hover:underline"
        >
          ← Volver a lo más reciente
        </Link>
      )}

      {entries.length === 0 && !error ? (
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          No hay actividad con esos filtros.
        </p>
      ) : (
        [...groups.entries()].map(([key, items]) => (
          <section key={key} aria-labelledby={`day-${key}`} className="flex flex-col gap-2.5">
            <h2
              id={`day-${key}`}
              className="font-mono text-[13px] font-semibold tracking-[0.04em] text-muted-foreground"
            >
              {dayLabel(key)}
            </h2>
            <ol className="overflow-hidden rounded-2xl border bg-card">
              {items.map((entry) => {
                const actor = entry.actor_id ? memberByUser.get(entry.actor_id) : undefined;
                const actorName = actor ? actor.full_name || actor.email : "Sistema";
                const kind = auditKindOf(entry.action);
                return (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-muted px-5 py-3.5 first:border-t-0"
                  >
                    <time
                      dateTime={entry.created_at}
                      className="w-12 font-mono text-sm text-muted-foreground"
                    >
                      {new Date(entry.created_at).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                        timeZone: CLUB_TZ,
                      })}
                    </time>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        actor?.role === "profesor"
                          ? "bg-line text-line-foreground"
                          : "bg-ink text-primary-foreground"
                      )}
                    >
                      {initials(actorName)}
                    </span>
                    <span className="min-w-0 flex-[1_1_320px] text-[15px] leading-snug">
                      <strong>{actorName}</strong>{" "}
                      {describeAuditEntry(entry, contextFor(entry))}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2.5 py-1 text-[13px] font-semibold",
                        KIND_STYLES[kind]
                      )}
                    >
                      {AUDIT_KIND_LABELS[kind]}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}

      {nextHref && (
        <Button asChild variant="outline" className="w-fit self-center">
          <Link href={nextHref}>Cargar más</Link>
        </Button>
      )}
    </div>
  );
}
