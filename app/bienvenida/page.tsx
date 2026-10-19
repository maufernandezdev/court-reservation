import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, MailOpen, Plus } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import { AuthHeading, AuthLayout } from "@/components/auth/auth-layout";
import { OnboardingSteps } from "@/components/onboarding/onboarding-steps";
import { SignOutButton } from "@/components/onboarding/sign-out-button";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const optionClass =
  "group flex items-start gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line";

export default async function BienvenidaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, memberships } = await getSessionContext();

  if (!user) {
    redirect("/login");
  }

  // La bienvenida es solo para quien todavía no tiene club (crear otro club no está disponible).
  if (memberships.length > 0) {
    redirect("/dashboard");
  }

  const { opcion } = await searchParams;

  if (opcion === "invitacion") {
    return (
      <AuthLayout aside={<OnboardingSteps current={2} />} courtVariant="vertical">
        <div className="flex flex-col gap-6">
          <AuthHeading
            eyebrow="PASO 2 DE 3"
            title="Pedí el link de invitación"
            description="El administrador de tu club te invita desde Equipo y te manda un link por WhatsApp."
          />

          <ol className="flex flex-col gap-3 rounded-xl bg-muted px-5 py-4 text-[15px] text-pretty">
            <li>
              <strong>1.</strong> Pedile al administrador que te genere una invitación con tu rol.
            </li>
            <li>
              <strong>2.</strong> Abrí el link que te manda. Podés entrar con esta cuenta
              {user.email ? <> (<span className="font-mono break-all">{user.email}</span>)</> : null} o crear una nueva.
            </li>
          </ol>

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
              </span>
              <span className="text-[15px] text-pretty text-muted-foreground">
                Trabajás en un club que ya usa saque: el administrador te suma
                con un link por WhatsApp.
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
