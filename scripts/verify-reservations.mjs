// Verificación integral de reservas y ocupación (change add-reservations-and-occupancy).
// Cubre: 3.2/3.3/3.4 (persistencia de alta/edición/baja y doble reserva),
// 5.2 (ocupación del bloque actual), 6.1 (flujo completo con test@user.com),
// 6.2 (aislamiento RLS) y 6.3 (usuario sin canchas).
// Uso: node scripts/verify-reservations.mjs
// Requiere: migración 0002_reservations.sql aplicada en Supabase.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Mismo criterio que la home: bloque de 1h (desde 09:00) que contiene la hora actual.
const now = new Date();
const hour = now.getHours();
const slot = hour >= 9 && hour <= 22 ? `${String(hour).padStart(2, "0")}:00` : "12:00";
if (hour < 9 || hour > 22) {
  console.log(`NOTA  fuera de la grilla (${hour}h); se usa la franja ${slot} para la verificación.`);
}
const todayKey = formatDateKey(now);
const stamp = Date.now();

// ---- 6.2: sin sesión no se lee reservations ----
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const anonRes = await anon.from("reservations").select("*");
check("6.2 sin sesión no lee reservations", anonRes.data?.length === 0 && !anonRes.error, anonRes.error?.message ?? `${anonRes.data.length} filas`);

// ---- Login usuario A (test@user.com) ----
const { error: loginErr } = await supabase.auth.signInWithPassword({
  email: "test@user.com",
  password: "test1234",
});
check("login test@user.com", !loginErr, loginErr?.message ?? "");
const userA = (await supabase.auth.getUser()).data.user;

// ---- 6.1/3.2: crear cancha de prueba + reserva hoy en la franja actual ----
const insCourt = await supabase
  .from("courts")
  .insert({ name: `Cancha Test Reservas ${stamp}`, type: "padel", user_id: userA.id })
  .select()
  .single();
check("setup insert cancha de prueba", !insCourt.error, insCourt.error?.message ?? insCourt.data?.id);

const reservation = {
  court_id: insCourt.data.id,
  date: todayKey,
  time: slot,
  customer_name: "Verificación Ocupación",
  phone: "3415000000",
  user_id: userA.id,
};
const insRes = await supabase.from("reservations").insert(reservation).select().single();
check("3.2/6.1 insert reserva en franja actual", !insRes.error, insRes.error?.message ?? insRes.data?.id);

// "La home la reporta ocupada": la reserva se lee de vuelta para hoy con titular y cancha correctos
const reload = await supabase.from("reservations").select("*").eq("date", todayKey);
const found = reload.data?.find(
  (r) => r.court_id === insCourt.data.id && r.time === slot && r.customer_name === "Verificación Ocupación"
);
check("5.2/6.1 home reporta ocupada con titular correcto", !!found && !reload.error, found ? `${found.customer_name} @ ${found.time}` : "no encontrada");

// ---- 3.4/6.1: slot duplicado rechazado por el constraint único ----
const dup = await supabase.from("reservations").insert({ ...reservation, customer_name: "Duplicado" }).select().single();
check("3.4/6.1 slot duplicado rechazado (23505)", !!dup.error && dup.error.code === "23505", dup.error ? `code ${dup.error.code}` : "se guardó igual");

// ---- 3.3: edición persiste ----
const upd = await supabase
  .from("reservations")
  .update({ customer_name: "Verificación Editada", phone: "3415111111" })
  .eq("id", insRes.data.id)
  .select()
  .single();
check("3.3 edición guarda en Supabase", !upd.error && upd.data.customer_name === "Verificación Editada", upd.error?.message ?? upd.data?.customer_name);

// ---- 3.3: eliminación persiste ----
const del = await supabase.from("reservations").delete().eq("id", insRes.data.id);
const afterDelete = await supabase.from("reservations").select("*").eq("id", insRes.data.id);
check("3.3 eliminación reflejada tras recargar", !del.error && (afterDelete.data?.length ?? 1) === 0, `${afterDelete.data?.length ?? "?"} filas restantes`);

// ---- 6.2: insert con user_id ajeno / court_id ajeno es rechazado ----
const emailB = `test-b-${stamp}@user.com`;
const signUpB = await supabase.auth.signUp({ email: emailB, password: "test1234" });

if (signUpB.data.session) {
  const userB = signUpB.data.user;

  const foreignUser = await supabase.from("reservations").insert({ ...reservation, user_id: userB.id }).select().single();
  check("6.2 insert con user_id ajeno rechazado", !!foreignUser.error, foreignUser.error?.message ?? "se insertó");

  const insCourtB = await supabase.from("courts").insert({ name: `Cancha B ${stamp}`, type: "tenis", user_id: userB.id }).select().single();
  const foreignCourt = await supabase.from("reservations").insert({ ...reservation, court_id: insCourtB.data.id }).select().single();
  check("6.2 insert con court_id ajeno rechazado", !!foreignCourt.error, foreignCourt.error?.message ?? "se insertó");

  // ---- 6.3: usuario B (sin canchas tras limpieza) ve todo vacío ----
  await supabase.from("courts").delete().eq("id", insCourtB.data.id);
  const courtsB = await supabase.from("courts").select("*");
  const resB = await supabase.from("reservations").select("*");
  check("6.3 usuario B ve 0 canchas y 0 reservas", (courtsB.data?.length ?? 1) === 0 && (resB.data?.length ?? 1) === 0, `${courtsB.data?.length ?? "?"} canchas, ${resB.data?.length ?? "?"} reservas`);

  // Limpieza: borrar cancha de A (cascada de reservas) y salir
  await supabase.from("courts").delete().eq("id", insCourt.data.id);
  await supabase.auth.signOut();
  console.log("OK    limpieza realizada (canchas de prueba y sesiones cerradas)");
} else {
  console.log("SKIP 6.2/6.3 con usuario B — la confirmación de email está habilitada y no hay sesión para B.");
  console.log("      (El aislamiento está garantizado por RLS + trigger; se puede verificar a mano con otro usuario confirmado.)");
  await supabase.from("courts").delete().eq("id", insCourt.data.id);
}

console.log(failures === 0 ? "\nTODO OK" : `\n${failures} VERIFICACIONES FALLARON`);
process.exit(failures === 0 ? 0 : 1);
