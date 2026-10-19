// Herramienta del dueño del producto para la suscripción de los clubes (sin pantalla de superadmin).
//
//   node scripts/subscription-admin.mjs status <club>
//   node scripts/subscription-admin.mjs pay <club> --amount 15000 --cycle monthly [--mp-payment-id 123] [--yes]
//   node scripts/subscription-admin.mjs plan <club> <inicial|club|gran_club> [--yes]
//
// <club> es el id del club o su nombre exacto. Usa NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY
// (del entorno o de .env.local); nunca imprime las claves. `pay` llama a register_subscription_payment,
// la misma función que va a usar el webhook de Mercado Pago: repetir el mismo --mp-payment-id no duplica.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

function loadEnv() {
  const file = new URL("../.env.local", import.meta.url);
  const fromFile = existsSync(file)
    ? Object.fromEntries(
        readFileSync(file, "utf8")
          .split("\n")
          .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
          .map((l) => {
            const i = l.indexOf("=");
            return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
          })
      )
    : {};
  return { ...fromFile, ...process.env };
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else flags[key] = argv[++i];
    } else positional.push(argv[i]);
  }
  return { positional, flags };
}

const fail = (msg) => {
  console.error(`Error: ${msg}`);
  process.exit(1);
};

const money = (n) => `$${Number(n).toLocaleString("es-AR")}`;

const env = loadEnv();
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  fail("faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (en el entorno o en .env.local).");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { positional, flags } = parseArgs(process.argv.slice(2));
const [command, clubArg, planArg] = positional;

async function confirm(question) {
  if (flags.yes) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`${question} [s/N] `)).trim().toLowerCase();
  rl.close();
  return answer === "s" || answer === "si" || answer === "sí" || answer === "y";
}

async function findClub(ref) {
  if (!ref) fail("indicá el club (id o nombre exacto).");
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
  const query = supabase.from("clubs").select("id, name, city");
  const { data, error } = await (isId ? query.eq("id", ref) : query.ilike("name", ref));
  if (error) fail(error.message);
  if (!data?.length) fail(`no existe un club "${ref}".`);
  if (data.length > 1) fail(`hay ${data.length} clubes llamados "${ref}"; usá el id:\n${data.map((c) => `  ${c.id}  ${c.name} (${c.city})`).join("\n")}`);
  return data[0];
}

async function readSubscription(clubId) {
  const { data: info, error } = await supabase.rpc("club_subscription_info", { p_club_id: clubId });
  if (error) fail(error.message);
  return info;
}

async function lastPayments(clubId, limit) {
  const { data, error } = await supabase
    .from("subscription_payments")
    .select("paid_at, amount, billing_cycle, status, period_start, period_end, mp_payment_id")
    .eq("club_id", clubId)
    .order("paid_at", { ascending: false })
    .limit(limit);
  if (error) fail(error.message);
  return data ?? [];
}

const STATE = { trial: "Prueba gratis", active: "Al día", grace: "En gracia", expired: "Vencida", none: "Sin suscripción" };

function printStatus(club, info, payments) {
  console.log(`${club.name} (${club.city})  ${club.id}`);
  if (info.state === "none") return console.log("  Sin suscripción.");
  console.log(`  Estado:      ${STATE[info.state]}${info.can_write ? "" : " (solo lectura)"}`);
  console.log(`  Plan:        ${info.plan_name} (${info.billing_cycle === "yearly" ? "anual" : "mensual"})`);
  console.log(`  Vence:       ${info.ends_on}  (${info.days_left} días)`);
  console.log(`  Gracia:      ${info.grace_days} días${info.grace_days_left != null ? `, quedan ${info.grace_days_left}` : ""}`);
  console.log(`  Canchas:     ${info.courts_used} de ${info.courts_limit ?? "sin tope"}`);
  if (payments.length) {
    console.log("  Últimos pagos:");
    for (const p of payments) {
      console.log(`    ${p.paid_at.slice(0, 10)}  ${money(p.amount)}  ${p.billing_cycle}  ${p.status}  ${p.period_start} → ${p.period_end}${p.mp_payment_id ? `  mp:${p.mp_payment_id}` : ""}`);
    }
  }
}

if (command === "status") {
  const club = await findClub(clubArg);
  printStatus(club, await readSubscription(club.id), await lastPayments(club.id, 5));
} else if (command === "pay") {
  const club = await findClub(clubArg);
  const amount = Number(flags.amount);
  if (!Number.isFinite(amount) || amount <= 0) fail("indicá --amount con un monto mayor a 0.");
  const cycle = flags.cycle;
  if (cycle !== "monthly" && cycle !== "yearly") fail("--cycle tiene que ser monthly o yearly.");
  const mpId = typeof flags["mp-payment-id"] === "string" ? flags["mp-payment-id"] : null;

  printStatus(club, await readSubscription(club.id), await lastPayments(club.id, 1));
  if (!mpId) console.log("\nSin --mp-payment-id no hay idempotencia: registrar dos veces el mismo pago lo duplica.");
  if (!(await confirm(`\n¿Registrar un pago aprobado ${cycle === "yearly" ? "anual" : "mensual"} de ${money(amount)}?`))) fail("cancelado.");

  const { data, error } = await supabase.rpc("register_subscription_payment", {
    p_club_id: club.id,
    p_amount: amount,
    p_cycle: cycle,
    p_status: "approved",
    p_mp_payment_id: mpId,
  });
  if (error) fail(error.message);
  console.log(data.duplicate ? `Ese pago ya estaba registrado; no se cambió nada (vence ${data.paid_until}).` : `Pago registrado. Nuevo vencimiento: ${data.paid_until}.`);
} else if (command === "plan") {
  const club = await findClub(clubArg);
  if (!planArg) fail("indicá el plan: inicial, club o gran_club.");
  const { data: plan, error } = await supabase.from("plans").select("code, name, max_courts").eq("code", planArg).maybeSingle();
  if (error) fail(error.message);
  if (!plan) fail(`no existe el plan "${planArg}" (inicial, club o gran_club).`);

  const info = await readSubscription(club.id);
  if (info.state === "none") fail("el club no tiene suscripción.");
  if (plan.max_courts !== null && info.courts_used > plan.max_courts) {
    fail(`el club tiene ${info.courts_used} canchas activas y el plan ${plan.name} incluye hasta ${plan.max_courts}. Dalas de baja o elegí un plan mayor.`);
  }
  if (!(await confirm(`¿Pasar a ${club.name} del plan ${info.plan_name} al plan ${plan.name}?`))) fail("cancelado.");

  const { error: updateError } = await supabase.from("club_subscriptions").update({ plan_code: plan.code, updated_at: new Date().toISOString() }).eq("club_id", club.id);
  if (updateError) fail(updateError.message);
  console.log(`Listo: ${club.name} ahora está en el plan ${plan.name}.`);
} else {
  console.log("Uso:\n  status <club>\n  pay <club> --amount N --cycle monthly|yearly [--mp-payment-id ID] [--yes]\n  plan <club> <inicial|club|gran_club> [--yes]");
  process.exit(command ? 1 : 0);
}
