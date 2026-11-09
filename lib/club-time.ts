/** Zona horaria del club: el servidor corre en UTC y "hoy" tiene que ser el del club. */
export const CLUB_TZ = "America/Argentina/Buenos_Aires";

/** Fecha de hoy en el club, como "AAAA-MM-DD". */
export function clubTodayKey(now: Date = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: CLUB_TZ });
}
