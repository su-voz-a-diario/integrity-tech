ALTER TABLE "assessment_versions" ADD COLUMN "retirement_reason" TEXT;
ALTER TABLE "item_versions" ADD COLUMN "retirement_reason" TEXT;
ALTER TABLE "norm_group_versions" ADD COLUMN "retirement_reason" TEXT;
ALTER TABLE "scoring_model_versions" ADD COLUMN "retirement_reason" TEXT;
ALTER TABLE "report_template_versions" ADD COLUMN "retirement_reason" TEXT;

CREATE OR REPLACE FUNCTION prevent_published_version_mutation()
RETURNS TRIGGER AS $$
DECLARE
  old_protected JSONB;
  new_protected JSONB;
BEGIN
  IF OLD.status IN ('PUBLISHED', 'ACTIVE') THEN
    old_protected := to_jsonb(OLD)
      - 'status'
      - 'retired_at'
      - 'effective_to'
      - 'retirement_reason'
      - 'updated_at';

    new_protected := to_jsonb(NEW)
      - 'status'
      - 'retired_at'
      - 'effective_to'
      - 'retirement_reason'
      - 'updated_at';

    IF NEW.status = 'RETIRED'
      AND NULLIF(BTRIM(COALESCE(NEW.retirement_reason, '')), '') IS NOT NULL
      AND old_protected = new_protected THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Published psychometric versions are immutable; create a new version instead.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'PUBLISHED' AND OLD.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Psychometric versions must be approved before publication.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'RETIRED'
    AND NULLIF(BTRIM(COALESCE(NEW.retirement_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Retiring a psychometric version requires retirement_reason.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assessment_versions_publication_immutability
BEFORE UPDATE ON "assessment_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_published_version_mutation();

CREATE TRIGGER item_versions_publication_immutability
BEFORE UPDATE ON "item_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_published_version_mutation();

CREATE TRIGGER norm_group_versions_publication_immutability
BEFORE UPDATE ON "norm_group_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_published_version_mutation();

CREATE TRIGGER scoring_model_versions_publication_immutability
BEFORE UPDATE ON "scoring_model_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_published_version_mutation();

CREATE TRIGGER report_template_versions_publication_immutability
BEFORE UPDATE ON "report_template_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_published_version_mutation();
