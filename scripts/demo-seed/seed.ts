/**
 * One-time demo setup: drives the real app in a headless Chrome, exactly as a person would, so every record
 * is made by the app's own code (hashes, normalising, checks, audit log). Nothing here writes to the database
 * directly.
 *
 *   1. npm run db:wipe          (optional, starts from an empty database)
 *   2. npm run dev              (the app must be running, default http://localhost:3000)
 *   3. npm run demo:seed
 *
 * It makes four accounts (bhanwar, meet, love, ayush; password is <name>@123), the scenario-B case, invites
 * and accepts the other three, and adds seven of the eight scenario-B documents as the exporter. The lorry
 * receipt (B5) is left out on purpose: it is added live in the demo.
 *
 * The values come from mock_assets/B_planted-problems/B_FORM_VALUES.txt, so they match the PDFs exactly.
 */
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright-core";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DOC_FORMS, type FieldSpec, type RepeatSpec } from "../../src/lib/doc-forms";
import { docTypeSlug, type DocType } from "../../src/lib/documents";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MOCK = join(process.cwd(), "mock_assets", "B_planted-problems");
const T = 90_000;

type Account = { username: string; name: string; email: string; phone: string; role: string; org?: string; gstin?: string; iec?: string };
const ACCOUNTS: Account[] = [
  { username: "bhanwar", name: "Bhanwar Lal", email: "bhanwar@example.com", phone: "9876500001", role: "Consignor / Exporter", iec: "AAHCI3306R", gstin: "33AAHCI3306R1ZC" },
  { username: "meet", name: "Meet Bhut", email: "meet@example.com", phone: "9876500002", role: "Transporter / Fleet Dispatcher" },
  { username: "love", name: "Love Rajawat", email: "love@example.com", phone: "9876500003", role: "Gate Entry Officer" },
  { username: "ayush", name: "Ayush Yadav", email: "ayush@example.com", phone: "9876500004", role: "Consignee / Buyer", org: "Nordic Textile Imports GmbH" },
];
const password = (a: Account) => `${a.username}@123`;

/** The seven documents the exporter adds in advance: step number in B_FORM_VALUES.txt, type, PDF. */
const DOCS: Array<{ step: number; type: DocType; file: string }> = [
  { step: 3, type: "shipping_bill", file: "B1_shipping-bill.pdf" },
  { step: 4, type: "commercial_invoice", file: "B2_commercial-invoice.pdf" },
  { step: 5, type: "packing_list", file: "B3_packing-list.pdf" },
  { step: 6, type: "eway_bill", file: "B4_e-way-bill.pdf" },
  { step: 8, type: "form_13", file: "B6_form-13.pdf" },
  { step: 9, type: "vgm_declaration", file: "B7_vgm-declaration.pdf" },
  { step: 10, type: "e_seal", file: "B8_e-seal.pdf" },
];

// ---------- parsing B_FORM_VALUES.txt ----------

type Entry = { label: string; value: string; row: { header: string; index: number } | null };

function parseSteps(): Map<number, Entry[]> {
  const path = join(MOCK, "B_FORM_VALUES.txt");
  if (!existsSync(path)) throw new Error(`Missing ${path}. Run: npm run mocks:generate`);
  const out = new Map<number, Entry[]>();
  let step = 0;
  let row: Entry["row"] = null;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const s = line.match(/^STEP (\d+)\./);
    if (s) {
      step = Number(s[1]);
      row = null;
      out.set(step, []);
      continue;
    }
    if (!step) continue;
    const h = line.match(/^\s+(Item|Container|Line) (\d+)\s*$/);
    if (h) {
      row = { header: h[1], index: Number(h[2]) - 1 };
      continue;
    }
    if (/^\s{2}[A-Z]/.test(line) && !line.includes(" : ") && !/^\s{4}/.test(line)) row = null; // a new heading
    const kv = line.match(/^\s{4,}(.+?)\s*:\s(.*)$/);
    if (!kv) continue;
    const label = kv[1].trim();
    if (["Page", "Menu", "Add as", "File", "Note"].includes(label)) continue;
    let value = kv[2].replace(/\s*<-.*$/, "").split(/\s{3,}/)[0].trim();
    if (value === "(leave empty)") continue;
    out.get(step)!.push({ label, value, row });
  }
  return out;
}

const isoDate = (v: string) => v.replace(/^(\d\d)\/(\d\d)\/(\d{4})$/, "$3-$2-$1");

