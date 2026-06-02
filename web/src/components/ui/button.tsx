import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Verlet button: pink highlight is the primary CTA. rounded-lg, 12px medium text,
// soft pink focus ring, subtle press scale. Keeps the app's existing variant names.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[12px] font-medium font-sans transition-[color,background-color,border-color,box-shadow,transform,opacity] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-highlight/25 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-highlight text-highlight-foreground hover:bg-highlight/90",
        highlight: "bg-highlight text-highlight-foreground hover:bg-highlight/90",
        secondary: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-hover",
        ghost: "text-muted-foreground hover:bg-hover hover:text-foreground",
        danger:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-foreground underline-offset-4 hover:text-highlight hover:underline",
      },
      size: {
        default: "h-[38px] px-4",
        sm: "h-8 gap-1.5 px-3",
        lg: "h-10 px-6",
        icon: "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
