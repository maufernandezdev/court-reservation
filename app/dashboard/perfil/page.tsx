import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { CLUB_ROLE_LABELS } from "@/lib/roles";
import { avatarUrl, type Profile } from "@/lib/profile";
import { PageHeader } from "@/components/shell/page-header";
import { UserAvatar } from "@/components/profile/user-avatar";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import {
  EmailForm,
  NameForm,
  PasswordForm,
  ProfeColorSection,
} from "@/components/profile/profile-forms";

export const metadata = { title: "Mi perfil" };

function initialsOf(text: string): string {
  const words = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "??";
}

/** Mi perfil: nombre, foto, correo, contraseña y (si es profe) color en la planilla. */
export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, memberships } = await getSessionContext();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_path, avatar_updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = data as Profile | null;

  const { correo } = await searchParams;
  const email = user.email ?? "";
  const fullName = profile?.full_name || memberships[0]?.full_name || "";
  const displayName = fullName || email;
  const profeClubs = memberships
    .filter((m) => m.role === "profesor")
    .map((m) => ({ clubId: m.club_id, clubName: m.club.name, color: m.color ?? null }));

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Mi perfil" description="Tus datos en todos los clubes donde estás." />

      <section aria-label="Resumen" className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-5 sm:p-6">
        <UserAvatar
          src={avatarUrl(profile)}
          initials={initialsOf(displayName)}
          name={displayName}
          size={72}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <strong className="truncate font-display text-2xl font-extrabold tracking-[-0.02em] font-stretch-[115%]">
            {displayName}
          </strong>
          <span className="truncate text-[15px] text-muted-foreground">{email}</span>
          <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Tus clubes">
            {memberships.map((m) => (
              <li key={m.club_id} className="rounded-full border px-3 py-1 text-[13px]">
                {m.club.name} · {CLUB_ROLE_LABELS[m.role]}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <AvatarUploader
        avatarUrl={avatarUrl(profile)}
        initials={initialsOf(displayName)}
        name={displayName}
      />
      <NameForm fullName={fullName} />
      {profeClubs.length > 0 && <ProfeColorSection clubs={profeClubs} />}
      <EmailForm
        email={email}
        pendingEmail={user.new_email ?? null}
        justConfirmed={correo === "confirmado"}
      />
      <PasswordForm />
    </div>
  );
}
