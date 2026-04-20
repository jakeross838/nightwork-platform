import { createServerClient } from "@/lib/supabase/server";
import SupportChatWidget from "./support-chat-widget";

/**
 * Server wrapper that checks auth state and mounts the client chat widget
 * only when a real user session exists. Mirrors the feedback widget mount
 * pattern — unauthenticated marketing pages never see the bubble.
 */
export default async function SupportChatMount() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <SupportChatWidget authenticated={!!user} />;
}
