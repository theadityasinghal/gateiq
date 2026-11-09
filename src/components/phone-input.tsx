import type { PhoneCountry } from "@/lib/phone";
import { Input, Select } from "@/components/ui/field";

/**
 * Country code dropdown plus the national number. Submits `phoneCountry` (ISO code) and `phone`.
 * The country list is built on the server (see listPhoneCountries) and passed in.
 */
export function PhoneInput({
  countries,
  defaultCountry,
  defaultValue,
  invalid,
  id = "phone",
}: {
  countries: PhoneCountry[];
  defaultCountry: string;
  defaultValue?: string;
  invalid?: boolean;
  id?: string;
}) {
  return (
    <div className="flex gap-2">
      {/* `w-full` on the control can't be overridden by cn(), so the wrapper sets the width. */}
      <div className="w-[136px] shrink-0">
        <Select name="phoneCountry" aria-label="Country code" defaultValue={defaultCountry} className="truncate">
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} +{c.dial}  {c.name}
            </option>
          ))}
        </Select>
      </div>
      <Input
        className="min-w-0 flex-1"
        id={id}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        defaultValue={defaultValue}
        maxLength={32}
        aria-invalid={invalid || undefined}
        required
      />
    </div>
  );
}
