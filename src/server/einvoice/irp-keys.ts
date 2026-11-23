/**
 * Public keys of the Invoice Registration Portals (IRPs) that sign GST e-invoice QR codes.
 *
 * Empty until the official certificates are added: until then every e-invoice QR shows as "signature not
 * checked", exactly as before. To add one, take the certificate the IRP publishes for verifying signed QR
 * codes (NIC IRP-1, NIC IRP-2, and any private IRP), and paste its PEM text below. A DER `.cer` file can be
 * turned into PEM with: openssl x509 -inform der -in irp.cer -out irp.pem
 *
 * Only add certificates downloaded from the IRP's own official site.
 */
export type IrpKey = {
  /** Which IRP, for logs: "NIC IRP-1". */
  name: string;
  /** A PEM certificate (BEGIN CERTIFICATE) or public key (BEGIN PUBLIC KEY). */
  pem: string;
  /** The `kid` the IRP puts in its token header, if it uses one. */
  kid?: string;
};

export const IRP_KEYS: IrpKey[] = [];
