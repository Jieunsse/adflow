"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@shared/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;

// ponytail: 단일 셸 가정 — .adflow 첫 매치. 멀티 셸 생기면 trigger 기준 ancestor 탐색으로 승급.
function adflowContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  return document.querySelector<HTMLElement>(".adflow") ?? undefined;
}

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal container={adflowContainer()}>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-[rgba(15,17,21,0.45)] dark:bg-[rgba(0,0,0,0.6)] grid place-items-center p-10 animate-[fadeIn_120ms_ease]">
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "bg-[var(--w-bg-elevated)] border border-[var(--w-line-alternative)] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.20)] max-w-[90vw] max-h-[90vh] overflow-auto animate-[popIn_140ms_ease] focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Overlay>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";
