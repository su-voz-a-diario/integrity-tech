ALTER TABLE "organizations"
ADD COLUMN "domain" VARCHAR(255);

CREATE UNIQUE INDEX "organizations_domain_key"
ON "organizations"("domain");

ALTER TABLE "organizations"
ADD COLUMN "branding" JSONB;
