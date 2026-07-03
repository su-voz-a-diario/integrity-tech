ALTER TABLE "audit_events" DROP CONSTRAINT IF EXISTS "audit_events_organization_id_fkey";

ALTER TABLE "audit_events" ALTER COLUMN "organization_id" DROP NOT NULL;

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
