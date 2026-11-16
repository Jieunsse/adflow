import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@shared/lib/cn"

// 상태 배지 (피그마 Status Badge). 색만으로 알리지 않도록 글자를 항상 넣는다.
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        blocked: "border-status-blocked-line bg-status-blocked-bg text-status-blocked-fg",
        waiting: "border-status-waiting-line bg-status-waiting-bg text-status-waiting-fg",
        progress: "border-status-progress-line bg-status-progress-bg text-status-progress-fg",
        done: "border-status-done-line bg-status-done-bg text-status-done-fg",
        quiet: "border-status-quiet-line bg-status-quiet-bg text-status-quiet-fg",
      },
    },
    defaultVariants: {
      variant: "quiet",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
