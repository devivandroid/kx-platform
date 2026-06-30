ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS arc_job_id TEXT;

CREATE INDEX IF NOT EXISTS requests_arc_job_id_idx
  ON requests (arc_job_id);

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS arc_identity_id TEXT,
  ADD COLUMN IF NOT EXISTS identity_source TEXT;
