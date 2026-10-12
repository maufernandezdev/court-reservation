import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, MailOpen, Plus } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import { CLUB_ROLE_LABELS, type ClubRole } from "@/lib/roles";
import { AuthHeading, AuthLayout } from "@/components/auth/auth-layout";
import { OnboardingSteps } from "@/components/onboarding/onboarding-steps";
import { PendingInvitationCard } from "@/components/onboarding/pending-invitation-card";
import { SignOutButton } from "@/components/onboarding/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type PendingInvitation = {
  id: string;
  club_name: string;
  role: ClubRole;
  expires_at: string;
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

const optionClass =
  "group flex items-start gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line";

export default async function BienvenidaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user, memberships } = await getSessionContext();

  if (!user) {
    redirect("/login");
  }

  // La bienvenida es solo para quien todavía no tiene club (crear otro club no está disponible).
  if (memberships.length > 0) {
    redirect("/dashboard");
  }

  const { opcion } = await searchParams;
  const { data } = await supabase.rpc("my_pending_invitations");
  const invitations = (data ?? []) as PendingInvitation[];

  if (opcion === "invitacion") {
    return (
      <AuthLayout aside={<OnboardingSteps current={2} />} courtVariant="vertical">
        <div className="flex flex-col gap-6">
          <AuthHeading
            eyebrow="PASO 2 DE 3"
            title={invitations.length ? "Tenés invitaciones" : "Esperá la invitación"}
            description={
              invitations.length
                ? "Elegí a qué club querés sumarte."
                : "Pedile al administrador de tu club que te invite desde Equipo. Te va a llegar un link por WhatsApp o por correo."
            }
          />

          <div className="flex flex-col gap-1.5 rounded-xl bg-muted px-4 py-3">
            <span className="text-sm text-muted-foreground">Tiene que invitarte con este correo:</span>
            <strong className="font-mono text-[15px] break-all">{user.email}</strong>
          </div>

          {invitations.length > 0 && (
            <ul className="flex flex-col gap-3" aria-label="Invitaciones pendientes">
              {invitations.map((invitation) => (
                <PendingInvitationCard
                  key={invitation.id}
                  id={invitation.id}
                  clubName={invitation.club_name}
                  roleLabel={CLUB_ROLE_LABELS[invitation.role]}
                  expiresLabel={shortDate(invitation.expires_at)}
                />
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/bienvenida">
                <ArrowLeft />
                Volver a elegir
              </Link>
            </Button>
            <SignOutButton label="Usar otra cuenta" />
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout aside={<OnboardingSteps current={2} />} courtVariant="vertical">
      <div className="flex flex-col gap-6">
        <AuthHeading
          eyebrow="PASO 2 DE 3"
          title="¿Cómo vas a usar saque?"
          description="Tu cuenta ya está lista. Ahora elegí si das de alta tu club o si te suman a uno."
        />

        <nav aria-label="Opciones" className="flex flex-col gap-3">
          <Link href="/bienvenida/club" className={optionClass}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ball text-ball-foreground">
              <Plus className="size-5" />
            </span>
            <span className="flex flex-1 flex-col gap-1">
              <strong className="text-lg">Crear mi club</strong>
              <span className="text-[15px] text-pretty text-muted-foreground">
                Cargás el club y sus canchas. Quedás como administrador y después
                invitás a tu equipo.
              </span>
            </span>
            <ArrowRight className="mt-3 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link href="/bienvenida?opcion=invitacion" className={optionClass}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sidebar text-sidebar-foreground">
              <MailOpen className="size-5" />
            </span>
            <span className="flex flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <strong className="text-lg">Me van a invitar</strong>
                {invitations.length > 0 && (
                  <Badge className="bg-line text-line-foreground">
                    {invitations.length === 1
                      ? "Tenés 1 invitación"
                      : `Tenés ${invitations.length} invitaciones`}
                  </Badge>
                )}
              </span>
              <span className="text-[15px] text-pretty text-muted-foreground">
                Trabajás en un club que ya usa saque: el administrador te suma
                con un link.
              </span>
            </span>
            <ArrowRight className="mt-3 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </nav>

        <div className="flex flex-wrap gap-3">
          <SignOutButton />
        </div>
      </div>
    </AuthLayout>
  );
}
