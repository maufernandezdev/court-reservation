import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { AuthLayout } from "@/components/auth/auth-layout";
import { OnboardingSteps } from "@/components/onboarding/onboarding-steps";
import { ClubOnboardingForm } from "@/components/onboarding/club-onboarding-form";

export const dynamic = "force-dynamic";

/** Alta del club: paso 2 de 3 (artboard AltaClub). */
export default async function AltaClubPage() {
  const { user } = await getSessionContext();

  if (!user) {
    redirect("/login");
  }

  return (
    <AuthLayout wide aside={<OnboardingSteps current={2} />} courtVariant="vertical">
      <ClubOnboardingForm backHref="/bienvenida" />
    </AuthLayout>
  );
}
