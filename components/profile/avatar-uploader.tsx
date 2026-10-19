"use client";

import { useRef, useState } from "react";
import { z } from "zod";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeAvatarAction, uploadAvatarAction } from "@/app/dashboard/perfil/actions";
import { IMAGE_ACCEPTED_TYPES, IMAGE_MAX_BYTES, toSquareWebp } from "@/lib/image";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Validación del archivo elegido (antes de recortarlo).
const avatarFileSchema = z
  .instanceof(File, { message: "Elegí una imagen." })
  .refine((file) => (IMAGE_ACCEPTED_TYPES as readonly string[]).includes(file.type), "La foto tiene que ser JPG, PNG o WebP.")
  .refine((file) => file.size <= IMAGE_MAX_BYTES, "La foto puede pesar hasta 5 MB.");

/**
 * Tarjeta de cabecera de Mi perfil: foto (subir, cambiar o quitar), nombre, correo y los clubes
 * donde está la persona.
 */
export function AvatarUploader({
  avatarUrl,
  initials,
  name,
  email,
  clubs,
}: {
  avatarUrl: string | null;
  initials: string;
  name: string;
  email: string;
  /** Un texto por club, como "The Garden Tenis · Administrador". */
  clubs: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);

  const onFile = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError("");
    const parsed = avatarFileSchema.safeParse(file);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "La foto no es válida.");
      return;
    }
    setBusy("upload");
    try {
      const blob = await toSquareWebp(parsed.data);
      const formData = new FormData();
      formData.append("avatar", new File([blob], "avatar.webp", { type: "image/webp" }));
      const result = await uploadAvatarAction(formData);
      if (!result.success) {
        setError(result.error ?? "No se pudo subir la foto.");
      } else {
        toast.success("Foto actualizada");
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
    const result = await removeAvatarAction();
    setBusy(null);
    if (!result.success) {
      setError(result.error ?? "No se pudo quitar la foto.");
    } else {
      toast.success("Foto quitada");
    }
  };

  return (
    <section aria-label="Resumen y foto" className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <UserAvatar src={avatarUrl} initials={initials} name={name} size={88} />
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
          <strong className="truncate font-display text-2xl font-extrabold tracking-[-0.02em] font-stretch-[115%]">
            {name}
          </strong>
          <span className="truncate text-[15px] text-muted-foreground">{email}</span>
          <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Tus clubes">
            {clubs.map((club) => (
              <li key={club} className="rounded-full border px-3 py-1 text-[13px]">
                {club}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t pt-4">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPTED_TYPES.join(",")}
            className="sr-only"
            id="avatar-file"
            aria-label="Elegir foto"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy !== null}>
            <Camera />
            {busy === "upload" ? "Subiendo…" : avatarUrl ? "Cambiar foto" : "Subir foto"}
          </Button>
          {avatarUrl && (
            <Button type="button" variant="outline" onClick={remove} disabled={busy !== null}>
              <Trash2 />
              {busy === "remove" ? "Quitando…" : "Quitar foto"}
            </Button>
          )}
        </div>
        <p className="text-[13px] text-pretty text-muted-foreground">
          La foto se ve en el menú y en Equipo. JPG, PNG o WebP de hasta 5 MB; se recorta en cuadrado.
        </p>
      </div>
    </section>
  );
}
