// Inspecciona (y opcionalmente limpia) los turnos "Prueba*" que dejan las pruebas
// automáticas en el club de prueba. Usa la service key (no la guarda en ningún lado).
// Uso: node --env-file=.env.local scripts/dev/inspect-test-reservations.mjs [--clean]
//      (toma SUPABASE_SECRET_KEY de .env.local; también acepta SUPA_SERVICE_KEY por variable de entorno)
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPA_SERVICE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const clean = process.argv.includes("--clean");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const get = async (path) => (await fetch(`${URL}/rest/v1/${path}`, { headers: H })).json();
const del = async (path) => { const r = await fetch(`${URL}/rest/v1/${path}`, { method: "DELETE", headers: H }); if (!r.ok) throw new Error(await r.text()); };

// El club de prueba es el club donde el admin de prueba es admin.
const admins = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, { headers: H }).then((r) => r.json());
const adminId = admins.users.find((u) => u.email === process.env.TEST_ADMIN_EMAIL)?.id;
if (!adminId) throw new Error("No se encontró TEST_ADMIN_EMAIL");
const [membership] = await get(`memberships?user_id=eq.${adminId}&role=eq.admin&select=club_id&order=created_at`);
const owner = membership?.club_id;
if (!owner) throw new Error("El admin de prueba no es admin de ningún club");
const res = await get(`reservations?club_id=eq.${owner}&customer_name=like.Prueba*&select=id,date,time,customer_name,status,payment_status,late_cancel,phone&order=created_at`);
for (const r of res) {
  const pays = await get(`payments?reservation_id=eq.${r.id}&select=kind,amount,released`);
  console.log(r.date, r.time, r.customer_name, r.status, r.payment_status, r.late_cancel ? "tardía" : "", JSON.stringify(pays));
}
const credits = await get(`credit_balances?club_id=eq.${owner}&customer_phone=like.341555900*&select=customer_phone,amount`);
console.log("saldos:", JSON.stringify(credits));
if (clean) {
  for (const r of res) await del(`payments?reservation_id=eq.${r.id}`);
  for (const r of res) await del(`reservations?id=eq.${r.id}`);
  await del(`credit_balances?club_id=eq.${owner}&customer_phone=like.341555900*`);
  console.log("limpio:", res.length, "turnos de prueba borrados");
}
