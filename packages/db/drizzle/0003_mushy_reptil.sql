CREATE TABLE "automation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"category" varchar(32) DEFAULT 'general' NOT NULL,
	"trigger_kind" varchar(32) NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"schedule" jsonb,
	"owner_user_id" uuid,
	"assignment_scope" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"coalesce_window_sec" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"lead_id" uuid,
	"triggered_by_user_id" uuid,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"correlation_id" varchar(128),
	"trigger_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolved_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"steps_executed" integer DEFAULT 0 NOT NULL,
	"conditions_matched" boolean DEFAULT true NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"kind" varchar(32) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"output" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation" ADD CONSTRAINT "automation_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_run" ADD CONSTRAINT "automation_run_automation_id_automation_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_run" ADD CONSTRAINT "automation_run_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_run" ADD CONSTRAINT "automation_run_triggered_by_user_id_user_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_step" ADD CONSTRAINT "automation_step_run_id_automation_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."automation_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auto_ent_idx" ON "automation" USING btree ("enterprise_id");--> statement-breakpoint
CREATE INDEX "auto_ent_active_idx" ON "automation" USING btree ("enterprise_id","is_active");--> statement-breakpoint
CREATE INDEX "auto_ent_trigger_idx" ON "automation" USING btree ("enterprise_id","trigger_kind");--> statement-breakpoint
CREATE INDEX "auto_ent_next_run_idx" ON "automation" USING btree ("enterprise_id","next_run_at");--> statement-breakpoint
CREATE INDEX "auto_ent_created_idx" ON "automation" USING btree ("enterprise_id","created_at");--> statement-breakpoint
CREATE INDEX "autorun_ent_idx" ON "automation_run" USING btree ("enterprise_id");--> statement-breakpoint
CREATE INDEX "autorun_ent_auto_idx" ON "automation_run" USING btree ("enterprise_id","automation_id");--> statement-breakpoint
CREATE INDEX "autorun_ent_lead_idx" ON "automation_run" USING btree ("enterprise_id","lead_id");--> statement-breakpoint
CREATE INDEX "autorun_ent_status_idx" ON "automation_run" USING btree ("enterprise_id","status");--> statement-breakpoint
CREATE INDEX "autorun_ent_corr_idx" ON "automation_run" USING btree ("enterprise_id","correlation_id");--> statement-breakpoint
CREATE INDEX "autorun_ent_started_idx" ON "automation_run" USING btree ("enterprise_id","started_at");--> statement-breakpoint
CREATE INDEX "autostep_ent_idx" ON "automation_step" USING btree ("enterprise_id");--> statement-breakpoint
CREATE INDEX "autostep_ent_run_idx" ON "automation_step" USING btree ("enterprise_id","run_id","order");--> statement-breakpoint
CREATE INDEX "autostep_ent_status_idx" ON "automation_step" USING btree ("enterprise_id","status");