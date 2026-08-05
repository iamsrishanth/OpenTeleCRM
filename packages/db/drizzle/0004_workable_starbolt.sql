CREATE TABLE "sequence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequence_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"lead_id" uuid,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"current_step" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequence_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"delay_days" integer DEFAULT 0 NOT NULL,
	"action" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sequence_run" ADD CONSTRAINT "sequence_run_sequence_id_sequence_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_run" ADD CONSTRAINT "sequence_run_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_step" ADD CONSTRAINT "sequence_step_sequence_id_sequence_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seq_ent_idx" ON "sequence" USING btree ("enterprise_id");--> statement-breakpoint
CREATE INDEX "seq_ent_active_idx" ON "sequence" USING btree ("enterprise_id","is_active");--> statement-breakpoint
CREATE INDEX "seq_ent_created_idx" ON "sequence" USING btree ("enterprise_id","created_at");--> statement-breakpoint
CREATE INDEX "seqrun_ent_idx" ON "sequence_run" USING btree ("enterprise_id");--> statement-breakpoint
CREATE INDEX "seqrun_ent_seq_idx" ON "sequence_run" USING btree ("enterprise_id","sequence_id");--> statement-breakpoint
CREATE INDEX "seqrun_ent_lead_idx" ON "sequence_run" USING btree ("enterprise_id","lead_id");--> statement-breakpoint
CREATE INDEX "seqrun_ent_status_idx" ON "sequence_run" USING btree ("enterprise_id","status");--> statement-breakpoint
CREATE INDEX "seqrun_ent_started_idx" ON "sequence_run" USING btree ("enterprise_id","started_at");--> statement-breakpoint
CREATE INDEX "seqstep_ent_idx" ON "sequence_step" USING btree ("enterprise_id");--> statement-breakpoint
CREATE INDEX "seqstep_ent_seq_idx" ON "sequence_step" USING btree ("enterprise_id","sequence_id","step_order");--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "category" varchar(32) DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "last_run_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "next_run_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "auto_ent_next_run_idx" ON "automation" USING btree ("enterprise_id","next_run_at");
