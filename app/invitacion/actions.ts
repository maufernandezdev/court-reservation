"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setActiveClubCookie } from "@/lib/auth";
import {
  invitationTokenSchema,
  joinInvitationSchema,
  type InvitationLookup,
  type JoinInvitationInput,
} from "@/lib/invitations";

type ActionResult = { success: false; error: string };

const STATUS_ERRORS: Record<Exclude<InvitationLookup["status"], "pending">, string> = {
  invalid: "El link de invitación no es válido.",
  expired: "La invitación venció. Pedile al administrador un link nuevo.",
  accepted: "La invitación ya se usó. Ingresá con tu correo y contraseña.",
  revoked: "La invitación fue cancelada. Pedile al administrador un link nuevo.",
};

async function lookup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  token: string
): Promise<InvitationLookup | null> {
  const { data } = await supabase.rpc("get_invitation", { p_token: token });
  return ((data ?? []) as InvitationLookup[])[0] ?? null;
}

/** Acepta la invitación con la sesión ya iniciada y entra al panel del club. */
async function acceptAndEnter(
  supabase: Awaited<ReturnType<typeof createClient>>,
  token: string
): Promise<ActionResult | string> {
  const { data: clubId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !clubId) {
    return {
      success: false,
      error: error?.message ?? "No se pudo aceptar la invitación.",
    };
  }
  return clubId as string;
}

/**
 * Ingreso desde el link sin sesión: con cuenta, inicia sesión con su contraseña;
 * sin cuenta, la crea ya confirmada con el correo invitado (el link prueba que el
 * admin se la mandó a esa persona) y después inicia sesión.
 */
export async function joinWithInvitationAction(
  input: JoinInvitationInput
): Promise<ActionResult> {
  const parsed = joinInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { token, password } = parsed.data;
  const supabase = await createClient();
  const invitation = await lookup(supabase, token);

  if (!invitation || invitation.status !== "pending" || !invitation.email) {
    const status = invitation && invitation.status !== "pending" ? invitation.status : "invalid";
    return { success: false, error: STATUS_ERRORS[status] };
  }

  if (!invitation.has_account) {
    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch (err) {
      // Falta SUPABASE_SECRET_KEY: no se pueden crear cuentas desde una invitación.
      console.error(err);
      return {
        success: false,
        error:
          "No pudimos crear tu cuenta por un problema de configuración del sistema. Avisale al administrador del club.",
      };
    }
    const { error: createError } = await admin.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: invitation.full_name ?? "" },
    });

    // Si justo se creó la cuenta por otro lado, sigue como "con cuenta".
    if (createError && createError.code !== "email_exists") {
      return { success: false, error: "No se pudo crear tu cuenta. Probá de nuevo." };
    }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invitation.email,
    password,
  });

  if (signInError) {
    return {
      success: false,
      error:
        signInError.code === "invalid_credentials"
          ? "La contraseña no es correcta."
          : "No se pudo iniciar sesión. Probá de nuevo.",
    };
  }

  const accepted = await acceptAndEnter(supabase, token);
  if (typeof accepted !== "string") return accepted;

  await setActiveClubCookie(accepted);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

/** "Unirme al club" cuando ya hay sesión con el correo invitado. */
export async function joinWithSessionAction(token: string): Promise<ActionResult> {
  const parsed = invitationTokenSchema.safeParse(token);
  if (!parsed.success) {
    return { success: false, error: STATUS_ERRORS.invalid };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Tu sesión venció. Recargá la página." };
  }

  const accepted = await acceptAndEnter(supabase, parsed.data);
  if (typeof accepted !== "string") return accepted;

  await setActiveClubCookie(accepted);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}
