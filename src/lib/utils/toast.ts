/**
 * Toast helper — Phase 8g.
 *
 * Convenience wrappers around the publish-side of the toast provider so any
 * file (server actions, hooks, helpers) can fire toasts without touching the
 * React context. The provider in `<ToastProvider>` subscribes and renders.
 */
import { publishToast } from "@/components/toast-provider";

export const toast = {
  success(message: string, durationMs?: number) {
    publishToast("success", message, durationMs);
  },
  error(message: string, durationMs?: number) {
    publishToast("error", message, durationMs);
  },
  warning(message: string, durationMs?: number) {
    publishToast("warning", message, durationMs);
  },
  info(message: string, durationMs?: number) {
    publishToast("info", message, durationMs);
  },
};
