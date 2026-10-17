ALTER TABLE "proformas" ADD COLUMN "approved_by_id" integer;--> statement-breakpoint
ALTER TABLE "proformas" ADD COLUMN "approved_at" timestamp (3) with time zone;--> statement-breakpoint
-- Hand-edited: added as nullable, filled for existing rows, then made NOT NULL (generated SQL failed on non-empty tables).
-- New rows get a crypto-random token from the app; md5() is only for rows that existed before this migration.
ALTER TABLE "proformas" ADD COLUMN "verify_token" varchar(32);--> statement-breakpoint
UPDATE "proformas" SET "verify_token" = md5(random()::text || clock_timestamp()::text || "id"::text) WHERE "verify_token" IS NULL;--> statement-breakpoint
ALTER TABLE "proformas" ALTER COLUMN "verify_token" SET NOT NULL;--> statement-breakpoint
-- Who approved existing proformas, taken from the first "approve" entry in the audit log
UPDATE "proformas" AS p SET "approved_by_id" = a."user_id", "approved_at" = a."created_at"
FROM (
  SELECT DISTINCT ON ("entity_id") "entity_id", "user_id", "created_at"
  FROM "audit_logs"
  WHERE "entity" = 'proforma' AND "action" = 'approve'
  ORDER BY "entity_id", "created_at"
) AS a
WHERE p."id"::text = a."entity_id" AND p."approved_by_id" IS NULL;--> statement-breakpoint
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_verifyToken_unique" UNIQUE("verify_token");
