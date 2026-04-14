"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/**
 * Pings Supabase every 30s. If the ping fails (network error, DNS, 500, etc.)
 * a sticky red banner appears at the top telling the user their changes may
 * not be saved. Clears automatically on recovery.
 */
export default function ConnectionBanner() {
  const [offline, setOffline] = useState(false);
  const [lastErrorAt, setLastErrorAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    let failures = 0;

    async function ping() {
      try {
        // `cost_codes` is public/static — cheapest table to ping.
        const { error } = await supabase
          .from("cost_codes")
          .select("id", { head: true, count: "exact" })
          .limit(1);
        if (cancelled) return;
        if (error) throw error;
        // Success — clear the banner.
        failures = 0;
        setOffline(false);
      } catch (err) {
        if (cancelled) return;
        failures += 1;
        // Only surface after two consecutive failures to avoid flickering
        // on transient blips.
        if (failures >= 2) {
          setOffline(true);
          setLastErrorAt(new Date());
        }
        // eslint-disable-next-line no-console
        console.warn("[connection ping]", err);
      }
    }

    // Run now + every 30s. The first failure won't trigger the banner
    // (failures must reach 2), which suppresses brief network hiccups.
    ping();
    const interval = setInterval(ping, 30_000);

    // Also listen to navigator online/offline events — instant signal.
    const goOffline = () => {
      setOffline(true);
      setLastErrorAt(new Date());
    };
    const goOnline = () => {
      // Re-verify before clearing.
      ping();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[60] bg-status-danger text-white text-center text-sm py-2 px-4 shadow-md"
    >
      <strong className="font-semibold">Database connection lost</strong>
      <span className="mx-2 opacity-80">·</span>
      <span>Your changes may not be saved. Check your network.</span>
      {lastErrorAt && (
        <span className="ml-2 opacity-70 text-xs">
          (last check {lastErrorAt.toLocaleTimeString()})
        </span>
      )}
    </div>
  );
}
