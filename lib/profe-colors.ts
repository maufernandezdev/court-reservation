/**
 * Paleta de colores de profes (misma que el trigger `assign_profe_color` de la base).
 * Todos con contraste AA para texto blanco; ninguno se confunde con los tonos de pago
 * (tinta, pelota) ni con el azul de torneo.
 */
export const PROFE_COLORS = [
  { value: "#B4235A", label: "Frambuesa" },
  { value: "#7A3FB8", label: "Violeta" },
  { value: "#1F7A4D", label: "Verde" },
  { value: "#C2410C", label: "Naranja" },
  { value: "#0F766E", label: "Turquesa" },
  { value: "#A16207", label: "Mostaza" },
  { value: "#6D4C41", label: "Marrón" },
  { value: "#475569", label: "Pizarra" },
] as const;

export const PROFE_COLOR_VALUES = PROFE_COLORS.map((c) => c.value) as unknown as readonly [string, ...string[]];

/** Color por defecto si un profe todavía no tiene uno. */
export const FALLBACK_PROFE_COLOR = "#475569";
