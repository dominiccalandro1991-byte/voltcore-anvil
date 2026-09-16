import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 min-h-11 px-4 text-sm font-medium tracking-tight transition-[opacity,transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg rounded-full hover:opacity-90",
        secondary: "bg-surface text-fg rounded-full border border-border hover:border-fg/25",
        ghost: "bg-transparent text-muted rounded-full hover:text-fg hover:bg-raised",
        danger: "bg-danger/10 text-danger rounded-full border border-danger/30 hover:bg-danger/15",
      },
      size: {
        md: "h-11",
        sm: "h-10 min-h-10 px-3 text-xs",
        icon: "h-11 w-11 min-w-11 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
