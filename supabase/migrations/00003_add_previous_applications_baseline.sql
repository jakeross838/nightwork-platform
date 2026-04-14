-- 00003_add_previous_applications_baseline.sql
-- Adds previous_applications_baseline to budget_lines for historical draw data
-- that existed before the system (e.g., Drummond draws 1-7 = $1,354,766.61)

ALTER TABLE budget_lines
ADD COLUMN IF NOT EXISTS previous_applications_baseline BIGINT NOT NULL DEFAULT 0;
