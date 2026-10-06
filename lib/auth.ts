import { createClient } from "@/lib/supabase/server";
import { roleAtLeast, type ClubRole, type Membership } from "@/lib/roles";

export type SessionContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string } | null;
  membership: Membership | null;
};

/**
 * Contexto de sesión: usuario autenticado + su membresía activa (club más reciente).
 */
export async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, membership: null };
  }

  const { data } = await supabase
    .from("memberships")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    supabase,
    user: { id: user.id, email: user.email },
    membership: (data as Membership | null) ?? null,
  };
}

/**
 * Exige sesión activa con rol >= `minimum`. Lanza Error con mensaje en español.
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
