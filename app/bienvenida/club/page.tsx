import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { AuthLayout } from "@/components/auth/auth-layout";
import { OnboardingSteps } from "@/components/onboarding/onboarding-steps";
import { ClubOnboardingForm } from "@/components/onboarding/club-onboarding-form";

export const dynamic = "force-dynamic";

/** Alta del club: paso 2 de 3 (artboard AltaClub). */
export default async function AltaClubPage() {
  const { user, memberships } = await getSessionContext();

  if (!user) {
    redirect("/login");
  }

  // Por ahora solo se da de alta un club desde la bienvenida (sin club todavía).
  if (memberships.length > 0) {
    redirect("/dashboard");
  }

  return (
    <AuthLayout wide aside={<OnboardingSteps current={2} />} courtVariant="vertical">
      <ClubOnboardingForm backHref="/bienvenida" />
    </AuthLayout>
  );
}
