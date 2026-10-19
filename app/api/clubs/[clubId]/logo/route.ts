import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getObject, isR2Configured } from "@/lib/r2";

const notFound = () => new Response("No encontrado", { status: 404 });

/**
 * Logo del club desde el bucket privado de R2. Solo para personas con sesión que pertenecen al
 * club: el RLS de `clubs` solo devuelve la fila a sus miembros, así que si no es miembro no hay logo.
 * La URL lleva `?v=` con la versión para la caché.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/clubs/[clubId]/logo">) {
  const { clubId } = await params;
  if (!z.string().uuid().safeParse(clubId).success || !isR2Configured()) return notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return notFound();

  const { data: club } = await supabase.from("clubs").select("logo_path").eq("id", clubId).maybeSingle();
  if (!club?.logo_path) return notFound();

  const object = await getObject(club.logo_path).catch(() => null);
  if (!object?.body) return notFound();

  return new Response(object.body, {
    headers: {
      "Content-Type": object.headers.get("Content-Type") ?? "image/webp",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
