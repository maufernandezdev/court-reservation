import { z } from "zod";

/** Deportes que se pueden dar de alta (los mismos que admite `courts.type`), en el orden del alta. */
export const ONBOARDING_SPORTS = [
  { id: "tenis", label: "Tenis", prefix: "Cancha" },
  { id: "padel", label: "Pádel", prefix: "Pádel" },
  { id: "futbol", label: "Fútbol", prefix: "Fútbol" },
] as const;

export type OnboardingSport = (typeof ONBOARDING_SPORTS)[number]["id"];

export const MAX_COURTS_PER_SPORT = 20;

const courtCount = z
  .number({ message: "Ingresá una cantidad válida" })
  .int("Ingresá un número entero")
  .min(0, "La cantidad no puede ser negativa")
  .max(MAX_COURTS_PER_SPORT, `Hasta ${MAX_COURTS_PER_SPORT} canchas por deporte`);

const clubName = z
  .string()
  .trim()
  .min(1, "Ingresá el nombre del club")
  .max(80, "El nombre puede tener hasta 80 caracteres");

const clubCity = z.string().trim().max(80, "La ciudad puede tener hasta 80 caracteres");

/** Alta del club (paso 2 de 3): datos y cantidad de canchas por deporte. */
export const clubOnboardingSchema = z
  .object({
    name: clubName,
    city: clubCity,
    courts: z.object({ tenis: courtCount, padel: courtCount, futbol: courtCount }),
  })
  .refine(
    (data) => data.courts.tenis + data.courts.padel + data.courts.futbol > 0,
    { message: "Elegí al menos un deporte con una cancha", path: ["courts"] }
  );

export type ClubOnboardingInput = z.infer<typeof clubOnboardingSchema>;

/** Datos del club editables por el admin en Políticas. */
export const clubDetailsSchema = z.object({ name: clubName, city: clubCity });

export type ClubDetailsInput = z.infer<typeof clubDetailsSchema>;

/** Nombres que va a tener cada cancha (mismo criterio que `create_club` en la base). */
export function previewCourtNames(
  courts: Record<OnboardingSport, number>
): { sport: string; name: string }[] {
  return ONBOARDING_SPORTS.flatMap((sport) =>
    Array.from({ length: courts[sport.id] }, (_, i) => ({
      sport: sport.label,
      name: `${sport.prefix} ${i + 1}`,
    }))
  );
}

const clubTime = z.string().regex(/^([01][0-9]|2[0-3]):(00|30)$/, "Elegí un horario válido");

/** Horario de apertura y cierre del club, en pasos de 30 minutos (Políticas y alta del club). */
export const clubHoursSchema = z
  .object({ open_time: clubTime, close_time: clubTime })
  .refine((data) => data.open_time < data.close_time, {
    message: "El cierre tiene que ser posterior a la apertura",
    path: ["close_time"],
  });

export type ClubHoursInput = z.infer<typeof clubHoursSchema>;

/** Instagram: acepta "@usuario", "usuario" o el link del perfil; guarda solo el usuario. */
export function normalizeInstagram(value: string): string {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/instagram\.com\/([^/?#]+)/i);
  return (fromUrl ? fromUrl[1] : trimmed).replace(/^@/, "").replace(/\/+$/, "");
}

/** WhatsApp del club (solo números) e Instagram (usuario o link), editables en Políticas. */
export const clubSocialSchema = z.object({
  whatsapp: z
    .string()
    .transform((value) => value.replace(/[\s\-()+]/g, ""))
    .pipe(
      z
        .string()
        .regex(/^\d*$/, "El WhatsApp va solo con números (ej.: 1155551111 o 5491155551111)")
        .refine((value) => value === "" || (value.length >= 8 && value.length <= 15), "El número tiene que tener entre 8 y 15 dígitos")
    ),
  instagram: z
    .string()
    .transform(normalizeInstagram)
    .pipe(
      z
        .string()
        .max(30, "El usuario de Instagram tiene hasta 30 caracteres")
        .regex(/^[A-Za-z0-9._]*$/, "Escribí el usuario (ej.: @thegardentenis) o el link del perfil")
    ),
});

export type ClubSocialInput = z.input<typeof clubSocialSchema>;

/** Línea de contacto para los mensajes que comparte el club ("" si no cargó redes). */
export function clubContactLine(social: { whatsapp?: string | null; instagram?: string | null }): string {
  const parts: string[] = [];
  const digits = (social.whatsapp ?? "").replace(/\D/g, "");
  if (digits.length >= 8) parts.push(`WhatsApp: wa.me/${digits.startsWith("54") ? digits : `549${digits}`}`);
  if (social.instagram) parts.push(`Instagram: instagram.com/${social.instagram}`);
  return parts.join(" · ");
}
