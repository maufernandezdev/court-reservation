"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useMembership } from "@/hooks/use-membership";
import { avatarUrl as profileAvatarUrl, type Profile } from "@/lib/profile";
import { IMAGE_ACCEPTED_TYPES, IMAGE_MAX_BYTES, toLogoWebp } from "@/lib/image";
import { removeClubLogoAction, uploadClubLogoAction } from "@/app/dashboard/configuracion/actions";
import { ClubLogo } from "@/components/club/club-logo";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Validación del archivo elegido (antes de ajustarlo).
const logoFileSchema = z
  .instanceof(File, { message: "Elegí una imagen." })
  .refine((file) => (IMAGE_ACCEPTED_TYPES as readonly string[]).includes(file.type), "El logo tiene que ser JPG, PNG o WebP.")
  .refine((file) => file.size <= IMAGE_MAX_BYTES, "El logo puede pesar hasta 5 MB.");

/** "Logo del club" en Políticas: subir, cambiar o quitar (solo admin). Lo ve todo el equipo en el menú. */
export function ClubLogoCard({
  logoUrl,
  initials,
  clubName,
}: {
  logoUrl: string | null;
  initials: string;
  clubName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState<string | null>(null);
  const { membership } = useMembership();

  // Si la persona tiene foto de perfil, se ofrece usarla como logo (muchos clubes usan su logo de foto).
  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("profiles")
      .select("user_id, avatar_path, avatar_updated_at")
      .eq("user_id", membership.user_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setMyPhotoUrl(profileAvatarUrl(data as Profile | null));
      });
    return () => {
      cancelled = true;
    };
  }, [membership.user_id]);

  const applyMyPhoto = async () => {
    if (!myPhotoUrl) return;
    setError("");
    setBusy("upload");
    try {
      const response = await fetch(myPhotoUrl);
      if (!response.ok) throw new Error("sin foto");
      const blob = await response.blob();
      await upload(new File([blob], "foto.webp", { type: blob.type || "image/webp" }));
    } catch {
      setError("No se pudo leer tu foto de perfil. Probá subiendo el logo.");
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError("");
    setBusy("upload");
    await upload(file);
  };

  const upload = async (file: File) => {
    const parsed = logoFileSchema.safeParse(file);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "El logo no es válido.");
      setBusy(null);
      return;
    }
    try {
      const blob = await toLogoWebp(parsed.data);
      const formData = new FormData();
      formData.append("logo", new File([blob], "logo.webp", { type: "image/webp" }));
      const result = await uploadClubLogoAction(formData);
      if (!result.success) {
        setError(result.error ?? "No se pudo subir el logo.");
      } else {
        toast.success("Logo actualizado");
      }
    } catch {
      setError("No se pudo leer la imagen. Probá con otra.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setError("");
    setBusy("remove");
    const result = await removeClubLogoAction();
    setBusy(null);
    if (!result.success) {
      setError(result.error ?? "No se pudo quitar el logo.");
    } else {
      toast.success("Logo quitado");
    }
  };

  return (
    <section aria-labelledby="logo-del-club" className="flex flex-col gap-4 rounded-2xl border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 id="logo-del-club" className="text-lg font-bold">
          Logo del club
        </h2>
        <p className="text-[15px] text-pretty text-muted-foreground">
          Lo ve todo el equipo en el menú. JPG, PNG o WebP de hasta 5 MB. Se quitan los bordes vacíos y se conserva su forma, así un logo horizontal no queda chico.
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <ClubLogo src={logoUrl} initials={initials} name={clubName} size={80} width={200} className="rounded-xl" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPTED_TYPES.join(",")}
            className="sr-only"
            aria-label="Elegir logo"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy !== null}>
            <ImagePlus />
            {busy === "upload" ? "Subiendo…" : logoUrl ? "Cambiar logo" : "Subir logo"}
          </Button>
          {myPhotoUrl && (
            <Button type="button" variant="outline" onClick={applyMyPhoto} disabled={busy !== null}>
              Usar mi foto de perfil
            </Button>
          )}
          {logoUrl && (
            <Button type="button" variant="outline" onClick={remove} disabled={busy !== null}>
              <Trash2 />
              {busy === "remove" ? "Quitando…" : "Quitar logo"}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
