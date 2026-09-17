import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 min-h-11 px-4 text-sm font-medium tracking-wide transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary/90 rounded-sm",
        secondary: "bg-surface text-fg rounded-sm border border-border hover:border-fg/25",
        ghost: "bg-transparent text-fg border border-border hover:bg-raised rounded-sm",
        danger: "bg-danger text-fg hover:bg-danger/90 rounded-sm",
        quiet: "bg-raised text-fg hover:bg-surface border border-border rounded-sm",
      },
      size: {
        md: "h-11",
        sm: "h-10 min-h-10 px-3 text-xs",
        icon: "h-11 w-11 min-w-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
