import { NextResponse } from "next/server";

/**
 * Throw from a route to return a structured JSON error with a specific HTTP status.
 * Preserves the message for the client without leaking internal stack traces.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

/**
 * Wrap a Next.js route handler with a uniform try/catch:
 *   - ApiError → { error: message } with the supplied status
 *   - Any other Error → { error: "Internal server error" } with 500, logs the cause
 *
 * Usage:
 *   export const POST = withApiError(async (req) => {
 *     ...
 *     return NextResponse.json({ ok: true });
 *   });
 */
type Handler<A extends unknown[]> = (...args: A) => Promise<Response>;

export function withApiError<A extends unknown[]>(handler: Handler<A>): Handler<A> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      // Never send raw stack traces to clients.
      const message =
        err instanceof Error ? err.message : "Unknown server error";
      console.error("[api] unhandled error:", err);
      return NextResponse.json(
        { error: `Internal server error: ${message}` },
        { status: 500 }
      );
    }
  };
}