// ---------- small browser helpers ----------

const byId = (page: Page, id: string) => page.locator(`[id="${id}"]`);

async function pick(sel: Locator, want: string) {
  const opts = await sel.locator("option").evaluateAll((os) => os.map((o) => ({ v: (o as HTMLOptionElement).value, t: (o.textContent ?? "").trim() })));
  const w = want.trim().toLowerCase();
  const m = opts.find((o) => o.v.toLowerCase() === w) ?? opts.find((o) => o.t.toLowerCase() === w) ?? opts.find((o) => o.t.toLowerCase().startsWith(w));
  if (!m) throw new Error(`No option "${want}" in [${opts.slice(0, 8).map((o) => o.t).join(", ")}…]`);
  await sel.selectOption(m.v);
}

async function setField(page: Page, id: string, kind: FieldSpec["kind"], value: string) {
  const el = byId(page, id);
  await el.waitFor({ timeout: T });
  if (kind === "select") return pick(el, value.split(" · ")[0].replace(/\s{2,}.*$/, ""));
  if (kind === "date") return el.fill(isoDate(value));
  return el.fill(value);
}

async function failIfAlert(page: Page, what: string) {
  const alert = page.locator('p[role="alert"]').first();
  if (await alert.count()) throw new Error(`${what}: ${(await alert.innerText()).trim()}`);
}

async function newUserPage(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1360, height: 900 } });
  ctx.setDefaultTimeout(T);
  return { ctx, page: await ctx.newPage() };
}

// ---------- steps ----------

async function signUp(browser: Browser, a: Account) {
  const { ctx, page } = await newUserPage(browser);
  await page.goto("/sign-in?mode=sign-up");
  await page.locator("#name").fill(a.name);
  await page.locator("#username").fill(a.username);
  await page.locator("#email").fill(a.email);
  await page.locator('input[name="phone"]').fill(a.phone);
  await page.locator("#password").fill(password(a));
  await page.locator("#confirm").fill(password(a));
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/onboarding/, { timeout: T });
  // Account type
  await page.locator("label", { hasText: a.role }).first().click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.waitForURL(/\/onboarding\/profile/, { timeout: T });
  // Profile
  await page.locator("#legalName").fill(a.name);
  if (a.org) await page.locator("#organisation").fill(a.org);
  if (a.iec) await page.locator("#iec").fill(a.iec);
  if (a.gstin) await page.locator("#gstin").fill(a.gstin);
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: T });
  console.log(`  account ${a.username} (${a.role}) ready`);
  return { ctx, page };
}

async function createCase(page: Page, steps: Map<number, Entry[]>): Promise<string> {
  const e = steps.get(1)!;
  const get = (label: string, row = false) => e.find((x) => x.label === label && !!x.row === row)?.value ?? "";
  await page.goto("/cases/new");
  await setField(page, "originPlace", "text", get("Origin (place of dispatch)"));
  await setField(page, "exportPortCode", "text", get("Port / ICD of export"));
  await setField(page, "destinationCountry", "select", get("Destination country"));
  await setField(page, "destinationPort", "text", get("Destination port (optional)"));
  await setField(page, "incoterm", "select", get("Incoterm"));
  await setField(page, "currency", "select", get("Invoice currency"));
  const g = (label: string) => e.find((x) => x.label === label && x.row)?.value ?? e.find((x) => x.label.startsWith(label) && x.row)?.value ?? "";
  await setField(page, "lines.0.description", "text", g("Description"));
  await setField(page, "lines.0.hsCode", "text", g("HS code (8-digit)"));
  await setField(page, "lines.0.quantity", "text", g("Quantity"));
  await setField(page, "lines.0.uqc", "select", g("Unit (UQC)"));
  await setField(page, "lines.0.packages", "text", g("Packages"));
  await setField(page, "lines.0.packageType", "text", g("Package type"));
  await setField(page, "lines.0.netWeight", "text", g("Net weight"));
  await setField(page, "lines.0.grossWeight", "text", g("Gross weight"));
  await setField(page, "lines.0.weightUnit", "select", g("Weight unit"));
  await setField(page, "lines.0.value", "text", g("Value"));
  await page.getByRole("button", { name: /Create case/ }).click();
  await page.waitForURL(/\/cases\/GIQ-[A-Z0-9-]+/, { timeout: T });
  await failIfAlert(page, "Create case");
  const code = new URL(page.url()).pathname.split("/")[2];
  console.log(`  case created: ${code}`);
  return code;
}

