-- WI-M-1: optional cleanup for import_error invoice rows older than 7 days.
-- No cron is wired yet; callable ad-hoc by admin SQL or future background
-- job. Keeps orphan storage from accumulating forever.
--
-- Storage objects themselves are not deleted — those require the service
-- role's storage.objects access. A follow-up migration can extend this
-- function once storage cleanup API is available.

CREATE OR REPLACE FUNCTION app_private.cleanup_stale_import_errors(
  p_older_than_days integer DEFAULT 7
)
RETURNS TABLE (invoices_soft_deleted integer) AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.invoices
  SET deleted_at = now()
  WHERE status = 'import_error'
    AND deleted_at IS NULL
    AND created_at < now() - make_interval(days => p_older_than_days);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_private.cleanup_stale_import_errors IS
'Soft-deletes invoices rows stuck in import_error status for more than N days. Ad-hoc cleanup; cron hookup deferred.';

REVOKE ALL ON FUNCTION app_private.cleanup_stale_import_errors FROM public;
GRANT EXECUTE ON FUNCTION app_private.cleanup_stale_import_errors TO service_role;
