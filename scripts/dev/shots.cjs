// Inicia sesión con un usuario de prueba y saca capturas de las rutas pedidas.
// Credenciales: TEST_ADMIN_EMAIL/PASSWORD y TEST_OPERADOR_EMAIL/PASSWORD de .env.local.
// Uso: NODE_PATH=$(npm root -g) node --env-file=.env.local scripts/dev/shots.cjs <rol: admin|operador> <outDir> <prefijo> <ruta> [ruta...]
// Ancho: env WIDTHS="1440x900,390x844" (por defecto ambas). FULL=1 para página completa.
const { chromium } = require("playwright");
const path = require("path");

const [role, outDir, prefix, ...routes] = process.argv.slice(2);
const user =
  role === "operador"
    ? { email: process.env.TEST_OPERADOR_EMAIL, password: process.env.TEST_OPERADOR_PASSWORD }
    : { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD };
if (!user.email || !user.password) throw new Error("Faltan TEST_* en .env.local (usar --env-file=.env.local)");
const widths = (process.env.WIDTHS || "1440x900,390x844").split(",").map((w) => w.split("x").map(Number));
const BASE = process.env.BASE || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    // FAKE_NOW="2026-10-06T18:40:00" congela el reloj del navegador (para ver "ahora" a media tarde).
    if (process.env.FAKE_NOW) await page.clock.setFixedTime(new Date(process.env.FAKE_NOW));
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: /ingres|iniciar/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 20000 });
    for (const route of routes) {
      await page.goto(`${BASE}${route}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(800);
      const name = `${prefix}-${role}-${route.replace(/\W+/g, "_").replace(/^_|_$/g, "") || "root"}-${w}.png`;
      await page.screenshot({ path: path.join(outDir, name), fullPage: !!process.env.FULL });
      console.log("shot", name);
    }
    if (errors.length) console.log(`errores de consola (${w}px):\n  ` + [...new Set(errors)].join("\n  "));
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