async function invite(page: Page, code: string, username: string) {
  await page.goto(`/cases/${code}/people`);
  await page.locator("#invite-username").fill(username);
  await page.getByRole("button", { name: /^Find$|Finding/ }).click();
  await page.getByRole("button", { name: "Send invite" }).click();
  await page.getByText(`Invite sent to @${username}`).waitFor({ timeout: T });
  console.log(`  invited @${username}`);
}

async function accept(page: Page, username: string) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Accept" }).first().click();
  await page.getByText(/You are on case/).waitFor({ timeout: T });
  console.log(`  @${username} accepted`);
}

async function addDocument(page: Page, code: string, steps: Map<number, Entry[]>, d: (typeof DOCS)[number]) {
  const spec = DOC_FORMS[d.type]!;
  const entries = steps.get(d.step) ?? [];
  const groupFields = new Map<string, FieldSpec>();
  const repeats = spec.sections.filter((s): s is RepeatSpec => s.kind === "repeat");
  for (const s of spec.sections) if (s.kind === "group") for (const f of s.fields) groupFields.set(f.label, f);

  await page.goto(`/cases/${code}/documents/new/${docTypeSlug(d.type)}`);
  await page.getByRole("button", { name: "Type it" }).click();

  // Rows first: make sure each repeated section has enough rows.
  for (const r of repeats) {
    const need = Math.max(0, ...entries.filter((x) => x.row && x.row.header === (r.key === "lines" ? "Item" : "Container")).map((x) => x.row!.index + 1));
    const first = r.fields[0].key;
    for (let i = 0; i < need; i++) {
      if (!(await byId(page, `${r.key}.${i}.${first}`).count())) {
        await page.getByRole("button", { name: r.addLabel, exact: true }).click();
        await byId(page, `${r.key}.${i}.${first}`).waitFor({ timeout: T });
      }
    }
  }

  for (const e of entries) {
    if (e.row) {
      const r = repeats.find((x) => x.itemLabel === e.row!.header) ?? repeats.find((x) => x.key === (e.row!.header === "Item" ? "lines" : "containers"));
      const f = r?.fields.find((x) => x.label === e.label);
      if (!r || !f) { console.warn(`  ! ${d.type}: no field for row label "${e.label}"`); continue; }
      await setField(page, `${r.key}.${e.row.index}.${f.key}`, f.kind, e.value);
    } else {
      const f = groupFields.get(e.label);
      if (!f) { console.warn(`  ! ${d.type}: no field for label "${e.label}"`); continue; }
      await setField(page, f.key, f.kind, e.value);
    }
  }
  await page.locator("#file").setInputFiles(join(MOCK, d.file));
  await page.getByRole("button", { name: spec.submitLabel, exact: true }).click();
  await page.waitForURL((u) => !u.pathname.includes("/documents/new/"), { timeout: T }).catch(async () => {
    await failIfAlert(page, `Add ${d.type}`);
    throw new Error(`Add ${d.type}: still on the form`);
  });
  console.log(`  added ${d.type}`);
}

async function main() {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME}. Set CHROME_PATH.`);
  const steps = parseSteps();
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    console.log("Accounts");
    const sessions: Record<string, { ctx: BrowserContext; page: Page }> = {};
    for (const a of ACCOUNTS) sessions[a.username] = await signUp(browser, a);

    console.log("Case");
    const exporter = sessions.bhanwar.page;
    const code = await createCase(exporter, steps);

    console.log("People");
    for (const u of ["ayush", "meet", "love"]) await invite(exporter, code, u);
    for (const u of ["ayush", "meet", "love"]) await accept(sessions[u].page, u);

    console.log("Documents (as the exporter)");
    for (const d of DOCS) await addDocument(exporter, code, steps, d);

    await exporter.goto(`/cases/${code}/checks`);
    await exporter.getByRole("heading", { name: "Checks" }).first().waitFor({ timeout: T });
    const summary = (await exporter.locator("h2:has-text('Checks') + p").first().innerText().catch(() => "")).trim();
    console.log(`\nDone. Case ID: ${code}`);
    console.log(`Checks tab says: ${summary || "(could not read)"}`);
    console.log("Lorry receipt (B5) is NOT added: do that live as meet.");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("\nSeed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
