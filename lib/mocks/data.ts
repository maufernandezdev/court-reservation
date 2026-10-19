export type Product = {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  lowStockThreshold: number;
};

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Coca-Cola 500ml",
    category: "Bebidas",
    stock: 24,
    price: 1200,
    lowStockThreshold: 10,
  },
  {
    id: "p2",
    name: "Agua mineral 500ml",
    category: "Bebidas",
    stock: 8,
    price: 900,
    lowStockThreshold: 10,
  },
  {
    id: "p3",
    name: "Pelota de pádel",
    category: "Pelotas",
    stock: 15,
    price: 3500,
    lowStockThreshold: 5,
  },
  {
    id: "p4",
    name: "Pelota de tenis",
    category: "Pelotas",
    stock: 3,
    price: 2800,
    lowStockThreshold: 5,
  },
  {
    id: "p5",
    name: "Alquiler paleta",
    category: "Alquiler",
    stock: 0,
    price: 2500,
    lowStockThreshold: 2,
  },
];

export const ANNOUNCEMENTS = [
  {
    id: "a1",
    title: "Cancelación por lluvia",
    body: "Se suspenden las actividades al aire libre para el turno de la tarde. Disculpen las molestias.",
    createdAt: "2026-08-20 08:00",
  },
  {
    id: "a2",
    title: "Mantenimiento Cancha 2",
    body: "La Cancha 2 de tenis estará fuera de servicio el martes por mantenimiento.",
    createdAt: "2026-08-19 18:30",
  },
];
