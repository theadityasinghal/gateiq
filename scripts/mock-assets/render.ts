/**
 * Rendering helpers: HTML to PDF or PNG with the installed Chrome (headless), QR code payloads in the formats
 * src/lib/qr/parse.ts reads, and the "bad photo" treatments (blur, rotation, desk background, noise).
 * No network access is used. Set CHROME_PATH to use a different browser binary.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((p): p is string => !!p);

export function chromePath(): string {
  const found = CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error("Chrome was not found. Install Google Chrome or set CHROME_PATH to a Chrome/Chromium binary.");
  return found;
}

const work = mkdtempSync(join(tmpdir(), "gateiq-mocks-"));
const profile = join(work, "profile");
mkdirSync(profile, { recursive: true });
process.on("exit", () => rmSync(work, { recursive: true, force: true }));

let counter = 0;

function chrome(args: string[]) {
  execFileSync(chromePath(), ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--disable-extensions", `--user-data-dir=${profile}`, ...args], {
    stdio: "pipe",
    timeout: 90_000,
  });
}

function htmlFile(html: string): string {
  const p = join(work, `doc-${counter++}.html`);
  writeFileSync(p, html);
  return `file://${p}`;
}

export function toPdf(html: string, out: string) {
  chrome(["--no-pdf-header-footer", `--print-to-pdf=${out}`, htmlFile(html)]);
}

/** A PNG of the page as laid out at A4 width, at 2x so it reads like a flatbed scan. */
export function toPng(html: string, out: string, opts: { scale?: number } = {}) {
  chrome([`--screenshot=${out}`, "--window-size=794,1123", `--force-device-scale-factor=${opts.scale ?? 2}`, htmlFile(html)]);
}

/* ───────────── QR payloads ───────────── */

const b64url = (s: string) => Buffer.from(s).toString("base64url");
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** The IRN is a SHA-256 over seller GSTIN, document number, financial year and document type. */
export function irnFor(sellerGstin: string, docNo: string, invoiceDate: string): string {
  const y = Number(invoiceDate.slice(0, 4));
  const m = Number(invoiceDate.slice(5, 7));
  const fy = m >= 4 ? `${y}-${String((y + 1) % 100).padStart(2, "0")}` : `${y - 1}-${String(y % 100).padStart(2, "0")}`;
  return createHash("sha256").update(`${sellerGstin}${docNo}${fy}INV`).digest("hex");
}

/**
 * What an IRP-signed e-invoice QR carries: a JWT whose payload has `data` (a JSON string). The signature
 * here is a placeholder: GateIQ does not verify it (and says so on screen).
 */
export function eInvoiceQrText(o: { sellerGstin: string; docNo: string; date: string; totalInr: number; hsn: string; irn: string; items: number }): string {
  const data = {
    SellerGstin: o.sellerGstin,
    BuyerGstin: "URP",
    DocNo: o.docNo,
    DocTyp: "INV",
    DocDt: dmy(o.date),
    TotInvVal: o.totalInr,
    ItemCnt: o.items,
    MainHsnCode: o.hsn,
    Irn: o.irn,
    IrnDt: `${o.date} 11:42:07`,
  };
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ data: JSON.stringify(data) }));
  return `${header}.${payload}.${b64url("mock-signature-not-verified")}`;
}

/** The e-way bill printout QR: number, generator's GSTIN and date, slash separated. */
export function ewayQrText(o: { ewbNo: string; gstin: string; date: string }): string {
  return `${o.ewbNo}/${o.gstin}/${dmy(o.date)}`;
}

export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { errorCorrectionLevel: "L", margin: 4, width: 700 });
}

export async function qrPng(text: string, out: string, width = 900) {
  await QRCode.toFile(out, text, { errorCorrectionLevel: "L", margin: 4, width, type: "png" });
}

/* ───────────── Bad photos ───────────── */

const noise = (w: number, h: number, sigma: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma } } })
    .png()
    .toBuffer();

/** A page photographed on a desk: rotated, soft focus, uneven light, sensor noise, JPEG. */
export async function deskPhoto(pagePng: string, out: string, o: { angle: number; blur: number; quality: number; width?: number }) {
  const W = o.width ?? 1700;
  const H = Math.round(W * 1.5);
  const pageW = Math.round(W * 0.86);
  const page = await sharp(pagePng).resize({ width: pageW }).png().toBuffer();
  const rotated = await sharp(page).rotate(o.angle, { background: { r: 120, g: 88, b: 60, alpha: 0 } }).png().toBuffer();
  const meta = await sharp(rotated).metadata();
  const desk = await sharp({ create: { width: W, height: H, channels: 3, background: { r: 120, g: 88, b: 60 } } })
    .composite([{ input: await noise(W, H, 28), blend: "soft-light" }])
    .png()
    .toBuffer();
  const light = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="g" cx="30%" cy="25%" r="85%"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );
  let img = sharp(desk).composite([
    { input: rotated, left: Math.max(0, Math.round((W - (meta.width ?? pageW)) / 2)), top: Math.max(0, Math.round((H - (meta.height ?? H)) / 2)) },
    { input: light },
    { input: await noise(W, H, 7), blend: "soft-light" },
  ]);
  if (o.blur > 0) img = sharp(await img.png().toBuffer()).blur(o.blur);
  await img.jpeg({ quality: o.quality }).toFile(out);
}

/** A file that is over the 3.5 MB upload limit: an invoice-like page over a field of noise. */
export async function oversizedPng(pagePng: string, out: string, side = 1500) {
  const bg = await noise(side, side, 60);
  const page = await sharp(pagePng).resize({ width: Math.round(side * 0.8), height: Math.round(side * 0.92), fit: "inside" }).png().toBuffer();
  await sharp(bg).composite([{ input: page, gravity: "centre" }]).png({ compressionLevel: 1 }).toFile(out);
}

/** A picture with no document in it. */
export async function notADocument(out: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a6ea5"/><stop offset="1" stop-color="#f4c27a"/></linearGradient></defs><rect width="1600" height="1100" fill="url(#s)"/><circle cx="1180" cy="300" r="90" fill="#fff3c4"/><path d="M0 800 L260 480 L470 700 L720 380 L1010 760 L1260 520 L1600 820 L1600 1100 L0 1100Z" fill="#2d4a3e"/><path d="M0 930 C300 850 600 990 900 920 S1400 880 1600 940 L1600 1100 L0 1100Z" fill="#1c2f27"/></svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(out);
}
