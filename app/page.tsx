import { redirect } from "next/navigation";

/**
 * La raíz no tiene contenido propio:
 * - Con `?code=` (link de confirmación de email que Supabase redirigió a la Site URL),
 *   se reenvía a `/verification-account` para canjear el código.
 * - Si no, va al panel (que manda al login si no hay sesión).
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await searchParams;
  if (typeof code === "string" && code) {
    redirect(`/verification-account?code=${encodeURIComponent(code)}`);
  }
  redirect("/dashboard");
}
