export type Court = {
  id: string;
  name: string;
  sport: string;
};

export type Reservation = {
  id: string;
  courtId: string;
  time: string;
  customerName: string;
  phone: string;
};

export type Member = {
  id: string;
  name: string;
  dni: string;
  phone: string;
  feeStatus: "paid" | "pending";
};

export type Product = {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  lowStockThreshold: number;
};

export type Transaction = {
  id: string;
  concept: string;
  amount: number;
  time: string;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  active?: boolean;
};

export const CLUB_NAME = "Club Deportivo Central";

export const TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];

export const COURTS: Court[] = [
  { id: "c1", name: "Cancha 1", sport: "Pádel" },
  { id: "c2", name: "Cancha 2", sport: "Tenis" },
  { id: "c3", name: "Cancha 3", sport: "Fútbol 7" },
  { id: "c4", name: "Cancha 4", sport: "Multideporte" },
];

export const INITIAL_RESERVATIONS: Reservation[] = [
  {
    id: "r1",
    courtId: "c1",
    time: "09:00",
    customerName: "Fernández / Casimiro",
    phone: "3415123456",
  },
  {
    id: "r2",
    courtId: "c2",
    time: "10:00",
    customerName: "Torneo",
    phone: "",
  },
  {
    id: "r3",
    courtId: "c3",
    time: "11:00",
    customerName: "Martínez",
    phone: "3415987654",
  },
  {
    id: "r4",
    courtId: "c1",
    time: "14:00",
    customerName: "Gómez / López",
    phone: "3415567890",
  },
];

export const MEMBERS: Member[] = [
  {
    id: "m1",
    name: "Juan Fernández",
    dni: "30123456",
    phone: "3415123456",
    feeStatus: "paid",
  },
  {
    id: "m2",
    name: "María Casimiro",
    dni: "27890123",
    phone: "3415234567",
    feeStatus: "pending",
  },
  {
    id: "m3",
    name: "Carlos Martínez",
    dni: "33456789",
    phone: "3415345678",
    feeStatus: "paid",
  },
  {
    id: "m4",
    name: "Laura Gómez",
    dni: "31234567",
    phone: "3415456789",
    feeStatus: "pending",
  },
  {
    id: "m5",
    name: "Pedro López",
    dni: "29567890",
    phone: "3415567890",
    feeStatus: "paid",
  },
];

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

export const TRANSACTIONS: Transaction[] = [
  { id: "t1", concept: "Reserva Cancha 1 - 09:00", amount: 8000, time: "09:05" },
  { id: "t2", concept: "Reserva Cancha 2 - 10:00", amount: 6500, time: "09:45" },
  { id: "t3", concept: "Venta kiosco - Coca-Cola", amount: 1200, time: "10:30" },
  { id: "t4", concept: "Reserva Cancha 3 - 11:00", amount: 12000, time: "10:55" },
  { id: "t5", concept: "Alquiler paleta", amount: 2500, time: "11:20" },
  { id: "t6", concept: "Reserva Cancha 1 - 14:00", amount: 8000, time: "13:50" },
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Prueba Gratis",
    price: "$0",
    period: "30 días",
    description: "Ideal para probar el sistema sin compromiso.",
    features: [
      "1 cancha",
      "1 usuario operador",
      "Reservas básicas",
      "Soporte por email",
    ],
  },
  {
    id: "basic",
    name: "Plan Básico",
    price: "$29.900",
    period: "mes",
    description: "Para clubes pequeños que están empezando.",
    features: [
      "Hasta 4 canchas",
      "2 usuarios operadores",
      "Gestión de socios",
      "Control de caja",
      "Reportes por WhatsApp",
    ],
    active: true,
  },
  {
    id: "pro",
    name: "Plan Pro",
    price: "Desde $74.900",
    period: "mes",
    description: "Para clubes con alto volumen de reservas.",
    features: [
      "Canchas ilimitadas",
      "Usuarios ilimitados",
      "Kiosco con códigos de barras",
      "Reportes avanzados",
      "Soporte prioritario",
      "API para integraciones",
    ],
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
