/**
 * Módulos que ya tienen desarrollo pero todavía no se muestran al cliente.
 * Con `false` no aparecen en el menú y su ruta redirige a Hoy; el código queda intacto.
 */
export const FEATURES = {
  /** Catálogo de productos para las ventas de la caja (pedido por el cliente, 2026-11). */
  products: true,
  /** Notificaciones: se definen después de que la v1 esté en uso. */
  notifications: false,
} as const;

export type Feature = keyof typeof FEATURES;
