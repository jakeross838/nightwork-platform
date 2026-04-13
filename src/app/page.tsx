import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  let connected = false;

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    // Simple connectivity check — a lightweight RPC call
    const { error } = await supabase.from("_dummy_health_check").select("*").limit(1);
    // 42501 = insufficient_privilege or PGRST116 = relation not found — both mean the DB responded
    connected = !error || error.code === "42501" || error.code === "PGRST116";
  } catch {
    connected = false;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white tracking-tight">
          Ross Command Center
        </h1>
        <p className="mt-4 text-lg text-gray-400">
          Invoice Processing &amp; Draw Generation
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Ross Built Custom Homes
        </p>
        <div className="mt-8 flex items-center justify-center gap-2">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              connected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-sm text-gray-400">
            {connected ? "Supabase connected" : "Supabase disconnected"}
          </span>
        </div>
      </div>
    </div>
  );
}
