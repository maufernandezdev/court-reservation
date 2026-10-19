import Link from "next/link";
import { CircleAlert, Clock, UserCheck, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  invitationTokenSchema,
  shortDate,
  type InvitationLookup,
} from "@/lib/invitations";
import { CLUB_ROLE_LABELS } from "@/lib/roles";
import { AuthHeading, AuthLayout } from "@/components/auth/auth-layout";
import {
  JoinInvitationForm,
  JoinWithSessionButton,
} from "@/components/invitations/join-invitation-form";
import { SignOutButton } from "@/components/onboarding/sign-out-button";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Invitación" };

const INVALID: InvitationLookup = {
  status: "invalid",
  club_name: null,
  role: null,
  note: null,
  expires_at: null,
};

function Problem({
  icon,
  title,
  description,
  loginLabel = "Ir al ingreso",
  href = "/login",
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  loginLabel?: string;
  href?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted">{icon}</span>
      <AuthHeading title={title} description={description} />
      <Button asChild variant="outline" size="lg">
        <Link href={href}>{loginLabel}</Link>
      </Button>
    </div>
  );
}

/** Pantalla pública del link de invitación (`/invitacion/<token>`). */
export default async function InvitacionPage({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  const supabase = await createClient();

  const validToken = invitationTokenSchema.safeParse(token).success;
  const { data } = validToken
    ? await supabase.rpc("get_invitation", { p_token: token })
    : { data: null };
  const invitation = ((data ?? []) as InvitationLookup[])[0] ?? INVALID;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const clubName = invitation.club_name ?? "el club";
  let content: React.ReactNode;

  switch (invitation.status) {
    case "invalid":
      content = (
        <Problem
          icon={<CircleAlert className="size-6 text-destructive" />}
          title="Este link no es válido"
          description="Puede que esté incompleto o que ya lo hayan reemplazado por uno nuevo. Pedile al administrador del club que te mande el link otra vez."
        />
      );
      break;
    case "expired":
      content = (
        <Problem
          icon={<Clock className="size-6 text-muted-foreground" />}
          title="La invitación venció"
          description={
            <>
              La invitación a <strong className="text-foreground">{clubName}</strong> vencía a los 7
              días. Pedile al administrador un link nuevo.
            </>
          }
        />
      );
      break;
    case "revoked":
      content = (
        <Problem
          icon={<CircleAlert className="size-6 text-muted-foreground" />}
          title="La invitación fue cancelada"
          description={
            <>
              El administrador de <strong className="text-foreground">{clubName}</strong> canceló
              esta invitación. Si es un error, pedile un link nuevo.
            </>
          }
        />
      );
      break;
    case "accepted":
      content = (
        <Problem
          icon={<UserCheck className="size-6 text-muted-foreground" />}
          title="Esta invitación ya se usó"
          description="Si ya sos parte del club, ingresá con tu correo y contraseña."
          loginLabel={user ? "Ir al panel" : "Ir al ingreso"}
          href={user ? "/dashboard" : "/login"}
        />
      );
      break;
    case "pending": {
      const roleLabel = invitation.role ? CLUB_ROLE_LABELS[invitation.role] : "";
      const intro = (
        <div className="flex flex-col gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-ball text-ball-foreground">
            <UsersRound className="size-6" />
          </span>
          <AuthHeading
            eyebrow="TE INVITARON A"
            title={clubName}
            description={
              <>
                Vas a entrar como <strong className="text-foreground">{roleLabel}</strong>. La
                invitación vence el {invitation.expires_at ? shortDate(invitation.expires_at) : "—"}.
              </>
            }
          />
        </div>
      );

      if (user) {
        content = (
          <div className="flex flex-col gap-6">
            {intro}
            <p className="rounded-xl bg-muted px-4 py-3 text-[15px] text-pretty text-muted-foreground">
              Vas a unirte con la cuenta <strong className="text-foreground">{user.email}</strong>.
            </p>
            <JoinWithSessionButton token={token} />
            <SignOutButton label="Usar otra cuenta" redirectTo={`/invitacion/${token}`} variant="outline" />
          </div>
        );
      } else {
        content = (
          <div className="flex flex-col gap-6">
            {intro}
            <JoinInvitationForm token={token} />
          </div>
        );
      }
      break;
    }
  }

  return <AuthLayout courtVariant="horizontal">{content}</AuthLayout>;
}
