// Crea un club de prueba para revisar el rediseño: admin + operador confirmados,
// 6 canchas y turnos de hoy/mañana con distintos estados de pago.
// Uso (una sola vez; ya se corrió el 2026-10-06): SUPA_URL=... SUPA_SERVICE_KEY=... node scripts/dev/seed-test-club.mjs <out.json>
// Las credenciales generadas se copiaron a .env.local (TEST_*). Para sembrar turnos de otro día,
// adaptar la sección de reservas (fechas) y omitir la creación de usuarios.
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const URL = process.env.SUPA_URL;
const KEY = process.env.SUPA_SERVICE_KEY;
const out = process.argv[2];
if (!URL || !KEY || !out) throw new Error("faltan SUPA_URL, SUPA_SERVICE_KEY o archivo de salida");

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function call(path, method, body, extra = {}) {
  const res = await fetch(`${URL}${path}`, { method, headers: { ...H, ...extra }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
const rest = (table, rows, prefer = "return=representation") =>
  call(`/rest/v1/${table}`, "POST", rows, { Prefer: prefer });

const pwd = () => "Saque-" + randomBytes(6).toString("hex");

async function createUser(email, fullName) {
  const password = pwd();
  const user = await call("/auth/v1/admin/users", "POST", {
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  return { id: user.id, email, password };
}

const today = new Date();
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

const admin = await createUser("saque.admin.prueba@example.com", "Valeria Gómez");
const oper = await createUser("saque.operador.prueba@example.com", "Diego Ruiz");

// La membresía admin del dueño la crea el trigger handle_new_user; completamos el nombre.
await call(`/rest/v1/memberships?owner_id=eq.${admin.id}&user_id=eq.${admin.id}`, "PATCH", { full_name: "Valeria Gómez" });
await rest("memberships", [{ owner_id: admin.id, user_id: oper.id, role: "operador", full_name: "Diego Ruiz", email: oper.email }]);

const courtDefs = [
  ["Cancha 1", "tenis", 24000, 60, "08:00", "23:00", true, "percent", 30],
  ["Cancha 2", "tenis", 24000, 60, "08:00", "23:00", true, "percent", 30],
  ["Cancha 3", "tenis", 24000, 60, "08:00", "23:00", true, "percent", 30],
  ["Cancha 4", "tenis", 20000, 60, "08:00", "22:00", false, "percent", 0],
  ["Pádel 1", "padel", 24000, 90, "09:00", "23:00", true, "fixed", 10000],
  ["Pádel 2", "padel", 24000, 90, "09:00", "23:00", true, "fixed", 10000],
];
const courts = await rest("courts", courtDefs.map(([name, type, price, slot, open, close, dep, dtype, dval]) => ({
  user_id: admin.id, name, type, price_per_hour: price, slot_duration: slot, open_time: open, close_time: close,
  deposit_enabled: dep, deposit_type: dtype, deposit_value: dval,
})));

// [cancha, día(0 hoy/1 mañana), hora, duración, cliente, teléfono, estado]
const R = [
  [0, 0, "08:00", 60, "Clase · Prof. Sosa", "3415550101", "pagada"],
  [0, 0, "10:00", 60, "Martín Ríos", "3415550102", "pagada"],
  [0, 0, "17:00", 60, "Lucía Ferreyra", "3415550103", "senada"],
  [0, 0, "20:00", 60, "J. Paz / R. Gómez", "3415550104", "pendiente"],
  [1, 0, "09:00", 60, "Ana Beltrán", "3415550105", "pagada"],
  [1, 0, "18:00", 60, "Carla Méndez", "3415550106", "senada"],
  [1, 0, "19:00", 60, "Federico Luna", "3415550107", "pendiente"],
  [2, 0, "16:00", 60, "Diego Ortiz", "3415550108", "pagada"],
  [2, 0, "19:00", 60, "Sofía Navarro", "3415550109", "senada"],
  [3, 0, "18:00", 60, "Pablo Acosta", "3415550110", "pagada"],
  [3, 0, "21:00", 60, "Nicolás Vera", "3415550111", "pendiente"],
  [4, 0, "09:00", 90, "Bruno Castro", "3415550112", "pagada"],
  [4, 0, "18:00", 90, "Paula Díaz", "3415550113", "senada"],
  [4, 0, "19:30", 90, "Matías Romero", "3415550114", "senada"],
  [4, 0, "21:00", 90, "Gonzalo Ruiz", "3415550115", "pendiente"],
  [5, 0, "17:30", 90, "Valentina Sosa", "3415550116", "pagada"],
  [5, 0, "19:00", 90, "Emiliano Quiroga", "3415550117", "pendiente"],
  [0, 1, "18:00", 60, "Lucía Ferreyra", "3415550103", "senada"],
  [2, 1, "20:00", 60, "Sofía Navarro", "3415550109", "pendiente"],
];
const reservations = await rest("reservations", R.map(([c, d, time, dur, name, phone, pay]) => ({
  user_id: admin.id, court_id: courts[c].id, date: key(d ? tomorrow : today), time, duration_minutes: dur,
  customer_name: name, phone, payment_status: pay, created_by: oper.id, updated_by: oper.id,
})));

// Un cancelado (en término) para ver el estado "cancelada".
await rest("reservations", [{
  user_id: admin.id, court_id: courts[1].id, date: key(today), time: "11:00", duration_minutes: 60,
  customer_name: "Tomás Ibarra", phone: "3415550118", status: "cancelled", cancelled_at: new Date().toISOString(),
  cancelled_by: oper.id, cancel_reason: "Pedido del jugador", created_by: oper.id,
}], "return=minimal");

const payments = [];
reservations.forEach((r, i) => {
  const court = courtDefs[R[i][0]];
  const price = (court[2] * r.duration_minutes) / 60;
  const deposit = court[7] === "fixed" ? court[8] : Math.round((price * court[8]) / 100);
  if (r.payment_status === "senada") payments.push({ owner_id: admin.id, reservation_id: r.id, kind: "seña", amount: deposit, method: "transferencia", created_by: oper.id });
  if (r.payment_status === "pagada") payments.push({ owner_id: admin.id, reservation_id: r.id, kind: "total", amount: price, method: i % 2 ? "efectivo" : "transferencia", created_by: oper.id });
});
await rest("payments", payments, "return=minimal");

await rest("settings", [{ owner_id: admin.id, cancel_window_hours: 24, late_penalty_percent: 50 }], "resolution=merge-duplicates,return=minimal");

writeFileSync(out, JSON.stringify({ admin, operador: oper, ownerId: admin.id, courts: courts.length, reservations: reservations.length + 1, payments: payments.length }, null, 2));
console.log(`ok: ${courts.length} canchas, ${reservations.length + 1} turnos, ${payments.length} cobros`);
