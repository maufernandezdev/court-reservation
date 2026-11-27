/** Zona horaria del club: el servidor corre en UTC y "hoy" tiene que ser el del club. */
export const CLUB_TZ = "America/Argentina/Buenos_Aires";

/** Fecha de hoy en el club, como "AAAA-MM-DD". */
export function clubTodayKey(now: Date = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: CLUB_TZ });
}

/** Minutos transcurridos del día en el club (mismo criterio que `now_minutes_ar` en la base). */
export function clubNowMinutes(now: Date = new Date()): number {
  const [h, m] = now
    .toLocaleTimeString("en-GB", { timeZone: CLUB_TZ, hour: "2-digit", minute: "2-digit", hour12: false })
    .split(":")
    .map(Number);
  return (h % 24) * 60 + m;
}
