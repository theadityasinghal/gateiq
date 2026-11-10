import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { DocType } from "@/lib/documents";
import { extractionPrompt, extractionSchema } from "@/lib/extract/schema";

/** Default model for reading documents; override with GEMINI_MODEL. */
const DEFAULT_MODEL = "gemini-3.8-flash";

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/** Used when the main model is overloaded; override with GEMINI_FALLBACK_MODEL (empty to disable). */
const DEFAULT_FALLBACK = "gemini-3.6-flash";

function fallbackModel(): string | null {
  const v = process.env.GEMINI_FALLBACK_MODEL;
  return v === undefined ? DEFAULT_FALLBACK : v.trim() || null;
}

/** Overloaded, rate limited, or no answer in time: worth one try on the fallback model. */
const busy = (e: unknown) =>
  (e instanceof ApiError && (e.status === 503 || e.status === 429)) || (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError"));

/**
 * The page allows 60 s per action. Give the main model up to 30 s; if it is busy or slow, give the
 * fallback model up to 25 s. Returns the result and which model produced it.
 */
class ModelError extends Error {
  constructor(readonly model: string, readonly cause: unknown) {
    super(`Gemini call failed on ${model}`);
  }
}

async function withRetry<T>(model: string, call: (model: string, timeoutMs: number) => Promise<T>): Promise<{ value: T; model: string }> {
  try {
    return { value: await call(model, 30_000), model };
  } catch (e) {
    const fb = fallbackModel();
    if (!busy(e) || !fb || fb === model) throw new ModelError(model, e);
    console.warn("Gemini model busy or slow, using fallback", { model, fallback: fb });
    try {
      return { value: await call(fb, 25_000), model: fb };
    } catch (e2) {
      throw new ModelError(fb, e2);
    }
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
    const { value: res, model: used } = await withRetry(model, (m, timeout) => ai().models.generateContent({
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
        httpOptions: { timeout },
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
