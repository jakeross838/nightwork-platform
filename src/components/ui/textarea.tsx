import * as React from "react"
import TextareaAutosize, {
  type TextareaAutosizeProps,
} from "react-textarea-autosize"

import { cn } from "@/lib/utils"

// Nightwork Textarea primitive (Stage 1.5a, nwrp18-A).
//
// Wraps `react-textarea-autosize` so long-form content auto-grows up to a
// reasonable cap (12 rows ≈ 240px) before internal scroll kicks in. Replaces
// the prior shadcn `field-sizing-content` implementation, which was both
// browser-limited (Chrome 123+, Safari 17.4+, Firefox 130+) and capped at
// `min-h-16` (64px) with no max — long values silently spilled.
//
// Design tokens (per SYSTEM.md §1, §6, §12b):
//   bg     → --bg-subtle
//   border → --border-default (default), --nw-stone-blue (focus),
//            --color-error (aria-invalid)
//   text   → --text-primary
//   ph     → --text-secondary
//   muted  → --bg-muted (disabled bg)
//
// Square corners (`rounded-none`) per SYSTEM §6. Tighter 13px body to align
// with proposal/invoice form density. Default minRows=4 (~80px), maxRows=12
// (~240px). Consumers may pass `minRows`/`maxRows` (or `className`) overrides
// for site-specific density (e.g. `minRows={2}` for compact line-item rows
// or `minRows={6}` for the cover-letter editor).
//
// Ref forwarding: TextareaAutosize forwards refs natively; we re-forward via
// React.forwardRef so callers using `useRef<HTMLTextAreaElement>` work.

type TextareaProps = TextareaAutosizeProps &
  React.RefAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaAutosizeProps>(
  function Textarea(
    {
      className,
      minRows = 4,
      maxRows = 12,
      cacheMeasurements = true,
      ...props
    },
    ref,
  ) {
    return (
      <TextareaAutosize
        ref={ref}
        data-slot="textarea"
        minRows={minRows}
        maxRows={maxRows}
        cacheMeasurements={cacheMeasurements}
        className={cn(
          "flex w-full rounded-none px-3 py-2 text-[13px]",
          "border border-[var(--border-default)] bg-[var(--bg-subtle)]",
          "text-[color:var(--text-primary)]",
          "placeholder:text-[color:var(--text-secondary)]",
          "transition-colors outline-none",
          "focus:border-[var(--nw-stone-blue)] focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-[var(--bg-muted)]",
          "aria-invalid:border-[var(--color-error)]",
          className,
        )}
        {...props}
      />
    )
  },
)

export { Textarea }
export type { TextareaProps }
