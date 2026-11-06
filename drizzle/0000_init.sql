CREATE TYPE "public"."case_status" AS ENUM('draft', 'created', 'filing_pending', 'filed_baseline_ready');--> statement-breakpoint
CREATE TYPE "public"."filing_source" AS ENUM('manual', 'ulip');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('consignor', 'cha', 'transporter', 'driver', 'gate_officer', 'weighbridge_operator', 'customs_inspector', 'customs_superintendent', 'terminal_admin', 'vigilance_auditor');--> statement-breakpoint
CREATE TYPE "public"."verification_level" AS ENUM('self_declared', 'invalid', 'format_valid', 'exists', 'owned');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_goods_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"description" text NOT NULL,
	"hs_code" text NOT NULL,
	"quantity" numeric(18, 3) NOT NULL,
	"uqc" text NOT NULL,
	"net_weight" numeric(18, 3) NOT NULL,
	"gross_weight" numeric(18, 3) NOT NULL,
	"weight_unit" text NOT NULL,
	"packages" integer NOT NULL,
	"package_type" text NOT NULL,
	"value" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "country_master" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currency_master" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"field" text NOT NULL,
	"value" text,
	"level" "verification_level" NOT NULL,
	"verifier" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filed_baseline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filing_id" uuid NOT NULL,
	"raw_record_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"verification" text NOT NULL,
	"normalized" jsonb NOT NULL,
	"provenance" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" text DEFAULT 'shipping_bill' NOT NULL,
	"document_number" text NOT NULL,
	"document_date" date NOT NULL,
	"port_code" text NOT NULL,
	"source" "filing_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filing_raw_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filing_id" uuid NOT NULL,
	"source" "filing_source" NOT NULL,
	"payload" jsonb NOT NULL,
	"sha256" text NOT NULL,
	"received_by" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hs_code_master" (
	"code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "port_master" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text,
	"state" text,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"legal_name" text NOT NULL,
	"organisation" text,
	"iec" text,
	"gstin" text,
	"address" text,
	"phone" text,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_code" text NOT NULL,
	"owner_id" text NOT NULL,
	"status" "case_status" DEFAULT 'created' NOT NULL,
	"consignee_name" text NOT NULL,
	"consignee_address" text NOT NULL,
	"consignee_country" text NOT NULL,
	"origin_place" text NOT NULL,
	"export_port_code" text NOT NULL,
	"destination_country" text NOT NULL,
	"destination_port" text,
	"incoterm" text NOT NULL,
	"currency" text NOT NULL,
	"hazmat" jsonb,
	"pharma" jsonb,
	"perishable" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_case_code_unique" UNIQUE("case_code")
);
--> statement-breakpoint
CREATE TABLE "uqc_master" (
	"code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"tonnes_factor" double precision,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "role",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_document" ADD CONSTRAINT "case_document_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_document" ADD CONSTRAINT "case_document_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_goods_line" ADD CONSTRAINT "case_goods_line_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_verification" ADD CONSTRAINT "field_verification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filed_baseline" ADD CONSTRAINT "filed_baseline_filing_id_filing_id_fk" FOREIGN KEY ("filing_id") REFERENCES "public"."filing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filed_baseline" ADD CONSTRAINT "filed_baseline_raw_record_id_filing_raw_record_id_fk" FOREIGN KEY ("raw_record_id") REFERENCES "public"."filing_raw_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filing" ADD CONSTRAINT "filing_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filing_raw_record" ADD CONSTRAINT "filing_raw_record_filing_id_filing_id_fk" FOREIGN KEY ("filing_id") REFERENCES "public"."filing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filing_raw_record" ADD CONSTRAINT "filing_raw_record_received_by_user_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case" ADD CONSTRAINT "case_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "case_goods_line_uq" ON "case_goods_line" USING btree ("case_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "field_verification_user_field_uq" ON "field_verification" USING btree ("user_id","field");--> statement-breakpoint
CREATE UNIQUE INDEX "filed_baseline_version_uq" ON "filed_baseline" USING btree ("filing_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "filing_case_kind_uq" ON "filing" USING btree ("case_id","kind");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "case_owner_idx" ON "case" USING btree ("owner_id");