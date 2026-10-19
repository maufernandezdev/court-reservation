import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // La pantalla se llamaba Socios; se conserva el enlace por si quedó guardado.
      { source: "/dashboard/socios", destination: "/dashboard/jugadores", permanent: true },
      // Equipo se llamaba Miembros.
      { source: "/dashboard/miembros", destination: "/dashboard/equipo", permanent: true },
    ];
  },
};

export default nextConfig;
