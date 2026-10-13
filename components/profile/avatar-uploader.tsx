"use client";

import { useRef, useState } from "react";
import { z } from "zod";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeAvatarAction, uploadAvatarAction } from "@/app/dashboard/perfil/actions";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 5 * 1024 * 1024;
const SIZE = 512;

// Validación del archivo elegido (antes de recortarlo).
const avatarFileSchema = z
  .instanceof(File, { message: "Elegí una imagen." })
  .refine((file) => (ACCEPTED as readonly string[]).includes(file.type), "La foto tiene que ser JPG, PNG o WebP.")
  .refine((file) => file.size <= MAX_BYTES, "La foto puede pesar hasta 5 MB.");

/** Recorta al centro en cuadrado y reduce a 512×512 en WebP. */
async function toSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("No se pudo procesar la imagen.");
  return blob;
}

/** Foto de perfil: subir, cambiar o quitar. */
export function AvatarUploader({
  avatarUrl,
  initials,
  name,
}: {
  avatarUrl: string | null;
  initials: string;
  name: string;
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
    <section aria-labelledby="perfil-foto" className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="perfil-foto" className="text-lg font-bold">
          Foto
        </h2>
        <p className="text-[15px] text-pretty text-muted-foreground">
          Se ve en el menú y en Equipo. JPG, PNG o WebP de hasta 5 MB; se recorta en cuadrado.
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar src={avatarUrl} initials={initials} name={name} size={80} />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
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
      </div>
    </section>
  );
}
