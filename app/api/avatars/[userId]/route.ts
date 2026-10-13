import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getObject, isR2Configured } from "@/lib/r2";

const notFound = () => new Response("No encontrada", { status: 404 });

/**
 * Foto de perfil desde el bucket privado de R2. Solo para personas con sesión que
 * comparten un club con el dueño (el RLS de `profiles` ya lo exige: si no puede
 * leer el perfil, no hay foto). La URL lleva `?v=` con la versión para la caché.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/avatars/[userId]">) {
  const { userId } = await params;
  if (!z.string().uuid().safeParse(userId).success || !isR2Configured()) return notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.avatar_path) return notFound();

  const object = await getObject(profile.avatar_path).catch(() => null);
  if (!object?.body) return notFound();

  return new Response(object.body, {
    headers: {
      "Content-Type": object.headers.get("Content-Type") ?? "image/webp",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
