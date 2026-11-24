/**
 * Dress rehearsal of the live part of the demo, against a seeded case:
 *   CASE=GIQ-26-XXXXXXXX npm run demo:rehearse
 * It changes the case (adds the lorry receipt, corrects the packing list, adds an explanation), so run
 * `npm run db:wipe` and `npm run demo:seed` afterwards to get back to the starting state.
 */
import { chromium, type Page } from "playwright-core";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CODE = process.env.CASE ?? "";
const T = 90_000;
if (!CODE) throw new Error("Set CASE=<case id>");

const log = (s: string) => console.log(s);

async function signIn(browser: import("playwright-core").Browser, u: string) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1360, height: 900 } });
  ctx.setDefaultTimeout(T);
  const page = await ctx.newPage();
  await page.goto("/sign-in");
  await page.locator("#signInUsername").fill(u);
  await page.locator("#password").fill(`${u}@123`);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: T });
  return page;
}

async function checks(page: Page, label: string) {
  await page.goto(`/cases/${CODE}/checks`);
  await page.getByRole("heading", { name: "Checks", exact: true }).first().waitFor();
  const summary = (await page.locator("h2:has-text('Checks') + p").first().innerText()).trim();
  const cards = await page.locator("li h3").allInnerTexts();
  log(`[${label}] ${summary}`);
  log(`   cards: ${cards.join(" | ")}`);
  return { summary, cards };
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    // 1. Meet adds the lorry receipt, read by Gemini
    const meet = await signIn(browser, "meet");
    await meet.goto("/dashboard");
    log(`meet dashboard lists the case: ${await meet.getByText(CODE).count() > 0}`);
    await meet.goto(`/cases/${CODE}/documents`);
    log(`meet sees Add document: ${await meet.getByText("Add document").count() > 0}`);
    await meet.goto(`/cases/${CODE}/documents/new/lorry-receipt`);
    await meet.locator("#read-file").setInputFiles(join(process.cwd(), "mock_assets/B_planted-problems/B5_lorry-receipt.pdf"));
    const t0 = Date.now();
    await meet.getByRole("button", { name: "Read it" }).click();
    await meet.getByText("Check what was read").waitFor({ timeout: T });
    log(`reading took ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    for (const id of ["lrNumber", "vehicleNumber", "packages", "chargedWeight", "driverName"]) {
      log(`   ${id} = ${await meet.locator(`[id="${id}"]`).inputValue().catch(() => "?")}`);
    }
    await meet.getByRole("button", { name: "Add lorry receipt", exact: true }).click();
    await meet.waitForURL((u) => !u.pathname.includes("/documents/new/"), { timeout: T });
    log("lorry receipt added");

    // 2. Bhanwar reads the checks, corrects the packing list, explains the consignee difference
    const bhanwar = await signIn(browser, "bhanwar");
    const before = await checks(bhanwar, "after lorry receipt");

    await bhanwar.goto(`/cases/${CODE}/documents`);
    await bhanwar.locator('a[aria-label="Correct"][href*="packing-list"]').click();
    await bhanwar.locator('[id="containers.0.containerNo"]').fill("GIQU 332017 3");
    await bhanwar.getByRole("button", { name: "Save correction" }).click();
    await bhanwar.waitForURL((u) => !u.search.includes("correct="), { timeout: T });
    log("packing list corrected");
    const after = await checks(bhanwar, "after correction");
    log(`   check-digit card gone: ${!after.cards.some((c) => /check digit/i.test(c))}; was there: ${before.cards.some((c) => /check digit/i.test(c))}`);

    await bhanwar.goto(`/cases/${CODE}/checks`);
    const card = bhanwar.locator("li", { has: bhanwar.getByRole("heading", { name: "Consignee", exact: true }) }).first();
    await card.getByText("Explain", { exact: true }).click();
    await card.locator("textarea").fill('Same company, the invoice just adds "Trading"');
    await card.getByRole("button", { name: "Save" }).click();
    await card.getByText("Same company").waitFor();
    log("consignee difference explained");

    await bhanwar.goto(`/cases/${CODE}/verified`);
    log(`verified info shows I agree / Put this value forward: ${(await bhanwar.getByText(/I agree|Put this value forward|Use this instead/).count()) > 0}`);

    // 3. Love sees it view-only
    const love = await signIn(browser, "love");
    await love.goto("/dashboard");
    log(`love dashboard lists the case: ${await love.getByText(CODE).count() > 0}`);
    await love.goto(`/cases/${CODE}/documents`);
    log(`love sees Add document button: ${await love.getByText("Add document").count() > 0} (expect false)`);
    log(`love sees View only label: ${await love.getByText("View only").count() > 0}`);
    await love.goto(`/cases/${CODE}/checks`);
    await love.getByRole("heading", { name: "Checks", exact: true }).first().waitFor();
    log(`love sees Explain links: ${await love.getByText("Explain", { exact: true }).count()} (expect 0)`);
    await love.goto(`/cases/${CODE}/activity`);
    log(`love activity rows: ${await love.locator("li").count()}`);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error("\nRehearsal failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
