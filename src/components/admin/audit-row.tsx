"use client";

import { useState } from "react";
import Link from "next/link";
import Badge from "@/components/nw/Badge";

type Row = {
  id: string;
  when: string;
  admin: string;
  action: string;
  actionVariant: "success" | "warning" | "danger" | "info" | "neutral" | "accent";
  target_org_id: string | null;
  target_org_name: string | null;
  target_user_id: string | null;
  target_user_email: string | null;
  target_record_type: string | null;
  target_record_id: string | null;
  details: unknown;
  reason: string | null;
};

export default function AuditRow({ row }: { row: Row }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = row.details !== null && row.details !== undefined;

  return (
    <>
      <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <td
          className="px-4 py-3 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          {row.when}
        </td>
        <td
          className="px-4 py-3 text-xs"
          style={{ color: "var(--text-primary)" }}
        >
          {row.admin}
        </td>
        <td className="px-4 py-3">
          <Badge variant={row.actionVariant}>{row.action}</Badge>
        </td>
        <td className="px-4 py-3 text-xs">
          {row.target_org_id ? (
            <Link
              href={`/admin/platform/organizations/${row.target_org_id}`}
              className="underline underline-offset-2"
              style={{ color: "var(--text-primary)" }}
            >
              {row.target_org_name ?? row.target_org_id.slice(0, 8)}
            </Link>
          ) : null}
          {row.target_user_id ? (
            <>
              {row.target_org_id ? " · " : ""}
              <Link
                href={`/admin/platform/users/${row.target_user_id}`}
                className="underline underline-offset-2"
                style={{ color: "var(--text-primary)" }}
              >
                {row.target_user_email ?? row.target_user_id.slice(0, 8)}
              </Link>
            </>
          ) : null}
          {row.target_record_type ? (
            <span style={{ color: "var(--text-tertiary)" }}>
              {" "}
              · {row.target_record_type}{" "}
              {row.target_record_id?.slice(0, 8) ?? ""}
            </span>
          ) : null}
          {!row.target_org_id &&
            !row.target_user_id &&
            !row.target_record_type && (
              <span style={{ color: "var(--text-tertiary)" }}>—</span>
            )}
        </td>
        <td
          className="px-4 py-3 text-xs max-w-[340px] truncate"
          style={{ color: "var(--text-secondary)" }}
          title={row.reason ?? ""}
        >
          {row.reason ?? "—"}
        </td>
        <td className="px-4 py-3 text-right">
          {hasDetails ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs underline"
              style={{ color: "var(--nw-stone-blue)" }}
            >
              {expanded ? "Hide" : "Details"}
            </button>
          ) : null}
        </td>
      </tr>
      {expanded && hasDetails ? (
        <tr
          className="border-b"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <td colSpan={6} className="px-4 py-3">
            <pre
              className="text-xs p-3 border overflow-x-auto"
              style={{
                background: "var(--bg-page)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              {JSON.stringify(row.details, null, 2)}
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}
