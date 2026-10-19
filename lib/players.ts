import { z } from "zod";

/** Jugador del club (sin cuota). */
export type Player = {
  id: string;
  club_id: string;
  full_name: string;
  dni: string;
  phone: string;
  email: string;
  /** Quién lo agregó: el profe solo modifica a los suyos. */
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
};

/** Datos de un jugador: nombre obligatorio; DNI, teléfono y correo opcionales. */
export const playerSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Ingresá el nombre del jugador")
    .max(120, "El nombre puede tener hasta 120 caracteres"),
  dni: z
    .string()
    .trim()
    .max(20, "El DNI puede tener hasta 20 caracteres")
    .regex(/^[0-9A-Za-z.\- ]*$/, "El DNI solo puede tener números, letras, puntos o guiones"),
  phone: z
    .string()
    .trim()
    .max(15, "El teléfono puede tener hasta 15 números")
    .regex(/^\d*$/, "El teléfono solo puede tener números"),
  email: z
    .string()
    .trim()
    .max(254, "El correo es demasiado largo")
    .refine((value) => value === "" || z.string().email().safeParse(value).success, "Ingresá un correo válido"),
});

export type PlayerInput = z.infer<typeof playerSchema>;

/** Deja solo los números de un teléfono (lo que se escribe o se pega con espacios, guiones o +). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** El DNI se guarda sin puntos ni espacios para que la búsqueda y la unicidad no dependan del formato. */
export function normalizeDni(dni: string): string {
  return dni.replace(/[.\s]/g, "").toUpperCase();
}
