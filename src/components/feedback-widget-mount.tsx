import { createServerClient } from "@/lib/supabase/server";
import FeedbackWidget from "./feedback-widget";

/**
 * Server component that checks auth state and mounts the client
 * feedback widget only when a real user session exists. This keeps
 * unauthenticated marketing pages from rendering an interactive button
 * that would 401 on submit anyway.
 */
export default async function FeedbackWidgetMount() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <FeedbackWidget authenticated={!!user} />;
}
