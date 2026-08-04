CREATE TABLE "call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"lead_id" uuid,
	"direction" varchar(16) NOT NULL,
	"status" varchar(32) NOT NULL,
	"disposition" varchar(32),
	"phone" varchar(32) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"talk_sec" integer DEFAULT 0 NOT NULL,
	"ring_sec" integer DEFAULT 0 NOT NULL,
	"recording_id" uuid,
	"trunk" varchar(64),
	"did" varchar(32),
	"agent_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "callback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"source" varchar(32) DEFAULT 'manual' NOT NULL,
	"channel" varchar(16) DEFAULT 'in_app' NOT NULL,
	"note" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dnd_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"phone" varchar(32) NOT NULL,
	"channel" varchar(16) DEFAULT 'call' NOT NULL,
	"source" varchar(16) DEFAULT 'enterprise' NOT NULL,
	"reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recording" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"call_id" uuid NOT NULL,
	"object_key" varchar(512) NOT NULL,
	"url" text,
	"mime_type" varchar(128) DEFAULT 'audio/ogg',
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'recorded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call" ADD CONSTRAINT "call_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call" ADD CONSTRAINT "call_recording_id_recording_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recording"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call" ADD CONSTRAINT "call_agent_user_id_user_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callback" ADD CONSTRAINT "callback_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording" ADD CONSTRAINT "recording_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_ent_created_idx" ON "call" USING btree ("enterprise_id","created_at");--> statement-breakpoint
CREATE INDEX "call_ent_lead_idx" ON "call" USING btree ("enterprise_id","lead_id");--> statement-breakpoint
CREATE INDEX "cb_ent_due_idx" ON "callback" USING btree ("enterprise_id","due_at");--> statement-breakpoint
CREATE INDEX "cb_ent_lead_idx" ON "callback" USING btree ("enterprise_id","lead_id");--> statement-breakpoint
CREATE INDEX "dnd_ent_phone_idx" ON "dnd_registry" USING btree ("enterprise_id","phone");--> statement-breakpoint
CREATE INDEX "rec_ent_call_idx" ON "recording" USING btree ("enterprise_id","call_id");