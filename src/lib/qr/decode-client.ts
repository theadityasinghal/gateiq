/**
 * Finds a QR code in a chosen file, in the browser, before anything is uploaded. Images are drawn to a
 * canvas; PDFs have their first two pages rendered with pdf.js. Browser-only (uses DOM canvas): import it
 * from client components alone.
 */
import jsQR from "jsqr";

const MAX_SIDE = 2400;

function scan(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

async function fromImage(file: File): Promise<string | null> {
  const bmp = await createImageBitmap(file);
  try {
    // Phone photos are large; scan a downscaled copy first, then full size if nothing was found.
    for (const scale of [Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height)), 1]) {
      const c = canvasOf(bmp.width * scale, bmp.height * scale);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      const found = scan(c);
      if (found) return found;
      if (scale === 1) break;
    }
    return null;
  } finally {
    bmp.close();
  }
}

async function fromPdf(file: File): Promise<string | null> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  try {
    for (let p = 1; p <= Math.min(2, doc.numPages); p++) {
      const page = await doc.getPage(p);
      for (const scale of [2, 3.5]) {
        const viewport = page.getViewport({ scale });
        const c = canvasOf(viewport.width, viewport.height);
        await page.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport }).promise;
        const found = scan(c);
        if (found) return found;
      }
    }
    return null;
  } finally {
    await task.destroy();
  }
}

/** The text of the first QR code found, or null. Never throws: a QR code is a bonus, not a requirement. */
export async function decodeQrFromFile(file: File): Promise<string | null> {
  try {
    if (file.type === "application/pdf") return await fromPdf(file);
    if (file.type.startsWith("image/")) return await fromImage(file);
    return null;
  } catch (e) {
    console.warn("QR decoding failed", e);
    return null;
  }
}
