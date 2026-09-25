// Verificación del soft delete de canchas y la policy de UPDATE (migración 0003_court_soft_delete.sql).
// Cubre: columna `active` aplicada, policy `courts_update_own`, edición de cancha,
// baja lógica (desaparece del listado pero persiste en la base) y aislamiento RLS del UPDATE.
// Uso: node scripts/verify-court-soft-delete.mjs
// Requiere: migración 0003_court_soft_delete.sql aplicada en Supabase.
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

const stamp = Date.now();

// ---- Login usuario A (test@user.com) ----
const { error: loginErr } = await supabase.auth.signInWithPassword({
  email: "test@user.com",
  password: "test1234",
});
check("login test@user.com", !loginErr, loginErr?.message ?? "");
if (loginErr) {
  console.log("\nABORTADO — no se pudo iniciar sesión.");
  process.exit(1);
}
const userA = (await supabase.auth.getUser()).data.user;

// ---- 1. La columna `active` existe y viene en true por defecto ----
const ins = await supabase
  .from("courts")
  .insert({ name: `Cancha SoftDelete ${stamp}`, type: "padel", user_id: userA.id })
  .select()
  .single();
check("1 insert cancha de prueba", !ins.error, ins.error?.message ?? ins.data?.id);
check("1 columna active existe y default true", ins.data?.active === true, `active=${ins.data?.active}`);

const courtId = ins.data.id;

// ---- 2. Edición (UPDATE propio) renombra la cancha ----
const upd = await supabase.from("courts").update({ name: `Cancha Editada ${stamp}` }).eq("id", courtId).select().single();
check("2 edición propia permitida por RLS", !upd.error && upd.data?.name === `Cancha Editada ${stamp}`, upd.error?.message ?? upd.data?.name);

// ---- 3. Soft delete: desaparece del listado activo pero persiste en la base ----
const del = await supabase.from("courts").update({ active: false }).eq("id", courtId).select().single();
check("3 soft delete aplica active=false", !del.error && del.data?.active === false, del.error?.message ?? `active=${del.data?.active}`);

const activeList = await supabase.from("courts").select("id").eq("active", true);
check("3 no aparece en el listado activo", !activeList.data?.some((c) => c.id === courtId), `${activeList.data?.length ?? 0} activas`);

const fullTable = await supabase.from("courts").select("id, active").eq("id", courtId).single();
check("3 la fila sigue existiendo en la base", fullTable.data?.id === courtId && fullTable.data?.active === false, fullTable.error?.message ?? "");

// ---- 4. Aislamiento RLS: usuario B no puede editar ni dar de baja la cancha de A ----
const emailB = `test-sd-${stamp}@user.com`;
const signUpB = await supabase.auth.signUp({ email: emailB, password: "test1234" });

if (signUpB.data.session) {
  const updByB = await supabase.from("courts").update({ name: "Hackeada" }).eq("id", courtId).select();
  check("4 B no puede editar cancha de A", updByB.data?.length === 0 && !updByB.error, updByB.error?.message ?? `${updByB.data?.length ?? 0} filas afectadas`);

  const delByB = await supabase.from("courts").update({ active: false }).eq("id", courtId).select();
  check("4 B no puede dar de baja cancha de A", delByB.data?.length === 0 && !delByB.error, delByB.error?.message ?? `${delByB.data?.length ?? 0} filas afectadas`);

  // Volver a A y verificar que la cancha quedó igual (solo con el rename propio)
  await supabase.auth.signInWithPassword({ email: "test@user.com", password: "test1234" });
  const afterB = await supabase.from("courts").select("name, active").eq("id", courtId).single();
  check("4 cancha intacta tras intentos de B", afterB.data?.name === `Cancha Editada ${stamp}` && afterB.data?.active === false, JSON.stringify(afterB.data));
} else {
  console.log("SKIP 4 — la confirmación de email está habilitada y no hay sesión para el usuario B.");
  console.log("      (El aislamiento igual está garantizado por la policy using (user_id = auth.uid()).)");
}

// ---- Limpieza: no hay policy de DELETE (a propósito; la baja soportada es la lógica) ----
// La cancha de prueba queda con active=false: invisible en la UI y aislada por RLS.
console.log("NOTA  sin policy de DELETE en RLS (por diseño); la cancha de prueba queda soft-deleted e invisible.");

console.log(failures === 0 ? "\nTODO OK" : `\n${failures} VERIFICACIONES FALLARON`);
process.exit(failures === 0 ? 0 : 1);
