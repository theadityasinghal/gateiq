import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  uuid,
  date,
  index,
  uniqueIndex,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { ROLES } from "@/lib/roles";

/* ───────────── Better Auth tables (names/columns match Better Auth's core schema) ───────────── */

export const roleEnum = pgEnum("role", ROLES);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: roleEnum("role"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ───────────── Profiles and field verification ───────────── */

export const profile = pgTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  legalName: text("legal_name").notNull(),
  organisation: text("organisation"),
  iec: text("iec"),
  gstin: text("gstin"),
  address: text("address"),
  phone: text("phone"),
  /** Role-specific identifiers (CHA licence, driving licence, employee ID, …). */
  extra: jsonb("extra").$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verificationLevelEnum = pgEnum("verification_level", [
  "self_declared",
  "invalid",
  "format_valid",
  "exists",
  "owned",
]);

export const fieldVerification = pgTable(
  "field_verification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    value: text("value"),
    level: verificationLevelEnum("level").notNull(),
    /** Which verifier produced this result, and what it found. */
    verifier: text("verifier").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("field_verification_user_field_uq").on(t.userId, t.field)],
);

/* ───────────── Cases ───────────── */

export const caseStatusEnum = pgEnum("case_status", [
  "draft",
  "created",
  "filing_pending",
  "filed_baseline_ready",
]);

export const shipmentCase = pgTable(
  "case",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseCode: text("case_code").notNull().unique(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    status: caseStatusEnum("status").notNull().default("created"),
    consigneeName: text("consignee_name").notNull(),
    consigneeAddress: text("consignee_address").notNull(),
    consigneeCountry: text("consignee_country").notNull(),
    originPlace: text("origin_place").notNull(),
    exportPortCode: text("export_port_code").notNull(),
    destinationCountry: text("destination_country").notNull(),
    destinationPort: text("destination_port"),
    incoterm: text("incoterm").notNull(),
    currency: text("currency").notNull(),
    hazmat: jsonb("hazmat").$type<{ unNumber: string; hazardClass: string } | null>(),
    pharma: jsonb("pharma").$type<{ minC: number; maxC: number } | null>(),
    perishable: jsonb("perishable").$type<{ certificateType: string } | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("case_owner_idx").on(t.ownerId)],
);

export const caseGoodsLine = pgTable(
  "case_goods_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => shipmentCase.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    description: text("description").notNull(),
    hsCode: text("hs_code").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 3 }).notNull(),
    uqc: text("uqc").notNull(),
    netWeight: numeric("net_weight", { precision: 18, scale: 3 }).notNull(),
    grossWeight: numeric("gross_weight", { precision: 18, scale: 3 }).notNull(),
    weightUnit: text("weight_unit").notNull(),
    packages: integer("packages").notNull(),
    packageType: text("package_type").notNull(),
    value: numeric("value", { precision: 18, scale: 2 }).notNull(),
  },
  (t) => [uniqueIndex("case_goods_line_uq").on(t.caseId, t.lineNo)],
);

export const caseDocument = pgTable("case_document", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => shipmentCase.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // msds | temperature_spec | certificate
  storagePath: text("storage_path").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ───────────── Filings and the Filed baseline ───────────── */

export const filingSourceEnum = pgEnum("filing_source", ["manual", "ulip"]);

export const filing = pgTable(
  "filing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => shipmentCase.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("shipping_bill"),
    documentNumber: text("document_number").notNull(),
    documentDate: date("document_date").notNull(),
    portCode: text("port_code").notNull(),
    source: filingSourceEnum("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("filing_case_kind_uq").on(t.caseId, t.kind)],
);

/** Append-only: every input (typed form now, ULIP payload later) exactly as received. */
export const filingRawRecord = pgTable("filing_raw_record", {
  id: uuid("id").primaryKey().defaultRandom(),
  filingId: uuid("filing_id")
    .notNull()
    .references(() => filing.id, { onDelete: "cascade" }),
  source: filingSourceEnum("source").notNull(),
  payload: jsonb("payload").notNull(),
  sha256: text("sha256").notNull(),
  receivedBy: text("received_by").references(() => user.id),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export const filedBaseline = pgTable(
  "filed_baseline",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filingId: uuid("filing_id")
      .notNull()
      .references(() => filing.id, { onDelete: "cascade" }),
    rawRecordId: uuid("raw_record_id")
      .notNull()
      .references(() => filingRawRecord.id),
    version: integer("version").notNull(),
    verification: text("verification").notNull(), // self_declared | source_verified
    normalized: jsonb("normalized").notNull(),
    provenance: jsonb("provenance").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("filed_baseline_version_uq").on(t.filingId, t.version)],
);

/* ───────────── Audit ───────────── */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").references(() => user.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId)],
);

/* ───────────── Reference masters (loaded by scripts/import-masters) ───────────── */

export const portMaster = pgTable("port_master", {
  code: text("code").primaryKey(), // e.g. 6-char customs location code
  name: text("name").notNull(),
  kind: text("kind"), // seaport | icd | airport | lcs | …
  state: text("state"),
  source: text("source").notNull(),
});

export const hsCodeMaster = pgTable("hs_code_master", {
  code: text("code").primaryKey(), // 8-digit ITC-HS
  description: text("description").notNull(),
  source: text("source").notNull(),
});

export const uqcMaster = pgTable("uqc_master", {
  code: text("code").primaryKey(),
  description: text("description").notNull(),
  /** Factor to convert 1 unit to metric tonnes; null for non-mass units. */
  tonnesFactor: doublePrecision("tonnes_factor"),
  source: text("source").notNull(),
});

export const currencyMaster = pgTable("currency_master", {
  code: text("code").primaryKey(), // ISO 4217
  name: text("name").notNull(),
  source: text("source").notNull(),
});

export const countryMaster = pgTable("country_master", {
  code: text("code").primaryKey(), // ISO 3166-1 alpha-2
  name: text("name").notNull(),
  source: text("source").notNull(),
});
