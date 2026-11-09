import { ROLE_INFO, type Role } from "@/lib/roles";
import {
  clean,
  selfDeclared,
  verifyDrivingLicence,
  verifyEmail,
  verifyGstin,
  verifyIec,
  verifyPhone,
} from "@/lib/verify/identifiers";
import type { VerificationResult } from "@/lib/verify/types";

export type ProfileInput = {
  legalName: string;
  organisation?: string;
  iec?: string;
  gstin?: string;
  address?: string;
  phone: string;
  phoneCountry: string;
  extra: Record<string, string>;
};

/**
 * Runs every check available today for the fields this role uses.
 * Returns one result per field; anything "invalid" blocks saving.
 */
export function verifyProfile(
  role: Role,
  input: ProfileInput,
  account: { email: string; emailVerified: boolean },
): VerificationResult[] {
  const info = ROLE_INFO[role];
  const results: VerificationResult[] = [verifyEmail(account.email, account.emailVerified, info.official)];

  results.push(selfDeclared("legalName", input.legalName, "Entered by you. Will be matched to the GST registry later."));
  if (input.organisation) results.push(selfDeclared("organisation", input.organisation));
  if (input.address) results.push(selfDeclared("address", input.address));
  results.push(verifyPhone(input.phoneCountry, input.phone));

  if (role === "consignor") {
    if (input.gstin) results.push(verifyGstin(input.gstin));
    if (input.iec) results.push(verifyIec(input.iec, input.gstin));
  }

  const idKey = info.idField?.key;
  const idValue = idKey ? input.extra[idKey] : undefined;
  if (idKey && idValue) {
    if (idKey === "transporterGstin") results.push(verifyGstin(idValue, "transporterGstin"));
    else if (idKey === "drivingLicence") results.push(verifyDrivingLicence(idValue));
    else if (idKey === "chaLicence")
      results.push(selfDeclared("chaLicence", clean(idValue), "No public registry API exists. An admin will check it against CBIC's broker lists later."));
    else results.push(selfDeclared(idKey, idValue.trim(), "Can only be confirmed by a Terminal Admin (later phase)."));
  }
  return results;
}
