import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { DocType } from "@/lib/documents";
import { extractionPrompt, extractionSchema } from "@/lib/extract/schema";

/**
 * Default model for reading documents; override with GEMINI_MODEL. Measured on a real shipping bill:
 * 3.5-flash answers in about 4 s, while the 3.8 and 3.7 flash models mostly came back 503 "high demand".
 */
const DEFAULT_MODEL = "gemini-3.5-flash";

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/** Raced against the main model when it is slow or busy; override with GEMINI_FALLBACK_MODEL (empty to disable). */
const DEFAULT_FALLBACK = "gemini-3.5-flash-lite";

function fallbackModel(): string | null {
  const v = process.env.GEMINI_FALLBACK_MODEL;
  return v === undefined ? DEFAULT_FALLBACK : v.trim() || null;
}

/** A typical reading takes 4 to 6 s. If the main model hasn't answered by then, start the fallback beside it. */
const HEDGE_AFTER_MS = 8_000;
/** The page allows 60 s per action; the upload and saving also need time, so the model gets 40 s in all. */
const TOTAL_MS = 40_000;

/** Overloaded, rate limited, or a server-side failure: worth a try on the fallback model. */
const busy = (e: unknown) =>
  (e instanceof ApiError && (e.status === 503 || e.status === 429 || e.status === 500 || e.status === 504)) ||
  (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError"));

class ModelError extends Error {
  constructor(readonly model: string, readonly cause: unknown) {
    super(`Gemini call failed on ${model}`);
  }
}

/**
 * Asks the main model; if it fails as busy, or hasn't answered after HEDGE_AFTER_MS, also asks the fallback
 * and takes whichever answers first (the other request is dropped). Nothing waits for a slow model
 * to time out before the next one is tried. Gives up after TOTAL_MS.
 */
async function hedged<T>(model: string, call: (model: string, signal: AbortSignal) => Promise<T>): Promise<{ value: T; model: string }> {
  const fb = fallbackModel();
  const all = new AbortController();
  const deadline = setTimeout(() => all.abort(new DOMException("Gemini took too long", "TimeoutError")), TOTAL_MS);
  const hedgeTimer: { id?: ReturnType<typeof setTimeout> } = {};

  try {
    return await new Promise<{ value: T; model: string }>((resolve, reject) => {
      const failures: ModelError[] = [];
      let running = 0;
      let fallbackStarted = false;

      const start = (m: string) => {
        running++;
        call(m, all.signal).then(
          (value) => resolve({ value, model: m }),
          (e) => {
            running--;
            failures.push(new ModelError(m, e));
            // A failure that isn't about load (bad request, bad key) won't be fixed by another model.
            if (!busy(e) && m === model) return reject(failures[failures.length - 1]);
            if (m === model && !fallbackStarted && fb && fb !== model && !all.signal.aborted) {
              console.warn("Gemini model busy, using fallback", { model: m, fallback: fb });
              startFallback();
            }
            if (running === 0) reject(failures[failures.length - 1]);
          },
        );
      };
      const startFallback = () => {
        if (fallbackStarted || !fb || fb === model) return;
        fallbackStarted = true;
        clearTimeout(hedgeTimer.id);
        start(fb);
      };

      if (fb && fb !== model) {
        hedgeTimer.id = setTimeout(() => {
          console.warn("Gemini model slow, racing the fallback", { model, fallback: fb });
          startFallback();
        }, HEDGE_AFTER_MS);
      }
      start(model);
    });
  } finally {
    clearTimeout(deadline);
    clearTimeout(hedgeTimer.id);
    all.abort(); // drops whichever request is still waiting
  }
}

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/**
 * Sends one file to the model with the type's schema and returns its JSON. Only this document is sent:
 * nothing else from the case, so the model can't "see" what it expects and copy it (a blind read).
 */
export async function readWithGemini(args: { type: DocType; mimeType: string; bytes: Buffer }): Promise<{ ok: true; output: unknown; model: string } | { ok: false; error: string }> {
  let model = geminiModel();
  try {
    const { value: res, model: used } = await hedged(model, (m, signal) => ai().models.generateContent({
      model: m,
      contents: [
        {
          role: "user",
          parts: [{ text: extractionPrompt(args.type) }, { inlineData: { mimeType: args.mimeType, data: args.bytes.toString("base64") } }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: extractionSchema(args.type),
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        abortSignal: signal,
      },
    }));
    model = used;
    const text = res.text;
    if (!text) return { ok: false, error: "The file couldn't be read. Try a clearer photo, or type the details in." };
    try {
      return { ok: true, output: JSON.parse(text), model };
    } catch {
      console.error("Gemini returned non-JSON", { model, sample: text.slice(0, 200) });
      return { ok: false, error: "The reading came back malformed. Try again, or type the details in." };
    }
  } catch (err) {
    const e = err instanceof ModelError ? err.cause : err;
    if (err instanceof ModelError) model = err.model;
    if (e instanceof ApiError) {
      console.error("Gemini API error", { model, status: e.status, message: e.message });
      if (e.status === 503) return { ok: false, error: "The reading service is overloaded right now. Try again in a minute, or type the details in." };
      if (e.status === 429) return { ok: false, error: "The reading service is busy. Wait a minute and try again, or type the details in." };
      if (e.status === 400) return { ok: false, error: "This file couldn't be read. Try a PDF or a clearer photo, or type the details in." };
      if (e.status === 401 || e.status === 403) return { ok: false, error: "Reading from files isn't set up correctly (API key). Type the details in for now." };
      return { ok: false, error: "The reading service failed. Try again, or type the details in." };
    }
    console.error("Gemini call failed", { model }, e);
    return { ok: false, error: "The reading service didn't answer in time. Try again, or type the details in." };
  }
}
