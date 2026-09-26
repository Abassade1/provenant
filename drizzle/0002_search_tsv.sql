-- Keep canonical_job.search_tsv in sync. Title weighted above skills above description.
CREATE OR REPLACE FUNCTION canonical_job_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW.skills, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.city, '') || ' ' || coalesce(NEW.province, '')), 'C') ||
    setweight(to_tsvector('english', left(coalesce(NEW.description, ''), 20000)), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER canonical_job_tsv_trg
  BEFORE INSERT OR UPDATE OF title, skills, city, province, description ON canonical_job
  FOR EACH ROW EXECUTE FUNCTION canonical_job_tsv_update();
