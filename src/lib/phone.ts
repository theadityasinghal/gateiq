import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export type PhoneCountry = { code: string; dial: string; name: string };

export const DEFAULT_PHONE_COUNTRY = "IN";

/**
 * Every country libphonenumber knows, with its calling code, sorted by name.
 * Built on the server and passed to forms as a prop, so the phone metadata stays out of the client bundle.
 */
export function listPhoneCountries(): PhoneCountry[] {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return getCountries()
    .map((code) => ({ code, dial: getCountryCallingCode(code), name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function isPhoneCountry(value: unknown): value is CountryCode {
  return typeof value === "string" && (getCountries() as string[]).includes(value);
}

export type PhoneParse = { ok: true; e164: string; country: string; national: string } | { ok: false; message: string };

/** Validates a number typed against a chosen country and returns it in E.164 (e.g. +919876543210). */
export function parsePhone(country: unknown, raw: unknown): PhoneParse {
  if (!isPhoneCountry(country)) return { ok: false, message: "Choose a country code." };
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { ok: false, message: "Enter your mobile number." };
  if (value.length > 32 || !/^[0-9+()\s.-]+$/.test(value)) return { ok: false, message: "Use digits only." };
  const parsed = parsePhoneNumberFromString(value, country);
  if (!parsed || !parsed.isValid()) return { ok: false, message: "That number isn't valid for the chosen country." };
  // A number typed with its own +code must still belong to the chosen country.
  if (parsed.countryCallingCode !== getCountryCallingCode(country)) {
    return { ok: false, message: "That number belongs to a different country code." };
  }
  return { ok: true, e164: parsed.number, country, national: parsed.nationalNumber };
}

/** National part of a stored E.164 number, for prefilling the input next to the country dropdown. */
export function nationalPart(e164: string | null | undefined): string {
  if (!e164) return "";
  return parsePhoneNumberFromString(e164)?.nationalNumber ?? "";
}
