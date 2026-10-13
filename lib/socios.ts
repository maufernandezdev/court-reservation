import { z } from "zod";

/** Socio del club (sin cuota). */
export type Socio = {
  id: string;
  club_id: string;
  full_name: string;
  dni: string;
  phone: string;
  email: string;
  created_at: string;
  updated_at: string | null;
};

/** Datos de un socio: nombre obligatorio; DNI, teléfono y correo opcionales. */
export const socioSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Ingresá el nombre del socio")
    .max(120, "El nombre puede tener hasta 120 caracteres"),
  dni: z
    .string()
    .trim()
    .max(20, "El DNI puede tener hasta 20 caracteres")
    .regex(/^[0-9A-Za-z.\- ]*$/, "El DNI solo puede tener números, letras, puntos o guiones"),
  phone: z
    .string()
    .trim()
    .max(40, "El teléfono puede tener hasta 40 caracteres")
    .regex(/^[0-9+()\- ]*$/, "El teléfono solo puede tener números, espacios, +, ( ) o guiones"),
  email: z
    .string()
    .trim()
    .max(254, "El correo es demasiado largo")
    .refine((value) => value === "" || z.string().email().safeParse(value).success, "Ingresá un correo válido"),
});

export type SocioInput = z.infer<typeof socioSchema>;

/** El DNI se guarda sin puntos ni espacios para que la búsqueda y la unicidad no dependan del formato. */
export function normalizeDni(dni: string): string {
  return dni.replace(/[.\s]/g, "").toUpperCase();
}
