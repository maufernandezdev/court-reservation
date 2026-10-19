import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_CLUB_COOKIE,
  roleAtLeast,
  type ClubRole,
  type Membership,
} from "@/lib/roles";

export type SessionContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string } | null;
  /** Membresía en el club activo. */
  membership: Membership | null;
  /** Todas las membresías de la persona (para el selector de club). */
  memberships: Membership[];
};

/** Membresías del usuario con los datos de su club, la más reciente primero. */
export async function fetchMemberships(
  supabase: SessionContext["supabase"],
  userId: string
): Promise<Membership[]> {
  const { data } = await supabase
    .from("memberships")
    .select("*, club:clubs(id, name, city, logo_path, logo_updated_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as Membership[]).filter((m) => m.club);
}

/**
 * Contexto de sesión: usuario autenticado + su membresía en el club activo.
 * El club activo es el de la cookie `club_activo`; si no hay cookie o ya no es
 * miembro de ese club, la membresía más reciente.
 */
export async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, membership: null, memberships: [] };
  }

  const memberships = await fetchMemberships(supabase, user.id);
  const activeClubId = (await cookies()).get(ACTIVE_CLUB_COOKIE)?.value;
  const membership =
    memberships.find((m) => m.club_id === activeClubId) ?? memberships[0] ?? null;

  return {
    supabase,
    user: { id: user.id, email: user.email },
    membership,
    memberships,
  };
}

/**
 * Exige sesión activa con rol >= `minimum` en el club activo. Lanza Error con mensaje en español.
 */
export async function requireRole(minimum: ClubRole): Promise<SessionContext> {
  const ctx = await getSessionContext();

  if (!ctx.user) {
    throw new Error("No hay sesión activa.");
  }

  if (!ctx.membership || !roleAtLeast(ctx.membership.role, minimum)) {
    throw new Error("No tenés permisos para realizar esta acción.");
  }

  return ctx;
}

/** Guarda el club activo (solo desde Server Actions). */
export async function setActiveClubCookie(clubId: string): Promise<void> {
  (await cookies()).set(ACTIVE_CLUB_COOKIE, clubId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
