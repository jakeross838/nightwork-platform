"use client";

import { createBrowserClient } from "@supabase/ssr";

// Single shared browser client — cookies are synchronized so auth state
// persists across navigation and is readable by the Next.js middleware.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
