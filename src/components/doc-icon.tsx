import { BadgeCheck, ClipboardCheck, FileText, FlaskConical, Leaf, Lock, Package, Receipt, ReceiptText, Scale, Ship, Thermometer, Truck, type LucideIcon } from "lucide-react";
import type { DocType } from "@/lib/documents";

const ICONS: Record<DocType, LucideIcon> = {
  shipping_bill: Ship,
  eway_bill: Receipt,
  lorry_receipt: Truck,
  form_13: ClipboardCheck,
  vgm_declaration: Scale,
  e_seal: Lock,
  commercial_invoice: ReceiptText,
  packing_list: Package,
  msds: FlaskConical,
  temperature_spec: Thermometer,
  quality_certificate: BadgeCheck,
  fumigation_certificate: Leaf,
};

/** A small vector icon for each kind of document, so lists can be scanned by shape as well as by name. */
export function DocIcon({ type, size = 16, className }: { type: DocType; size?: number; className?: string }) {
  const Icon = ICONS[type] ?? FileText;
  return <Icon size={size} strokeWidth={1.8} className={className} aria-hidden="true" />;
}
