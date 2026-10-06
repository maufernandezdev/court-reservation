// Inspecciona (y opcionalmente limpia) los turnos "Prueba*" que dejan las pruebas
// automáticas en el club de prueba. Usa la service key (no la guarda en ningún lado).
// Uso: SUPA_SERVICE_KEY=$(supabase projects api-keys --project-ref <ref> -o json | jq -r '.[]|select(.name=="service_role").api_key') \
//        node --env-file=.env.local scripts/dev/inspect-test-reservations.mjs [--clean]
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.SUPA_SERVICE_KEY;
const clean = process.argv.includes("--clean");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const get = async (path) => (await fetch(`${URL}/rest/v1/${path}`, { headers: H })).json();
const del = async (path) => { const r = await fetch(`${URL}/rest/v1/${path}`, { method: "DELETE", headers: H }); if (!r.ok) throw new Error(await r.text()); };

// El dueño del club de prueba es el admin de prueba.
const admins = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, { headers: H }).then((r) => r.json());
const owner = admins.users.find((u) => u.email === process.env.TEST_ADMIN_EMAIL)?.id;
if (!owner) throw new Error("No se encontró TEST_ADMIN_EMAIL");
const res = await get(`reservations?user_id=eq.${owner}&customer_name=like.Prueba*&select=id,date,time,customer_name,status,payment_status,late_cancel,phone&order=created_at`);
for (const r of res) {
  const pays = await get(`payments?reservation_id=eq.${r.id}&select=kind,amount,released`);
  console.log(r.date, r.time, r.customer_name, r.status, r.payment_status, r.late_cancel ? "tardía" : "", JSON.stringify(pays));
}
const credits = await get(`credit_balances?owner_id=eq.${owner}&customer_phone=like.341555900*&select=customer_phone,amount`);
console.log("saldos:", JSON.stringify(credits));
if (clean) {
  for (const r of res) await del(`payments?reservation_id=eq.${r.id}`);
  for (const r of res) await del(`reservations?id=eq.${r.id}`);
  await del(`credit_balances?owner_id=eq.${owner}&customer_phone=like.341555900*`);
  console.log("limpio:", res.length, "turnos de prueba borrados");
}
