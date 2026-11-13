export const CASE_STATUS_LABEL = {
  draft: "Draft",
  created: "Created",
  filing_pending: "Awaiting shipping bill",
  filed_baseline_ready: "Filed baseline ready",
} as const;

export function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(date);
}

export function formatDateTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function countryName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function formatTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(date);
}

/** The calendar day in India, as YYYY-MM-DD: what the Activity timeline groups by. */
export function dayKey(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).format(date);
}

/** "Today", "Yesterday", or the date, for a YYYY-MM-DD day key. */
export function dayHeading(key: string, now: Date = new Date()) {
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return "Yesterday";
  return formatDate(new Date(`${key}T12:00:00+05:30`));
}

/** A label for use mid-sentence: "Shipping bill number" becomes "shipping bill number", but "Exporter IEC" and "HS codes" keep their capitals. */
export function inlineLabel(label: string) {
  return /^[A-Z]{2}/.test(label) || !label ? label : label.charAt(0).toLowerCase() + label.slice(1);
}
