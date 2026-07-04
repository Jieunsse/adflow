import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@shared/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "inverse"
  | "fb";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-1.5 border font-semibold leading-none tracking-[-0.002em] cursor-pointer transition-[background,border-color,color,box-shadow,transform] duration-[120ms] whitespace-nowrap disabled:cursor-not-allowed active:scale-[0.97]";

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12.5px] rounded-lg gap-[5px]",
  md: "h-10 px-[18px] text-[13.5px] rounded-[10px]",
  lg: "h-12 px-6 text-[15px] rounded-xl",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--w-primary-normal)] text-white border-transparent " +
    "hover:bg-[var(--w-primary-hover)] active:bg-[var(--w-primary-press)] " +
    "disabled:bg-[var(--w-bg-neutral)] disabled:text-[var(--w-fg-alternative)]",
  secondary:
    "bg-[var(--w-bg-elevated)] border-[var(--w-line-normal)] text-[var(--w-fg-strong)] " +
    "hover:bg-[var(--w-bg-neutral)] disabled:opacity-50",
  ghost:
    "bg-transparent border-transparent text-[var(--w-fg-strong)] " +
    "hover:bg-[var(--w-bg-neutral)] disabled:opacity-50",
  danger:
    "bg-[var(--w-status-negative)] text-white border-[var(--w-status-negative)] " +
    "hover:bg-[#cf3a3f] hover:border-[#cf3a3f]",
  inverse:
    "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-transparent " +
    "hover:bg-[var(--w-neutral-700)] disabled:opacity-50",
  fb:
    "h-[46px] px-[22px] gap-2 font-bold text-[13.5px] rounded-[10px] " +
    "bg-[var(--w-brand-facebook)] text-white border-[var(--w-brand-facebook)] " +
    "hover:bg-[var(--w-brand-facebook-hover)] hover:border-[var(--w-brand-facebook-hover)]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", block, className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        BASE,
        variant !== "fb" && SIZE[size],
        VARIANT[variant],
        block && "w-full",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

/** Link 같은 non-button 엘리먼트에 btn 스타일을 적용할 때 사용 */
export function buttonVariants({
  variant = "secondary",
  size = "md",
  block,
  className,
}: Partial<
  Pick<ButtonProps, "variant" | "size" | "block" | "className">
> = {}) {
  return cn(
    BASE,
    variant !== "fb" && SIZE[size],
    VARIANT[variant],
    block && "w-full",
    className,
  );
}
