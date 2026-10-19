"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setActiveClubCookie } from "@/lib/auth";
import {
  invitationTokenSchema,
  joinExistingAccountSchema,
  joinNewAccountSchema,
  type InvitationLookup,
  type JoinExistingAccountInput,
  type JoinNewAccountInput,
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

/** El link tiene que estar pendiente: si no, devuelve el mensaje que corresponde. */
async function requirePending(
  supabase: Awaited<ReturnType<typeof createClient>>,
  token: string
): Promise<ActionResult | null> {
  const invitation = await lookup(supabase, token);
  if (!invitation || invitation.status !== "pending") {
    const status = invitation && invitation.status !== "pending" ? invitation.status : "invalid";
    return { success: false, error: STATUS_ERRORS[status] };
  }
  return null;
}

/** Inicia sesión con correo y contraseña, acepta la invitación y entra al panel del club. */
async function signInAcceptAndEnter(
  supabase: Awaited<ReturnType<typeof createClient>>,
  token: string,
  email: string,
  password: string
): Promise<ActionResult> {
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return {
      success: false,
      error:
        signInError.code === "invalid_credentials"
          ? "El correo o la contraseña no son correctos."
          : "No se pudo iniciar sesión. Probá de nuevo.",
    };
  }

  const accepted = await acceptAndEnter(supabase, token);
  if (typeof accepted !== "string") return accepted;

  await setActiveClubCookie(accepted);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

/**
 * Ingreso desde el link sin cuenta: crea la cuenta con el nombre, el correo y la contraseña que
 * cargó la persona (ya confirmada: el link prueba que el admin se lo mandó) y entra al club.
 * Si el correo ya tiene cuenta, le pide que ingrese con su contraseña.
 */
export async function joinWithNewAccountAction(input: JoinNewAccountInput): Promise<ActionResult> {
  const parsed = joinNewAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { token, full_name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const supabase = await createClient();

  const problem = await requirePending(supabase, token);
  if (problem) return problem;

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
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError) {
    return {
      success: false,
      error:
        createError.code === "email_exists"
          ? "Ese correo ya tiene una cuenta. Elegí \"Ya tengo cuenta\" e ingresá con tu contraseña."
          : "No se pudo crear tu cuenta. Probá de nuevo.",
    };
  }

  return signInAcceptAndEnter(supabase, token, email, password);
}

/** Ingreso desde el link con una cuenta que ya existe: correo y contraseña. */
export async function joinWithExistingAccountAction(input: JoinExistingAccountInput): Promise<ActionResult> {
  const parsed = joinExistingAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { token, password } = parsed.data;
  const supabase = await createClient();

  const problem = await requirePending(supabase, token);
  if (problem) return problem;

  return signInAcceptAndEnter(supabase, token, parsed.data.email.toLowerCase(), password);
}

/** "Unirme al club" con la sesión que ya está iniciada. */
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
