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
