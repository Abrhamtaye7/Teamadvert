CREATE TYPE "public"."credit_standing" AS ENUM('Good', 'Warning', 'Suspended');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending_approval', 'approved', 'in_progress', 'completed', 'finance_review', 'closed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('ProformaApproved', 'JobApproved', 'JobCompleted', 'PaymentPending', 'PriceChange', 'CustomerAlert', 'PaymentVerified', 'Generic');--> statement-breakpoint
CREATE TYPE "public"."proforma_status" AS ENUM('draft', 'approved', 'converted', 'expired');--> statement-breakpoint
CREATE TABLE "access_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"label" varchar(128) NOT NULL,
	"description" varchar(255),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"message" varchar(512) NOT NULL,
	"context" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"entity" varchar(64) NOT NULL,
	"entity_id" varchar(64),
	"action" varchar(64) NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backups" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" varchar(512) NOT NULL,
	"status" varchar(32) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"scope" varchar(32) NOT NULL,
	"period" integer NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "counters_scope_period_pk" PRIMARY KEY("scope","period")
);
--> statement-breakpoint
CREATE TABLE "credit_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"change" numeric(14, 2) NOT NULL,
	"reason" varchar(255),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"user_id" integer,
	"note" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"old_price" numeric(14, 2),
	"new_price" numeric(14, 2) NOT NULL,
	"changed_by" integer,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" varchar(32) NOT NULL,
	"name" varchar(191) NOT NULL,
	"company" varchar(191),
	"phones" jsonb,
	"email" varchar(191),
	"tin" varchar(32),
	"address" jsonb,
	"credit_limit" numeric(14, 2),
	"outstanding_balance" numeric(14, 2),
	"last_payment_date" timestamp (3) with time zone,
	"standing" "credit_standing" DEFAULT 'Good' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_customerId_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "item_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" varchar(32) NOT NULL,
	"name" varchar(191) NOT NULL,
	"category_id" integer,
	"measurement_unit_id" integer,
	"unit" varchar(64),
	"purchase_price" numeric(14, 2),
	"selling_price" numeric(14, 2),
	"base_price" numeric(14, 2),
	"notes" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_itemId_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "job_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"item_id" integer,
	"name" varchar(191) NOT NULL,
	"description" text,
	"quantity" numeric(14, 2) NOT NULL,
	"unit" varchar(64),
	"price" numeric(14, 2) NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(32) NOT NULL,
	"customer_id" integer NOT NULL,
	"proforma_id" integer,
	"customer_snapshot" jsonb,
	"job_type" varchar(128),
	"description" text,
	"artwork_path" varchar(512),
	"deadline" timestamp (3) with time zone,
	"priority" varchar(32) DEFAULT 'normal',
	"price" numeric(14, 2),
	"advance_payment" numeric(14, 2),
	"admin_notes" text,
	"status" "job_status" DEFAULT 'pending_approval' NOT NULL,
	"created_by_id" integer,
	"admin_approved_by_id" integer,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_orders_number_unique" UNIQUE("number"),
	CONSTRAINT "job_orders_proformaId_unique" UNIQUE("proforma_id")
);
--> statement-breakpoint
CREATE TABLE "login_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ip" varchar(64),
	"user_agent" varchar(512),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurement_units" (
	"id" serial PRIMARY KEY NOT NULL,
	"unit_name" varchar(64) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "measurement_units_unitName_unique" UNIQUE("unit_name")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" "notification_type" DEFAULT 'Generic' NOT NULL,
	"message" varchar(512) NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"data" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"customer_id" integer,
	"amount" numeric(14, 2) NOT NULL,
	"method" varchar(32),
	"transaction_number" varchar(64),
	"reference_path" varchar(512),
	"verified" boolean DEFAULT false NOT NULL,
	"verification_note" text,
	"created_by_id" integer,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proforma_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"proforma_id" integer NOT NULL,
	"item_id" integer,
	"name" varchar(191) NOT NULL,
	"description" text,
	"quantity" numeric(14, 2) NOT NULL,
	"unit" varchar(64),
	"selling_price" numeric(14, 2) NOT NULL,
	"discount" numeric(14, 2),
	"vat_percent" numeric(5, 2),
	"total" numeric(14, 2) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proformas" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(32) NOT NULL,
	"customer_id" integer NOT NULL,
	"prepared_by_id" integer NOT NULL,
	"date" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"validity" integer,
	"amount_in_words" varchar(512),
	"notes" text,
	"terms" text,
	"signature_path" varchar(512),
	"stamp_path" varchar(512),
	"bank_info_snapshot" jsonb,
	"customer_snapshot" jsonb,
	"status" "proforma_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proformas_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"permissions" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"last_seen_at" timestamp (3) with time zone NOT NULL,
	"ip" varchar(64),
	"user_agent" varchar(512),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"old_price" numeric(14, 2),
	"new_price" numeric(14, 2) NOT NULL,
	"changed_by" integer,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" varchar(32) NOT NULL,
	"company_name" varchar(191) NOT NULL,
	"contact_person" varchar(191),
	"phones" jsonb,
	"email" varchar(191),
	"address" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_supplierId_unique" UNIQUE("supplier_id")
);
--> statement-breakpoint
CREATE TABLE "user_access_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"access_role_id" integer NOT NULL,
	"granted" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"pin_hash" varchar(255) NOT NULL,
	"role_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp (3) with time zone,
	"last_login_at" timestamp (3) with time zone,
	"last_login_ip" varchar(64),
	"last_login_agent" varchar(512),
	"preferences" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_history" ADD CONSTRAINT "credit_history_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_price_history" ADD CONSTRAINT "customer_price_history_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_price_history" ADD CONSTRAINT "customer_price_history_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_price_history" ADD CONSTRAINT "customer_price_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_item_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."item_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_measurement_unit_id_measurement_units_id_fk" FOREIGN KEY ("measurement_unit_id") REFERENCES "public"."measurement_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_job_id_job_orders_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_proforma_id_proformas_id_fk" FOREIGN KEY ("proforma_id") REFERENCES "public"."proformas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_admin_approved_by_id_users_id_fk" FOREIGN KEY ("admin_approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_logs" ADD CONSTRAINT "login_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_job_id_job_orders_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proforma_items" ADD CONSTRAINT "proforma_items_proforma_id_proformas_id_fk" FOREIGN KEY ("proforma_id") REFERENCES "public"."proformas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proforma_items" ADD CONSTRAINT "proforma_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_prepared_by_id_users_id_fk" FOREIGN KEY ("prepared_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_notes" ADD CONSTRAINT "supplier_notes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_notes" ADD CONSTRAINT "supplier_notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_price_history" ADD CONSTRAINT "supplier_price_history_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_price_history" ADD CONSTRAINT "supplier_price_history_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_price_history" ADD CONSTRAINT "supplier_price_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access_roles" ADD CONSTRAINT "user_access_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access_roles" ADD CONSTRAINT "user_access_roles_access_role_id_access_roles_id_fk" FOREIGN KEY ("access_role_id") REFERENCES "public"."access_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_customer_name" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_customer_company" ON "customers" USING btree ("company");--> statement-breakpoint
CREATE INDEX "idx_item_name" ON "items" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_job_customer" ON "job_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_job_status" ON "job_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_login_logs_user" ON "login_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_user" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "idx_payment_job" ON "payments" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_payment_trx" ON "payments" USING btree ("transaction_number");--> statement-breakpoint
CREATE INDEX "idx_proforma_customer" ON "proformas" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_proforma_status" ON "proformas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_session_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_company" ON "suppliers" USING btree ("company_name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_access_role" ON "user_access_roles" USING btree ("user_id","access_role_id");