// Verificación de las reglas de precio especial (lib/special-pricing.ts), sin base de datos.
// Uso: node scripts/verify-special-pricing.ts
import { resolvePricing, type ExistingPricing, type PricingInput } from "../lib/special-pricing.ts";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const LIST = 24000;
let listCalls = 0;
const listPrice = async () => {
  listCalls++;
  return LIST;
};
const input = (p: Partial<PricingInput>): PricingInput => ({
  pricing_mode: "lista",
  unit_price: null,
  expected_people: null,
  custom_price: null,
  ...p,
});
const existing = (p: Partial<ExistingPricing>): ExistingPricing => ({
  pricing_mode: "lista",
  price: LIST,
  unit_price: null,
  expected_people: null,
  has_payments: false,
  slot_unchanged: true,
  ...p,
});
const throws = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
};

// Alta como admin
{
  const r = await resolvePricing(true, input({}), null, listPrice);
  check("lista: precio de lista", r.price === LIST && r.pricing_mode === "lista" && r.payment_status === null);
}
{
  const r = await resolvePricing(true, input({ pricing_mode: "sin_cargo" }), null, listPrice);
  check("sin cargo: $0 y pagado", r.price === 0 && r.payment_status === "pagada");
}
{
  const r = await resolvePricing(true, input({ pricing_mode: "monto_fijo", custom_price: 15000 }), null, listPrice);
  check("monto fijo: el monto", r.price === 15000 && r.custom_price === 15000);
}
{
  const r = await resolvePricing(
    true,
    input({ pricing_mode: "por_persona", unit_price: 10000, expected_people: 4 }),
    null,
    listPrice
  );
  check(
    "por persona: arranca en $0 con precio por persona",
    r.price === 0 && r.unit_price === 10000 && r.expected_people === 4 && r.payment_status === null
  );
}
check("por persona sin precio: error", await throws(() => resolvePricing(true, input({ pricing_mode: "por_persona" }), null, listPrice)));
check("monto fijo sin monto: error", await throws(() => resolvePricing(true, input({ pricing_mode: "monto_fijo" }), null, listPrice)));

// Alta como no admin: siempre de lista
{
  const r = await resolvePricing(false, input({ pricing_mode: "sin_cargo" }), null, listPrice);
  check("no admin: ignora el modo pedido", r.pricing_mode === "lista" && r.price === LIST);
}

// Edición
{
  listCalls = 0;
  const r = await resolvePricing(true, input({}), existing({ price: 20000 }), listPrice);
  check("edición de lista sin mover: conserva el precio", r.price === 20000 && listCalls === 0);
}
{
  const r = await resolvePricing(true, input({}), existing({ price: 20000, slot_unchanged: false }), listPrice);
  check("edición de lista movida: recalcula", r.price === LIST);
}
{
  const r = await resolvePricing(
    true,
    input({ pricing_mode: "por_persona", unit_price: 12000 }),
    existing({ pricing_mode: "por_persona", price: 30000, unit_price: 10000, has_payments: true }),
    listPrice
  );
  check("por persona con cobros: conserva lo cobrado", r.price === 30000 && r.unit_price === 12000 && r.payment_status === null);
}
check(
  "cambiar el modo con cobros: error",
  await throws(() =>
    resolvePricing(true, input({ pricing_mode: "sin_cargo" }), existing({ has_payments: true }), listPrice)
  )
);
{
  const r = await resolvePricing(true, input({}), existing({ pricing_mode: "sin_cargo", price: 0 }), listPrice);
  check("de sin cargo a lista: precio de lista y pendiente", r.price === LIST && r.payment_status === "pendiente");
}
{
  const r = await resolvePricing(
    false,
    input({}),
    existing({ pricing_mode: "por_persona", price: 30000, unit_price: 10000 }),
    listPrice
  );
  check("no admin editando un turno especial: lo deja igual", r.pricing_mode === "por_persona" && r.price === 30000 && r.unit_price === 10000);
}

console.log(failures ? `\n${failures} verificación(es) fallaron` : "\nTodo OK");
process.exit(failures ? 1 : 0);
