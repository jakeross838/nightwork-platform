-- F-006 fix: track cumulative CO work completed in pre-Nightwork pay apps.
-- Maps to the G703 "PCCO from Previous Applications" total_to_date row.
-- For jobs that start in Nightwork this stays 0 — CO work flows naturally
-- through draw_line_items with source_type='change_order'.

ALTER TABLE jobs
ADD COLUMN previous_co_completed_amount bigint DEFAULT 0;

COMMENT ON COLUMN jobs.previous_co_completed_amount IS
'Cents. Cumulative CO work completed in pay apps before Nightwork managed draws. Maps to G703 "PCCO from Previous Applications" row. Zero for jobs originating in Nightwork.';
