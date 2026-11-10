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
  bigint,
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
  /** Lowercase, permanent, used to invite people to cases. Null only for accounts made before usernames existed. */
  username: text("username").unique(),
  /** Mobile number in E.164, collected at sign-up. Not yet confirmed by OTP. */
  phone: text("phone"),
  /** ISO 3166-1 alpha-2 country chosen next to the number. */
  phoneCountry: text("phone_country"),
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

/** Better Auth rate-limit counters, kept in Postgres so limits hold across serverless instances. */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
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
    /** Typed in by the consignor on cases made before consignees had accounts. New cases leave these empty. */
    consigneeName: text("consignee_name"),
    consigneeAddress: text("consignee_address"),
    consigneeCountry: text("consignee_country"),
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

/** A file (scan, PDF or photo) attached to one submission. */
export const caseDocument = pgTable(
  "case_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => shipmentCase.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => caseSubmission.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("case_document_submission_idx").on(t.submissionId)],
);

/* ───────────── People on a case ───────────── */

export const caseMemberStatusEnum = pgEnum("case_member_status", ["pending", "accepted"]);

/**
 * Someone invited to a case by its owner or by an accepted member. Accepted members can view the case.
 * Declined, cancelled and removed invites are deleted; the audit log keeps the history.
 */
export const caseMember = pgTable(
  "case_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => shipmentCase.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The invitee's account type when invited. */
    role: roleEnum("role").notNull(),
    status: caseMemberStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("case_member_case_user_uq").on(t.caseId, t.userId),
    index("case_member_user_status_idx").on(t.userId, t.status),
    index("case_member_invited_by_idx").on(t.invitedBy),
  ],
);

/* ───────────── Submissions: everything people add to a case ───────────── */

export const submissionSourceEnum = pgEnum("submission_source", ["manual", "upload", "ulip"]);

/**
 * One document one person added to a case: a typed-in shipping bill, e-way bill or lorry receipt, or an
 * uploaded invoice, packing list or certificate. A case can hold any number of each type, from anyone
 * whose account type may add it (see lib/documents). Nothing here is the truth; later checks compare them.
 * Rows are never edited. Removing one only sets removed_at, so the record trail stays complete.
 */
export const caseSubmission = pgTable(
  "case_submission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => shipmentCase.id, { onDelete: "cascade" }),
    /** A key of DOC_TYPES. */
    type: text("type").notNull(),
    addedBy: text("added_by")
      .notNull()
      .references(() => user.id),
    /** The adder's account type when they added it. */
    addedByRole: roleEnum("added_by_role").notNull(),
    source: submissionSourceEnum("source").notNull(),
    documentNumber: text("document_number"),
    documentDate: date("document_date"),
    /** Exactly what was received (form fields or API payload). Null for a plain upload. */
    raw: jsonb("raw"),
    rawSha256: text("raw_sha256"),
    /** The standard record built from raw, and where each field came from. Null for a plain upload. */
    normalized: jsonb("normalized"),
    provenance: jsonb("provenance").$type<Record<string, string>>(),
    /** The earlier version this one corrects. Saving a correction marks that version removed. */
    supersedesId: uuid("supersedes_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by").references(() => user.id),
  },
  (t) => [
    index("case_submission_case_type_idx").on(t.caseId, t.type),
    index("case_submission_added_by_idx").on(t.addedBy),
    index("case_submission_supersedes_idx").on(t.supersedesId),
  ],
);

/**
 * Someone on the case looked at a disagreement and explained it ("truck swapped at Bhiwandi, Part B
 * updated"). It holds only while the disagreement stays exactly the same (`values_key`); any change to
 * the values or the documents involved brings the check back.
 */
export const checkAck = pgTable(
  "check_ack",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => shipmentCase.id, { onDelete: "cascade" }),
    checkKey: text("check_key").notNull(),
    valuesKey: text("values_key").notNull(),
    note: text("note").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("check_ack_case_idx").on(t.caseId)],
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
