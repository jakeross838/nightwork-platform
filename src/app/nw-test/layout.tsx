import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

/**
 * /nw-test is an internal design-system reference page. Gate at the layout
 * so the entire route tree (including any future subpages) is owner/admin
 * only. Non-members and non-admins are bounced to the dashboard.
 */
export default async function NwTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getCurrentMembership();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
