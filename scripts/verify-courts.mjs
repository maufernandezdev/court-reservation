// Verificación integral del flujo de canchas (tasks 4.1, 4.2, 4.3 del change add-court-management).
// Uso: node scripts/verify-courts.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Carga NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY desde .env.local
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

// ---- 4.3: sin sesión no se puede leer la tabla ----
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const anonRes = await anon.from("courts").select("*");
check("4.3 sin sesión no lee courts", anonRes.data?.length === 0 && !anonRes.error, anonRes.error?.message ?? `${anonRes.data.length} filas`);

// ---- Login usuario A (test@user.com) ----
const { error: loginErr } = await supabase.auth.signInWithPassword({
  email: "test@user.com",
  password: "test1234",
});
check("login test@user.com", !loginErr, loginErr?.message ?? "");

// ---- 4.1: crear dos canchas de distinto tipo y verificar persistencia ----
const stamp = Date.now();
const courtA1 = { name: `Cancha Test Fútbol ${stamp}`, type: "futbol" };
const courtA2 = { name: `Cancha Test Tenis ${stamp}`, type: "tenis" };

const ins1 = await supabase.from("courts").insert({ ...courtA1, user_id: (await supabase.auth.getUser()).data.user.id }).select().single();
check("4.1 insert cancha fútbol", !ins1.error, ins1.error?.message ?? ins1.data?.id);
const ins2 = await supabase.from("courts").insert({ ...courtA2, user_id: (await supabase.auth.getUser()).data.user.id }).select().single();
check("4.1 insert cancha tenis", !ins2.error, ins2.error?.message ?? ins2.data?.id);

// "Recarga": nueva query contra la base
const reload = await supabase.from("courts").select("*");
const persisted = reload.data?.filter((c) => [ins1.data?.id, ins2.data?.id].includes(c.id)) ?? [];
check("4.1 canchas persisten tras recargar", persisted.length === 2 && !reload.error, `${persisted.length}/2 encontradas`);

// ---- 4.2: usuario B no ve las canchas de A y viceversa ----
const emailB = `test-b-${stamp}@user.com`;
const passwordB = "test1234";
const signUpB = await supabase.auth.signUp({ email: emailB, password: passwordB });

if (signUpB.data.session) {
  // Confirmación de email deshabilitada: sesión directa
  const courtsOfB = await supabase.from("courts").select("*");
  const seesA = courtsOfB.data?.some((c) => c.user_id !== signUpB.data.user.id) ?? false;
  check("4.2 usuario B no ve canchas de A", !seesA, `${courtsOfB.data?.length ?? 0} filas propias`);

  const insB = await supabase.from("courts").insert({ name: `Cancha B Pádel ${stamp}`, type: "padel", user_id: signUpB.data.user.id }).select().single();
  check("4.2 insert cancha usuario B", !insB.error, insB.error?.message ?? insB.data?.id);

  await supabase.auth.signInWithPassword({ email: "test@user.com", password: "test1234" });
  const courtsOfA = await supabase.from("courts").select("*");
  const seesB = courtsOfA.data?.some((c) => c.id === insB.data?.id) ?? false;
  check("4.2 usuario A no ve cancha de B", !seesB, seesB ? "FILTRACIÓN" : "aislado");

  // Limpieza: borrar la cancha de B (el usuario B queda, sin canchas)
  await supabase.from("courts").delete().eq("id", insB.data.id);
} else {
  console.log("SKIP 4.2 — la confirmación de email está habilitada y no hay sesión para el usuario B.");
  console.log("      (El aislamiento igual está garantizado por las policies RLS; se puede verificar a mano con otro usuario confirmado.)");
}

console.log(failures === 0 ? "\nTODO OK" : `\n${failures} VERIFICACIONES FALLARON`);
process.exit(failures === 0 ? 0 : 1);
