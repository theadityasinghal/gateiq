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
  const model = geminiModel();
  try {
    const res = await ai().models.generateContent({
      model,
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
        httpOptions: { timeout: 50_000 },
      },
    });
    const text = res.text;
    if (!text) return { ok: false, error: "The file couldn't be read. Try a clearer photo, or type the details in." };
    try {
      return { ok: true, output: JSON.parse(text), model };
    } catch {
      console.error("Gemini returned non-JSON", { model, sample: text.slice(0, 200) });
      return { ok: false, error: "The reading came back malformed. Try again, or type the details in." };
    }
  } catch (e) {
    if (e instanceof ApiError) {
      console.error("Gemini API error", { model, status: e.status, message: e.message });
      if (e.status === 429) return { ok: false, error: "The reading service is busy. Wait a minute and try again, or type the details in." };
      if (e.status === 400) return { ok: false, error: "This file couldn't be read. Try a PDF or a clearer photo, or type the details in." };
      if (e.status === 401 || e.status === 403) return { ok: false, error: "Reading from files isn't set up correctly (API key). Type the details in for now." };
      return { ok: false, error: "The reading service failed. Try again, or type the details in." };
    }
    console.error("Gemini call failed", { model }, e);
    return { ok: false, error: "The reading service didn't answer in time. Try again, or type the details in." };
  }
}
